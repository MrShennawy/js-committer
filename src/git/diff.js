import git, {hasCommits} from "../support/git.js";

// Large diffs blow past the model's context window, so they are capped.
const MAX_DIFF_CHARS = 12000;

/**
 * Collects the changes for the given paths.
 *
 * `git add --intent-to-add` is run first so that brand new (untracked) files
 * show up in the diff; without it the AI would receive an empty diff for any
 * newly created file. Comparing against HEAD also includes changes that are
 * already staged.
 *
 * @param {string[]} paths
 * @returns {{diff: string, stat: string, truncated: boolean}}
 */
const collect = (paths = ['.']) => {
    // Records new files in the index without staging their content.
    git(['add', '--intent-to-add', '--', ...paths], {allowFail: true});

    const base = hasCommits() ? ['diff', 'HEAD', '--'] : ['diff', '--'];
    const stat = git([...base.slice(0, -1), '--stat', '--', ...paths], {allowFail: true}) ?? '';
    const full = git([...base, ...paths], {allowFail: true}) ?? '';

    const truncated = full.length > MAX_DIFF_CHARS;
    return {
        diff: truncated ? `${full.slice(0, MAX_DIFF_CHARS)}\n... [diff truncated]` : full,
        stat,
        truncated,
    };
};

const command = (paths = ['.']) => collect(paths).diff;

export default {
    command,
    collect,
}
