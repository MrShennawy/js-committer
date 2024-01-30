#!/usr/bin/env node
import {greetings} from "./misc/greetings.js";
import add from "./git/add.js";
import commit, {commitLink} from "./git/commit.js";
import sentence from "./questions/commitSentence.js";
import chalk from "chalk";
import push from "./git/push.js";
import pull from "./git/pull.js";
import files from "./questions/files.js";
import {updateIssueCommitLink} from "./questions/jira.js";

greetings();

const addFiles = await files();
const commitData = await sentence();
const commitSentence = `${commitData.type}: ${commitData.sentence}` + (commitData.issueId ? ` ❯ ${commitData.issueId}` : '');

console.log(`\n [ Your commit => ${chalk.green(commitSentence)} ]`)

await add.command(addFiles)
await commit.command(commitSentence)

await pull.command()

const pushStatus = await push.command();

if (commitData.issueId && [...process.argv].includes('-jr')) {
    await updateIssueCommitLink(commitData.issueId, {customfield_10046: commitLink()})
} else {
    if(pushStatus) console.log(`\n[ Commit link => ${chalk.cyan(commitLink())} ] \n`)
}
