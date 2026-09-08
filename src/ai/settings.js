import chalk from "chalk";
import ora from "ora";
import inquirer from "../prompts/register.js";
import {readSettings, writeSettings} from "../store/handler.js";
import {maskSecret, secretFromText, offerFromClipboard, askSecret, openPageAndWaitForCopy} from "../support/secretSetup.js";
import {getProvider, providerList, DEFAULT_PROVIDER} from "./providers/index.js";
import loadConfig from "../support/config.js";

const STORE = 'ai';
// Where the Gemini key lived before there were several providers.
const LEGACY_STORE = 'GoogleGenerativeAI';

/** Shows only the first and last characters, never the whole secret. */
export const maskKey = (key) => maskSecret(key);

/** Picks a key-looking string for a given provider out of arbitrary text. */
export const keyFromText = (text, provider, {strict = true} = {}) => {
    const pattern = strict ? provider?.keyPattern : (provider?.loosePattern ?? provider?.keyPattern);
    if (!pattern) return null;

    return secretFromText(text, (value) => pattern.test(value));
}

const read = () => {
    const stored = readSettings(STORE);

    // One time move of the key saved before providers existed.
    if (!stored.keys) {
        const legacy = readSettings(LEGACY_STORE);
        if (legacy.apiKey) {
            const migrated = {provider: DEFAULT_PROVIDER, keys: {[DEFAULT_PROVIDER]: legacy.apiKey}, aiDisabled: false};
            writeSettings(STORE, migrated);
            writeSettings(LEGACY_STORE, {});
            return migrated;
        }

        return {...stored, keys: {}};
    }

    return stored;
}

const write = (changes) => {
    const current = read();
    writeSettings(STORE, {...current, ...changes, keys: {...current.keys, ...(changes.keys ?? {})}});
}

/** The provider in force: the project's choice first, then the user's. */
export const activeProvider = () => {
    const fromConfig = loadConfig().ai.provider;
    if (fromConfig) return getProvider(fromConfig);

    return getProvider(read().provider ?? DEFAULT_PROVIDER);
}

const envKey = (provider) => {
    for (const name of provider.envNames ?? []) {
        const value = process.env[name]?.trim();
        if (value) return value;
    }
    return null;
}

/**
 * Checks a key by asking the provider to generate one token.
 * @returns {Promise<{valid: boolean, reason: string|null, offline?: boolean}>}
 */
export const validateKey = async (provider, apiKey, {model, baseUrl} = {}) => {
    try {
        await provider.generate({prompt: 'Reply with the single word: ok', apiKey, model, baseUrl});
        return {valid: true, reason: null};
    } catch (err) {
        // Being unable to reach the service is not the same as a bad key.
        if (/fetch failed|ENOTFOUND|ECONNREFUSED|did not answer/i.test(err.message)) {
            return {valid: false, reason: err.message, offline: true};
        }
        return {valid: false, reason: err.message};
    }
}

const acceptKey = async (provider, key, extras = {}) => {
    const spinner = ora(`Checking the ${provider.label.split(' (')[0]} key ... \n`).start();
    const {valid, reason, offline} = await validateKey(provider, key, extras);

    if (valid || offline) {
        spinner.text = valid
            ? chalk.green('The key works.')
            : chalk.yellow('Could not reach the provider to verify the key, saving it anyway.');
        valid ? spinner.succeed() : spinner.warn();

        write({provider: provider.id, keys: {[provider.id]: key}, aiDisabled: false, ...extras});
        return key;
    }

    spinner.text = chalk.red(`The key was rejected: ${reason}`);
    spinner.fail();
    return null;
}

const disableAi = () => {
    write({aiDisabled: true});
    console.log(chalk.dim(`\n Continuing without AI. Run ${chalk.cyan('cmt --setup')} whenever you want to enable it.\n`));
}

const chooseProvider = async () => {
    const {choice} = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'Which model should write your commit messages?',
        choices: [
            ...providerList().map(provider => ({value: provider.id, name: provider.label})),
            new inquirer.Separator(),
            {value: null, name: 'Continue without AI'},
        ],
    }]);

    return choice;
}

/** Collects a key for a hosted provider, preferring the clipboard. */
const collectKey = async (provider) => {
    const fromClipboard = await offerFromClipboard({
        label: `a ${provider.label.split(' (')[0]} key`,
        detect: (value) => Boolean(provider.keyPattern?.test(value)),
    });
    if (fromClipboard) return fromClipboard;

    const {choice} = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'How would you like to provide the key?',
        choices: [
            {value: 'browser', name: 'Open the API key page in my browser'},
            {value: 'paste', name: 'Paste a key I already have'},
            {value: 'skip', name: 'Continue without AI'},
        ],
    }]);

    if (choice === 'skip') return null;

    if (choice === 'browser') {
        const copied = await openPageAndWaitForCopy({
            url: provider.keyPage,
            instruction: 'Create a key there and press the copy button.',
            detect: (value) => Boolean(provider.keyPattern?.test(value)),
        });

        if (copied) return copied;
        console.log(chalk.dim('\n Nothing key-shaped in the clipboard, paste it below instead.'));
    }

    const typed = await askSecret(`Paste your ${provider.label.split(' (')[0]} key:`);
    if (typed && provider.loosePattern && !provider.loosePattern.test(typed)) {
        console.log(chalk.yellow(`\n That does not look like a key for this provider (${provider.keyHint}), checking it anyway.`));
    }

    return typed;
}

/** Confirms a local provider is reachable; there is no key to collect. */
const setupLocalProvider = async (provider) => {
    console.log(chalk.dim(`\n ${provider.label}`));
    console.log(chalk.dim(` Using model ${chalk.cyan(provider.defaultModel)}. Change it with "ai": {"model": "..."} in .committerrc.\n`));

    const spinner = ora('Looking for the local model ... \n').start();
    const {valid, reason} = await validateKey(provider, null, {});

    if (valid) {
        spinner.text = chalk.green('The local model answered.');
        spinner.succeed();
    } else {
        spinner.text = chalk.yellow(`Could not reach it: ${reason}`);
        spinner.warn();
        console.log(chalk.dim(' Saved anyway; it will be used once the server is running.\n'));
    }

    write({provider: provider.id, aiDisabled: false});
    return true;
}

/**
 * Walks the user through choosing a model and, when it needs one, a key.
 * @returns {Promise<object|null>} the settings to use, or null when opted out
 */
export const setupAi = async () => {
    console.log(chalk.inverse(' Committer can write your commit messages for you. '));

    const choice = await chooseProvider();
    if (!choice) {
        disableAi();
        return null;
    }

    const provider = getProvider(choice);

    if (!provider.needsKey) {
        await setupLocalProvider(provider);
        return {provider, apiKey: null};
    }

    const key = await collectKey(provider);
    if (!key) {
        disableAi();
        return null;
    }

    const accepted = await acceptKey(provider, key);
    return accepted ? {provider, apiKey: accepted} : null;
}

/**
 * Finds the model settings to use.
 * Order: the environment, then stored settings, then the walkthrough.
 *
 * @returns {Promise<{provider: object, apiKey: string|null, model: string|null, baseUrl: string|null}|null>}
 */
export const resolveAi = async ({interactive = true} = {}) => {
    const config = loadConfig();
    const provider = activeProvider();
    const stored = read();

    const settings = {
        provider,
        apiKey: null,
        model: config.ai.model ?? stored.model ?? null,
        baseUrl: config.ai.baseUrl ?? stored.baseUrl ?? null,
    };

    // A local model has nothing to authenticate.
    if (!provider.needsKey) return settings;

    const key = envKey(provider) ?? stored.keys?.[provider.id] ?? null;
    if (key) return {...settings, apiKey: key};

    if (stored.aiDisabled) return null;
    if (!interactive || !process.stdin.isTTY) return null;

    const result = await setupAi();
    if (!result) return null;

    return {...settings, provider: result.provider, apiKey: result.apiKey};
}

/** Clears the stored key for the active provider. */
export const clearApiKey = () => {
    const provider = activeProvider();
    write({keys: {[provider.id]: null}});
}

/** Stores a key given on the command line, after verifying it. */
export const setApiKeyDirectly = async (key) => acceptKey(activeProvider(), key.trim());

export const ENV_VARIABLE_NAMES = providerList().flatMap(provider => provider.envNames ?? []);
