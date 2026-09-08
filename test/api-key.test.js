import test from 'node:test';
import assert from 'node:assert/strict';
import {maskKey, keyFromText} from '../src/ai/apiKey.js';

const VALID = 'AIza' + 'B'.repeat(35);

test('a key is recognised in clipboard text', () => {
    assert.equal(keyFromText(VALID), VALID);
    assert.equal(keyFromText(`  ${VALID}\n`), VALID, 'surrounding whitespace is ignored');
});

test('unrelated clipboard content is not mistaken for a key', () => {
    assert.equal(keyFromText('git commit -m "hello"'), null);
    assert.equal(keyFromText('https://aistudio.google.com/app/apikey'), null);
    assert.equal(keyFromText(''), null);
    assert.equal(keyFromText(null), null);
    assert.equal(keyFromText('AIzaTooShort'), null);
});

test('a key of an unusual length is accepted only in loose mode', () => {
    const unusual = 'AIza' + 'C'.repeat(28);
    assert.equal(keyFromText(unusual), null, 'strict mode protects the clipboard offer');
    assert.equal(keyFromText(unusual, {strict: false}), unusual, 'typed keys are treated leniently');
});

test('a masked key never reveals the middle', () => {
    const masked = maskKey(VALID);
    assert.ok(!masked.includes(VALID.slice(6, -4)), 'the secret part is hidden');
    assert.ok(masked.startsWith('AIza'));
    assert.ok(masked.endsWith(VALID.slice(-4)));
    assert.equal(maskKey(''), '••••');
    assert.equal(maskKey('short'), '••••');
});
