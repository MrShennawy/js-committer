import inquirer from "../prompts/register.js";
import add from "../git/add.js";
import flags from "../support/args.js";

/**
 * Resolves which paths to stage.
 * Returns an array so the paths can be passed to git as separate arguments,
 * which keeps names containing spaces intact.
 *
 * @returns {Promise<string[]>}
 */
export default async () => {
    if (!flags.selectFiles) return ['.'];

    const answers = await inquirer.prompt([await add.files()]);
    return answers.files;
}
