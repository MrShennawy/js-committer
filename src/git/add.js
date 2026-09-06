import chalk from "chalk";
import inquirer from "../prompts/register.js";
import status from "./status.js";
import RequiredError from "../exceptions/RequiredError.js";
import git from "../support/git.js";

const askForCommit = () => {
    return inquirer.prompt([
        {
            type: 'enhanced-confirm',
            name: 'runAddCommit',
            prefix: `${chalk.bold.red('❯')}`,
            message: `Do you want to use this commit message?`,
            default: true
        }
    ]);
}

/**
 * Confirms the message with the user and stages the selected paths.
 * Paths are passed as separate arguments, so names containing spaces or
 * shell metacharacters are staged correctly.
 *
 * @param {string[]} paths
 */
const command = async (paths = ['.']) => {
    const commitAnswer = await askForCommit();

    // Declining is a normal cancellation, not a failure.
    if (!commitAnswer.runAddCommit) {
        console.log(chalk.dim('\nAborted, nothing was committed.\n'));
        process.exit(0);
    }

    return git(['add', '--', ...paths]);
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
