import chalk from "chalk";
import inquirer from "../prompts/register.js";
import {confirm} from "../prompts/ask.js";
import status from "./status.js";
import diff from "./diff.js";
import RequiredError from "../exceptions/RequiredError.js";
import git from "../support/git.js";

const askForCommit = () => confirm({
    name: 'runAddCommit',
    prefix: `${chalk.bold.red('❯')}`,
    message: 'Do you want to use this commit message?',
});

/**
 * Confirms the message with the user and stages the selected paths.
 * Paths are passed as separate arguments, so names containing spaces or
 * shell metacharacters are staged correctly.
 *
 * @param {string[]} paths
 */
const command = async (paths = ['.']) => {
    // Declining is a normal cancellation, not a failure, and it has to leave
    // the index exactly as it was found.
    if (!await askForCommit()) {
        diff.forgetNewFiles();
        console.log(chalk.dim('\nAborted, nothing was committed.\n'));
        process.exit(0);
    }

    const result = git(['add', '--', ...paths]);
    // The content is staged properly now, so there is nothing left to undo.
    diff.keepNewFiles();

    return result;
}

const files = async () => {
    const choices = await status.handleFiles();
    return {
        type: 'checkbox',
        pageSize: 10,
        name: 'files',
        loop: false,
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'select the files: ',
        choices,
        validate: (selected) => {
            if (!selected.length) throw new RequiredError('You need to select at least one file');
            return true;
        }
    }
}

export default {
    command,
    files
}
