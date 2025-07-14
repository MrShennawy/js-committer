import {execSync} from "child_process";
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";
import {replaceArray} from "../support/helper.js";

const types = [
    {value: 'feat', short: 'feat', name: `${chalk.bold('feat:')} A new feature for the user.`},
    {value: 'fix', short: 'fix', name: `${chalk.bold('fix:')} A bug fix for the user.`},
    {value: 'docs', short: 'docs', name: `${chalk.bold('docs:')} Documentation only changes.`},
    {value: 'style', short: 'style', name: `${chalk.bold('style:')} Changes that do not affect the meaning of the code.`},
    {value: 'refactor', short: 'refactor', name: `${chalk.bold('refactor:')} A code change that neither fixes a bug nor adds a feature.`},
    {value: 'perf', short: 'perf', name: `${chalk.bold('perf:')} A code change that improves performance.`},
    {value: 'test', short: 'test', name: `${chalk.bold('test:')} Adding missing tests or correcting existing tests.`},
    {value: 'build', short: 'build', name: `${chalk.bold('build:')} Changes that affect the build system or external dependencies.`},
    {value: 'chore', short: 'chore', name: `${chalk.bold('chore:')} Other changes that don't modify src or test files.`},
];

const lastCommit = ({getType = false, getIssueId = false, full = false, avoidArg = false} = {}) => {
    if (![...process.argv].includes('-lc') && !avoidArg) return null;

    try {
        const log = execSync("git log --pretty=format:'%s'").toString().trim();
        if(full) return log.split('\n')[0];
        let lc = log.split('\n')[0].split(':');
        let type = lc[0];
        if (types.find(typ => typ.value === type)) {
            lc.shift()
            if (getType) return type;
        }
        const commit = lc.join().split('❯');
        if (!getIssueId) return commit[0].trim();
        if (commit[1]) return commit[1].trim();
        return null;
    } catch (err) {
        process.exit(1);
    }
}

export const commitLink = () => {
    try {
        const linkCommand = `echo "https://$(git config --get remote.origin.url | sed -e 's/\\.git$//' -e 's/^git@//' -e 's/:/\\//' -e 's/^https\\/\\/\\///')/commit/$(git rev-parse HEAD)"`;
        return execSync(linkCommand).toString().trim();
    } catch (err) {
        process.exit(1);
    }
}

const type = (def = null) => {
    return {
        type: 'rawlist',
        pageSize: 10,
        name: 'type',
        default: def ?? lastCommit({getType: true}),
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Select the desired commit type:',
        choices: types,
        validate: (type) => {
            if (!type) throw new RequiredError('You need to select type');
            return true;
        }
    }
}

const sentence = (def = null) => {
    return {
        type: 'default-editable-input',
        name: 'commit',
        default: def ?? lastCommit(),
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the commit sentence:',
        validate: (commit) => {
            if (!commit) throw new RequiredError('The commit sentence is required');
            return true;
        }
    }
}

const issueId = (def = null) => {
    return {
        type: 'default-editable-input',
        name: 'issueId',
        default: def ?? lastCommit({getIssueId: true}),
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the issue ID: ' +  (![...process.argv].includes('-jr') ? chalk.dim('(optional)') : ''),
        validate: (issueId) => {
            if([...process.argv].includes('-jr') && !issueId)
                throw new RequiredError('Issue id is required');
            return true;
        }
    }
}

const command = (commit) => {
    try {
        commit = replaceArray(commit, ['"'], [''])
        return execSync(`git commit -m "${commit}"`);
    } catch (err) {
        process.exit(1);
    }
}

export default {
    command,
    type,
    sentence,
    issueId,
    lastCommit
}