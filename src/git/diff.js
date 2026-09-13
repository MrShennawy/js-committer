import git, {hasCommits} from "../support/git.js";

// Large diffs blow past the model's context window, so they are capped.
const MAX_DIFF_CHARS = 12000;

/**
 * Untracked files registered with `--intent-to-add` so far.
 *
 * Reading the changes has to touch the index to see new files at all, which
 * means a run that stops before committing would otherwise leave the repository
 * different from how it found it. Remembering what was registered makes that
 * reversible.
 */
const marked = new Set();

/** Registers untracked paths so their contents appear in the diff. */
const markNewFiles = (paths) => {
    const fresh = (git(['ls-files', '--others', '--exclude-standard', '--', ...paths], {allowFail: true}) ?? '')
        .split('\n')
        .filter(Boolean);

    if (!fresh.length) return;

    git(['add', '--intent-to-add', '--', ...fresh], {allowFail: true});
    fresh.forEach(path => marked.add(path));
};

/**
 * Puts the index back as it was, for a run that ends without committing.
 * `git reset` needs a commit to reset against, so a repository with no history
 * yet drops the entries instead.
 */
export const forgetNewFiles = () => {
    if (!marked.size) return;

    const paths = [...marked];
    marked.clear();

    if (hasCommits()) git(['reset', '--quiet', '--', ...paths], {allowFail: true});
    else git(['rm', '--cached', '--force', '--quiet', '--', ...paths], {allowFail: true});
};

/** After a real `git add` the content is staged properly; nothing to undo. */
export const keepNewFiles = () => marked.clear();

/** Arguments that compare the working tree with the last commit, when there is one. */
const baseArgs = () => (hasCommits() ? ['diff', 'HEAD'] : ['diff']);

/**
 * Parses `git diff --name-status` into records.
 * Lines look like "M\tsrc/a.js" or "R100\told.js\tnew.js".
 *
 * The path a rename came from is kept as well. Staging only the destination
 * commits half a rename: the deletion of the original is a separate change to
 * the index and is left behind without it.
 *
 * @returns {{status: string, path: string, origPath: string|null}[]}
 */
const parseNameStatus = (output) => output
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
        const parts = line.split('\t');
        const status = parts[0][0];
        const renamed = (status === 'R' || status === 'C') && parts.length >= 3;

        // Renames and copies list the destination path last.
        return {status, path: parts[parts.length - 1], origPath: renamed ? parts[1] : null};
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
 * @returns {{diff: string, stat: string, files: {status: string, path: string, origPath: string|null}[], truncated: boolean}}
 */
const collect = (paths = ['.']) => {
    // Records new files in the index without staging their content, keeping a
    // note of them so the index can be restored if nothing is committed.
    markNewFiles(paths);

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
    forgetNewFiles,
    keepNewFiles,
}
