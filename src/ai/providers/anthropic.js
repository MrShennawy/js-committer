import {postJson, getJson, modelNotAvailable} from './http.js';

const VERSION = '2023-06-01';
const root = (baseUrl) => (baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');

export default {
    id: 'anthropic',
    label: 'Anthropic Claude',
    local: false,
    needsKey: true,
    keyPage: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-3-5-haiku-latest',
    envNames: ['ANTHROPIC_API_KEY'],
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    loosePattern: /^sk-ant-[A-Za-z0-9_-]{16,}$/,
    keyHint: "they start with 'sk-ant-'",

    async listModels({apiKey, baseUrl} = {}) {
        const payload = await getJson(`${root(baseUrl)}/v1/models?limit=100`, {
            headers: {'x-api-key': apiKey, 'anthropic-version': VERSION},
            timeout: 15000,
        });

        return (payload?.data ?? []).map(model => model.id).filter(Boolean).sort();
    },

    async generate({prompt, apiKey, model, baseUrl}) {
        const name = model || this.defaultModel;

        try {
            const payload = await postJson(`${root(baseUrl)}/v1/messages`, {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': VERSION,
                },
                body: {
                    model: name,
                    max_tokens: 1024,
                    messages: [{role: 'user', content: prompt}],
                },
            });

            return payload?.content?.map(part => part.text ?? '').join('') ?? '';
        } catch (err) {
            throw modelNotAvailable(err, name);
        }
    },
};
