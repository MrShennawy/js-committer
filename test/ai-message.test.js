import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveMessage} from '../src/ai/generate.js';

test('a well formed reply is kept as is', () => {
    assert.deepEqual(resolveMessage('feat: add user authentication', 'fix'), {
        message: 'feat: add user authentication',
        corrected: false,
    });
});

test('markdown fences and extra lines are stripped', () => {
    assert.equal(resolveMessage('```\nfix: resolve login crash\n```', 'chore').message, 'fix: resolve login crash');
});

test('a colon inside the description survives', () => {
    assert.equal(resolveMessage('feat: support a:b syntax', 'chore').message, 'feat: support a:b syntax');
});

test('a scoped or breaking type is valid conventional syntax and is kept', () => {
    assert.deepEqual(resolveMessage('chore(deps): bump lodash', 'build'), {
        message: 'chore(deps): bump lodash',
        corrected: false,
    });

    assert.deepEqual(resolveMessage('feat(api)!: drop v1 endpoints', 'fix'), {
        message: 'feat(api)!: drop v1 endpoints',
        corrected: false,
    });
});

test('an invented type falls back to the detected one, keeping the wording', () => {
    assert.deepEqual(resolveMessage('wip: half done', 'fix'), {
        message: 'fix: wip: half done',
        corrected: true,
    });
});

test('a reply with no type at all gets the detected type', () => {
    assert.deepEqual(resolveMessage('add a new reporting endpoint', 'feat'), {
        message: 'feat: add a new reporting endpoint',
        corrected: true,
    });
});

test('an issue id echoed by the model is dropped', () => {
    assert.equal(resolveMessage('feat: add endpoint ❯ ABC-12', 'chore').message, 'feat: add endpoint');
});

test('an empty reply asks the caller to use its fallback', () => {
    assert.equal(resolveMessage('', 'fix'), null);
    assert.equal(resolveMessage(undefined, 'fix'), null);
});

/** Resolves a message inside a repository that restricts its scopes. */
const resolveIn = (scopes, reply) => {
    const dir = mkdtempSync(join(tmpdir(), 'committer-scopes-'));
    execFileSync('git', ['init', '-q', dir], {stdio: 'ignore'});
    writeFileSync(join(dir, '.committerrc.json'), JSON.stringify({scopes}));

    try {
        // The config is cached per process, so each case needs its own.
        return JSON.parse(execFileSync(process.execPath, [
            '--input-type=module',
            '-e',
            `process.chdir(${JSON.stringify(dir)});
             const {resolveMessage} = await import(${JSON.stringify(new URL('../src/ai/generate.js', import.meta.url).href)});
             process.stdout.write(JSON.stringify(resolveMessage(${JSON.stringify(reply)}, 'fix')));`,
        ], {encoding: 'utf8'}));
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
};

test('a scope the project does not list is dropped rather than committed', () => {
    // The model is told not to invent a scope and invents one anyway. An
    // unlisted scope is worse than none: it breaks the convention the list
    // exists to enforce.
    assert.deepEqual(resolveIn(['api', 'web'], 'feat(billing): add invoice export'), {
        message: 'feat: add invoice export',
        corrected: true,
    });
});

test('a scope the project does list is kept', () => {
    assert.deepEqual(resolveIn(['api', 'web'], 'feat(api): add invoice export'), {
        message: 'feat(api): add invoice export',
        corrected: false,
    });
});

test('a project that lists no scopes accepts any of them', () => {
    assert.deepEqual(resolveIn([], 'feat(billing): add invoice export'), {
        message: 'feat(billing): add invoice export',
        corrected: false,
    });
});
