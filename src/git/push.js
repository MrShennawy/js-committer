import {exec} from "child_process";
import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";

const askForPush = () =>{
    return inquirer.prompt([
        {
            type: 'enhanced-confirm',
            name: 'runPush',
            prefix: `\n ${chalk.bold.red('❯')}`,
            message: `Run ${chalk.bold.cyan('git push')} ?`,
            default: true
        }
    ]);
}

const command = async () => {
    const pullAnswer = await askForPush();
    if(!pullAnswer.runPush) return false;
    const spinner = ora('Pushing... \n').start();
    return new Promise((resolve, reject) => {
        exec('git push').on('close', code => {
            if (code !== 0) {
                spinner.text = chalk.red('Push (FAILED)');
                spinner.fail()
                reject();
                process.exit(1);

            }
            spinner.text = chalk.green('Push (DONE)');
            spinner.succeed()
            resolve(true);
        });
    });
}

export default ({
    command,
})