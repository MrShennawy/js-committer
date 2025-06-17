import status from "./status.js";
import {execSync} from "child_process";
import RequiredError from "../exceptions/RequiredError.js";
import chalk from "chalk";
import inquirer from "inquirer";
import ConfirmPrompt from "../prompts/confirm.js";

inquirer.registerPrompt('enhanced-confirm', ConfirmPrompt);

const askForCommit = () =>{
    return inquirer.prompt([
        {
            type: 'enhanced-confirm',
            name: 'runAddCommit',
            prefix: `${chalk.bold.red('❯')}`,
            message: `Do you want to use this commit message?`,
            default: true
        }
    ]);
}

const command = async (files) => {

    try {
        const commitAnswer = await askForCommit();
        if (!commitAnswer.runAddCommit)
            process.exit(1);

        return execSync(`git add ${files}`);
    } catch (err) {
        process.exit(1);
    }
}

const files =  async () => {
    const files = await status.handleFiles();
    return {
        type: 'checkbox',
        pageSize: 10,
        name: 'files',
        loop: false,
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'select the files: ',
        choices: files,
        validate: (files) => {
            if(!files.length) throw new RequiredError('You need to select at least one file');
            return true;
        }
    }
}

export default {
    command,
    files
}