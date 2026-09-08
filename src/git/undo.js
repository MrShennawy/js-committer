import chalk from "chalk";
import git, {hasCommits} from "../support/git.js";
import {isLastCommitPushed} from "./amend.js";
import {confirm} from "../prompts/ask.js";

/**
 * Undoes the previous commit while keeping its changes in the working tree.
 *
 * A commit that has already been pushed is left alone: undoing it locally
 * would only be publishable with a force push.
 */
export const undoLastCommit = async () => {
    if (!hasCommits()) {
        console.log(chalk.yellow('\n There is no commit to undo.\n'));
        return false;
    }

    const subject = git(['log', '-1', '--pretty=%s'], {allowFail: true});

    if (isLastCommitPushed()) {
        console.log(chalk.yellow(`\n ${subject}`));
        console.log(chalk.yellow(' That commit has already been pushed, so it is not undone here.'));
        console.log(chalk.dim(` Undo it deliberately with ${chalk.cyan('git reset --soft HEAD~1')} and a force push.\n`));
        return false;
    }

    console.log(`\n [ ${chalk.cyan(subject)} ]`);

    const agreed = await confirm({
        name: 'undo',
        message: 'Undo this commit and keep its changes staged?',
    });

    if (!agreed) return false;

    git(['reset', '--soft', 'HEAD~1']);
    console.log(chalk.green('\n Done. The changes are staged again.\n'));
    return true;
}

export default {undoLastCommit};
