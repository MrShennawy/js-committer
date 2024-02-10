import {exec} from "child_process";
import ora from "ora";
import inquirer from "inquirer";
import chalk from "chalk";
import ConfirmPrompt from "../prompts/confirm.js";

inquirer.registerPrompt('enhanced-confirm', ConfirmPrompt);

const command = async () => {
    const spinner = ora('Fetching... \n').start();
    return new Promise((resolve, reject) => {
        exec('git fetch').on('close', code => {
            if (code !== 0) {
                spinner.text = chalk.red('Fetch (FAILED)');
                spinner.fail()
                reject();
                process.exit(1);
            }
            spinner.text = chalk.green('Fetched (DONE)');
            spinner.succeed()
            resolve();
        });
    });
}

export default ({
    command,
})