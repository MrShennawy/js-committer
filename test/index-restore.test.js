import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * Reading the changes has to register untracked files in the index, or a new
 * file would reach the model as an empty diff. A run that then stops - a dry
 * run, a declined confirmation, Ctrl-C - has to put that back, or the tool
 * leaves the repository different from how it found it.
 */

const git = (dir, args) => execFileSync('git', args, {cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});

const repo = ({withCommit}) => {
    const dir = mkdtempSync(join(tmpdir(), 'committer-index-'));
    git(dir, ['init', '-q', '.']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);

    if (withCommit) {
        writeFileSync(join(dir, 'tracked.txt'), 'one\n');
        git(dir, ['add', 'tracked.txt']);
        git(dir, ['commit', '-qm', 'chore: first']);
    }

    writeFileSync(join(dir, 'brand-new.js'), 'export const value = 1;\n');
    return dir;
};

/** Runs the collect/restore pair in the repository and reports the status. */
const statusAround = (dir, finish) => JSON.parse(execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `process.chdir(${JSON.stringify(dir)});
     const {execFileSync} = await import('node:child_process');
     const diff = (await import(${JSON.stringify(new URL('../src/git/diff.js', import.meta.url).href)})).default;
     const status = () => execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim();

     const before = status();
     diff.collect(['.']);
     diff.collect(['.']);          // the guards read it, then the model does
     const during = status();
     diff.${finish}();
     process.stdout.write(JSON.stringify({before, during, after: status()}));`,
], {encoding: 'utf8'}));

test('a run that stops leaves the index exactly as it found it', () => {
    const dir = repo({withCommit: true});
    try {
        const {before, during, after} = statusAround(dir, 'forgetNewFiles');

        assert.match(before, /\?\? brand-new\.js/, 'the new file starts out untracked');
        assert.doesNotMatch(during, /\?\? brand-new\.js/, 'reading the change has to register it');
        assert.equal(after, before, 'and stopping has to put it back');
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('a repository with no commits yet is restored too', () => {
    // `git reset` needs something to reset against, so the empty repository
    // takes a different path and used to be left with a half-staged file.
    const dir = repo({withCommit: false});
    try {
        const {before, after} = statusAround(dir, 'forgetNewFiles');
        assert.equal(after, before);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('once the files are really staged there is nothing to undo', () => {
    const dir = repo({withCommit: true});
    try {
        const {during, after} = statusAround(dir, 'keepNewFiles');
        assert.equal(after, during, 'keeping them must not reach for the index');
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('changes that were already staged are left alone', () => {
    const dir = repo({withCommit: true});
    try {
        writeFileSync(join(dir, 'tracked.txt'), 'one\ntwo\n');
        git(dir, ['add', 'tracked.txt']);

        const {before, after} = statusAround(dir, 'forgetNewFiles');

        assert.match(before, /^M {2}tracked\.txt/m, 'the staged change is there to begin with');
        assert.equal(after, before, 'restoring must not unstage someone else\'s work');
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});
