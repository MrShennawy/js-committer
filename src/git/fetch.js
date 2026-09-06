import {execFile} from "child_process";
import ora from "ora";
import chalk from "chalk";

/** Runs `git fetch`, showing a spinner while it works. */
const command = () => {
    const spinner = ora('Fetching... \n').start();

    return new Promise((resolve, reject) => {
        execFile('git', ['fetch'], (error, stdout, stderr) => {
            if (error) {
                spinner.text = chalk.red(`Fetch (FAILED): ${stderr?.trim() || error.message}`);
                spinner.fail();
                reject(error);
                return;
            }

            spinner.text = chalk.green('Fetched (DONE)');
            spinner.succeed();
            resolve(stdout.trim());
        });
    });
}

export default ({
    command,
})
