import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

// Resolved from this file rather than the working directory, so it still finds
// the manifest when cmt runs inside someone else's project.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
export const version = pkg.version;
export default pkg;
