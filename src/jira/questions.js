import { readSettings, writeSettings } from '../store/handler.js';
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import inquirer from "inquirer";
import InputPrompt from "../prompts/input.js";
inquirer.registerPrompt('default-editable-input', InputPrompt);

const questions = [
    {
        type: 'default-editable-input',
        name: 'host',
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        hint: `Example: ${chalk.yellow('somehost.atlassian.net')}`,
        message: 'Enter the jira host:',
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
        message: 'Enter Your jira email:',
        validate: (commit) => {
            if (!commit) throw new RequiredError('your Jira email is required');
            return true;
        }
    },
    {
        type: 'default-editable-input',
        name: 'token',
        hint: `From ❯ https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account`,
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter jira api token:',
        validate: (commit) => {
            if (!commit) throw new RequiredError('Api token is required');
            return true;
        }
    }
]

const answers = await inquirer.prompt(questions)
writeSettings('jira', answers);
