import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {getProvider, providerList} from '../src/ai/providers/index.js';
import {normaliseBaseUrl, modelNotAvailable} from '../src/ai/providers/http.js';

/** A stand-in Ollama that only knows about the models it was given. */
const ollamaServer = (installed) => new Promise(resolve => {
    const server = createServer((req, res) => {
        let raw = '';
        req.on('data', chunk => raw += chunk);
        req.on('end', () => {
            res.setHeader('content-type', 'application/json');

            if (req.url === '/api/tags') {
                res.end(JSON.stringify({models: installed.map(name => ({name}))}));
                return;
            }

            const {model} = JSON.parse(raw || '{}');
            if (!installed.includes(model)) {
                res.statusCode = 404;
                res.end(JSON.stringify({error: `model '${model}' not found`}));
                return;
            }

            res.end(JSON.stringify({response: 'ok'}));
        });
    });

    server.listen(0, '127.0.0.1', () => resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
    }));
});

test('the installed models are listed rather than assumed', async () => {
    const {server, url} = await ollamaServer(['qwen2.5-coder:7b', 'mistral:latest']);

    try {
        const models = await getProvider('ollama').listModels({baseUrl: url});
        assert.deepEqual(models, ['mistral:latest', 'qwen2.5-coder:7b']);
    } finally {
        server.close();
    }
});

test('a model that is not installed explains how to install it', async () => {
    const {server, url} = await ollamaServer(['mistral:latest']);

    try {
        await assert.rejects(
            () => getProvider('ollama').generate({prompt: 'hi', model: 'llama3.2', baseUrl: url}),
            /no model called 'llama3.2'.*ollama pull llama3.2/s,
        );
    } finally {
        server.close();
    }
});

test('an installed model answers', async () => {
    const {server, url} = await ollamaServer(['mistral:latest']);

    try {
        const reply = await getProvider('ollama').generate({prompt: 'hi', model: 'mistral:latest', baseUrl: url});
        assert.equal(reply, 'ok');
    } finally {
        server.close();
    }
});

test('a server that is not running says so, rather than reporting a bad model', async () => {
    // Port 1 is never an Ollama server.
    await assert.rejects(
        () => getProvider('ollama').generate({prompt: 'hi', baseUrl: 'http://127.0.0.1:1'}),
        /no Ollama server at/,
    );
});

test('OLLAMA_HOST is accepted in the scheme-less form people actually set', () => {
    assert.equal(normaliseBaseUrl('127.0.0.1:11434', 'x'), 'http://127.0.0.1:11434');
    assert.equal(normaliseBaseUrl('http://box:11434/', 'x'), 'http://box:11434');
    assert.equal(normaliseBaseUrl('https://box', 'x'), 'https://box');
    assert.equal(normaliseBaseUrl('', 'http://fallback'), 'http://fallback');
});

test('a 404 from a hosted provider names the model and the way out', () => {
    const err = Object.assign(new Error('HTTP 404'), {status: 404});
    assert.match(modelNotAvailable(err, 'gemini-9-turbo').message, /gemini-9-turbo.*cmt --setup/s);

    // Anything else is passed through untouched.
    const other = Object.assign(new Error('nope'), {status: 500});
    assert.equal(modelNotAvailable(other, 'x'), other);
});

test('every provider can be asked for its models', () => {
    for (const provider of providerList()) {
        assert.equal(typeof provider.listModels, 'function', provider.id);
    }
});
