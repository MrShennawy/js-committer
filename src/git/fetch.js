import {execFile} from "child_process";
import ora from "ora";
import chalk from "chalk";

const run = () => new Promise((resolve, reject) => {
    execFile('git', ['fetch'], (error, stdout, stderr) => {
        if (error) {
            error.detail = stderr?.trim() || error.message;
            reject(error);
            return;
        }
        resolve(stdout.trim());
    });
});

// Started at launch so the network round trip overlaps with the prompts.
let inFlight = null;

/** Kicks off a fetch in the background. Failures are held, not thrown. */
const prefetch = () => {
    if (!inFlight) inFlight = run().catch(error => error);
    return inFlight;
}

/** Awaits the fetch, showing a spinner for whatever time is left. */
const command = async () => {
    const spinner = ora('Fetching... \n').start();
    const result = await (inFlight ?? run().catch(error => error));

    if (result instanceof Error) {
        spinner.text = chalk.red(`Fetch (FAILED): ${result.detail ?? result.message}`);
        spinner.fail();
        throw result;
    }

    spinner.text = chalk.green('Fetched (DONE)');
    spinner.succeed();
    return result;
}

export default ({
    command,
    prefetch,
})
