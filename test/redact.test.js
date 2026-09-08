import test from 'node:test';
import assert from 'node:assert/strict';
import {redact} from '../src/support/redact.js';

test('credentials are replaced before the diff leaves the machine', () => {
    const {text, removed} = redact([
        '+const aws = "AKIA2E0A8F3B244C9986"',
        '+const gh = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"',
        '+password: "hunter2supersecret"',
        '+DATABASE_URL=postgres://admin:s3cr3tpw@db.internal:5432/app',
    ].join('\n'));

    assert.ok(!text.includes('AKIA2E0A8F3B244C9986'));
    assert.ok(!text.includes('ghp_abcdefghijklmnopqrstuvwxyz0123456789'));
    assert.ok(!text.includes('hunter2supersecret'));
    assert.ok(!text.includes('s3cr3tpw'));
    assert.equal(removed, 4);
});

test('the shape of the code is preserved so the model still understands it', () => {
    const {text} = redact('+password: "hunter2supersecret"');
    assert.equal(text, '+password: "[redacted]"', 'the key name survives, the value does not');

    const {text: url} = redact('+url = "postgres://admin:s3cr3tpw@db:5432/app"');
    assert.ok(url.includes('postgres://admin:[redacted]@db:5432/app'));
});

test('a whole private key block collapses to one line', () => {
    const {text, removed} = redact('+-----BEGIN RSA PRIVATE KEY-----\n+MIIEow...\n+-----END RSA PRIVATE KEY-----');
    assert.ok(text.includes('[private key removed]'));
    assert.ok(!text.includes('MIIEow'));
    assert.equal(removed, 1);
});

test('ordinary code is untouched', () => {
    const source = '+const total = price * quantity;\n+return { ok: true };';
    assert.deepEqual(redact(source), {text: source, removed: 0});
});

test('empty input is handled', () => {
    assert.deepEqual(redact(''), {text: '', removed: 0});
    assert.deepEqual(redact(null), {text: '', removed: 0});
});
