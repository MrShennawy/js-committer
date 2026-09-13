import chalk from "chalk";
import ora from "ora";
import gitDiff from "../git/diff.js";
import {parseSubject, formatSubject, isKnownType, typeNames, typeGuide} from "../git/commit.js";
import detectType from "../support/detectType.js";
import detectScope from "../support/detectScope.js";
import {redact} from "../support/redact.js";
import {resolveAi} from "./settings.js";
import loadConfig from "../support/config.js";

const MAX_GROUPS = 6;

const buildPrompt = ({stat, diff, truncated}, count) => `
You are an expert at curating a clean git history.

CHANGED FILES:
${stat}

DIFF${truncated ? ' (truncated)' : ''}:
${diff}

TASK:
Group the changed files into separate commits, each one a single coherent
change, and write a conventional commit message for each group.

RULES:
1. At most ${count} groups. Fewer is better: only split what is genuinely separate.
2. Every changed file must appear in exactly one group, and no file may be invented.
3. Order the groups so that each one could be committed on its own, dependencies first.
4. Each message is "<type>: <description>", type being one of: ${typeNames().join(', ')}
5. Keep every description under ${loadConfig().maxSubjectLength} characters, imperative mood.

TYPES:
${typeGuide()}

ANSWER FORMAT:
Reply with JSON only, no prose and no code fences:
{"groups": [{"message": "feat: ...", "files": ["path/one.js", "path/two.js"]}]}
`;

/**
 * Reads the grouping and makes it safe to act on.
 *
 * The model is told not to invent or drop files, but the result is verified
 * against the real change set anyway: anything unknown is discarded and
 * anything missed is added to a final group, so the commits together always
 * reproduce exactly what was there before.
 *
 * @param {string} reply
 * @param {string[]} actualPaths
 * @param {Map<string, string>} renamedFrom - destination path to the path it
 *   was renamed from, so both halves of a rename land in the same commit
 * @returns {{message: string, files: string[]}[]}
 */
export const parseGroups = (reply, actualPaths, renamedFrom = new Map()) => {
    const text = (reply ?? '').replace(/```[a-z]*\n?|```/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return [];

    let parsed;
    try {
        parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
        return [];
    }

    if (!Array.isArray(parsed.groups)) return [];

    const known = new Set(actualPaths);
    const used = new Set();
    const groups = [];

    for (const group of parsed.groups) {
        if (!group || typeof group.message !== 'string' || !Array.isArray(group.files)) continue;

        // Only real, not yet used paths survive.
        const files = group.files.filter(file => known.has(file) && !used.has(file));
        if (!files.length) continue;

        files.forEach(file => used.add(file));

        // A rename is one change in two places: staging the destination without
        // the source commits the new file and leaves the deletion uncommitted.
        const staged = [];
        for (const file of files) {
            const origin = renamedFrom.get(file);
            if (origin && !used.has(origin)) {
                used.add(origin);
                staged.push(origin);
            }
            staged.push(file);
        }

        groups.push({message: group.message.trim(), files: staged});
    }

    // Whatever the model forgot still has to be committed, renames included.
    const missing = actualPaths
        .filter(path => !used.has(path))
        .flatMap(path => {
            const origin = renamedFrom.get(path);
            return origin && !used.has(origin) ? [origin, path] : [path];
        });

    if (missing.length) {
        groups.push({message: 'chore: remaining changes', files: missing});
    }

    return groups;
}

/** Brings each group's message into the repository's configured types. */
const normaliseGroup = (group, files) => {
    const parsed = parseSubject(group.message);
    const entries = files.filter(file => group.files.includes(file.path));

    const type = parsed.type && isKnownType(parsed.type)
        ? parsed.type
        : detectType(entries);

    const scope = loadConfig().autoScope
        ? detectScope(entries, {allowed: loadConfig().scopes})
        : null;

    return {
        ...group,
        message: formatSubject({
            type: isKnownType(type) ? type : typeNames()[0],
            scope: parsed.scope ?? scope,
            sentence: parsed.sentence || 'update files',
        }),
    };
}

/**
 * Asks the model to divide the current change into commits.
 * @returns {Promise<{groups: {message: string, files: string[]}[], reason: string|null}>}
 */
export const planCommits = async (paths = ['.']) => {
    const collected = gitDiff.collect(paths);
    const actualPaths = collected.files.map(file => file.path);
    const renamedFrom = new Map(
        collected.files.filter(file => file.origPath).map(file => [file.path, file.origPath])
    );

    if (actualPaths.length < 2) {
        return {groups: [], reason: 'there is only one changed file'};
    }

    const ai = await resolveAi();
    if (!ai) return {groups: [], reason: 'no model is configured'};

    const cleaned = redact(collected.diff);
    const spinner = ora('Working out how to split this ... \n').start();

    try {
        const reply = await ai.provider.generate({
            prompt: buildPrompt({...collected, diff: cleaned.text}, MAX_GROUPS),
            apiKey: ai.apiKey,
            model: ai.model,
            baseUrl: ai.baseUrl,
        });

        const groups = parseGroups(reply, actualPaths, renamedFrom)
            .map(group => normaliseGroup(group, collected.files));

        if (groups.length < 2) {
            spinner.text = chalk.yellow('This looks like a single commit.');
            spinner.warn();
            return {groups: [], reason: 'the change does not divide cleanly'};
        }

        spinner.text = chalk.green(`Split into ${groups.length} commits.`);
        spinner.succeed();
        return {groups, reason: null};
    } catch (err) {
        spinner.text = chalk.red(`Could not plan the split: ${err.message}`);
        spinner.fail();
        return {groups: [], reason: err.message};
    }
}

export default {planCommits, parseGroups};
