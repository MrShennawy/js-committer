import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs';
import {dirname, join} from 'path';
import chalk from "chalk";
import os from 'os';

const CONFIG_DIR = join(os.homedir(), '.committer-configuration');

// These files hold API tokens, so they stay readable by the owner only.
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

const settingsPath = (fileName) => join(CONFIG_DIR, `${fileName}.json`);

export const readSettings = (fileName) => {
    const filePath = settingsPath(fileName);

    if (!existsSync(filePath)) writeSettings(fileName, {});

    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        // A corrupted settings file should not stop the tool: start fresh.
        console.error(chalk.yellow(`Could not read ${fileName} settings, starting with an empty one.`));
        return {};
    }
}

export const writeSettings = (fileName, data) => {
    const filePath = settingsPath(fileName);
    const folderPath = dirname(filePath);

    try {
        if (!existsSync(folderPath)) mkdirSync(folderPath, {recursive: true, mode: DIR_MODE});
        writeFileSync(filePath, JSON.stringify(data, null, 4), {encoding: 'utf8', mode: FILE_MODE});
    } catch (error) {
        if (error.code === 'EACCES') {
            console.error(chalk.bgYellow.black(` The package is unable to read or update the 'store' folder `));
            console.log();
            if (["linux", "darwin"].includes(process.platform)) {
                console.log(`Execute ${chalk.cyan(`sudo chown -R $(whoami) ${folderPath}`)} to enable the package to save and read credentials.`);
            } else {
                console.log(`Change the ownership of the ${chalk.cyan(folderPath)} folder to your user.`);
            }
            console.log();
            process.exit(1);
        }
        console.error(`An error occurred while writing the file ${fileName}:`, error);
        throw error;
    }
}
