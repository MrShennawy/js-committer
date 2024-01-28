import {exec} from "child_process";
import ora from "ora";

const command = () => {
    const spinner = ora('Pushing... \n').start();
    return new Promise((resolve, reject) => {
        exec('git push').on('close', code => {
            if (code !== 0) {
                spinner.fail()
                reject();
                process.exit(1);
            }
            spinner.succeed()
            resolve();
        });
    });
}

export default ({
    command,
})