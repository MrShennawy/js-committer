import {execFile} from "child_process";
import ora from "ora";
import chalk from "chalk";
import {confirm} from "../prompts/ask.js";
import fetch from "./fetch.js";
import config from "./config.js";
import {isBehindRemote} from "../support/git.js";

const askForPull = () => confirm({
    name: 'runPull',
    message: `You have new changes in your remote repository. Should you run ${chalk.bold.cyan('git pull')} ?`,
});

const command = async () => {
    await fetch.command();

    // Compare revisions instead of reading git's English status text, which
    // changes with the user's locale.
    if (!isBehindRemote()) return false;

    if (!await askForPull()) return false;

    if (!config.get('pull.rebase')) config.set('pull.rebase', 'false');

    console.log();

    const spinner = ora('Pulling... \n').start();
    return new Promise((resolve, reject) => {
        // Only the exit code decides success: git writes normal progress
        // information ("From github.com...") to stderr on a successful pull.
        execFile('git', ['pull'], (error, stdout, stderr) => {
            if (error) {
                spinner.text = chalk.red(`Pull (FAILED): ${stderr?.trim() || error.message}`);
                spinner.fail();

                if (/conflict/i.test(`${stdout}${stderr}`)) {
                    console.log(chalk.yellow('\nResolve the conflicts, then commit and push manually.\n'));
                }

                reject(error);
                return;
            }

            spinner.text = chalk.green('Pull (DONE)');
            spinner.succeed();
            resolve(stdout.trim());
        });
    });
}

export default ({
    command,
})
