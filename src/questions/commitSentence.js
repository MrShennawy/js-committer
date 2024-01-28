import inquirer from "inquirer";
import InputPrompt from "../prompts/input.js";
import commit from "../git/commit.js";
import jiraQuestions from './jira.js'
inquirer.registerPrompt('default-editable-input', InputPrompt);

export default async () => {
    const issueData = await jiraQuestions()

    const questions = [
        commit.type(issueData?.issuetype?.name === 'Fix' ? 'FIX': null),
        commit.sentence(issueData?.summary),
    ]

    if(!issueData?.issueId) questions.push(commit.issueId())

    const answers = await inquirer.prompt(questions)
    const issueId = issueData?.issueId ?? answers.issueId.trim();
    return {
        type: answers.type,
        sentence: answers.commit.trim(),
        issueId,
    }
}