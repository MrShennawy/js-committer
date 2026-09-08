import git, {hasCommits} from "../support/git.js";

// Large diffs blow past the model's context window, so they are capped.
const MAX_DIFF_CHARS = 12000;

/** Arguments that compare the working tree with the last commit, when there is one. */
const baseArgs = () => (hasCommits() ? ['diff', 'HEAD'] : ['diff']);

/**
 * Parses `git diff --name-status` into records.
 * Lines look like "M\tsrc/a.js" or "R100\told.js\tnew.js".
 *
 * @returns {{status: string, path: string}[]}
 */
const parseNameStatus = (output) => output
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
        const parts = line.split('\t');
        const status = parts[0][0];
        // Renames and copies list the destination path last.
        return {status, path: parts[parts.length - 1]};
    });

/**
 * Collects the changes for the given paths.
 *
 * `git add --intent-to-add` is run first so that brand new (untracked) files
 * show up in the diff; without it the AI would receive an empty diff for any
 * newly created file. Comparing against HEAD also includes changes that are
 * already staged.
 *
 * @param {string[]} paths
 * @returns {{diff: string, stat: string, files: {status: string, path: string}[], truncated: boolean}}
 */
const collect = (paths = ['.']) => {
    // Records new files in the index without staging their content.
    git(['add', '--intent-to-add', '--', ...paths], {allowFail: true});

    const base = baseArgs();
    const stat = git([...base, '--stat', '--', ...paths], {allowFail: true}) ?? '';
    const nameStatus = git([...base, '--name-status', '--', ...paths], {allowFail: true}) ?? '';
    const full = git([...base, '--', ...paths], {allowFail: true}) ?? '';

    const truncated = full.length > MAX_DIFF_CHARS;

    return {
        diff: truncated ? `${full.slice(0, MAX_DIFF_CHARS)}\n... [diff truncated]` : full,
        stat,
        files: parseNameStatus(nameStatus),
        truncated,
    };
};

const command = (paths = ['.']) => collect(paths).diff;

export default {
    command,
    collect,
    parseNameStatus,
}
