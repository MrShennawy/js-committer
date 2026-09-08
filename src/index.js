#!/usr/bin/env node
import chalk from "chalk";
import inquirer from "./prompts/register.js";
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
import {setupAi, setApiKeyDirectly, ENV_VARIABLE_NAMES} from "./ai/settings.js";
import {withIssue} from "./support/issueKey.js";
import {setupJira, JIRA_ENV_NAMES} from "./jira/credentials.js";
import fetch from "./git/fetch.js";
import {canAmend, amendCommit, isLastCommitPushed, pushHint} from "./git/amend.js";
import {undoLastCommit} from "./git/undo.js";
import {version} from "./support/pkg.js";
import {runGuards} from "./questions/guards.js";

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

const HELP = `
 ${chalk.bold('cmt')} - craft standard git commit messages

 ${chalk.yellow('Usage')}
   cmt                 commit, with the message and type written for you
   cmt -s              pick which files to stage
   cmt -lc             reuse the last commit message
   cmt -b              run a build command first
   cmt -jr             link the commit to a Jira issue
   cmt --no-ai         write the message yourself this once

 ${chalk.yellow('Redoing things')}
   cmt --amend         rewrite the previous commit
   cmt --undo          undo the previous commit, keeping the changes
   cmt --dry-run       show what would happen and stop
   cmt -y              accept every confirmation, for scripts

 ${chalk.yellow('Setup')}
   cmt --setup         connect the AI and Jira
   cmt --set-key KEY   store a Google API key directly

   Credentials in the environment are picked up automatically, which is the
   best option for CI and shared machines:
     AI    ${ENV_VARIABLE_NAMES.join(', ')}
     Jira  ${JIRA_ENV_NAMES.join(', ')}
`;

/** Commands that configure the tool and exit, usable outside a repository. */
async function runStandaloneCommand() {
    if (flags.version) {
        console.log(version);
        return true;
    }

    if (flags.help) {
        console.log(HELP);
        return true;
    }

    if (flags.setKey) {
        const stored = await setApiKeyDirectly(flags.setKey);
        console.log(stored
            ? chalk.green('\n The key has been saved.\n')
            : chalk.red('\n The key was not saved.\n'));
        console.log(chalk.dim(` Tip: passing a key on the command line leaves it in your shell history.\n Setting ${ENV_VARIABLE_NAMES[0]} avoids that.\n`));
        process.exitCode = stored ? 0 : 1;
        return true;
    }

    if (flags.setup) {
        // A single choice list: the arrow keys move and Enter picks. A checkbox
        // needs space to toggle, so moving to an entry and pressing Enter ran
        // the one that happened to be ticked instead.
        const {part} = await inquirer.prompt([{
            type: 'list',
            name: 'part',
            prefix: `\n ${chalk.bold.red('❯')}`,
            suffix: '\n',
            message: 'What would you like to set up?',
            choices: [
                {value: 'ai', name: 'AI commit messages (Google Gemini)'},
                {value: 'jira', name: 'Jira issue linking'},
                {value: 'both', name: 'Both'},
                new inquirer.Separator(),
                {value: null, name: 'Cancel'},
            ],
        }]);

        if (part === 'ai' || part === 'both') await setupAi();
        if (part === 'jira' || part === 'both') await setupJira();
        if (!part) console.log(chalk.dim('\n Nothing to do.\n'));

        return true;
    }

    return false;
}

/** Prints the plan for --dry-run without touching the repository. */
function reportDryRun(paths, commitSentence) {
    console.log(chalk.yellow('\n Dry run, nothing was changed.\n'));
    console.log(` ${chalk.yellow('Would stage:')}  ${paths.join(', ')}`);
    console.log(` ${chalk.yellow('Would commit:')} ${chalk.green(commitSentence)}`);
    console.log(chalk.dim(`\n Run the same command without --dry-run to apply it.\n`));
}

async function main() {
    if (await runStandaloneCommand()) return;

    if (!isInsideRepo()) {
        console.error(chalk.red('\n Not a git repository. Run this inside a project tracked by git.\n'));
        process.exit(1);
    }

    if (flags.undo) {
        await undoLastCommit();
        return;
    }

    if (flags.amend) {
        const {ok, reason} = canAmend();
        if (!ok) {
            console.error(chalk.red(`\n Cannot amend: ${reason}.\n`));
            process.exit(1);
        }
    }

    greetings();

    // The network round trip overlaps with the questions that follow.
    if (!flags.dryRun) fetch.prefetch();

    const paths = await files();

    // Protected branch and secret checks, before anything is written.
    if (!await runGuards(paths)) {
        console.log(chalk.dim(' Stopped, nothing was committed.\n'));
        process.exit(0);
    }

    // -b runs the build first and aborts the commit when it fails.
    if (flags.build) await build();

    const commitData = await sentence(paths);
    const commitSentence = withIssue(commitData.sentence, commitData.issueId);

    console.log(`\n [ Your commit => ${chalk.green(commitSentence)} ] \n`);

    if (flags.dryRun) {
        reportDryRun(paths, commitSentence);
        return;
    }

    await add.command(paths);

    if (flags.amend) {
        const wasPushed = isLastCommitPushed();
        amendCommit(commitSentence);
        console.log(chalk.green('\n The previous commit has been rewritten.\n'));
        if (wasPushed) console.log(pushHint());
        return;
    }

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
