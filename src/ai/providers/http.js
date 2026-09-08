/** Shared JSON request used by the hosted providers. */
export const postJson = async (url, {headers = {}, body, timeout = 60000}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', ...headers},
            body: JSON.stringify(body),
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
            const message = payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
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

export default postJson;
