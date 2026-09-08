import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DEFAULTS} from '../src/support/config.js';

/** A throwaway repository holding the given .committerrc.json. */
const repoWith = (contents) => {
    const dir = mkdtempSync(join(tmpdir(), 'committerrc-'));
    execFileSync('git', ['init', '-q', dir], {stdio: 'ignore'});
    if (contents !== null) writeFileSync(join(dir, '.committerrc.json'), contents);
    return dir;
};

/** Loads the config in a child process, since the module caches per process. */
const loadIn = (dir) => JSON.parse(execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `process.chdir(${JSON.stringify(dir)});
     const {loadConfig} = await import(${JSON.stringify(new URL('../src/support/config.js', import.meta.url).href)});
     process.stdout.write(JSON.stringify(loadConfig()));`,
], {encoding: 'utf8'}));

test('a repository without a config file gets the defaults', () => {
    const dir = repoWith(null);
    try {
        const config = loadIn(dir);
        assert.deepEqual(config.types, DEFAULTS.types);
        assert.equal(config.configPath, null);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('declared values override the defaults and the rest are kept', () => {
    const dir = repoWith(JSON.stringify({types: ['feat', 'hotfix'], requireIssue: true}));
    try {
        const config = loadIn(dir);
        assert.deepEqual(config.types, ['feat', 'hotfix']);
        assert.equal(config.requireIssue, true);
        assert.deepEqual(config.protectedBranches, DEFAULTS.protectedBranches, 'untouched keys keep their default');
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('the ai block merges rather than replacing', () => {
    const dir = repoWith(JSON.stringify({ai: {provider: 'ollama'}}));
    try {
        const config = loadIn(dir);
        assert.equal(config.ai.provider, 'ollama');
        assert.equal(config.ai.model, DEFAULTS.ai.model, 'the other ai fields survive');
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

test('a malformed config file is ignored rather than fatal', () => {
    const dir = repoWith('{ this is not json');
    try {
        const config = loadIn(dir);
        assert.deepEqual(config.types, DEFAULTS.types);
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});
