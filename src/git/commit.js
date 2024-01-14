import {execSync} from "child_process";
import chalk from "chalk";
import RequiredError from "../exceptions/RequiredError.js";

const types = [
    {value: 'FEATURE', short: 'FEATURE', name: `${chalk.bold('FEATURE:')} A new feature for the user.`},
    {value: 'FIX', short: 'FIX', name: `${chalk.bold('FIX:')} A bug fix for the user.`},
    {value: 'CHORE', short: 'CHORE', name: `${chalk.bold('CHORE:')} Routine tasks, maintenance, or refactors.`},
    {value: 'DOCS', short: 'DOCS', name: `${chalk.bold('DOCS:')} Documentation changes.`},
    {value: 'STYLE', short: 'STYLE', name: `${chalk.bold('STYLE:')} Code style changes (whitespace, formatting).`},
    {value: 'REFACTOR', short: 'REFACTOR', name: `${chalk.bold('REFACTOR:')} Code changes that neither fix a bug nor add a feature.`},
    {value: 'TEST', short: 'TEST', name: `${chalk.bold('TEST:')} Adding or modifying tests.`},
    {value: 'BUILD', short: 'BUILD', name: `${chalk.bold('BUILD:')} npm run build.`},
];

export default ({
    command(commit) {
        try {
            return execSync(`git commit -m ${commit}`);
        } catch (err) {
            process.exit(1);
        }
    },
    type: ({
        type: 'rawlist',
        pageSize: 10,
        name: 'type',
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Select the desired commit type:',
        choices: types,
        validate: (type) => {
            if (!type) throw new RequiredError('You need to select type');
            return true;
        }
    }),
    sentence: ({
        type: 'input',
        name: 'commit',
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the commit sentence:',
        validate: (commit) => {
            if (!commit) throw new RequiredError('The commit sentence is required');
            return true;
        }
    }),
    issueId: ({
        type: 'input',
        name: 'issueId',
        prefix: `\n ${chalk.bold.red('❯')}`,
        suffix: "\n",
        message: 'Enter the issue ID: '+chalk.dim('(optional)'),
    })
})