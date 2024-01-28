import {getCurrentUser, findIssue, updateIssue} from "./jira/handler.js";
import { readSettings, writeSettings } from './store/handler.js';
import ora from 'ora';

let spinner = ora('Getting Issue data').start();

const issueNumber = 'ZLEO-172'
await findIssue(issueNumber, 'summary,issuetype,customfield_10046')
    .then(issue => {
        writeSettings('issue_'+issueNumber, issue.fields);
        spinner.succeed()
        // console.log(`Status: ${issue.fields.summary}`);
    })
    .catch(err => {
        spinner.fail()
        console.error(err);
    });


spinner = ora('Updating issue').start();

const issueData = readSettings('issue_'+issueNumber);

issueData.customfield_10046 = 'https://google.com'
await updateIssue(issueNumber, {fields: issueData})
    .then(issue => {
        // console.log(issue);
    })
    .catch(err => {
        console.error(err);
    });

spinner.succeed()
