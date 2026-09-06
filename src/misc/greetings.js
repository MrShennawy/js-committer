import chalk from "chalk";
import status from "../git/status.js";
import branch from "../git/branch.js";
import commit from "../git/commit.js";
import DrawsBoxes from "./DrawsBoxes.js";
import flags from "../support/args.js";

const greetingsBox = ({body, info, hint, color = 'gray'}) => {
    const box = (new DrawsBoxes).box({
        title: chalk.bold('Committer'),
        body,
        color,
        hint,
        info,
    });
    console.log(box);
}

export const greetings = () => {
    // Uses the porcelain output rather than git's English status text, so the
    // check keeps working under any locale.
    if (status.isClean() && !flags.build) {
        greetingsBox({
            body: chalk.yellow('Nothing to commit, working tree clean '),
            color: 'yellow',
        });
        process.exit(0);
    }

    const changesCount = status.changesCount();
    const lastCommit = commit.lastCommit({full: true, avoidArg: true});

    const boxContent = [
        '',
        `${chalk.yellow('Branch:')} ${branch.current()}`,
        `${chalk.yellow('Last commit:')} ${lastCommit ?? chalk.dim('none yet')}`,
    ];

    greetingsBox({
        body: boxContent.join('\n'),
        info: changesCount ? chalk.redBright(`${changesCount} Change${changesCount > 1 ? 's' : ''}`) : null,
    });
}
