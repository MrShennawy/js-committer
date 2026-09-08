import ora from "ora";
import chalk from "chalk";
import {exec} from "child_process";
import inquirer from "../prompts/register.js";
import RequiredError from "../exceptions/RequiredError.js";
import flags from "../support/args.js";
import loadConfig from "../support/config.js";
import {readProject, updateProject} from "../store/projects.js";

const askForCommand = async () => {
    // What this clone ran last wins, then what the project declares, then the
    // built in default, so the command is not retyped on every build.
    const remembered = readProject().buildCommand;
    const suggestion = remembered || loadConfig().buildCommand;

    const answers = await inquirer.prompt([{
        type: 'default-editable-input',
        name: 'command',
        default: suggestion,
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

    const cmd = flags.yes
        ? (readProject().buildCommand || loadConfig().buildCommand)
        : await askForCommand();

    updateProject({buildCommand: cmd});
    await runBuildCommand(cmd);

    return {
        type: 'BUILD',
        sentence: cmd,
    }
}
