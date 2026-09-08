import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import git, {hasCommits} from "../support/git.js";
import flags from "../support/args.js";
import branch from "./branch.js";
import {splitIssue, withIssue, issueKeyFromBranch} from "../support/issueKey.js";
import loadConfig from "../support/config.js";

// Descriptions for the standard types, used when prompting the model. A type
// added through .committerrc simply has no description here.
const TYPE_DESCRIPTIONS = {
    feat: 'a new feature for the user',
    fix: 'a bug fix for the user',
    docs: 'documentation only changes',
    style: 'changes that do not affect the meaning of the code',
    refactor: 'a code change that neither fixes a bug nor adds a feature',
    perf: 'a code change that improves performance',
    test: 'adding missing tests or correcting existing tests',
    build: 'changes that affect the build system or external dependencies',
    chore: 'other changes that do not modify src or test files',
    ci: 'changes to the continuous integration configuration',
    revert: 'reverting a previous commit',
};

/** The types this repository accepts, from .committerrc or the defaults. */
export const typeNames = () => loadConfig().types;

/** True when the value is one of this repository's commit types. */
export const isKnownType = (value) => typeNames().includes(value);

/** The types with their descriptions, for the model prompt. */
export const typeGuide = () => typeNames()
    .map(name => `- ${name}: ${TYPE_DESCRIPTIONS[name] ?? 'a project specific change type'}`)
    .join('\n');

// A conventional commit prefix: a type, an optional scope and an optional "!"
// marking a breaking change, e.g. "feat", "fix(api)" or "refactor(core)!".
const PREFIX_PATTERN = /^([a-zA-Z]+)(?:\(([^)]*)\))?(!?)$/;

/**
 * Splits a commit subject into its parts.
 * Only the first colon separates the prefix from the description, so a subject
 * such as "feat: support a:b syntax" keeps its remaining colons.
 *
 * @param {string} subject
 * @returns {{type: string|null, scope: string|null, breaking: boolean, sentence: string, issueId: string|null}}
 */
export const parseSubject = (subject) => {
    let rest = subject ?? '';
    let type = null;
    let scope = null;
    let breaking = false;

    const colon = rest.indexOf(':');
    if (colon !== -1) {
        const match = rest.slice(0, colon).trim().match(PREFIX_PATTERN);
        const candidate = match?.[1].toLowerCase();

        if (candidate && isKnownType(candidate)) {
            type = candidate;
            scope = match[2] || null;
            breaking = match[3] === '!';
            rest = rest.slice(colon + 1);
        }
    }

    const {sentence, issueId} = splitIssue(rest);
    return {type, scope, breaking, sentence, issueId};
};

/** Rebuilds a subject from its parts, preserving any scope and breaking marker. */
export const formatSubject = ({type, scope = null, breaking = false, sentence}) => {
    if (!type) return sentence;
    return `${type}${scope ? `(${scope})` : ''}${breaking ? '!' : ''}: ${sentence}`;
};

/**
 * Reads the subject of the most recent commit.
 * Returns null on a repository without commits instead of exiting, so the tool
 * still works on a freshly initialised repo.
 */
const lastCommit = ({getIssueId = false, full = false, avoidArg = false} = {}) => {
    if (!flags.lastCommit && !avoidArg) return null;
    if (!hasCommits()) return null;

    const subject = git(['log', '-1', '--pretty=%s'], {allowFail: true});
    if (!subject) return null;
    if (full) return subject;

    const parsed = parseSubject(subject);
    if (getIssueId) return parsed.issueId;

    // The type is part of the message now that it is no longer asked for
    // separately, so it belongs in the prefilled sentence.
    return withIssue(formatSubject(parsed), parsed.issueId);
};

/**
 * Converts any git remote URL into its browsable https form.
 * Handles scp-like (git@host:owner/repo), ssh://, git:// and https:// remotes.
 */
export const remoteToHttpUrl = (remote) => {
    const url = remote.trim().replace(/\/+$/, '').replace(/\.git$/, '');

    // scp-like syntax, e.g. git@github.com:owner/repo
    const scp = url.match(/^(?:[^@/]+@)?([\w.-]+):(?!\/)(.+)$/);
    if (scp) return `https://${scp[1]}/${scp[2]}`;

    // ssh:// git:// http(s):// - drop the user info and any ssh port
    const proto = url.match(/^(?:ssh|git|https?):\/\/(?:[^@/]+@)?(.+)$/);
    if (proto) return `https://${proto[1].replace(/:\d+\//, '/')}`;

    return url;
};

/**
 * Builds the web URL of the current HEAD commit.
 * Done in JavaScript rather than through `echo | sed` so it also works on
 * Windows and returns null instead of exiting when there is no remote.
 */
export const commitLink = () => {
    const remote = git(['config', '--get', 'remote.origin.url'], {allowFail: true});
    const sha = git(['rev-parse', 'HEAD'], {allowFail: true});
    if (!remote || !sha) return null;

    return `${remoteToHttpUrl(remote)}/commit/${sha}`;
};

const sentence = (def = null) => {
    return {
        type: 'default-editable-input',
        name: 'commit',
        default: def ?? lastCommit(),
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the commit message:',
        validate: (value) => {
            if (!value) throw new RequiredError('The commit sentence is required');
            return true;
        }
    }
}

const issueId = (def = null, {required = false} = {}) => {
    // A branch such as "feature/SHEN-33-add-login" already names the issue.
    const fromBranch = issueKeyFromBranch(branch.current());

    return {
        type: 'default-editable-input',
        name: 'issueId',
        default: def ?? fromBranch ?? lastCommit({getIssueId: true}),
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the issue ID: ' + (required ? '' : chalk.dim('(optional)')),
        validate: (value) => {
            if (required && !value) throw new RequiredError('Issue id is required');
            return true;
        }
    }
}

/**
 * Creates the commit. The message is passed as a separate process argument,
 * so quotes, backticks and $(...) inside it are never evaluated by a shell.
 */
const command = (message) => git(['commit', '-m', message]);

export default {
    command,
    sentence,
    issueId,
    lastCommit,
    typeNames,
    typeGuide,
}
