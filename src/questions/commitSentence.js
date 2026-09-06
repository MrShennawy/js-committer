import inquirer from "../prompts/register.js";
import commit from "../git/commit.js";
import jiraQuestions from './jira.js';
import {generateCommitMessage} from "../ai/GoogleGenerativeAI.js";

/**
 * Asks everything needed to build the commit subject.
 * @param {string[]} paths - the paths that are about to be staged
 */
export default async (paths = ['.']) => {
    const issueData = await jiraQuestions();

    const {type} = await inquirer.prompt([
        commit.type(issueData?.issuetype?.name === 'Fix' ? 'fix' : null)
    ]);

    const suggestion = await generateCommitMessage(type, issueData?.summary, paths);
    const {commit: message} = await inquirer.prompt([commit.sentence(suggestion)]);

    const output = {
        type,
        sentence: message.trim(),
        issueId: issueData?.issueId ?? null,
    };

    // Only ask for an issue id when Jira did not already provide one.
    if (!output.issueId) {
        const answers = await inquirer.prompt([commit.issueId()]);
        output.issueId = answers.issueId?.trim() || null;
    }

    return output;
}
