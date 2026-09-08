import ora from "ora";
import chalk from "chalk";
import inquirer from "../prompts/register.js";
import commit from "../git/commit.js";
import branch from "../git/branch.js";
import {findIssue, addComment, searchIssues} from "../jira/handler.js";
import {resolveCredentials, storedCredentials} from "../jira/credentials.js";
import {issueKeyFromBranch} from "../support/issueKey.js";
import flags from "../support/args.js";

// Everything still open and assigned to whoever the token belongs to.
const MY_OPEN_ISSUES = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

/** Confirms the key found in the branch name, which is the common case. */
const confirmBranchKey = async (key) => {
    const {useIt} = await inquirer.prompt([{
        type: 'enhanced-confirm',
        name: 'useIt',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: `Use ${chalk.cyan(key)} from your branch name?`,
        default: true,
    }]);

    return useIt ? key : null;
}

/** Offers the issues currently assigned to the user, so nothing is typed. */
const pickFromMyIssues = async (credentials) => {
    const spinner = ora('Looking up your open issues ... \n').start();

    let issues = [];
    try {
        const result = await searchIssues(MY_OPEN_ISSUES, 'summary,issuetype', credentials);
        issues = result?.issues ?? [];
        spinner.stop();
    } catch (err) {
        // Not being able to list issues is not fatal: fall back to typing one.
        spinner.stop();
        console.log(chalk.dim(` Could not list your issues (${err.message}).`));
        return null;
    }

    if (!issues.length) return null;

    const {key} = await inquirer.prompt([{
        type: 'list',
        name: 'key',
        pageSize: 12,
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'Which issue is this commit for?',
        choices: [
            ...issues.map(issue => ({
                value: issue.key,
                short: issue.key,
                name: `${chalk.cyan(issue.key.padEnd(12))} ${issue.fields?.summary ?? ''}`,
            })),
            new inquirer.Separator(),
            {value: null, name: 'Enter a different key'},
        ],
    }]);

    return key;
}

/**
 * Works out which issue the commit belongs to, in order of least effort:
 * the branch name, then the user's own open issues, then typing it.
 */
const pickIssueKey = async (credentials) => {
    const fromBranch = issueKeyFromBranch(branch.current());
    if (fromBranch) {
        const confirmed = await confirmBranchKey(fromBranch);
        if (confirmed) return confirmed;
    }

    const picked = await pickFromMyIssues(credentials);
    if (picked) return picked;

    const answers = await inquirer.prompt([commit.issueId(null, {required: true})]);
    return answers.issueId?.trim() || null;
}

/** Reads the summary and type of the chosen issue. */
const fetchIssue = async (key, credentials) => {
    const spinner = ora(`Getting ${key} ... \n`).start();

    try {
        const issue = await findIssue(key, 'summary,issuetype', credentials);
        spinner.text = chalk.green(`${key}: ${issue.fields?.summary ?? ''}`);
        spinner.succeed();
        return {issueId: key, ...issue.fields};
    } catch (err) {
        spinner.text = chalk.red(`Could not read ${key}: ${err.message}`);
        spinner.fail();

        // The key is still usable in the commit message even if Jira is unhappy.
        return {issueId: key};
    }
}

export const updateIssueCommitLink = async (issueNumber, commentBody) => {
    if (!storedCredentials()) return;

    const spinner = ora('Updating issue').start();

    try {
        await addComment(issueNumber, commentBody);
        spinner.text = chalk.green('The issue has been updated');
        spinner.succeed();
    } catch (err) {
        spinner.fail();
        console.error('\n' + chalk.bgYellow.black(` ${err.message} `) + '\n');
    }
}

export default async () => {
    if (!flags.jira) return null;

    const credentials = await resolveCredentials();
    if (!credentials) return null;

    const key = await pickIssueKey(credentials);
    if (!key) return null;

    return fetchIssue(key, credentials);
}
