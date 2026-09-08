import {postJson, getJson, modelNotAvailable} from './http.js';

const root = (baseUrl) => (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');

export default {
    id: 'openai',
    label: 'OpenAI',
    local: false,
    needsKey: true,
    keyPage: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    envNames: ['OPENAI_API_KEY'],
    keyPattern: /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/,
    loosePattern: /^sk-[A-Za-z0-9_-]{16,}$/,
    keyHint: "they start with 'sk-'",

    async listModels({apiKey, baseUrl} = {}) {
        const payload = await getJson(`${root(baseUrl)}/models`, {
            headers: {Authorization: `Bearer ${apiKey}`},
            timeout: 15000,
        });

        // The list includes embeddings, audio and image models, none of which
        // can answer a chat completion.
        return (payload?.data ?? [])
            .map(model => model.id)
            .filter(id => id && /^(gpt|o[0-9]|chatgpt)/i.test(id))
            .filter(id => !/audio|realtime|transcribe|tts|image|search|embedding/i.test(id))
            .sort();
    },

    async generate({prompt, apiKey, model, baseUrl}) {
        const name = model || this.defaultModel;

        try {
            const payload = await postJson(`${root(baseUrl)}/chat/completions`, {
                headers: {Authorization: `Bearer ${apiKey}`},
                body: {
                    model: name,
                    messages: [{role: 'user', content: prompt}],
                    temperature: 0.2,
                },
            });

            return payload?.choices?.[0]?.message?.content ?? '';
        } catch (err) {
            throw modelNotAvailable(err, name);
        }
    },
};
