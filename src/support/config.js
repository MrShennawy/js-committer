import {readFileSync, existsSync} from 'fs';
import {join} from 'path';
import chalk from "chalk";
import git from "./git.js";

/**
 * Per-repository settings.
 *
 * These belong to the project and are meant to be committed, unlike the
 * credentials in ~/.committer-configuration which belong to the person.
 */

const FILE_NAMES = ['.committerrc.json', '.committerrc'];

export const DEFAULTS = {
    // Conventional commit types offered to the model and accepted when parsing.
    types: ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'chore'],
    // When set, the scope must be one of these; empty means anything goes.
    scopes: [],
    // Detect a scope from the changed paths and include it in the message.
    autoScope: true,
    // Refuse to finish without an issue reference.
    requireIssue: false,
    // Prefix expected on issue keys, e.g. "SHEN". Empty accepts any project.
    jiraProject: '',
    // Remembered so -b does not ask for it every time.
    buildCommand: 'npm run build',
    // Conventional commits recommend keeping the subject short.
    maxSubjectLength: 72,
    // How many messages to choose between. 1 skips the picker entirely.
    suggestions: 3,
    // 'auto' adds a body to large changes, 'always' and 'never' are absolute.
    commitBody: 'auto',
    // What counts as large enough to deserve a body.
    bodyThreshold: {files: 5, diffChars: 4000},
    // Committing straight to these asks for confirmation first.
    protectedBranches: ['main', 'master', 'develop', 'production'],
    // Warn before staging likely secrets or very large files.
    scanSecrets: true,
    maxFileSizeMb: 5,
    // Which model writes the messages. See src/ai/providers. A provider set
    // here is the project's decision and overrides the user's own choice;
    // leaving it null lets each person pick.
    ai: {
        provider: null,
        model: null,
        baseUrl: null,
    },
};

/** The repository root, or the working directory when git cannot say. */
export const repoRoot = () => git(['rev-parse', '--show-toplevel'], {allowFail: true}) ?? process.cwd();

const readFrom = (directory) => {
    for (const name of FILE_NAMES) {
        const path = join(directory, name);
        if (!existsSync(path)) continue;

        try {
            return {data: JSON.parse(readFileSync(path, 'utf8')), path};
        } catch (error) {
            // A broken config must not stop a commit; the defaults still work.
            console.error(chalk.yellow(` Ignoring ${name}: ${error.message}`));
            return {data: {}, path};
        }
    }

    return {data: {}, path: null};
}

let cached = null;

/** Reads the repository config once and merges it over the defaults. */
export const loadConfig = ({reload = false} = {}) => {
    if (cached && !reload) return cached;

    const {data, path} = readFrom(repoRoot());

    cached = {
        ...DEFAULTS,
        ...data,
        // Nested objects merge rather than replace, so setting one AI field
        // does not silently drop the others.
        ai: {...DEFAULTS.ai, ...(data.ai ?? {})},
        bodyThreshold: {...DEFAULTS.bodyThreshold, ...(data.bodyThreshold ?? {})},
        configPath: path,
    };

    return cached;
}

export const config = () => loadConfig();

export default loadConfig;
