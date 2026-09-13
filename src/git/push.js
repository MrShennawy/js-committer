import {execFile} from "child_process";
import ora from "ora";
import chalk from "chalk";
import {confirm} from "../prompts/ask.js";
import branch from "./branch.js";
import git, {hasRemote} from "../support/git.js";

const askForPush = () => confirm({
    name: 'runPush',
    message: `Run ${chalk.bold.cyan('git push')} ?`,
});

/** Sets the upstream on the first push of a branch, pushes normally after that. */
const pushArgs = () => {
    const currentBranch = branch.current();
    const remoteBranch = git(['ls-remote', '--heads', 'origin', currentBranch], {allowFail: true});

    if (!remoteBranch) return ['push', '--set-upstream', 'origin', currentBranch];
    return ['push', 'origin', currentBranch];
}

const command = async () => {
    // Offering to push a repository with no remote only ever ends in git's
    // "Could not read from remote repository", after the commit is already made.
    if (!hasRemote()) return false;

    if (!await askForPush()) return false;

    console.log();

    const spinner = ora('Pushing... \n').start();
    return new Promise((resolve, reject) => {
        execFile('git', pushArgs(), (error, stdout, stderr) => {
            if (error) {
                spinner.text = chalk.red(`Push (FAILED): ${stderr?.trim() || error.message}`);
                spinner.fail();
                reject(error);
                return;
            }

            spinner.text = chalk.green('Push (DONE)');
            spinner.succeed();
            resolve(true);
        });
    });
}

export default ({
    command,
})
