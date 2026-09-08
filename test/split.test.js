import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGroups} from '../src/ai/split.js';

const ACTUAL = ['src/a.js', 'src/b.js', 'test/a.test.js', 'package.json'];

test('a well formed plan is kept as it is', () => {
    const reply = JSON.stringify({groups: [
        {message: 'feat: add a', files: ['src/a.js', 'src/b.js']},
        {message: 'test: cover a', files: ['test/a.test.js']},
        {message: 'build: bump deps', files: ['package.json']},
    ]});

    const groups = parseGroups(reply, ACTUAL);
    assert.equal(groups.length, 3);
    assert.deepEqual(groups[0].files, ['src/a.js', 'src/b.js']);
});

test('files the model invented are discarded', () => {
    const reply = JSON.stringify({groups: [
        {message: 'feat: add a', files: ['src/a.js', 'src/does-not-exist.js']},
        {message: 'chore: rest', files: ['src/b.js', 'test/a.test.js', 'package.json']},
    ]});

    const groups = parseGroups(reply, ACTUAL);
    assert.deepEqual(groups[0].files, ['src/a.js'], 'the invented path is gone');
});

test('a file the model forgot is still committed', () => {
    const reply = JSON.stringify({groups: [
        {message: 'feat: add a', files: ['src/a.js']},
    ]});

    const groups = parseGroups(reply, ACTUAL);
    const committed = groups.flatMap(group => group.files).sort();
    assert.deepEqual(committed, [...ACTUAL].sort(), 'every change is accounted for');
    assert.match(groups.at(-1).message, /remaining changes/);
});

test('a file listed twice is committed once', () => {
    const reply = JSON.stringify({groups: [
        {message: 'feat: add a', files: ['src/a.js', 'src/b.js']},
        {message: 'fix: also a', files: ['src/a.js', 'test/a.test.js']},
        {message: 'build: deps', files: ['package.json']},
    ]});

    const groups = parseGroups(reply, ACTUAL);
    const committed = groups.flatMap(group => group.files);
    assert.equal(new Set(committed).size, committed.length, 'no path appears twice');
    assert.deepEqual([...committed].sort(), [...ACTUAL].sort());
});

test('the groups together always reproduce the whole change', () => {
    const replies = [
        JSON.stringify({groups: [{message: 'feat: x', files: ['src/a.js']}]}),
        JSON.stringify({groups: []}),
        JSON.stringify({groups: [{message: 'feat: x', files: ['nope.js']}]}),
        'not json at all',
    ];

    for (const reply of replies) {
        const groups = parseGroups(reply, ACTUAL);
        if (!groups.length) continue;
        const committed = groups.flatMap(group => group.files).sort();
        assert.deepEqual(committed, [...ACTUAL].sort(), reply.slice(0, 40));
    }
});

test('an unusable answer produces no plan rather than a broken one', () => {
    assert.deepEqual(parseGroups('not json at all', ACTUAL), []);
    assert.deepEqual(parseGroups('', ACTUAL), []);
    assert.deepEqual(parseGroups(JSON.stringify({groups: 'nope'}), ACTUAL), []);
});
