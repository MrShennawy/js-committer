import {readSettings, writeSettings} from '../store/handler.js';
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import inquirer from "inquirer";
import InputPrompt from "../prompts/input.js";
import ora from "ora";
import {getCurrentUser} from "./handler.js";
inquirer.registerPrompt('default-editable-input', InputPrompt);

export const checkCredential = async () => {
    console.log()
    let spinner = ora('Check jira credential').start();
    await getCurrentUser().then(user => {
            spinner.succeed()
        })
        .catch(err => {
            spinner.fail()
            console.log(chalk.black.bgRedBright(' Sorry, the credentials provided are not correct '))
            writeSettings('jira', {})
            process.exit(1);
        });
}

export default async () => {
    console.log(chalk.inverse(' For the initial setup, please enter Jira credentials. '))

    const questions = [
        {
            type: 'default-editable-input',
            name: 'host',
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: "\n",
            hint: `Example: ${chalk.yellow('somehost.atlassian.net')}`,
            message: 'Enter Jira host:',
            validate: (commit) => {
                if (!commit) throw new RequiredError('Jira host is required');
                return true;
            }
        },
        {
            type: 'default-editable-input',
            name: 'email',
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: "\n",
            message: 'Enter your Jira email:',
            validate: (commit) => {
                if (!commit) throw new RequiredError('your Jira email is required');
                return true;
            }
        },
        {
            type: 'default-editable-input',
            name: 'token',
            hint: `From ❯ ${chalk.cyan('https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account')}`,
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: "\n",
            message: 'Enter Jira api token:',
            validate: (commit) => {
                if (!commit) throw new RequiredError('Api token is required');
                return true;
            }
        }
    ]

    const answers = await inquirer.prompt(questions)
    await writeSettings('jira', answers);
    await checkCredential();
    await writeSettings('jira', {...answers, verified: true});
}