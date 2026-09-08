/**
 * Minimal wrapper for the JIRA REST API.
 * https://docs.atlassian.com/jira/REST/6.4.8/
 *
 * Uses the runtime's built-in fetch, which removes the dependency on the
 * deprecated `request` family of packages.
 */
export default class JiraApi {
    constructor(options) {
        this.protocol = options.protocol || 'https';
        this.host = options.host;
        this.email = options.email;
        this.token = options.token;
        this.apiVersion = options.apiVersion || '3';
        this.base = options.base || '';
        this.intermediatePath = options.intermediatePath;
        this.timeout = options.timeout ?? 30000;

        // Injectable so unit tests can fake the transport.
        this.request = options.request || defaultRequest;
    }

    /** Authentication and content headers sent with every request. */
    headers() {
        const credentials = Buffer.from(`${this.email}:${this.token}`).toString('base64');
        return {
            Authorization: `Basic ${credentials}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };
    }

    /**
     * Builds the absolute URL for a given API path.
     * @param {object} options - path, query and optional intermediate path
     */
    makeUri({pathname, query = {}}) {
        const intermediate = this.intermediatePath || `/rest/api/${this.apiVersion}`;
        const uri = new URL(`${this.base}${intermediate}${pathname}`, `${this.protocol}://${this.host}`);

        Object.entries(query)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .forEach(([key, value]) => uri.searchParams.set(key, String(value)));

        return uri.toString();
    }

    /**
     * Performs the request and normalises JIRA's error shape.
     * Errors are rejected with the parsed body so callers can read
     * `err.errorMessages`.
     */
    async doRequest(url, {method = 'GET', body} = {}) {
        const response = await this.request(url, {
            method,
            headers: this.headers(),
            body: body === undefined ? undefined : JSON.stringify(body),
            timeout: this.timeout,
        });

        if (Array.isArray(response?.errorMessages) && response.errorMessages.length) {
            const error = new Error(response.errorMessages.join(', '));
            error.errorMessages = response.errorMessages;
            throw error;
        }

        return response;
    }

    /**
     * Find an issue in jira.
     * @param {string} issueNumber - issue key including the project key
     * @param {string} fields - comma separated list of field ids or keys
     */
    findIssue({issueNumber, expand = '', fields = '', properties = '', fieldsByKeys = false}) {
        return this.doRequest(this.makeUri({
            pathname: `/issue/${encodeURIComponent(issueNumber)}`,
            query: {expand, fields, properties, fieldsByKeys},
        }));
    }

    /** Create a new issue. */
    addNewIssue(issue) {
        return this.doRequest(this.makeUri({pathname: '/issue'}), {method: 'POST', body: issue});
    }

    /** Update an existing issue. */
    updateIssue({issueId, issueUpdate, query = {}}) {
        return this.doRequest(this.makeUri({
            pathname: `/issue/${encodeURIComponent(issueId)}`,
            query,
        }), {method: 'PUT', body: issueUpdate});
    }

    /** Add a comment to an issue. */
    addComment(issueId, comment) {
        return this.doRequest(this.makeUri({
            pathname: `/issue/${encodeURIComponent(issueId)}/comment`,
        }), {method: 'POST', body: {body: comment}});
    }

    /**
     * Runs a JQL search.
     * Jira replaced /search with /search/jql, so the new path is tried first
     * and the old one is used on instances that do not have it yet.
     */
    async searchIssues({jql, fields = 'summary,issuetype', maxResults = 15}) {
        const query = {jql, fields, maxResults};

        try {
            return await this.doRequest(this.makeUri({pathname: '/search/jql', query}));
        } catch (err) {
            if (err.status === 404 || err.status === 410) {
                return this.doRequest(this.makeUri({pathname: '/search', query}));
            }
            throw err;
        }
    }

    /** Describe the currently authenticated user. */
    getCurrentUser() {
        return this.doRequest(this.makeUri({pathname: '/myself'}));
    }
}

/**
 * Default transport: fetch with a timeout, returning the parsed JSON body.
 * Responses with a 4xx/5xx status reject with the parsed body attached.
 */
const defaultRequest = async (url, {method, headers, body, timeout}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response;
    try {
        response = await fetch(url, {method, headers, body, signal: controller.signal});
    } catch (err) {
        if (err.name === 'AbortError') throw new Error(`Jira request timed out after ${timeout}ms`);
        throw err;
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    if (!response.ok) {
        const messages = payload?.errorMessages?.length
            ? payload.errorMessages
            : [payload?.message || `Jira responded with ${response.status} ${response.statusText}`];

        const error = new Error(messages.join(', '));
        error.status = response.status;
        error.errorMessages = messages;
        throw error;
    }

    return payload;
};
