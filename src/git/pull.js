import {exec, execSync} from "child_process";
import ora from "ora";
import inquirer from "inquirer";
import chalk from "chalk";
import ConfirmPrompt from "../prompts/confirm.js";
import fetch from "./fetch.js";
import status from "./status.js";
import config from "./config.js";
import RequiredError from "../exceptions/RequiredError.js";

inquirer.registerPrompt('enhanced-confirm', ConfirmPrompt);

const askForPull = () =>{
    return inquirer.prompt([
        {
            type: 'enhanced-confirm',
            name: 'runPull',
            prefix: `\n ${chalk.bold.red('❯')}`,
            message: `You have new changes in your remote repository. Should you run ${chalk.bold.cyan('git pull')} ?`,
            default: true
        }
    ]);

}

const command = async () => {
    try {
        await fetch.command();
        if (!status.command().includes('git pull')) return;

        const pullAnswer = await askForPull();
        if (!pullAnswer.runPull) return false;

        // check rebase configuration
        const rebase = config.command('--get pull.rebase')
        if(!rebase) config.command('pull.rebase false')

        console.log()

        const spinner = ora('Pulling... \n').start();
        return new Promise((resolve, reject) => {
            exec('git pull', async (error, stdout, stderr) => {
                // TODO handle unmerged files on conflicts
                if (error) {
                    spinner.text = chalk.red(`Pull (FAILED): ${error.message}`);
                    spinner.fail();
                    reject(error.message);
                    process.exit(1);
                }

                if (stderr) {
                    spinner.text = chalk.red(`Pull (FAILED):: ${stderr}`);
                    spinner.fail();
                    reject(stderr);
                    process.exit(1);
                }

                spinner.text = chalk.green('Pull (DONE)');
                spinner.succeed();
                resolve(stdout.trim()); // Resolve with the trimmed stdout
            });
        });
    } catch (err) {
        console.error('Error during pull:', err);
        return Promise.reject(err);
    }
}

export default ({
    command,
})