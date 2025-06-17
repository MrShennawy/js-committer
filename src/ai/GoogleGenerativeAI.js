import { GoogleGenerativeAI } from "@google/generative-ai";
import gitDiff from "../git/diff.js";
import inquirer from "inquirer";
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import {readSettings, writeSettings} from "../store/handler.js";
import ora from "ora";

export const generateCommitMessage = async (commitType) => {
    let {apiKey} = readSettings('GoogleGenerativeAI')
    if(!apiKey)
        apiKey = await storeApiKey()

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const spinner = ora('Content generation ... \n').start();
    const diff = gitDiff.command()
    let prompt;
    prompt = `
        You are a serious AI that helps generate git commit messages.
        Commit type: ${commitType}
        Details: ${diff}
        Generate a professional, concise git commit message. Limit the response to a maximum of 10 words.
        `;

    let result = { response: null }
    try {
        result = await model.generateContent(prompt);
        spinner.text = chalk.green('Content generated.');
        spinner.succeed();
    } catch (err) {
        spinner.fail();
        handleError(err)
        await writeSettings('GoogleGenerativeAI', {apiKey: null});
        process.exit(1);
    }

    return result.response?.text();
};

const storeApiKey = async () => {
    const answers = await inquirer.prompt([
        {
            type: 'default-editable-input',
            name: 'key',
            hint: `From ❯ ${chalk.cyan('https://console.cloud.google.com/apis/credentials')}`,
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: "\n",
            message: 'Enter Google API Key:',
            validate: (commit) => {
                if (!commit) throw new RequiredError('Api Key is required');
                return true;
            }
        }
    ])
    await writeSettings('GoogleGenerativeAI', {apiKey: answers.key});
    return answers.key;
}


const handleError = (err) => {
    let errorMessage = 'An unknown error occurred.';

    if (err.errorDetails && Array.isArray(err.errorDetails)) {
        for (const detail of err.errorDetails) {
            if (detail['@type'] === 'type.googleapis.com/google.rpc.LocalizedMessage' && detail.message) {
                errorMessage = detail.message;
                break;
            } else if (detail.reason === 'API_KEY_INVALID') {
                errorMessage = 'API key not valid. Please pass a valid API key.';
                break;
            }
        }
    } else if (err.message) {
        errorMessage = err.message;
    }

    console.error(`${chalk.red.bold(errorMessage)}`);
}