const request = async (url, {method, headers = {}, body, timeout = 60000}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            method,
            headers: body === undefined ? headers : {'Content-Type': 'application/json', ...headers},
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });

        const text = await response.text();
        let payload = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch {
            payload = text;
        }

        if (!response.ok) {
            // Providers put the useful part in different places; take whichever
            // is there so the message says what actually went wrong.
            const detail = payload?.error?.message ?? payload?.error ?? payload?.message;
            const error = new Error(typeof detail === 'string' && detail ? detail : `HTTP ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }

        return payload;
    } catch (err) {
        if (err.name === 'AbortError') throw new Error(`the model did not answer within ${timeout / 1000}s`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

export const postJson = (url, options = {}) => request(url, {...options, method: 'POST'});

export const getJson = (url, options = {}) => request(url, {...options, method: 'GET'});

/** OLLAMA_HOST and hand typed hosts often come without a scheme. */
export const normaliseBaseUrl = (value, fallback) => {
    const raw = (value || fallback || '').trim().replace(/\/+$/, '');
    if (!raw) return fallback;

    return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

/** Turns "HTTP 404" into something the user can act on. */
export const modelNotAvailable = (err, model) => {
    if (err.status !== 404) return err;

    return new Error(
        `the model '${model}' is not available for this account. ` +
        `Run 'cmt --setup' to pick one from the list.`
    );
}

export default postJson;
