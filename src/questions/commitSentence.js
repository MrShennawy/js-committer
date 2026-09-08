import chalk from "chalk";
import inquirer from "../prompts/register.js";
import commit, {parseSubject} from "../git/commit.js";
import branch from "../git/branch.js";
import jiraQuestions from './jira.js';
import {generateSuggestions} from "../ai/generate.js";
import {issueKeyFromBranch} from "../support/issueKey.js";
import flags from "../support/args.js";
import loadConfig from "../support/config.js";

const WRITE_MY_OWN = Symbol('write my own');
const REGENERATE = Symbol('regenerate');

/** Lets the user pick between the generated messages. */
const chooseMessage = async (messages) => {
    const {choice} = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        pageSize: 10,
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'Pick the commit message:',
        choices: [
            ...messages.map(message => ({value: message, name: message, short: message})),
            new inquirer.Separator(),
            {value: WRITE_MY_OWN, name: 'Write my own'},
            {value: REGENERATE, name: 'Suggest something else'},
        ],
    }]);

    return choice;
}

/** The editable single line prompt, used directly when there is nothing to pick. */
const editMessage = async (suggestion) => {
    const {commit: message} = await inquirer.prompt([commit.sentence(suggestion)]);
    return message;
}

/** Shows the generated body and asks whether to keep it. */
const confirmBody = async (body) => {
    console.log(`\n ${chalk.yellow('Suggested body:')}`);
    for (const line of body.split('\n')) console.log(`   ${chalk.dim(line)}`);

    const {keep} = await inquirer.prompt([{
        type: 'list',
        name: 'keep',
        prefix: `\n ${chalk.bold.red('❯')}`,
        message: 'Include this body in the commit?',
        choices: [
            {value: true, name: 'Yes, include it'},
            {value: false, name: 'No, subject only'},
        ],
    }]);

    return keep ? body : null;
}

/**
 * Asks everything needed to build the commit.
 *
 * The commit type is not asked for: it is detected from the diff and arrives
 * as part of the suggestions, which the user can pick from or overrule.
 *
 * @param {string[]} paths - the paths that are about to be staged
 */
export default async (paths = ['.']) => {
    const config = loadConfig();
    const issueData = await jiraQuestions();

    // -lc and --amend start from an existing message instead of generating one.
    const existing = (flags.lastCommit || flags.amend)
        ? commit.lastCommit({avoidArg: flags.amend})
        : null;

    let message = existing;
    let body = null;

    if (!message) {
        let picked = REGENERATE;

        while (picked === REGENERATE) {
            const result = await generateSuggestions(paths, {
                summary: issueData?.summary,
                jiraIssueType: issueData?.issuetype?.name,
            });

            body = result.body;

            // Nothing to choose between when only one message came back.
            if (flags.yes) {
                picked = result.messages[0];
                break;
            }

            picked = result.messages.length > 1
                ? await chooseMessage(result.messages)
                : WRITE_MY_OWN;

            if (picked === WRITE_MY_OWN) {
                picked = await editMessage(result.messages[0]);
                break;
            }

            // Regenerating with no model behind it would return the same text.
            if (picked === REGENERATE && !result.generated) picked = result.messages[0];
        }

        message = picked;
    } else if (!flags.yes) {
        message = await editMessage(existing);
    }

    if (body && !flags.yes) body = await confirmBody(body);

    const parsed = parseSubject(message);

    const output = {
        type: parsed.type,
        sentence: message.trim(),
        body,
        issueId: issueData?.issueId ?? null,
    };

    if (flags.yes) {
        output.issueId = output.issueId || issueKeyFromBranch(branch.current()) || null;
        return output;
    }

    // Only ask for an issue id when Jira did not already provide one.
    if (!output.issueId) {
        const answers = await inquirer.prompt([commit.issueId(null, {required: config.requireIssue})]);
        output.issueId = answers.issueId?.trim() || null;
    }

    return output;
}
