import postJson from './http.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export default {
    id: 'gemini',
    label: 'Google Gemini (free tier available)',
    local: false,
    needsKey: true,
    keyPage: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.5-flash-lite',
    envNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    keyPattern: /^AIza[0-9A-Za-z_-]{35}$/,
    loosePattern: /^AIza[0-9A-Za-z_-]{20,60}$/,
    keyHint: "they start with 'AIza'",

    async generate({prompt, apiKey, model}) {
        const name = model || this.defaultModel;

        // The key travels as a header, never in the URL, so it cannot be
        // captured by an intermediate access log.
        const payload = await postJson(`${ENDPOINT}/${name}:generateContent`, {
            headers: {'x-goog-api-key': apiKey},
            body: {contents: [{parts: [{text: prompt}]}]},
        });

        return payload?.candidates?.[0]?.content?.parts?.map(part => part.text).join('') ?? '';
    },
};
