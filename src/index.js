#!/usr/bin/env node
import {greetings} from "./misc/greetings.js";
import add from "./git/add.js";
import commit, {commitLink} from "./git/commit.js";
import inquirer from "inquirer";
import chalk from "chalk";
import push from "./git/push.js";
import pull from "./git/pull.js";
import InputPrompt from './prompts/input.js'

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

inquirer.registerPrompt('input-editable-default', InputPrompt);

const answers = await inquirer.prompt(questions)

if(answers.files !== undefined) files = answers.files.join(" ");

const commitSentence = `${answers.type}: ${answers.commit.trim()}` + (answers.issueId ? ` ❯ ${answers.issueId.trim()}` : '');

console.log(`\n [ Your commit => ${chalk.green(commitSentence)} ]\n`)

await add.command(files)
await commit.command(commitSentence)
await pull.command();
await push.command();
console.log(`\n [ Commit link => ${chalk.cyan(commitLink())} ] \n`)