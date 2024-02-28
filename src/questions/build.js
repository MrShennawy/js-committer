import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import {exec} from "child_process";

const command = async () => {
    const question =  {
        type: 'default-editable-input',
        name: 'command',
        default: 'npm run build',
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the build command:',
        validate: (commit) => {
            if (!commit) throw new RequiredError('The build command is required');
            return true;
        }
    }
    const answers = await inquirer.prompt([question])
    return answers.command.trim();
}

const runBuildCommand = async (cmd) => {
    const spinner = ora('Build... \n').start();
    return new Promise((resolve, reject) => {
        exec(cmd).on('close', code => {
            if (code !== 0) {
                spinner.text = chalk.red('Build (FAILED)');
                spinner.fail()
                reject();
                process.exit(1);
            }
            spinner.text = chalk.green('Build (DONE)');
            spinner.succeed()
            resolve(true);
        });
    });
}

export default async () => {
    if (![...process.argv].includes('-b')) return null;
    const cmd = await command()
    await runBuildCommand(await cmd)
    return {
        type: 'BUILD',
        sentence: cmd,
    }
}