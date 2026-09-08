import test from 'node:test';
import assert from 'node:assert/strict';
import {splitIssue, withIssue, issueKeyFromBranch, looksLikeIssueKey} from '../src/support/issueKey.js';
import {normaliseHost} from '../src/jira/credentials.js';

test('a hyphen inside the description is not mistaken for the separator', () => {
    assert.deepEqual(splitIssue('update auth-service'), {sentence: 'update auth-service', issueId: null});
    assert.deepEqual(splitIssue('rename a - b'), {sentence: 'rename a - b', issueId: null});
    assert.deepEqual(splitIssue('support multi-word - names'), {sentence: 'support multi-word - names', issueId: null});
    assert.deepEqual(splitIssue('drop node - 18'), {sentence: 'drop node - 18', issueId: null});
});

test('a trailing issue key is split off', () => {
    assert.deepEqual(splitIssue('update auth-service ❯ SHEN-33'), {
        sentence: 'update auth-service',
        issueId: 'SHEN-33',
    });
    assert.deepEqual(splitIssue('fix login ❯ #42'), {sentence: 'fix login', issueId: '#42'});
});

test('the hyphen form is still read back, for Jira style keys only', () => {
    assert.deepEqual(splitIssue('update auth-service - SHEN-33'), {
        sentence: 'update auth-service',
        issueId: 'SHEN-33',
    });

    // A bare number after a hyphen is ordinary prose, not a reference.
    assert.deepEqual(splitIssue('bump timeout - 42'), {sentence: 'bump timeout - 42', issueId: null});
});

test('withIssue and splitIssue round trip', () => {
    for (const [sentence, id] of [['update auth-service', 'SHEN-33'], ['rename a - b', 'AB-1'], ['bump timeout - 42', '#7'], ['plain', null]]) {
        assert.deepEqual(splitIssue(withIssue(sentence, id)), {sentence, issueId: id});
    }
});

test('a Jira key is read out of a branch name', () => {
    assert.equal(issueKeyFromBranch('feature/SHEN-33-add-login'), 'SHEN-33');
    assert.equal(issueKeyFromBranch('SHEN-7'), 'SHEN-7');
    assert.equal(issueKeyFromBranch('bugfix/abc-99_fix'), 'ABC-99');
    assert.equal(issueKeyFromBranch('main'), null);
    assert.equal(issueKeyFromBranch('release/2024-01-05'), null, 'a date is not an issue key');
    assert.equal(issueKeyFromBranch(null), null);
});

test('looksLikeIssueKey accepts keys and rejects words', () => {
    assert.ok(looksLikeIssueKey('SHEN-33'));
    assert.ok(looksLikeIssueKey('42'));
    assert.ok(!looksLikeIssueKey('service'));
    assert.ok(!looksLikeIssueKey('multi-word'));
});

test('any pasted Jira URL is reduced to a bare host', () => {
    const cases = [
        ['https://acme.atlassian.net/jira/software/projects/AB/boards/1', 'acme.atlassian.net'],
        ['https://acme.atlassian.net/browse/AB-1', 'acme.atlassian.net'],
        ['acme.atlassian.net/', 'acme.atlassian.net'],
        ['  ACME.atlassian.net  ', 'acme.atlassian.net'],
        ['', ''],
    ];

    for (const [input, expected] of cases) assert.equal(normaliseHost(input), expected, input);
});
