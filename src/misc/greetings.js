import chalk from "chalk";
import status from "../git/status.js";
import branch from "../git/branch.js";
import commit, {commitLink} from "../git/commit.js";
import DrawsBoxes from "./DrawsBoxes.js";

const greetingsBox = ({body, info, color = 'gray'}) => {
    const box = (new DrawsBoxes).box({
        title: 'Committer',
        body,
        color,
        info,
    });
    console.log(box)
}

export const greetings = () => {
    // check repo Files status
    if(status.command().includes('nothing to commit')) {
        greetingsBox({
            body: chalk.black.bgYellowBright.bold(' Nothing to commit, working tree clean '),
            color: 'yellow'
        })
        process.exit(1);
    }

    const changesList = status.command(true).trim();
    const changesCount = changesList ? changesList.split("\n").length : 0;
    const boxContent = [
        '',
        `${chalk.yellow('Branch:')} ${branch.command('--show-current')}`,
        `${chalk.yellow('Last commit:')} ${commit.lastCommit({full: true, avoidArg: true})}`
    ];

    greetingsBox({
        body: boxContent.join('\n'),
        info: changesList ? chalk.redBright(`${changesCount} Change${changesCount > 1 ? 's' : ''}`) : null
    });
}