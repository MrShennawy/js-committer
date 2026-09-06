import chalk from "chalk";
import ora from "ora";
import inquirer from "../prompts/register.js";
import {writeSettings} from '../store/handler.js';
import RequiredError from "../exceptions/RequiredError.js";
import {getCurrentUser} from "./handler.js";

export const checkCredential = async () => {
    console.log();
    const spinner = ora('Check jira credential').start();

    try {
        await getCurrentUser();
        spinner.text = chalk.green('The credential has been verified');
        spinner.succeed();
    } catch (err) {
        spinner.text = chalk.red('Sorry, the credentials provided are not correct');
        spinner.fail();
        console.error(chalk.dim(err.message));
        writeSettings('jira', {});
        process.exit(1);
    }
}

export default async () => {
    console.log(chalk.inverse(' For the initial setup, please enter Jira credentials. '));

    const questions = [
        {
            type: 'default-editable-input',
            name: 'host',
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: "\n",
            hint: `Example: ${chalk.yellow('somehost.atlassian.net')}`,
            message: 'Enter Jira host:',
            validate: (host) => {
                if (!host) throw new RequiredError('Jira host is required');
                return true;
            }
        },
        {
            type: 'default-editable-input',
            name: 'email',
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: "\n",
            message: 'Enter your Jira email:',
            validate: (email) => {
                if (!email) throw new RequiredError('your Jira email is required');
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
            validate: (token) => {
                if (!token) throw new RequiredError('Api token is required');
                return true;
            }
        }
    ];

    const answers = await inquirer.prompt(questions);

    // The host is stored without a scheme or trailing slash.
    answers.host = answers.host.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    answers.email = answers.email.trim();
    answers.token = answers.token.trim();

    writeSettings('jira', answers);
    await checkCredential();
    writeSettings('jira', {...answers, verified: true});
}
