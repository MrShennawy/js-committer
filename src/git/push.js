import {exec} from "child_process";
import ora from "ora";
import chalk from "chalk";

const command = () => {
    const spinner = ora('Pushing... \n').start();
    return new Promise((resolve, reject) => {
        exec('git push').on('close', code => {
            if (code !== 0) {
                spinner.text = chalk.red('Push (FAILED)');
                spinner.fail()
                reject();
                process.exit(1);

            }
            spinner.text = chalk.green('Push (DONE)');
            spinner.succeed()
            resolve();
        });
    });
}

export default ({
    command,
})