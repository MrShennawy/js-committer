import test from 'node:test';
import assert from 'node:assert/strict';
import {maskKey, keyFromText} from '../src/ai/settings.js';
import {getProvider, providerList} from '../src/ai/providers/index.js';

const gemini = getProvider('gemini');
const openai = getProvider('openai');
const anthropic = getProvider('anthropic');

const GEMINI_KEY = 'AIza' + 'B'.repeat(35);
const OPENAI_KEY = 'sk-' + 'C'.repeat(40);
const ANTHROPIC_KEY = 'sk-ant-' + 'D'.repeat(40);

test('each provider recognises its own key format', () => {
    assert.equal(keyFromText(GEMINI_KEY, gemini), GEMINI_KEY);
    assert.equal(keyFromText(OPENAI_KEY, openai), OPENAI_KEY);
    assert.equal(keyFromText(ANTHROPIC_KEY, anthropic), ANTHROPIC_KEY);
    assert.equal(keyFromText(`  ${GEMINI_KEY}\n`, gemini), GEMINI_KEY, 'whitespace is ignored');
});

test("one provider's key is not offered to another", () => {
    assert.equal(keyFromText(GEMINI_KEY, openai), null);
    assert.equal(keyFromText(OPENAI_KEY, gemini), null);
    assert.equal(keyFromText(ANTHROPIC_KEY, openai), null, 'an Anthropic key is not an OpenAI key');
});

test('unrelated clipboard content is never mistaken for a key', () => {
    for (const provider of [gemini, openai, anthropic]) {
        assert.equal(keyFromText('git commit -m "hello"', provider), null);
        assert.equal(keyFromText('https://aistudio.google.com/app/apikey', provider), null);
        assert.equal(keyFromText('', provider), null);
        assert.equal(keyFromText(null, provider), null);
    }
});

test('a local provider has no key to detect', () => {
    const ollama = getProvider('ollama');
    assert.equal(ollama.needsKey, false);
    assert.equal(keyFromText(GEMINI_KEY, ollama), null);
});

test('a masked key never reveals the middle', () => {
    const masked = maskKey(GEMINI_KEY);
    assert.ok(!masked.includes(GEMINI_KEY.slice(6, -4)));
    assert.ok(masked.startsWith('AIza'));
    assert.ok(masked.endsWith(GEMINI_KEY.slice(-4)));
    assert.equal(maskKey(''), '••••');
});

test('every provider declares the fields the rest of the code relies on', () => {
    for (const provider of providerList()) {
        assert.equal(typeof provider.id, 'string', provider.id);
        assert.equal(typeof provider.label, 'string', provider.id);
        assert.equal(typeof provider.defaultModel, 'string', provider.id);
        assert.equal(typeof provider.generate, 'function', provider.id);
        assert.equal(typeof provider.needsKey, 'boolean', provider.id);
    }
});

test('an unknown provider name falls back to the default', () => {
    assert.equal(getProvider('nope').id, 'gemini');
});
