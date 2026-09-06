import ora from "ora";
import chalk from "chalk";
import inquirer from "../prompts/register.js";
import questions from "../jira/questions.js";
import commit from "../git/commit.js";
import {readSettings} from '../store/handler.js';
import {findIssue, addComment} from "../jira/handler.js";
import flags from "../support/args.js";

const getIssueData = async () => {
    const answers = await inquirer.prompt([commit.issueId()]);
    console.log();

    const spinner = ora('Getting Issue data').start();

    try {
        const issue = await findIssue(answers.issueId.trim(), 'summary,issuetype');
        spinner.succeed();
        return {issueId: answers.issueId.trim(), ...issue.fields};
    } catch (err) {
        spinner.fail();
        console.error('\n' + chalk.bgYellow.black(` ${err.message} `) + '\n');
        process.exit(1);
    }
}

export const updateIssueCommitLink = async (issueNumber, commentBody) => {
    const jiraCredential = readSettings('jira');
    if (!jiraCredential.verified) return;

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

    const jiraCredential = readSettings('jira');
    if (!jiraCredential.verified) await questions();

    return getIssueData();
}
