import postJson from './http.js';

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

    async generate({prompt, model, baseUrl}) {
        const root = (baseUrl || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/+$/, '');

        try {
            const payload = await postJson(`${root}/api/generate`, {
                body: {
                    model: model || this.defaultModel,
                    prompt,
                    stream: false,
                    options: {temperature: 0.2},
                },
                // A local model on a cold start can take a while to load.
                timeout: 120000,
            });

            return payload?.response ?? '';
        } catch (err) {
            if (err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message)) {
                throw new Error(`no Ollama server at ${root}. Start it with 'ollama serve'`);
            }
            throw err;
        }
    },
};
