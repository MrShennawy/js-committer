import { GoogleGenerativeAI } from "@google/generative-ai";
import gitDiff from "../git/diff.js";
import inquirer from "inquirer";
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import {readSettings, writeSettings} from "../store/handler.js";
import ora from "ora";

export const generateCommitMessage = async (commitType, summary = null, files = '.') => {
    let {apiKey} = readSettings('GoogleGenerativeAI')
    if(!apiKey)
        apiKey = await storeApiKey()

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const spinner = ora('Content generation ... \n').start();
    const diff = gitDiff.command(files)
    let mainTask = summary ? ` Jira Summary: ${summary}` : 'No summary provided';

    let prompt = `
        You are an expert at writing conventional git commit messages that follow industry best practices.
        
        CONTEXT:
        - Commit Type: ${commitType}
        - Task Summary: ${mainTask}
        - Git Diff Changes:
        ${diff}
        
        TASK:
        Generate a single-line git commit message that accurately describes the changes shown in the git diff.
        
        REQUIREMENTS:
        1. Format: "${commitType}: <concise description of what was changed>"
        2. Use present tense, imperative mood (e.g., "add", "fix", "update", not "added", "fixed", "updated")
        3. Start the description with a lowercase letter
        4. No period at the end
        5. Be specific about WHAT was changed, not just WHERE
        6. If task summary is provided, incorporate relevant context but prioritize the actual code changes
        7. Maximum 72 characters total (including the commit type)
        8. Use single quotes for strings, never backticks
        
        EXAMPLES:
        - feat: add user authentication middleware
        - fix: resolve memory leak in image processing
        - refactor: extract validation logic into separate module
        - docs: update API endpoint documentation
        - style: improve button spacing and colors
        - test: add unit tests for payment validation
        
        ANALYSIS PRIORITY:
        1. Focus on the most significant changes in the diff
        2. If multiple files changed, mention the primary change or group related changes
        3. For bug fixes, mention what was broken
        4. For features, mention what functionality was added
        5. For refactoring, mention what was improved or reorganized
        
        Generate ONLY the commit message, no additional text or explanations.
    `;

    // Smart fallback function for when AI generation fails
    const generateFallbackMessage = () => {
        // Try to create a meaningful message based on available context
        const baseMessage = `${commitType}: `;

        // If we have a summary, use it to create a better fallback
        if (summary && summary.trim()) {
            const cleanSummary = summary.trim()
                .toLowerCase()
                .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
                .replace(/\s+/g, ' ') // Normalize spaces
                .substring(0, 50); // Keep it concise

            return `${baseMessage}${cleanSummary}`;
        }

        // Generate contextual messages based on commit type
        const typeBasedMessages = {
            'feat': 'add new feature implementation',
            'fix': 'resolve issue in codebase',
            'refactor': 'improve code structure and organization',
            'docs': 'update project documentation',
            'style': 'improve code formatting and style',
            'test': 'add or update test coverage',
            'chore': 'update build process or dependencies',
            'perf': 'improve application performance',
            'ci': 'update continuous integration configuration',
            'build': 'update build system or dependencies'
        };

        const defaultMessage = typeBasedMessages[commitType] || 'update project files';
        return `${baseMessage}${defaultMessage}`;
    };

    let result = { response: null }
    let commitMessage = generateFallbackMessage();
    try {
        result = await model.generateContent(prompt);
        commitMessage = result.response?.text().trim();
        spinner.text = chalk.green('Content generated.');
        spinner.succeed();
    } catch (err) {
        spinner.fail();
        handleError(err)
        const removeKeyAnswer = await askForRemoveApiKey();
        if(removeKeyAnswer.removeApiKey)
            await writeSettings('GoogleGenerativeAI', {apiKey: null});
        // process.exit(1);
    }

    return commitMessage;
};

const askForRemoveApiKey = () =>{
    return inquirer.prompt([
        {
            type: 'enhanced-confirm',
            name: 'removeApiKey',
            prefix: `\n ${chalk.bold.red('❯')}`,
            message: `Do you want to remove the current ${chalk.bold.cyan('Google API key')}?`,
            default: false
        }
    ]);
}


const storeApiKey = async () => {
    const answers = await inquirer.prompt([
        {
            type: 'default-editable-input',
            name: 'key',
            hint: `From ❯ ${chalk.cyan('https://aistudio.google.com/app/apikey')}`,
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


const handleError = async (err) => {
    let errorMessage = 'An unknown error occurred.';

    if (err.errorDetails && Array.isArray(err.errorDetails)) {
        for (const detail of err.errorDetails) {
            if (detail['@type'] === 'type.googleapis.com/google.rpc.LocalizedMessage' && detail.message) {
                errorMessage = detail.message;
                break;
            } else if (detail.reason === 'API_KEY_INVALID') {
                await writeSettings('GoogleGenerativeAI', {apiKey: null});
                errorMessage = 'API key not valid. Please pass a valid API key.';
                break;
            }
        }
    } else if (err.message) {
        errorMessage = err.message;
    }

    console.error(`${chalk.red.bold(errorMessage)}`);
}