import chalk from "chalk";
import inquirer from "./register.js";
import flags from "../support/args.js";

const ARROW = `${chalk.bold.red('❯')}`;

/**
 * A yes/no question that answers itself under --yes.
 *
 * Every confirmation in the tool goes through here, so an unattended run
 * cannot stall on a prompt nobody is there to answer.
 */
export const confirm = async ({name = 'answer', message, defaultValue = true, prefix = `\n ${ARROW}`}) => {
    if (flags.yes) return defaultValue;

    const answers = await inquirer.prompt([{
        type: 'enhanced-confirm',
        name,
        prefix,
        message,
        default: defaultValue,
    }]);

    return answers[name];
}

export default {confirm};
