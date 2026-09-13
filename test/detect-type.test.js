import test from 'node:test';
import assert from 'node:assert/strict';
import detectType, {fromJiraIssueType} from '../src/support/detectType.js';
import diff from '../src/git/diff.js';
import {isKnownType} from '../src/git/commit.js';

const files = (...pairs) => pairs.map(([status, path]) => ({status, path}));

test('a Jira issue type outranks the file names', () => {
    assert.equal(detectType(files(['M', 'src/app.js']), 'Bug'), 'fix');
    assert.equal(detectType(files(['M', 'src/app.js']), 'Story'), 'feat');
    assert.equal(fromJiraIssueType('New Feature'), 'feat');
    assert.equal(fromJiraIssueType('Something else'), null);
});

test('a type is chosen only when it explains every changed file', () => {
    assert.equal(detectType(files(['M', 'README.md'], ['M', 'docs/usage.md'])), 'docs');
    assert.equal(detectType(files(['A', 'test/a.test.js'])), 'test');
    assert.equal(detectType(files(['M', 'src/main.css'])), 'style');
    assert.equal(detectType(files(['M', 'package.json'], ['M', 'package-lock.json'])), 'build');

    // Docs plus source is not a docs commit.
    assert.equal(detectType(files(['M', 'README.md'], ['M', 'src/app.js'])), 'fix');
});

test('added files read as a feature, deletions as a chore', () => {
    assert.equal(detectType(files(['A', 'src/feature.js'], ['M', 'src/app.js'])), 'feat');
    assert.equal(detectType(files(['D', 'src/old.js'])), 'chore');
    assert.equal(detectType(files(['M', 'src/app.js'])), 'fix');
    assert.equal(detectType([]), 'chore');
});

test('every detected type is a real commit type', () => {
    const samples = [
        files(['M', 'src/app.js']),
        files(['A', 'src/new.js']),
        files(['D', 'src/gone.js']),
        files(['M', 'docs/a.md']),
        files(['M', 'a.scss']),
        files(['M', 'Dockerfile']),
        files(['M', 'src/a.spec.ts']),
        [],
    ];

    for (const sample of samples) {
        assert.ok(isKnownType(detectType(sample)), JSON.stringify(sample));
    }
});

test('parseNameStatus reads renames and plain changes', () => {
    const output = 'M\tsrc/app.js\nA\tsrc/new.js\nR100\tsrc/old.js\tsrc/renamed.js';
    assert.deepEqual(diff.parseNameStatus(output), [
        {status: 'M', path: 'src/app.js', origPath: null},
        {status: 'A', path: 'src/new.js', origPath: null},
        // Where a rename came from matters: staging only the destination
        // commits the new file and leaves the deletion behind.
        {status: 'R', path: 'src/renamed.js', origPath: 'src/old.js'},
    ]);
});
