import chalk from "chalk";
import status from "../git/status.js";
import branch from "../git/branch.js";
import commit, {commitLink} from "../git/commit.js";
import DrawsBoxes from "./DrawsBoxes.js";

export const greetings = () => {
    const changesList = status.command(true).trim();
    const boxContent = [
        '',
        `${chalk.yellow('Branch:')} ${branch.command('--show-current')}`,
        `${chalk.yellow('Last commit:')} ${commit.lastCommit({avoidArg: true})}`
    ];
    const box = (new DrawsBoxes).box({
        title: 'Committer',
        body: boxContent.join('\n'),
        info: changesList ? chalk.redBright(`${status.command(true).trim().split("\n").length} Changes`) : null
    });

    console.log(box);

    // check repo Files status
    if(status.command().includes('nothing to commit')) {
        console.log(chalk.black.bgYellowBright.bold(' Nothing to commit, working tree clean', "\n"));
        process.exit(1);
    }
}