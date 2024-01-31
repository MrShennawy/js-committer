import inquirer from "inquirer";
import questions from "../jira/questions.js"
import commit from "../git/commit.js";
import {readSettings} from '../store/handler.js';
import ora from "ora";
import {findIssue, updateIssue} from "../jira/handler.js";
import chalk from "chalk";

const getIssueData = async () => {
    const answers = await inquirer.prompt(commit.issueId())
    console.error();
    let spinner = ora('Getting Issue data').start();
    let issueData = {};
    await findIssue(answers.issueId, 'summary,issuetype')
        .then(issue => {
            issueData = {issueId: answers.issueId, ...issue.fields};
            spinner.succeed()
        })
        .catch(err => {
            spinner.fail()
            console.error('\n' + chalk.bgYellow.black(err.errorMessages));
            process.exit(1);
        });
    return issueData;
}

export const updateIssueCommitLink = async(issueNumber, issueData) => {
    const jiraCredential = readSettings('jira')
    if(!jiraCredential.verified) return;
    let spinner = ora('Updating issue').start();
    await updateIssue(issueNumber, {fields: issueData})
        .then(issue => {
            spinner.text = chalk.green('The issue has been updated');
            spinner.succeed()
        })
        .catch(err => {
            spinner.fail()
            console.error('\n' + chalk.bgYellow.black(err.errorMessages));
            process.exit(1);
        });
}

export default async () => {
    if (![...process.argv].includes('-jr')) return null;
    const jiraCredential = readSettings('jira')
    if (!jiraCredential.verified) await questions()
    return getIssueData();
}