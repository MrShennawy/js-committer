import test from 'node:test';
import assert from 'node:assert/strict';
import {validateKey} from '../src/ai/settings.js';

/**
 * A provider whose key is perfectly good but whose assumed default model is
 * not enabled for the account. This is the situation that used to be reported
 * as "the key was rejected".
 */
const providerWithUnavailableDefault = {
    id: 'stub',
    label: 'Stub',
    needsKey: true,
    defaultModel: 'not-enabled-for-this-account',

    async listModels({apiKey}) {
        if (apiKey !== 'good-key') {
            throw Object.assign(new Error('API key not valid'), {status: 400});
        }
        return ['model-a', 'model-b'];
    },

    async generate({model}) {
        // Exactly what a hosted provider does for a model you cannot use.
        throw Object.assign(new Error(`the model '${model}' is not available for this account.`), {status: 404});
    },
};

test('a good key is accepted even when the default model is unavailable', async () => {
    const result = await validateKey(providerWithUnavailableDefault, 'good-key');

    assert.equal(result.valid, true, 'the key must not be blamed for the model');
    assert.deepEqual(result.models, ['model-a', 'model-b'], 'and the usable models come back');
});

test('a genuinely bad key is still rejected, with the provider reason', async () => {
    const result = await validateKey(providerWithUnavailableDefault, 'wrong-key');

    assert.equal(result.valid, false);
    assert.match(result.reason, /API key not valid/);
    assert.ok(!result.offline, 'a rejection is not an outage');
});

test('an unreachable provider is not treated as a bad key', async () => {
    const offline = {
        id: 'offline',
        label: 'Offline',
        needsKey: true,
        defaultModel: 'x',
        listModels: async () => {
            throw new Error('fetch failed');
        },
    };

    const result = await validateKey(offline, 'any-key');
    assert.equal(result.valid, false);
    assert.equal(result.offline, true, 'so the key is kept rather than thrown away');
});
