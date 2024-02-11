import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import chalk from "chalk";
import os from 'os';

const __committerConfiguration = `${os.homedir()}/.committer-configuration`;
export const readSettings = (fileName) => {
    const filePath = join(__committerConfiguration, `${fileName}.json`);

    if (!existsSync(filePath)) writeSettings(fileName, {})

    try {
        const data = readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`An error occurred while reading the file ${fileName}:`, error);
        throw error;
    }
}

export const writeSettings = (fileName, data) => {
    const filePath = join(__committerConfiguration, `${fileName}.json`);
    const folderPath = dirname(filePath);

    try {
        if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });
        writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        if (error.code === 'EACCES') {
            console.error(chalk.bgYellow.black(` The package is unable to read or update the 'store' folder `));
            console.log()
            if (["linux", "darwin"].includes(process.platform)) {
                console.log(`Execute ${chalk.cyan(`sudo chown -R $(whoami) ${folderPath}`)} to enable the package to save and read credentials.`)
            } else {
                console.log(`Change the ownership of the ${chalk.cyan(folderPath)} folder to your user.`);
            }
            console.log()
            process.exit(1);
        }
        console.error(`An error occurred while writing the file ${fileName}:`, error);
        throw error;
    }
}
