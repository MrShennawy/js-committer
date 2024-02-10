import {exec, execSync} from "child_process";
import ora from "ora";
import chalk from "chalk";
import inquirer from "inquirer";
import branch from "./branch.js";

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

const pushCommand = () => {
    const currentBranch = branch.command('--show-current');
    const remoteBranch = execSync(`git ls-remote --heads origin ${currentBranch}`).toString().trim();
    if(!remoteBranch) return `git push --set-upstream origin ${currentBranch}`;
    return `git push origin ${currentBranch}`;
}

const command = async () => {
    const pullAnswer = await askForPush();
    if(!pullAnswer.runPush) return false;

    console.log()

    const spinner = ora('Pushing... \n').start();
    return new Promise((resolve, reject) => {
        exec(pushCommand()).on('close', code => {
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