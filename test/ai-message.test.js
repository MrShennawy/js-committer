import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMessage} from '../src/ai/GoogleGenerativeAI.js';

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
