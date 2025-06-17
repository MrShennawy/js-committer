import inquirer from "inquirer";
import InputPrompt from "../prompts/input.js";
import commit from "../git/commit.js";
import jiraQuestions from './jira.js'
inquirer.registerPrompt('default-editable-input', InputPrompt);
import {generateCommitMessage} from "../ai/GoogleGenerativeAI.js";

export default async () => {
    const issueData = await jiraQuestions()
    const askForType = await inquirer.prompt([commit.type(issueData?.issuetype?.name === 'Fix' ? 'FIX': null)])

    const commitMsg = await generateCommitMessage(askForType.type);
    const askForCommit = await inquirer.prompt([commit.sentence(commitMsg)])

    const questions = []

    if(!issueData?.issueId) questions.push(commit.issueId())
    const output = {
        type: askForType.type,
        sentence: askForCommit.commit.trim(),
    }
    if(questions.length) {
        const answers = await inquirer.prompt(questions)
        output.issueId = issueData?.issueId ?? answers.issueId.trim();
    }
    return output;
}