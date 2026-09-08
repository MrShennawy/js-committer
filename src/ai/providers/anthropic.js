import postJson from './http.js';

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

    async generate({prompt, apiKey, model, baseUrl}) {
        const root = (baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');

        const payload = await postJson(`${root}/v1/messages`, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: {
                model: model || this.defaultModel,
                max_tokens: 1024,
                messages: [{role: 'user', content: prompt}],
            },
        });

        return payload?.content?.map(part => part.text ?? '').join('') ?? '';
    },
};
