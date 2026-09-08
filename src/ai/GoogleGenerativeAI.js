import {GoogleGenerativeAI as GeminiClient} from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";
import gitDiff from "../git/diff.js";
import {parseSubject, formatSubject, isKnownType, typeNames} from "../git/commit.js";
import detectType from "../support/detectType.js";
import {resolveApiKey, clearApiKey} from "./apiKey.js";
import flags from "../support/args.js";

const MODEL = "gemini-2.5-flash-lite";
const MAX_SUBJECT_LENGTH = 72;

const TYPE_GUIDE = `
- feat: a new feature for the user
- fix: a bug fix for the user
- docs: documentation only changes
- style: changes that do not affect the meaning of the code (formatting, whitespace)
- refactor: a code change that neither fixes a bug nor adds a feature
- perf: a code change that improves performance
- test: adding missing tests or correcting existing tests
- build: changes to the build system or external dependencies
- chore: other changes that do not modify src or test files`;

/** Description used when the model is unavailable; the type is added separately. */
const fallbackDescription = (type, summary) => {
    if (summary && summary.trim()) {
        return summary.trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')   // drop punctuation, keep hyphens
            .replace(/\s+/g, ' ')
            .substring(0, 50);
    }

    const byType = {
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

    return byType[type] ?? 'update project files';
};

const buildPrompt = (summary, {diff, stat, truncated}) => `
You are an expert at writing conventional git commit messages that follow industry best practices.

CONTEXT:
- Task Summary: ${summary?.trim() || 'No summary provided'}
- Changed Files:
${stat || '(no file statistics available)'}
- Git Diff Changes${truncated ? ' (truncated to the first part of the diff)' : ''}:
${diff || '(no textual diff available)'}

TASK:
Read the diff, decide which conventional commit type describes it best, and
generate a single-line commit message.

AVAILABLE TYPES (choose exactly one):${TYPE_GUIDE}

CHOOSING THE TYPE:
1. Judge by what the change does, not by which folder it lives in
2. New user facing behaviour is 'feat'; correcting broken behaviour is 'fix'
3. Restructuring without changing behaviour is 'refactor'
4. Only use 'chore' when nothing more specific applies
5. If a task summary is provided, let it inform the type but let the diff decide

REQUIREMENTS:
1. Format: "<type>: <concise description of what was changed>"
2. The type must be one of: ${typeNames.join(', ')}
3. Use present tense, imperative mood (e.g., "add", "fix", "update", not "added", "fixed", "updated")
4. Start the description with a lowercase letter
5. No period at the end
6. Be specific about WHAT was changed, not just WHERE
7. Maximum ${MAX_SUBJECT_LENGTH} characters total (including the type)
8. Use single quotes for strings, never backticks

EXAMPLES:
- feat: add user authentication middleware
- fix: resolve memory leak in image processing
- refactor: extract validation logic into separate module
- docs: update API endpoint documentation
- test: add unit tests for payment validation

Generate ONLY the commit message, no additional text or explanations.
`;

/** Keeps only the first line and strips any markdown fencing the model adds. */
const normalise = (text) => text
    .replace(/```[a-z]*|```/gi, '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length) ?? '';

/**
 * Turns whatever the model replied into a valid "type: description" message.
 *
 * The model is asked for one of the known types but does not always comply: it
 * may answer with a scope ("chore(deps): ..."), an invented type, or no type at
 * all. In those cases its wording is kept and only the type is corrected.
 *
 * @param {string} text - the raw model reply
 * @param {string} guessedType - the type detected from the changed files
 * @param {string|null} summary
 * @returns {{message: string, corrected: boolean}|null} null when the reply was empty
 */
export const resolveMessage = (text, guessedType, summary = null) => {
    const parsed = parseSubject(normalise(text ?? ''));
    if (!parsed.type && !parsed.sentence) return null;

    if (!parsed.type || !isKnownType(parsed.type)) {
        const description = parsed.sentence || fallbackDescription(guessedType, summary);
        return {message: formatSubject({type: guessedType, sentence: description}), corrected: true};
    }

    return {message: formatSubject(parsed), corrected: false};
};

/**
 * Generates the full commit message, including the type.
 *
 * The type is no longer asked for: the model picks it from the diff, and the
 * result is validated against the known types. Whatever comes back is shown in
 * an editable prompt, so the user always has the last word.
 *
 * @param {string[]} paths - the paths that are about to be staged
 * @param {{summary?: string|null, jiraIssueType?: string|null}} context
 * @returns {Promise<string>} a message shaped as "type: description"
 */
export const generateCommitMessage = async (paths = ['.'], {summary = null, jiraIssueType = null} = {}) => {
    const changes = gitDiff.collect(paths);

    // Worked out up front so it is available whether or not the model answers.
    const guessedType = detectType(changes.files, jiraIssueType);
    const fallback = `${guessedType}: ${fallbackDescription(guessedType, summary)}`;

    // No key, or the user opted out: fall back quietly rather than nagging.
    const apiKey = flags.noAi ? null : await resolveApiKey();
    if (!apiKey) return fallback;

    const spinner = ora('Content generation ... \n').start();

    try {
        const model = new GeminiClient(apiKey).getGenerativeModel({model: MODEL});
        const result = await model.generateContent(buildPrompt(summary, changes));
        const resolved = resolveMessage(result?.response?.text(), guessedType, summary);

        if (!resolved) {
            spinner.text = chalk.yellow('The model returned no message, using a fallback.');
            spinner.warn();
            return fallback;
        }

        const chosenType = parseSubject(resolved.message).type;
        const note = resolved.corrected ? `(type set to '${chosenType}')` : `(type: ${chosenType})`;
        spinner.text = chalk.green(`Content generated. ${chalk.dim(note)}`);
        spinner.succeed();

        return resolved.message;
    } catch (err) {
        spinner.fail();
        handleError(err);
        console.log(chalk.dim(` Writing the message without AI (detected type: ${guessedType}).\n`));
        return fallback;
    }
};

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
                clearApiKey();
                errorMessage = `API key not valid, it has been removed. Run ${chalk.cyan('cmt --setup')} to add a new one.`;
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
