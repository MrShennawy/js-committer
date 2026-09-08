import chalk from "chalk";
import ora from "ora";
import inquirer from "../prompts/register.js";
import {readSettings, writeSettings} from "../store/handler.js";
import {maskSecret, secretFromText, offerFromClipboard, askSecret, openPageAndWaitForCopy} from "../support/secretSetup.js";

const STORE = 'GoogleGenerativeAI';
const KEY_PAGE = 'https://aistudio.google.com/app/apikey';
const VALIDATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// The names other Google tooling already uses, so an existing key just works.
const ENV_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];

// Google AI Studio keys are "AIza" followed by 35 url-safe characters.
const STRICT_KEY = /^AIza[0-9A-Za-z_-]{35}$/;
const LOOSE_KEY = /^AIza[0-9A-Za-z_-]{20,60}$/;

/** Shows only the first and last characters, never the whole secret. */
export const maskKey = (key) => maskSecret(key);

const isKey = (value, {strict = true} = {}) => (strict ? STRICT_KEY : LOOSE_KEY).test(value);

/** Picks a key-looking string out of arbitrary clipboard content. */
export const keyFromText = (text, {strict = true} = {}) => secretFromText(text, (value) => isKey(value, {strict}));

const envKey = () => {
    for (const name of ENV_NAMES) {
        const value = process.env[name]?.trim();
        if (value) return value;
    }
    return null;
}

/**
 * Checks a key against the models endpoint before it is stored, so an invalid
 * key is reported here instead of halfway through a commit.
 *
 * @returns {Promise<{valid: boolean, reason: string|null}>}
 */
export const validateKey = async (key) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        // The key travels as a header rather than in the URL, so it cannot end
        // up in a proxy or server access log.
        const response = await fetch(VALIDATE_URL, {
            headers: {'x-goog-api-key': key},
            signal: controller.signal,
        });

        if (response.ok) return {valid: true, reason: null};

        const body = await response.json().catch(() => null);
        const message = body?.error?.message ?? `HTTP ${response.status}`;

        if (response.status === 400 || response.status === 401 || response.status === 403) {
            return {valid: false, reason: message};
        }

        return {valid: false, reason: `Could not verify the key right now (${message})`};
    } catch (err) {
        // No network is not the same as a bad key: let the caller keep it.
        const reason = err.name === 'AbortError' ? 'the request timed out' : err.message;
        return {valid: false, reason: `offline: ${reason}`, offline: true};
    } finally {
        clearTimeout(timer);
    }
}

/** Verifies a key, stores it when it is good, and reports what happened. */
const acceptKey = async (key) => {
    const spinner = ora('Checking the key ... \n').start();
    const {valid, reason, offline} = await validateKey(key);

    if (valid) {
        spinner.text = chalk.green('The key works.');
        spinner.succeed();
        writeSettings(STORE, {apiKey: key, aiDisabled: false});
        return key;
    }

    if (offline) {
        // Storing it anyway is kinder than losing a key the user just pasted.
        spinner.text = chalk.yellow('Could not reach Google to verify the key, saving it anyway.');
        spinner.warn();
        writeSettings(STORE, {apiKey: key, aiDisabled: false});
        return key;
    }

    spinner.text = chalk.red(`The key was rejected: ${reason}`);
    spinner.fail();
    return null;
}

const disableAi = () => {
    writeSettings(STORE, {apiKey: null, aiDisabled: true});
    console.log(chalk.dim(`\n Continuing without AI. Run ${chalk.cyan('cmt --setup')} whenever you want to enable it.\n`));
}

/**
 * Walks the user through getting a key, in as few keystrokes as possible.
 * @returns {Promise<string|null>} the key, or null when the user opts out
 */
export const setupApiKey = async () => {
    console.log(chalk.inverse(' Committer can write your commit messages with Google Gemini. '));
    console.log(chalk.dim(' The free tier is enough for everyday use.\n'));

    // The key is usually already copied, so offer that before anything else.
    const fromClipboard = await offerFromClipboard({
        label: 'a Google API key',
        detect: (value) => isKey(value),
    });

    if (fromClipboard) {
        const accepted = await acceptKey(fromClipboard);
        if (accepted) return accepted;
    }

    const {choice} = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'How would you like to set it up?',
        choices: [
            {value: 'browser', name: 'Open the API key page in my browser'},
            {value: 'paste', name: 'Paste a key I already have'},
            {value: 'skip', name: 'Continue without AI'},
        ],
    }]);

    if (choice === 'skip') {
        disableAi();
        return null;
    }

    if (choice === 'browser') {
        const copied = await openPageAndWaitForCopy({
            url: KEY_PAGE,
            instruction: 'Create a key there and press the copy button.',
            detect: (value) => isKey(value),
        });

        if (copied) {
            const accepted = await acceptKey(copied);
            if (accepted) return accepted;
        } else {
            console.log(chalk.dim('\n Nothing key-shaped in the clipboard, paste it below instead.'));
        }
    }

    const typed = await askSecret('Paste your Google API key:');
    if (!typed) {
        disableAi();
        return null;
    }

    if (!isKey(typed, {strict: false})) {
        console.log(chalk.yellow("\n That does not look like a Google API key (they start with 'AIza'), checking it anyway."));
    }

    return acceptKey(typed);
}

/**
 * Finds the key to use, asking only when there is no other way to get one.
 *
 * Order: environment variable, stored key, then the setup walkthrough. Returns
 * null when the user has opted out or when nobody is there to answer, in which
 * case the caller falls back to a message built without the model.
 *
 * @returns {Promise<string|null>}
 */
export const resolveApiKey = async ({interactive = true} = {}) => {
    const fromEnv = envKey();
    if (fromEnv) return fromEnv;

    const settings = readSettings(STORE);
    if (settings.apiKey) return settings.apiKey;
    if (settings.aiDisabled) return null;

    // Never block a non-interactive run, such as CI or a piped invocation.
    if (!interactive || !process.stdin.isTTY) return null;

    return setupApiKey();
}

/** Clears the stored key, used when Google reports it as invalid. */
export const clearApiKey = () => writeSettings(STORE, {apiKey: null, aiDisabled: false});

/** Stores a key given on the command line, after verifying it. */
export const setApiKeyDirectly = async (key) => acceptKey(key.trim());

export const ENV_VARIABLE_NAMES = ENV_NAMES;
export const API_KEY_PAGE = KEY_PAGE;
