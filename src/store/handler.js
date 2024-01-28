import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const readSettings = (fileName) => {
    const filePath = join(__dirname, `${fileName}.json`);

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
    const filePath = join(__dirname, `${fileName}.json`);
    const folderPath = dirname(filePath);

    try {
        if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });
        writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        if (error.code === 'EACCES') {
            console.error(chalk.bgYellow.black(` The package cannot read or update ${fileName} file `));
            console.log()
            console.log(`Execute ${chalk.cyan(`sudo chown -R $(whoami) ${folderPath}`)} to enable the package to save and read credentials.`)
            console.log()
            process.exit(1);
        }
        console.error(`An error occurred while writing the file ${fileName}:`, error);
        throw error;
    }
}
