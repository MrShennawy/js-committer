import inquirer from "../prompts/register.js";
import commit, {parseSubject} from "../git/commit.js";
import jiraQuestions from './jira.js';
import {generateCommitMessage} from "../ai/GoogleGenerativeAI.js";
import branch from "../git/branch.js";
import {issueKeyFromBranch} from "../support/issueKey.js";
import flags from "../support/args.js";
import loadConfig from "../support/config.js";

/**
 * Asks everything needed to build the commit subject.
 *
 * The commit type is not asked for: it is detected from the diff and arrives as
 * part of the suggested message, which the user can still edit.
 *
 * @param {string[]} paths - the paths that are about to be staged
 */
export default async (paths = ['.']) => {
    const issueData = await jiraQuestions();

    // -lc reuses the previous message; anything else asks the model, which
    // also decides the commit type.
    let suggestion = (flags.lastCommit || flags.amend) ? commit.lastCommit({avoidArg: flags.amend}) : null;

    if (!suggestion) {
        suggestion = await generateCommitMessage(paths, {
            summary: issueData?.summary,
            jiraIssueType: issueData?.issuetype?.name,
        });
    }

    // Under --yes nothing is asked: the suggestion is taken as written and the
    // issue reference comes from Jira or the branch name.
    if (flags.yes) {
        const issueId = issueData?.issueId ?? issueKeyFromBranch(branch.current());
        return {
            type: parseSubject(suggestion).type,
            sentence: suggestion.trim(),
            issueId: issueId || null,
        };
    }

    const {commit: message} = await inquirer.prompt([commit.sentence(suggestion)]);

    const output = {
        type: parseSubject(message).type,
        sentence: message.trim(),
        issueId: issueData?.issueId ?? null,
    };

    // Only ask for an issue id when Jira did not already provide one.
    if (!output.issueId) {
        const required = loadConfig().requireIssue;
        const answers = await inquirer.prompt([commit.issueId(null, {required})]);
        output.issueId = answers.issueId?.trim() || null;
    }

    return output;
}
