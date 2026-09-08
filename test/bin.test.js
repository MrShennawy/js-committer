import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const gitMode = (path) => {
    try {
        const entry = execFileSync('git', ['ls-files', '-s', '--', path], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        return entry ? entry.split(' ')[0] : null;
    } catch {
        // Installed from a tarball rather than a checkout: nothing to check.
        return null;
    }
};

test('every bin entry starts with a shebang', () => {
    for (const target of Object.values(pkg.bin)) {
        const firstLine = readFileSync(join(root, target), 'utf8').split('\n')[0];
        assert.equal(firstLine, '#!/usr/bin/env node', target);
    }
});

test('every bin entry is executable in git', () => {
    for (const target of Object.values(pkg.bin)) {
        const mode = gitMode(target);
        if (mode === null) continue;

        // Losing this bit makes the installed command fail with
        // "permission denied", which is not obviously a packaging problem.
        assert.equal(mode, '100755', `${target} must be committed as executable`);
    }
});
