#!/usr/bin/env node
import {greetings} from "./misc/greetings.js";
import add from "./git/add.js";
import commit from "./git/commit.js";
import inquirer from "inquirer";
import chalk from "chalk";
import push from "./git/push.js";
import pull from "./git/pull.js";

greetings();

let files = '.';

let questions = [];

if([...process.argv].includes('-s')) {
    const filesQuestion = await add.files()
    questions.push(filesQuestion)
}

questions = [
    ...questions,
    commit.type,
    commit.sentence,
    commit.issueId
]

const answers = await inquirer.prompt(questions)

if(answers.files !== undefined) files = answers.files.join(" ");

const commitSentence = `${answers.type}: ${answers.commit}` + (answers.issueId ? ` - ${answers.issueId}` : '');

console.log(`\n [ Your commit => ${chalk.green(commitSentence)} ] \n`)

await add.command(files)
await commit.command(commitSentence)
await pull.command();
await push.command();