import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReply} from '../src/ai/generate.js';
import {detectScope} from '../src/support/detectScope.js';

const files = (...paths) => paths.map(path => ({status: 'M', path}));

test('a JSON answer yields the messages and the body', () => {
    const reply = JSON.stringify({
        messages: ['feat: add reset endpoint', 'feat: allow password recovery'],
        body: '- adds the route\n- sends the email',
    });

    assert.deepEqual(parseReply(reply), {
        messages: ['feat: add reset endpoint', 'feat: allow password recovery'],
        body: '- adds the route\n- sends the email',
    });
});

test('a JSON answer wrapped in prose or fences is still read', () => {
    const reply = 'Sure! Here you go:\n```json\n{"messages": ["fix: stop the crash"]}\n```\nHope that helps.';
    assert.deepEqual(parseReply(reply), {messages: ['fix: stop the crash'], body: null});
});

test('a plain list of lines is accepted when the model ignores the format', () => {
    const reply = '1. feat: add endpoint\n2. feat: expose the route\n- feat: publish the api';
    assert.deepEqual(parseReply(reply), {
        messages: ['feat: add endpoint', 'feat: expose the route', 'feat: publish the api'],
        body: null,
    });
});

test('an empty or unusable answer yields nothing to choose from', () => {
    assert.deepEqual(parseReply(''), {messages: [], body: null});
    assert.deepEqual(parseReply(null), {messages: [], body: null});
    assert.deepEqual(parseReply('{"messages": []}'), {messages: [], body: null});
});

test('a scope is used only when the whole change sits in one area', () => {
    assert.equal(detectScope(files('packages/api/src/a.js', 'packages/api/b.js')), 'api');
    assert.equal(detectScope(files('src/auth/a.js', 'src/auth/b.js')), 'auth');
    assert.equal(detectScope(files('src/auth/a.js', 'src/billing/b.js')), null, 'two areas means no scope');
    assert.equal(detectScope(files('index.js')), null, 'a root file has no area');
});

test('a container directory is not a scope', () => {
    // "feat(src)" and "test(test)" say nothing that the paths do not.
    assert.equal(detectScope(files('src/reset.js', 'src/mailer.js')), null);
    assert.equal(detectScope(files('test/a.test.js')), null);
    assert.equal(detectScope(files('lib/x.js')), null);
});

test('repository level files do not prevent a scope', () => {
    assert.equal(detectScope(files('src/auth/a.js', 'README.md', 'package.json')), 'auth');
});

test('a project may restrict which scopes are allowed', () => {
    assert.equal(detectScope(files('src/auth/a.js'), {allowed: ['api', 'web']}), null);
    assert.equal(detectScope(files('src/api/a.js'), {allowed: ['api', 'web']}), 'api');
});
