import chalk from "chalk";
import {confirm} from "../prompts/ask.js";
import {scanChanges, isProtectedBranch} from "../support/scan.js";
import loadConfig from "../support/config.js";
import branch from "../git/branch.js";
import gitDiff from "../git/diff.js";
import flags from "../support/args.js";

/**
 * The checks that run just before anything is staged.
 * Each one warns and asks; none of them refuses on its own, because only the
 * person knows whether a match is really a problem.
 *
 * @returns {Promise<boolean>} false when the user chose to stop
 */
export const runGuards = async (paths) => {
    const config = loadConfig();

    if (!await checkBranch(config)) return false;
    if (!await checkContents(paths, config)) return false;

    return true;
}

const checkBranch = async (config) => {
    const current = branch.current();
    if (!isProtectedBranch(current, config.protectedBranches)) return true;

    console.log(chalk.yellow(`\n You are about to commit straight to ${chalk.bold(current)}.`));

    // --yes must not silently push to a protected branch.
    if (flags.yes) {
        console.log(chalk.red(' Refusing to do that unattended. Run without --yes to confirm it.\n'));
        return false;
    }

    return confirm({
        name: 'protectedBranch',
        message: `Continue committing to ${chalk.bold(current)}?`,
        defaultValue: false,
    });
}

const checkContents = async (paths, config) => {
    if (!config.scanSecrets) return true;

    const {files, diff} = gitDiff.collect(paths);
    const findings = scanChanges(files, diff, {maxFileSizeMb: config.maxFileSizeMb});
    if (!findings.length) return true;

    console.log(chalk.yellow('\n Worth a second look before this is committed:\n'));
    for (const {path, label} of findings) {
        console.log(`   ${chalk.red('•')} ${chalk.bold(label)}${path === 'diff' ? '' : ` in ${path}`}`);
    }
    console.log();

    if (flags.yes) {
        console.log(chalk.red(' Refusing to commit these unattended. Run without --yes to confirm.\n'));
        return false;
    }

    return confirm({
        name: 'riskyContent',
        message: 'Commit anyway?',
        defaultValue: false,
    });
}

export default runGuards;
