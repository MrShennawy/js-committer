import {postJson, getJson, normaliseBaseUrl} from './http.js';

const DEFAULT_HOST = 'http://127.0.0.1:11434';

const hostFor = (baseUrl) => normaliseBaseUrl(baseUrl || process.env.OLLAMA_HOST, DEFAULT_HOST);

/** Turns a connection failure into something the user can act on. */
const describeFailure = (err, root, model) => {
    if (err.cause?.code === 'ECONNREFUSED' || /fetch failed|ENOTFOUND/i.test(err.message)) {
        return new Error(`no Ollama server at ${root}. Start it with 'ollama serve'`);
    }

    // Ollama answers 404 when the server is up but the model is not pulled,
    // which is easy to mistake for a bad URL.
    if (err.status === 404 && model) {
        return new Error(`Ollama has no model called '${model}'. Install it with 'ollama pull ${model}'`);
    }

    return err;
}

/**
 * A model running on the machine itself.
 *
 * Nothing is sent anywhere and there is no key to collect, which makes this
 * the option for code that is not allowed to leave the network.
 */
export default {
    id: 'ollama',
    label: 'Ollama (runs locally, nothing leaves your machine)',
    local: true,
    needsKey: false,
    keyPage: 'https://ollama.com/download',
    defaultModel: 'llama3.2',
    envNames: ['OLLAMA_HOST'],
    keyPattern: null,
    loosePattern: null,
    keyHint: null,

    /** The models actually installed on this machine. */
    async listModels({baseUrl} = {}) {
        const root = hostFor(baseUrl);

        try {
            const payload = await getJson(`${root}/api/tags`, {timeout: 10000});
            return (payload?.models ?? [])
                .map(entry => entry.name ?? entry.model)
                .filter(Boolean)
                .sort();
        } catch (err) {
            throw describeFailure(err, root, null);
        }
    },

    async generate({prompt, model, baseUrl}) {
        const root = hostFor(baseUrl);
        const name = model || this.defaultModel;

        try {
            const payload = await postJson(`${root}/api/generate`, {
                body: {
                    model: name,
                    prompt,
                    stream: false,
                    options: {temperature: 0.2},
                },
                // A local model on a cold start can take a while to load.
                timeout: 120000,
            });

            return payload?.response ?? '';
        } catch (err) {
            throw describeFailure(err, root, name);
        }
    },
};
