import test from 'node:test';
import assert from 'node:assert/strict';
import {scanChanges, isProtectedBranch} from '../src/support/scan.js';

const labels = (findings) => findings.map(f => f.label).sort();

test('risky file names are reported', () => {
    const findings = scanChanges([
        {status: 'A', path: '.env'},
        {status: 'A', path: 'deploy/id_rsa'},
        {status: 'A', path: 'certs/server.pem'},
        {status: 'M', path: 'src/app.js'},
    ]);

    assert.deepEqual(labels(findings), ['environment file', 'key or certificate store', 'private ssh key']);
});

test('a deleted secret is not a finding', () => {
    assert.deepEqual(scanChanges([{status: 'D', path: '.env'}]), []);
});

test('credentials in added lines are caught', () => {
    const diff = [
        '+++ b/src/config.js',
        '+const awsKey = "AKIA2E0A8F3B244C9986"',
        '+const gh = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"',
        '+-----BEGIN RSA PRIVATE KEY-----',
    ].join('\n');

    assert.deepEqual(labels(scanChanges([], diff)), ['AWS access key id', 'GitHub token', 'private key']);
});

test('removed lines and placeholders are left alone', () => {
    const diff = [
        '-const awsKey = "AKIA2E0A8F3B244C9986"',
        '+const key = process.env.API_KEY',
        '+password: "changeme"',
        '+api_key = "<your-key-here>"',
        '+token: "${SLACK_TOKEN}"',
    ].join('\n');

    assert.deepEqual(scanChanges([], diff), [], 'no false positives on placeholders');
});

test('each path and label is reported once', () => {
    const diff = [
        '+const a = "AKIA2E0A8F3B244C9986"',
        '+const b = "AKIA7D1B9C2E5F04A831"',
    ].join('\n');

    assert.equal(scanChanges([], diff).length, 1);
});

test("documented example keys are not treated as secrets", () => {
    // The key AWS uses throughout its own documentation.
    assert.deepEqual(scanChanges([], '+const key = "AKIAIOSFODNN7EXAMPLE"'), []);
});

test('a real key is still caught when the line mentions an example', () => {
    const diff = '+// for example, this is the key\n+const key = "AKIA2E0A8F3B244C9986"';
    assert.deepEqual(labels(scanChanges([], diff)), ['AWS access key id']);
});

test('protected branches are matched without regard to case', () => {
    const protectedBranches = ['main', 'develop'];
    assert.ok(isProtectedBranch('main', protectedBranches));
    assert.ok(isProtectedBranch('MAIN', protectedBranches));
    assert.ok(!isProtectedBranch('feature/x', protectedBranches));
    assert.ok(!isProtectedBranch('main', []));
});
