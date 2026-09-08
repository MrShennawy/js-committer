import postJson from './http.js';

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

    async generate({prompt, apiKey, model, baseUrl}) {
        const root = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');

        const payload = await postJson(`${root}/chat/completions`, {
            headers: {Authorization: `Bearer ${apiKey}`},
            body: {
                model: model || this.defaultModel,
                messages: [{role: 'user', content: prompt}],
                temperature: 0.2,
            },
        });

        return payload?.choices?.[0]?.message?.content ?? '';
    },
};
