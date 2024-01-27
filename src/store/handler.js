import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function readSettings(fileName) {
    const filePath = join(__dirname, `${fileName}.json`);

    try {
        const data = readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`An error occurred while reading the file ${fileName}:`, error);
        throw error;
    }
}

export function writeSettings(fileName, data) {
    const filePath = join(__dirname, `${fileName}.json`);
    const folderPath = dirname(filePath);

    if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
    }

    try {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`An error occurred while writing the file ${fileName}:`, error);
        throw error;
    }
}
