import {execFile} from "child_process";
import ora from "ora";
import chalk from "chalk";
import {confirm} from "../prompts/ask.js";
import fetch from "./fetch.js";
import config from "./config.js";
import git, {isBehindRemote, hasRemote} from "../support/git.js";

const askForPull = () => confirm({
    name: 'runPull',
    message: `You have new changes in your remote repository. Should you run ${chalk.bold.cyan('git pull')} ?`,
});

/** Names the unmerged files and the way out of them. */
const reportConflicts = (output) => {
    const unmerged = git(['diff', '--name-only', '--diff-filter=U'], {allowFail: true});

    if (!unmerged && !/conflict/i.test(output)) return;

    console.log(chalk.yellow('\n The pull left conflicts behind.'));

    if (unmerged) {
        console.log(chalk.yellow(' Unmerged files:'));
        for (const file of unmerged.split('\n')) console.log(`   ${chalk.red('•')} ${file}`);
    }

    console.log(chalk.dim(
        `\n Your commit is already made. Resolve the files above, then run\n` +
        `   ${chalk.cyan('git add <file>')} and ${chalk.cyan('git commit')} to finish the merge,\n` +
        ` or ${chalk.cyan('git merge --abort')} to undo the pull and try again later.\n`
    ));
}

const command = async () => {
    // Nothing to fetch and nothing to be behind when there is no remote.
    if (!hasRemote()) return false;

    await fetch.command();

    // Compare revisions instead of reading git's English status text, which
    // changes with the user's locale.
    if (!isBehindRemote()) return false;

    if (!await askForPull()) return false;

    if (!config.get('pull.rebase')) config.set('pull.rebase', 'false');

    console.log();

    const spinner = ora('Pulling... \n').start();
    return new Promise((resolve, reject) => {
        // Only the exit code decides success: git writes normal progress
        // information ("From github.com...") to stderr on a successful pull.
        execFile('git', ['pull'], (error, stdout, stderr) => {
            if (error) {
                spinner.text = chalk.red(`Pull (FAILED): ${stderr?.trim() || error.message}`);
                spinner.fail();

                reportConflicts(`${stdout}${stderr}`);

                reject(error);
                return;
            }

            spinner.text = chalk.green('Pull (DONE)');
            spinner.succeed();
            resolve(stdout.trim());
        });
    });
}

export default ({
    command,
})
