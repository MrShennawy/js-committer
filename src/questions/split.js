import chalk from "chalk";
import inquirer from "../prompts/register.js";
import {confirm} from "../prompts/ask.js";
import {planCommits} from "../ai/split.js";
import commit from "../git/commit.js";
import git from "../support/git.js";
import {withIssue} from "../support/issueKey.js";
import {issueKeyFromBranch} from "../support/issueKey.js";
import branch from "../git/branch.js";
import flags from "../support/args.js";

/** Prints the plan the way it will be committed. */
const showPlan = (groups) => {
    console.log(chalk.yellow(`\n Planned ${groups.length} commits:\n`));

    groups.forEach((group, index) => {
        console.log(` ${chalk.bold(`${index + 1}.`)} ${chalk.green(group.message)}`);
        for (const file of group.files) console.log(`     ${chalk.dim(file)}`);
        console.log();
    });
}

/** Lets the user drop or reword a group before anything is committed. */
const reviewPlan = async (groups) => {
    let current = groups;

    for (;;) {
        showPlan(current);

        const {action} = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            prefix: ` ${chalk.bold.red('❯')}`,
            message: 'Commit these?',
            choices: [
                {value: 'go', name: `Yes, make ${current.length} commits`},
                {value: 'edit', name: 'Reword one of them'},
                {value: 'cancel', name: 'No, go back to a single commit'},
            ],
        }]);

        if (action === 'go') return current;
        if (action === 'cancel') return null;

        const {index} = await inquirer.prompt([{
            type: 'list',
            name: 'index',
            prefix: `\n ${chalk.bold.red('❯')}`,
            message: 'Which one?',
            choices: current.map((group, position) => ({value: position, name: group.message})),
        }]);

        const {message} = await inquirer.prompt([commit.sentence(current[index].message)]);
        current = current.map((group, position) => (
            position === index ? {...group, message: message.trim()} : group
        ));
    }
}

/**
 * Stages and commits one group at a time.
 *
 * Each commit is made from an index containing only that group's files, so the
 * commits stand alone even though they were prepared together.
 */
const applyPlan = async (groups, issueId) => {
    // Start from an empty index so nothing staged earlier leaks into group one.
    git(['reset'], {allowFail: true});

    for (const [index, group] of groups.entries()) {
        git(['add', '--', ...group.files]);

        const subject = withIssue(group.message, issueId);
        commit.command(subject);

        console.log(` ${chalk.green('✔')} ${index + 1}/${groups.length} ${subject}`);
    }

    console.log();
}

/**
 * The --split flow.
 * @returns {Promise<boolean>} true when the changes were committed here
 */
export default async (paths) => {
    const {groups, reason} = await planCommits(paths);

    if (!groups.length) {
        console.log(chalk.dim(`\n Not splitting: ${reason}. Continuing with a single commit.\n`));
        return false;
    }

    const chosen = flags.yes ? groups : await reviewPlan(groups);
    if (!chosen) return false;

    const issueId = issueKeyFromBranch(branch.current());

    if (!flags.yes) {
        const agreed = await confirm({
            name: 'applySplit',
            message: `Create ${chosen.length} commits now?`,
        });
        if (!agreed) return false;
    }

    console.log();
    await applyPlan(chosen, issueId);
    return true;
}
