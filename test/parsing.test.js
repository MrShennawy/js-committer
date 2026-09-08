import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSubject, formatSubject, remoteToHttpUrl} from '../src/git/commit.js';
import status from '../src/git/status.js';

test('parseSubject keeps colons that belong to the description', () => {
    assert.deepEqual(parseSubject('feat: support a:b syntax'), {
        type: 'feat',
        scope: null,
        breaking: false,
        sentence: 'support a:b syntax',
        issueId: null,
    });
});

test('parseSubject extracts the issue id', () => {
    assert.deepEqual(parseSubject('fix: broken login ❯ ABC-12'), {
        type: 'fix',
        scope: null,
        breaking: false,
        sentence: 'broken login',
        issueId: 'ABC-12',
    });
});

test('parseSubject leaves an unknown prefix in the sentence', () => {
    assert.deepEqual(parseSubject('wip: something'), {
        type: null,
        scope: null,
        breaking: false,
        sentence: 'wip: something',
        issueId: null,
    });
});

test('parseSubject reads a scope and a breaking marker', () => {
    const parsed = parseSubject('refactor(core)!: drop the legacy loader');
    assert.equal(parsed.type, 'refactor');
    assert.equal(parsed.scope, 'core');
    assert.equal(parsed.breaking, true);
    assert.equal(formatSubject(parsed), 'refactor(core)!: drop the legacy loader');
});

test('remoteToHttpUrl normalises every remote form', () => {
    const cases = [
        ['git@github.com:owner/repo.git', 'https://github.com/owner/repo'],
        ['https://github.com/owner/repo.git', 'https://github.com/owner/repo'],
        ['ssh://git@github.com/owner/repo.git', 'https://github.com/owner/repo'],
        ['ssh://git@gitlab.com:2222/owner/repo.git', 'https://gitlab.com/owner/repo'],
        ['https://user@bitbucket.org/owner/repo.git', 'https://bitbucket.org/owner/repo'],
    ];

    for (const [remote, expected] of cases) {
        assert.equal(remoteToHttpUrl(remote), expected, remote);
    }
});

test('describe labels single and combined status letters', () => {
    assert.equal(status.describe({x: '?', y: '?'}), 'Untracked');
    assert.equal(status.describe({x: 'M', y: ' '}), 'modified');
    assert.equal(status.describe({x: 'A', y: 'M'}), 'added + modified');
    assert.equal(status.describe({x: 'R', y: ' '}), 'renamed');
});
