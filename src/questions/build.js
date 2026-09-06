import ora from "ora";
import chalk from "chalk";
import {exec} from "child_process";
import inquirer from "../prompts/register.js";
import RequiredError from "../exceptions/RequiredError.js";
import flags from "../support/args.js";

const askForCommand = async () => {
    const answers = await inquirer.prompt([{
        type: 'default-editable-input',
        name: 'command',
        default: 'npm run build',
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the build command:',
        validate: (value) => {
            if (!value) throw new RequiredError('The build command is required');
            return true;
        }
    }]);

    return answers.command.trim();
}

// The build command is written by the user for their own shell, so it is run
// through a shell on purpose.
const runBuildCommand = (cmd) => {
    const spinner = ora('Build... \n').start();

    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                spinner.text = chalk.red('Build (FAILED)');
                spinner.fail();
                if (stderr?.trim()) console.error(stderr.trim());
                reject(error);
                return;
            }

            spinner.text = chalk.green('Build (DONE)');
            spinner.succeed();
            resolve(true);
        });
    });
}

export default async () => {
    if (!flags.build) return null;

    const cmd = await askForCommand();
    await runBuildCommand(cmd);

    return {
        type: 'BUILD',
        sentence: cmd,
    }
}
