import chalk from "chalk";
import git, {hasCommits, isBehindRemote} from "../support/git.js";

/**
 * Rewrites the previous commit.
 *
 * Amending after a push would need a force push, which is not something the
 * tool should do on the user's behalf, so that case is reported instead.
 */
export const isLastCommitPushed = () => {
    const upstream = git(['rev-parse', '--abbrev-ref', '@{u}'], {allowFail: true});
    if (!upstream) return false;

    const contains = git(['branch', '--remotes', '--contains', 'HEAD'], {allowFail: true});
    return Boolean(contains);
}

export const canAmend = () => {
    if (!hasCommits()) return {ok: false, reason: 'there is no commit to amend yet'};
    return {ok: true, reason: null};
}

/** Replaces the previous commit, keeping whatever is currently staged. */
export const amendCommit = (message) => git(['commit', '--amend', '-m', message]);

export const pushHint = () => chalk.dim(
    `\n The previous commit was already pushed. To publish the amended version run\n` +
    ` ${chalk.cyan('git push --force-with-lease')}\n`
);

export default {canAmend, amendCommit, isLastCommitPushed, pushHint, isBehindRemote};
