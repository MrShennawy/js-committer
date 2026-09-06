#!/usr/bin/env node
import chalk from "chalk";
import "./prompts/register.js";
import {greetings} from "./misc/greetings.js";
import {isInsideRepo} from "./support/git.js";
import flags from "./support/args.js";
import add from "./git/add.js";
import commit, {commitLink} from "./git/commit.js";
import pull from "./git/pull.js";
import push from "./git/push.js";
import files from "./questions/files.js";
import build from "./questions/build.js";
import sentence from "./questions/commitSentence.js";
import {updateIssueCommitLink} from "./questions/jira.js";

const ISSUE_SEPARATOR = '❯';

/** Atlassian document format body for the "commit link" comment. */
const commitComment = (link, description) => ({
    type: "doc",
    version: 1,
    content: [
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "(Commit link)",
                    marks: [{type: "link", attrs: {href: link, title: "Commit link"}}],
                },
                {
                    type: "text",
                    text: `: ${description}`,
                },
            ],
        },
    ],
});

async function main() {
    if (!isInsideRepo()) {
        console.error(chalk.red('\n Not a git repository. Run this inside a project tracked by git.\n'));
        process.exit(1);
    }

    greetings();

    const paths = await files();

    // -b runs the build first and aborts the commit when it fails.
    if (flags.build) await build();

    const commitData = await sentence(paths);
    const commitSentence = commitData.sentence + (commitData.issueId ? ` ${ISSUE_SEPARATOR} ${commitData.issueId}` : '');

    console.log(`\n [ Your commit => ${chalk.green(commitSentence)} ] \n`);

    await add.command(paths);
    commit.command(commitSentence);
    await pull.command();

    const pushStatus = await push.command();
    const link = commitLink();

    if (commitData.issueId && flags.jira && link) {
        await updateIssueCommitLink(commitData.issueId, commitComment(link, commitData.sentence));
    }

    if (pushStatus && link) console.log(`\n[ Commit link => ${chalk.cyan(link)} ] \n`);
}

// Restore the terminal cursor that ora hides before leaving.
const exitGracefully = () => {
    process.stdout.write('\x1B[?25h'); // show the cursor again
    console.log('\nExiting gracefully...');
    process.exit(0);
};

process.on('SIGINT', exitGracefully);
process.on('SIGTERM', exitGracefully);

main().catch(err => {
    process.stdout.write('\x1B[?25h'); // show the cursor again
    console.error(chalk.red(`\nError: ${err?.message ?? err}\n`));
    process.exit(1);
});
