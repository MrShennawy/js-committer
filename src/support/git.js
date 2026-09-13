import {execFileSync} from "child_process";
import chalk from "chalk";

/**
 * Runs a git command without a shell.
 *
 * Using execFileSync with an argument array means user input (commit messages,
 * file paths) is never interpreted by the shell, so quotes, backticks, spaces
 * and $(...) are all safe.
 *
 * @param {string[]} args        git arguments, e.g. ['commit', '-m', message]
 * @param {boolean}  allowFail   return null instead of exiting when git fails
 * @param {boolean}  trim        trim the output; must be off for porcelain
 *                               output, where a leading space is a status flag
 * @returns {string|null} stdout
 */
export const git = (args, {allowFail = false, trim = true} = {}) => {
    try {
        // stderr is captured rather than inherited, so git's own noise never
        // leaks into the prompts; it is reported deliberately on failure.
        const output = execFileSync('git', args, {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        return trim ? output.trim() : output;
    } catch (err) {
        if (allowFail) return null;
        const detail = err.stderr?.toString().trim() || err.message;
        console.error(`\n${chalk.red.bold(`git ${args[0]} failed:`)} ${detail}\n`);
        process.exit(1);
    }
};

/** True when the current directory is inside a git working tree. */
export const isInsideRepo = () => git(['rev-parse', '--is-inside-work-tree'], {allowFail: true}) === 'true';

/**
 * True when the repository has somewhere to push to.
 * Without this, a local only repository ends every commit with git's
 * "Could not read from remote repository" and a failing exit code, which reads
 * like the commit went wrong when it did not.
 */
export const hasRemote = () => Boolean(git(['remote'], {allowFail: true}));

/** True when the repository already has at least one commit. */
export const hasCommits = () => git(['rev-parse', '--verify', 'HEAD'], {allowFail: true}) !== null;

/** True when the current branch has an upstream that is ahead of us. */
export const isBehindRemote = () => {
    const count = git(['rev-list', '--count', 'HEAD..@{u}'], {allowFail: true});
    return Number(count) > 0;
};

export default git;
