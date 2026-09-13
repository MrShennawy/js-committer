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

const providerName = (provider) => provider.label.split(' (')[0];

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

/** Network trouble is not the same as a credential being wrong. */
const isUnreachable = (err) => (
    /fetch failed|ENOTFOUND|ECONNREFUSED|did not answer|no Ollama server/i.test(err.message)
);

/**
 * Checks a credential by asking the provider which models it offers.
 *
 * Listing is the right question: it proves the credential works without
 * depending on any one model being available to this account, and it returns
 * the list needed for the next step. Generating with an assumed model instead
 * reports a perfectly good key as rejected the moment that model is not
 * enabled, which is exactly what used to happen.
 *
 * @returns {Promise<{valid: boolean, reason: string|null, offline?: boolean, models?: string[]}>}
 */
export const validateKey = async (provider, apiKey, {baseUrl} = {}) => {
    try {
        const models = await provider.listModels({apiKey, baseUrl});
        return {valid: true, reason: null, models};
    } catch (err) {
        if (isUnreachable(err)) return {valid: false, reason: err.message, offline: true};
        return {valid: false, reason: err.message};
    }
}

/**
 * Verifies a key and stores it.
 * @returns {Promise<{key: string, models: string[]}|null>}
 */
const acceptKey = async (provider, key, extras = {}) => {
    const spinner = ora(`Checking the ${providerName(provider)} key ... \n`).start();
    const {valid, reason, offline, models} = await validateKey(provider, key, extras);

    if (valid || offline) {
        spinner.text = valid
            ? chalk.green('The key works.')
            : chalk.yellow('Could not reach the provider to verify the key, saving it anyway.');
        valid ? spinner.succeed() : spinner.warn();

        write({provider: provider.id, keys: {[provider.id]: key}, aiDisabled: false});
        return {key, models: models ?? []};
    }

    spinner.text = chalk.red(`The key was rejected: ${reason}`);
    spinner.fail();
    return null;
}

/**
 * Asks which model to use, from the list the provider really offers.
 *
 * Model availability differs by key, by account and, for a local server, by
 * what has been pulled, so assuming a default is how you end up with a 404
 * that reads like a broken key.
 *
 * @param {object} provider
 * @param {{apiKey?: string, baseUrl?: string, models?: string[]}} options
 *   models, when given, is a list already fetched while verifying the key
 * @returns {Promise<string|null>} the chosen model, or null to keep the default
 */
export const chooseModel = async (provider, {apiKey, baseUrl, models: known = null} = {}) => {
    if (typeof provider.listModels !== 'function') return null;

    let models = known?.length ? known : null;

    if (!models) {
        const spinner = ora('Looking up the available models ... \n').start();

        try {
            models = await provider.listModels({apiKey, baseUrl});
            spinner.stop();
        } catch (err) {
            spinner.text = chalk.yellow(`Could not list the models: ${err.message}`);
            spinner.warn();

            if (provider.local) {
                console.log(chalk.dim(` Pull one with ${chalk.cyan('ollama pull llama3.2')} and run ${chalk.cyan('cmt --setup')} again.\n`));
            }
            return null;
        }
    }

    if (!models.length) {
        console.log(chalk.yellow('\n That provider reported no usable models.'));

        if (provider.local) {
            console.log(chalk.dim(` Install one with ${chalk.cyan('ollama pull llama3.2')}, then run ${chalk.cyan('cmt --setup')} again.\n`));
        }
        return null;
    }

    // Offer the provider's own default first, but only when it is genuinely
    // available; otherwise it is just the wrong answer at the top of the list.
    const ordered = models.includes(provider.defaultModel)
        ? [provider.defaultModel, ...models.filter(name => name !== provider.defaultModel)]
        : models;

    const {model} = await inquirer.prompt([{
        type: 'list',
        name: 'model',
        pageSize: 12,
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: `Which model? ${chalk.dim(`(${models.length} available)`)}`,
        choices: ordered.map(name => ({
            value: name,
            name: name === provider.defaultModel ? `${name} ${chalk.dim('(suggested)')}` : name,
            short: name,
        })),
    }]);

    return model;
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
        label: `a ${providerName(provider)} key`,
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

    const typed = await askSecret(`Paste your ${providerName(provider)} key:`);
    if (typed && provider.loosePattern && !provider.loosePattern.test(typed)) {
        console.log(chalk.yellow(`\n That does not look like a key for this provider (${provider.keyHint}), checking it anyway.`));
    }

    return typed;
}

/** Confirms a local provider is reachable and picks one of its models. */
const setupLocalProvider = async (provider, {baseUrl} = {}) => {
    console.log(chalk.dim(`\n ${provider.label}`));

    const spinner = ora('Looking for the local models ... \n').start();
    const {valid, reason, models} = await validateKey(provider, null, {baseUrl});

    if (!valid) {
        spinner.text = chalk.yellow(`Could not reach it: ${reason}`);
        spinner.warn();
        console.log(chalk.dim(` Saved anyway; it will be used once the server is running.\n`));
        write({provider: provider.id, aiDisabled: false});
        return true;
    }

    spinner.stop();

    const model = await chooseModel(provider, {baseUrl, models});
    write({provider: provider.id, aiDisabled: false, ...(model ? {model} : {})});

    if (model) console.log(chalk.green(`\n Using ${model}.\n`));
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
    const baseUrl = loadConfig().ai.baseUrl ?? read().baseUrl ?? null;

    if (!provider.needsKey) {
        await setupLocalProvider(provider, {baseUrl});
        return {provider, apiKey: null};
    }

    const key = await collectKey(provider);
    if (!key) {
        disableAi();
        return null;
    }

    const accepted = await acceptKey(provider, key, {baseUrl});
    if (!accepted) return null;

    const model = await chooseModel(provider, {apiKey: accepted.key, baseUrl, models: accepted.models});
    if (model) write({model});

    return {provider, apiKey: accepted.key, model};
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

    return {
        ...settings,
        provider: result.provider,
        apiKey: result.apiKey,
        model: result.model ?? settings.model,
    };
}

/**
 * Clears the stored key for the active provider.
 * @returns {boolean} false when the key in force came from the environment,
 *   which this tool did not write and must not claim to have removed
 */
export const clearApiKey = () => {
    const provider = activeProvider();
    if (envKey(provider)) return false;

    write({keys: {[provider.id]: null}});
    return true;
}

/**
 * The provider a key belongs to, read from its shape.
 *
 * Without this, `cmt --set-key sk-ant-...` is checked against whichever
 * provider happens to be active, and a perfectly good key is reported as
 * rejected because it was sent to the wrong API.
 */
export const providerForKey = (key) => (
    providerList().find(provider => provider.keyPattern?.test(key))
    ?? providerList().find(provider => provider.loosePattern?.test(key))
    ?? null
);

/** Stores a key given on the command line, after verifying it. */
export const setApiKeyDirectly = async (key) => {
    const trimmed = key.trim();
    const baseUrl = loadConfig().ai.baseUrl ?? null;

    // A project that names its provider has made the choice for everyone; only
    // fall back to reading the key's shape when it has not.
    const provider = loadConfig().ai.provider
        ? activeProvider()
        : (providerForKey(trimmed) ?? activeProvider());

    const accepted = await acceptKey(provider, trimmed, {baseUrl});
    return accepted ? accepted.key : null;
}

export const ENV_VARIABLE_NAMES = providerList().flatMap(provider => provider.envNames ?? []);
