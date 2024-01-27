#!/usr/bin/env node
import {greetings} from "./misc/greetings.js";
import add from "./git/add.js";
import {commitLink} from "./git/commit.js";
import sentence from "./questions/commitSentence.js";
import chalk from "chalk";
import push from "./git/push.js";
import pull from "./git/pull.js";
import files from "./questions/files.js";
import {updateIssueCommitLink} from "./questions/jira.js";
import {readSettings} from "./store/handler.js";
import questions from "./jira/questions.js";
greetings();

const addFiles = await files();
const commit = await sentence();
const commitSentence = `${commit.type}: ${commit.sentence}` + (commit.issueId ? ` ❯ ${commit.issueId}` : '');

console.log(`\n [ Your commit => ${chalk.green(commitSentence)} ]\n`)

// await add.command(addFiles)
// await commit.command(commitSentence)
// await pull.command();
// await push.command();

const jiraCredential = readSettings('jira')
if (commit.issueId && jiraCredential.verified)
    await updateIssueCommitLink(commit.issueId, {customfield_10046: commitLink()})
