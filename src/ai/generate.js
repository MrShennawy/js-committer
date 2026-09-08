import chalk from "chalk";
import ora from "ora";
import gitDiff from "../git/diff.js";
import {parseSubject, formatSubject, isKnownType, typeNames, typeGuide} from "../git/commit.js";
import detectType from "../support/detectType.js";
import detectScope from "../support/detectScope.js";
import loadConfig from "../support/config.js";
import {resolveAi, clearApiKey} from "./settings.js";
import {redact} from "../support/redact.js";
import flags from "../support/args.js";

/**
 * A repository may narrow the list of types, so a type detected from the file
 * names has to be brought back into that list before it is used.
 */
const configuredType = (type) => {
    if (isKnownType(type)) return type;

    const available = typeNames();
    return available.includes('chore') ? 'chore' : available[0];
};

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

const buildPrompt = (summary, {diff, stat, truncated}, {count, scope, wantBody}) => `
You are an expert at writing conventional git commit messages that follow industry best practices.

CONTEXT:
- Task Summary: ${summary?.trim() || 'No summary provided'}
${scope ? `- Every changed file lives under the "${scope}" area of the project` : ''}
- Changed Files:
${stat || '(no file statistics available)'}
- Git Diff Changes${truncated ? ' (truncated to the first part of the diff)' : ''}:
${diff || '(no textual diff available)'}

TASK:
Read the diff, decide which conventional commit type describes it best, and
write ${count} alternative single line commit messages for the same change.

AVAILABLE TYPES (choose exactly one per message):
${typeGuide()}

CHOOSING THE TYPE:
1. Judge by what the change does, not by which folder it lives in
2. New user facing behaviour is 'feat'; correcting broken behaviour is 'fix'
3. Restructuring without changing behaviour is 'refactor'
4. Only use 'chore' when nothing more specific applies
5. If a task summary is provided, let it inform the type but let the diff decide

REQUIREMENTS:
1. Format: "<type>${scope ? `(${scope})` : ''}: <concise description of what was changed>"
2. The type must be one of: ${typeNames().join(', ')}
${scope ? `3. Use the scope "${scope}" in every message` : '3. Do not invent a scope'}
4. Use present tense, imperative mood ("add", "fix", "update")
5. Start the description with a lowercase letter, no period at the end
6. Be specific about WHAT changed, not just WHERE
7. Maximum ${loadConfig().maxSubjectLength} characters per message
8. The ${count} messages must be genuinely different readings of the change,
   not reworded versions of one another. Put the best one first.
${wantBody ? `9. Also write a short body: two to four bullet lines, each starting with "- ",
   explaining the notable parts of the change. Leave it empty if the subject says enough.` : ''}

ANSWER FORMAT:
Reply with JSON only, no prose and no code fences:
{"messages": [${Array.from({length: count}, (_, i) => `"message ${i + 1}"`).join(', ')}]${wantBody ? ', "body": "- first point\\n- second point"' : ''}}
`;

/** Strips code fences and returns the first non-empty line. */
const normalise = (text) => text
    .replace(/```[a-z]*|```/gi, '')
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length) ?? '';

/**
 * Reads the model's answer, which is asked for as JSON but is not always
 * given that way, so a plain list of lines is accepted too.
 *
 * @returns {{messages: string[], body: string|null}}
 */
export const parseReply = (reply) => {
    const text = (reply ?? '').replace(/```[a-z]*\n?|```/gi, '').trim();
    if (!text) return {messages: [], body: null};

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start !== -1 && end > start) {
        try {
            const parsed = JSON.parse(text.slice(start, end + 1));
            // A well formed answer is trusted even when it is empty, so the
            // raw JSON is never mistaken for a commit message.
            if (Array.isArray(parsed.messages)) {
                const messages = parsed.messages
                    .filter(item => typeof item === 'string' && item.trim())
                    .map(item => item.trim());

                return {messages, body: parsed.body?.trim() || null};
            }
        } catch {
            // Not valid JSON after all; fall through to reading it as lines.
        }
    }

    const messages = text
        .split('\n')
        .map(line => line.trim().replace(/^[-*\d.)\s]+/, '').trim())
        .filter(line => line.length);

    return {messages, body: null};
}

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

    // The fallback is clamped too: a caller may pass a type this repository
    // does not list.
    const fallbackType = configuredType(guessedType);

    if (!parsed.type || !isKnownType(parsed.type)) {
        const description = parsed.sentence || fallbackDescription(fallbackType, summary);
        return {message: formatSubject({type: fallbackType, sentence: description}), corrected: true};
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
/** True when the change is big enough that a subject alone will not cover it. */
const deservesBody = (changes, config) => {
    if (config.commitBody === 'always') return true;
    if (config.commitBody === 'never') return false;

    return changes.files.length >= config.bodyThreshold.files
        || changes.diff.length >= config.bodyThreshold.diffChars;
}

/**
 * Produces the commit messages to choose between.
 *
 * The model picks the type, and the scope comes from the changed paths rather
 * than from the model, because the paths are a fact and the model would be
 * guessing. Everything is validated before it is offered.
 *
 * @param {string[]} paths - the paths that are about to be staged
 * @param {{summary?: string|null, jiraIssueType?: string|null}} context
 * @returns {Promise<{messages: string[], body: string|null, generated: boolean}>}
 */
export const generateSuggestions = async (paths = ['.'], {summary = null, jiraIssueType = null} = {}) => {
    const config = loadConfig();
    const collected = gitDiff.collect(paths);

    const guessedType = configuredType(detectType(collected.files, jiraIssueType));
    const scope = config.autoScope ? detectScope(collected.files, {allowed: config.scopes}) : null;

    // Nothing that looks like a credential is allowed into the prompt, whoever
    // the provider turns out to be.
    const cleaned = redact(collected.diff);
    const changes = {...collected, diff: cleaned.text};

    const fallback = formatSubject({
        type: guessedType,
        scope,
        sentence: fallbackDescription(guessedType, summary),
    });

    const ai = flags.noAi ? null : await resolveAi();
    if (!ai) return {messages: [fallback], body: null, generated: false};

    if (cleaned.removed) {
        console.log(chalk.dim(` ${cleaned.removed} value(s) that looked like credentials were removed from the diff.`));
    }

    const count = Math.max(1, Math.min(5, config.suggestions));
    const wantBody = deservesBody(changes, config);
    const spinner = ora('Content generation ... \n').start();

    try {
        const reply = await ai.provider.generate({
            prompt: buildPrompt(summary, changes, {count, scope, wantBody}),
            apiKey: ai.apiKey,
            model: ai.model,
            baseUrl: ai.baseUrl,
        });

        const {messages, body} = parseReply(reply);

        const resolved = messages
            .map(message => resolveMessage(message, guessedType, summary)?.message)
            .filter(Boolean);

        // Keep the order the model chose, without repeats.
        const unique = [...new Set(resolved)];

        if (!unique.length) {
            spinner.text = chalk.yellow('The model returned no message, using a fallback.');
            spinner.warn();
            return {messages: [fallback], body: null, generated: false};
        }

        spinner.text = chalk.green(`Content generated. ${chalk.dim(`(${unique.length} suggestion${unique.length > 1 ? 's' : ''})`)}`);
        spinner.succeed();

        return {messages: unique, body: body || null, generated: true};
    } catch (err) {
        spinner.fail();
        handleError(err);
        console.log(chalk.dim(` Writing the message without AI (detected type: ${guessedType}).\n`));
        return {messages: [fallback], body: null, generated: false};
    }
};

/** The single best message, for callers that do not offer a choice. */
export const generateCommitMessage = async (paths, context) => {
    const {messages} = await generateSuggestions(paths, context);
    return messages[0];
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
