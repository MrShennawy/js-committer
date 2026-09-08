import chalk from "chalk";
import ora from "ora";
import inquirer from "../prompts/register.js";
import {readSettings, writeSettings} from "../store/handler.js";
import {offerFromClipboard, askSecret, openPageAndWaitForCopy, maskSecret} from "../support/secretSetup.js";
import config from "../git/config.js";

const STORE = 'jira';
const TOKEN_PAGE = 'https://id.atlassian.com/manage-profile/security/api-tokens';

const ENV_NAMES = {
    host: ['JIRA_HOST', 'JIRA_BASE_URL'],
    email: ['JIRA_EMAIL', 'JIRA_USER_EMAIL'],
    token: ['JIRA_API_TOKEN', 'JIRA_TOKEN'],
};

// Atlassian tokens issued today start with ATATT, scoped ones with ATCTT.
const STRICT_TOKEN = /^AT[AC]TT[A-Za-z0-9_\-=.]{20,}$/;
const LOOSE_TOKEN = /^[A-Za-z0-9_\-=.]{16,}$/;

const isToken = (value, {strict = true} = {}) => (strict ? STRICT_TOKEN : LOOSE_TOKEN).test(value);

/**
 * Accepts anything the user might paste and reduces it to a bare host.
 * "https://acme.atlassian.net/jira/software/projects/AB/boards/1" -> "acme.atlassian.net"
 */
export const normaliseHost = (value) => {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return '';

    const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, '');
    return withoutScheme.split('/')[0].replace(/\/+$/, '').toLowerCase();
}

const fromEnv = (names) => {
    for (const name of names) {
        const value = process.env[name]?.trim();
        if (value) return value;
    }
    return null;
}

/** Credentials taken wholly from the environment, or null when incomplete. */
const envCredentials = () => {
    const host = fromEnv(ENV_NAMES.host);
    const email = fromEnv(ENV_NAMES.email);
    const token = fromEnv(ENV_NAMES.token);

    if (!host || !email || !token) return null;
    return {host: normaliseHost(host), email, token, verified: true};
}

/**
 * Checks the credentials by asking Jira who we are.
 * Imported lazily so that this module can be loaded without pulling in the
 * API client, which keeps the credential resolution testable.
 */
const verify = async (credentials) => {
    const {getCurrentUser} = await import('./handler.js');

    try {
        const user = await getCurrentUser(credentials);
        return {valid: true, name: user?.displayName ?? null, reason: null};
    } catch (err) {
        return {valid: false, name: null, reason: err.message};
    }
}

const askHost = async (current) => {
    const {host} = await inquirer.prompt([{
        type: 'default-editable-input',
        name: 'host',
        default: current || null,
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        hint: `Paste any Jira URL, for example ${chalk.yellow('https://acme.atlassian.net/browse/AB-1')}`,
        message: 'Your Jira address:',
    }]);

    return normaliseHost(host);
}

const askEmail = async (current) => {
    // The git email is almost always the Jira email too, so it is offered first.
    const suggestion = current || config.get('user.email');

    const {email} = await inquirer.prompt([{
        type: 'default-editable-input',
        name: 'email',
        default: suggestion || null,
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        hint: suggestion ? 'Taken from your git config, press Enter to accept' : undefined,
        message: 'Your Jira email:',
    }]);

    return email?.trim() || null;
}

/** Collects the API token, preferring whatever is already on the clipboard. */
const askToken = async () => {
    const fromClipboard = await offerFromClipboard({
        label: 'a Jira API token',
        detect: (value) => isToken(value),
    });
    if (fromClipboard) return fromClipboard;

    const {choice} = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'How would you like to provide the API token?',
        choices: [
            {value: 'browser', name: 'Open the Atlassian token page in my browser'},
            {value: 'paste', name: 'Paste a token I already have'},
            {value: 'skip', name: 'Cancel'},
        ],
    }]);

    if (choice === 'skip') return null;

    if (choice === 'browser') {
        const copied = await openPageAndWaitForCopy({
            url: TOKEN_PAGE,
            instruction: "Choose 'Create API token', give it any label, then copy it.",
            detect: (value) => isToken(value),
        });

        if (copied) return copied;
        console.log(chalk.dim('\n Nothing token-shaped in the clipboard, paste it below instead.'));
    }

    return askSecret('Paste your Jira API token:');
}

const disableJira = () => {
    writeSettings(STORE, {jiraDisabled: true});
    console.log(chalk.dim(`\n Jira is off. Run ${chalk.cyan('cmt --setup')} whenever you want to connect it.\n`));
}

/**
 * Walks the user through connecting Jira, retrying on bad credentials rather
 * than discarding them and exiting.
 *
 * @returns {Promise<object|null>} verified credentials, or null when cancelled
 */
export const setupJira = async ({attempts = 3} = {}) => {
    console.log(chalk.inverse(' Connect Jira to attach issues to your commits. '));

    const stored = readSettings(STORE);
    let host = stored.host ?? '';
    let email = stored.email ?? '';

    for (let attempt = 1; attempt <= attempts; attempt++) {
        host = await askHost(host);
        if (!host) {
            disableJira();
            return null;
        }

        email = await askEmail(email);
        if (!email) {
            disableJira();
            return null;
        }

        const token = await askToken();
        if (!token) {
            disableJira();
            return null;
        }

        if (!isToken(token, {strict: false})) {
            console.log(chalk.yellow('\n That does not look like an Atlassian API token, checking it anyway.'));
        }

        const credentials = {host, email, token};
        const spinner = ora('Checking your Jira credentials ... \n').start();
        const {valid, name, reason} = await verify(credentials);

        if (valid) {
            spinner.text = chalk.green(`Connected to Jira${name ? ` as ${name}` : ''}.`);
            spinner.succeed();
            writeSettings(STORE, {...credentials, verified: true, jiraDisabled: false});
            return {...credentials, verified: true};
        }

        spinner.text = chalk.red(`Jira rejected the credentials: ${reason}`);
        spinner.fail();
        console.log(chalk.dim(` Token used: ${maskSecret(token)}`));

        if (attempt === attempts) break;

        const {retry} = await inquirer.prompt([{
            type: 'enhanced-confirm',
            name: 'retry',
            prefix: `\n ${chalk.bold.red('❯')}`,
            message: 'Try again?',
            default: true,
        }]);

        if (!retry) break;
    }

    disableJira();
    return null;
}

/**
 * Finds usable Jira credentials.
 * Order: environment variables, stored credentials, then the walkthrough.
 *
 * @returns {Promise<object|null>}
 */
export const resolveCredentials = async ({interactive = true} = {}) => {
    const fromEnvironment = envCredentials();
    if (fromEnvironment) return fromEnvironment;

    const stored = readSettings(STORE);
    if (stored.verified && stored.host && stored.email && stored.token) return stored;
    if (stored.jiraDisabled) return null;

    if (!interactive || !process.stdin.isTTY) return null;

    return setupJira();
}

/** The credentials as stored, without going through the walkthrough. */
export const storedCredentials = () => {
    const fromEnvironment = envCredentials();
    if (fromEnvironment) return fromEnvironment;

    const stored = readSettings(STORE);
    return stored.verified ? stored : null;
}

export const JIRA_ENV_NAMES = [ENV_NAMES.host[0], ENV_NAMES.email[0], ENV_NAMES.token[0]];
export const JIRA_TOKEN_PAGE = TOKEN_PAGE;
