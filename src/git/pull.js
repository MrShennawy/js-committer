import {exec} from "child_process";
import ora from "ora";
import inquirer from "inquirer";
import chalk from "chalk";
import ConfirmPrompt from "../prompts/confirm.js";

inquirer.registerPrompt('enhanced-confirm', ConfirmPrompt);

const askForPull = () =>{
    return inquirer.prompt([
        {
            type: 'enhanced-confirm',
            name: 'runPull',
            prefix: `\n ${chalk.bold.red('❯')}`,
            message: `Run ${chalk.bold.cyan('git pull')} ?`,
            default: false
        }
    ]);

}

const command = async () => {
    const pullAnswer = await askForPull();
    if(!pullAnswer.runPull) return false;
    const spinner = ora('Pulling... \n').start();
    return new Promise((resolve, reject) => {
        exec('git pull').on('close', code => {
            if (code !== 0) {
                spinner.text = chalk.red('Pull (FAILED)');
                spinner.fail()
                reject();
                process.exit(1);
            }
            spinner.text = chalk.green('Pull (DONE)');
            spinner.succeed()
            resolve();
        });
    });
}

export default ({
    command,
})