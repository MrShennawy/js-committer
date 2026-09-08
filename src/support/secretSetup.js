import chalk from "chalk";
import inquirer from "../prompts/register.js";
import {readClipboard, openUrl} from "./platform.js";

/**
 * The pieces shared by every "paste a credential" walkthrough.
 *
 * All of them assume the secret is already in the clipboard, because that is
 * where it lands the moment the user presses the copy button on the page that
 * issued it.
 */

/** Shows only the first and last characters, never the whole secret. */
export const maskSecret = (value, {prefixLength = 6} = {}) => {
    if (!value || value.length < 12) return '••••';
    return `${value.slice(0, prefixLength)}${'•'.repeat(12)}${value.slice(-4)}`;
}

/** Takes the first whitespace-delimited token that passes the test. */
export const secretFromText = (text, detect) => {
    if (!text) return null;

    const candidate = text.trim().split(/\s+/)[0] ?? '';
    return detect(candidate) ? candidate : null;
}

/**
 * Offers whatever key-shaped value is currently in the clipboard.
 * @returns {Promise<string|null>} the value when the user accepts it
 */
export const offerFromClipboard = async ({label, detect}) => {
    const candidate = secretFromText(readClipboard(), detect);
    if (!candidate) return null;

    const {useIt} = await inquirer.prompt([{
        type: 'enhanced-confirm',
        name: 'useIt',
        prefix: ` ${chalk.bold.red('❯')}`,
        message: `Found ${label} in your clipboard: ${chalk.cyan(maskSecret(candidate))}. Use it?`,
        default: true,
    }]);

    return useIt ? candidate : null;
}

/** Asks for a secret without echoing it to the terminal. */
export const askSecret = async (message) => {
    const {secret} = await inquirer.prompt([{
        type: 'password',
        name: 'secret',
        mask: '•',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message,
    }]);

    return secret?.trim() || null;
}

/**
 * Opens the page that issues the credential, waits for the user to copy it,
 * then reads the clipboard again.
 *
 * @returns {Promise<string|null>} the copied value, when it is recognisable
 */
export const openPageAndWaitForCopy = async ({url, instruction, detect}) => {
    const opened = openUrl(url);
    console.log(opened
        ? chalk.dim(`\n Opened ${url}`)
        : chalk.dim(`\n Open this page: ${chalk.cyan(url)}`));
    console.log(chalk.dim(` ${instruction}\n`));

    await inquirer.prompt([{
        type: 'enhanced-confirm',
        name: 'ready',
        prefix: ` ${chalk.bold.red('❯')}`,
        message: 'Press Enter once it is copied',
        default: true,
    }]);

    return secretFromText(readClipboard(), detect);
}

export default {maskSecret, secretFromText, offerFromClipboard, askSecret, openPageAndWaitForCopy};
