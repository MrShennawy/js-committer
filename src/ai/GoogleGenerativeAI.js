import {GoogleGenerativeAI as GeminiClient} from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";
import inquirer from "../prompts/register.js";
import gitDiff from "../git/diff.js";
import RequiredError from "../exceptions/RequiredError.js";
import {readSettings, writeSettings} from "../store/handler.js";

const MODEL = "gemini-2.5-flash-lite";
const MAX_SUBJECT_LENGTH = 72;

/**
 * Message used when the model is unavailable or returns nothing.
 * The user can still edit it in the prompt that follows.
 */
const fallbackMessage = (commitType, summary) => {
    if (summary && summary.trim()) {
        const cleanSummary = summary.trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')   // drop punctuation, keep hyphens
            .replace(/\s+/g, ' ')
            .substring(0, 50);

        return `${commitType}: ${cleanSummary}`;
    }

    const typeBasedMessages = {
        feat: 'add new feature implementation',
        fix: 'resolve issue in codebase',
        refactor: 'improve code structure and organization',
        docs: 'update project documentation',
        style: 'improve code formatting and style',
        test: 'add or update test coverage',
        chore: 'update build process or dependencies',
        perf: 'improve application performance',
        build: 'update build system or dependencies',
    };

    return `${commitType}: ${typeBasedMessages[commitType] ?? 'update project files'}`;
};

const buildPrompt = (commitType, summary, {diff, stat, truncated}) => `
You are an expert at writing conventional git commit messages that follow industry best practices.

CONTEXT:
- Commit Type: ${commitType}
- Task Summary: ${summary?.trim() || 'No summary provided'}
- Changed Files:
${stat || '(no file statistics available)'}
- Git Diff Changes${truncated ? ' (truncated to the first part of the diff)' : ''}:
${diff || '(no textual diff available)'}

TASK:
Generate a single-line git commit message that accurately describes the changes shown in the git diff.

REQUIREMENTS:
1. Format: "${commitType}: <concise description of what was changed>"
2. Use present tense, imperative mood (e.g., "add", "fix", "update", not "added", "fixed", "updated")
3. Start the description with a lowercase letter
4. No period at the end
5. Be specific about WHAT was changed, not just WHERE
6. If a task summary is provided, incorporate relevant context but prioritise the actual code changes
7. Maximum ${MAX_SUBJECT_LENGTH} characters total (including the commit type)
8. Use single quotes for strings, never backticks

EXAMPLES:
- feat: add user authentication middleware
- fix: resolve memory leak in image processing
- refactor: extract validation logic into separate module

ANALYSIS PRIORITY:
1. Focus on the most significant changes in the diff
2. If multiple files changed, mention the primary change or group related changes
3. For bug fixes, mention what was broken
4. For features, mention what functionality was added

Generate ONLY the commit message, no additional text or explanations.
`;

/** Keeps only the first line and strips any markdown fencing the model adds. */
const normalise = (text) => text
    .replace(/```[a-z]*|```/gi, '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length) ?? '';

export const generateCommitMessage = async (commitType, summary = null, paths = ['.']) => {
    let {apiKey} = readSettings('GoogleGenerativeAI');
    if (!apiKey) apiKey = await storeApiKey();

    const fallback = fallbackMessage(commitType, summary);
    const changes = gitDiff.collect(paths);

    const spinner = ora('Content generation ... \n').start();

    try {
        const model = new GeminiClient(apiKey).getGenerativeModel({model: MODEL});
        const result = await model.generateContent(buildPrompt(commitType, summary, changes));
        const text = normalise(result?.response?.text() ?? '');

        if (!text) {
            spinner.text = chalk.yellow('The model returned no message, using a fallback.');
            spinner.warn();
            return fallback;
        }

        spinner.text = chalk.green('Content generated.');
        spinner.succeed();
        return text;
    } catch (err) {
        spinner.fail();
        const invalidKey = handleError(err);

        // Offer to clear a key that the user may want to replace.
        if (!invalidKey) {
            const removeKeyAnswer = await askForRemoveApiKey();
            if (removeKeyAnswer.removeApiKey) writeSettings('GoogleGenerativeAI', {apiKey: null});
        }

        return fallback;
    }
};

const askForRemoveApiKey = () => {
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
            validate: (key) => {
                if (!key) throw new RequiredError('Api Key is required');
                return true;
            }
        }
    ]);

    writeSettings('GoogleGenerativeAI', {apiKey: answers.key.trim()});
    return answers.key.trim();
}

/**
 * Prints a readable error.
 * The raw error object is never logged, because it can contain the request
 * URL together with the API key.
 *
 * @returns {boolean} true when the stored key was invalid and has been cleared
 */
const handleError = (err) => {
    let errorMessage = 'An unknown error occurred.';
    let invalidKey = false;

    if (Array.isArray(err?.errorDetails)) {
        for (const detail of err.errorDetails) {
            if (detail.reason === 'API_KEY_INVALID') {
                writeSettings('GoogleGenerativeAI', {apiKey: null});
                errorMessage = 'API key not valid. Please pass a valid API key.';
                invalidKey = true;
                break;
            }
            if (detail['@type'] === 'type.googleapis.com/google.rpc.LocalizedMessage' && detail.message) {
                errorMessage = detail.message;
                break;
            }
        }
    } else if (err?.message) {
        errorMessage = err.message;
    }

    console.error(`${chalk.red.bold(errorMessage)}`);
    return invalidKey;
}
