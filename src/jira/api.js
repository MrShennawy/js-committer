import url from 'url';
import _request from 'postman-request';

function request(uri, options) {
    return new Promise((resolve, reject) => {
        _request(uri, options, (err, httpResponse) => {
            if (err) {
                reject(err);
            } else {
                if (httpResponse.statusCode >= 400) {
                    reject(httpResponse.body);
                }

                // for compatibility with request-promise
                resolve(httpResponse.body);
            }
        });
    });
}

/**
 * @name JiraApi
 * @class
 * Wrapper for the JIRA Rest Api
 * https://docs.atlassian.com/jira/REST/6.4.8/
 * https://github.com/jira-node/node-jira-client/blob/f9102bbe3969185a92834f48076c65aa9c5d0be4/src/jira.js
 */
export default class JiraApi {
    /**
     * @constructor
     * @function
     * @param options
     */
    constructor(options) {
        this.protocol = options.protocol || 'http';
        this.host = options.host;
        this.email = options.email;
        this.token = options.token;
        this.apiVersion = options.apiVersion || '3';
        this.base = options.base || '';
        this.intermediatePath = options.intermediatePath;
        this.strictSSL = options.hasOwnProperty('strictSSL') ? options.strictSSL : true;

        // This is so we can fake during unit tests
        this.request = options.request || request;
        this.baseOptions = {};

        this.baseOptions.headers = {
            sendImmediately: true,
            Authorization: 'Basic '+Buffer.from(this.email+':'+this.token).toString('base64')
        };

        if (options.timeout) {
            this.baseOptions.timeout = options.timeout;
        }
    }

    makeRequestHeader(uri, options = {}) {
        return {
            rejectUnauthorized: this.strictSSL,
            method: options.method || 'GET',
            uri,
            json: true,
            ...options,
        };
    }

    /**
     * @name makeUri
     * @function
     * Creates a URI object for a given pathname
     * @param {object} [options] - an object containing path information
     */
    makeUri({
                pathname, query, intermediatePath, encode = false,
            }) {
        const intermediateToUse = this.intermediatePath || intermediatePath;
        const tempPath = intermediateToUse || `/rest/api/${this.apiVersion}`;
        const uri = url.format({
            protocol: this.protocol,
            hostname: this.host,
            pathname: `${this.base}${tempPath}${pathname}`,
            query,
        });
        return encode ? encodeURI(uri) : decodeURIComponent(uri);
    }

    /**
     * @name doRequest
     * @function
     * Does a request based on the requestOptions object
     * @param {object} requestOptions - fields on this object get posted as a request header for
     * requests to jira
     */
    async doRequest(requestOptions) {
        const options = {
            ...this.baseOptions,
            ...requestOptions,
        };

            const response = await this.request(options);

            if (response) {
                if (Array.isArray(response.errorMessages) && response.errorMessages.length > 0) {
                    throw new Error(response.errorMessages.join(', '));
                }
            }

            return response;
        try {
        } catch (e) {
            throw new Error(JSON.stringify(e));
        }
    }

    /**
     * @name findIssue
     * @function
     * Find an issue in jira
     * [Jira Doc](http://docs.atlassian.com/jira/REST/latest/#id290709)
     * @param {string} issueNumber - The issue number to search for including the project key
     * @param {string} expand - The resource expansion to return additional fields in the response
     * @param {string} fields - Comma separated list of field ids or keys to retrieve
     * @param {string} properties - Comma separated list of properties to retrieve
     * @param {boolean} fieldsByKeys - False by default, used to retrieve fields by key instead of id
     */
    findIssue({issueNumber, expand = '', fields = '', properties = '', fieldsByKeys = false}) {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: `/issue/${issueNumber}`,
            query: {
                expand: expand || '',
                fields: fields || '*all',
                properties: properties || '*all',
                fieldsByKeys: fieldsByKeys || false,
            },
        })));
    }

    /** Add issue to Jira
     * [Jira Doc](http://docs.atlassian.com/jira/REST/latest/#id290028)
     * @name addNewIssue
     * @function
     * @param {object} issue - Properly Formatted Issue object
     */
    addNewIssue(issue) {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: '/issue',
        }), {
            method: 'POST',
            followAllRedirects: true,
            body: issue,
        }));
    }

    /** Update issue in Jira
     * [Jira Doc](http://docs.atlassian.com/jira/REST/latest/#id290878)
     * @name updateIssue
     * @function
     * @param {string} issueId - the Id of the issue to update
     * @param {object} issueUpdate - update Object as specified by the rest api
     * @param {object} query - adds parameters to the query string
     */
    updateIssue({issueId, issueUpdate, query = {}}) {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: `/issue/${issueId}`,
            query,
        }), {
            body: issueUpdate,
            method: 'PUT',
            followAllRedirects: true,
        }));
    }

    /** Add a comment to an issue
     * [Jira Doc](https://docs.atlassian.com/jira/REST/latest/#id108798)
     * @name addComment
     * @function
     * @param {string} issueId - Issue to add a comment to
     * @param {string} comment - string containing comment
     */
    addComment(issueId, comment) {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: `/issue/${issueId}/comment`,
        }), {
            body: {
                body: comment,
            },
            method: 'POST',
            followAllRedirects: true,
        }));
    }

    /** Describe the currently authenticated user
     * [Jira Doc](http://docs.atlassian.com/jira/REST/latest/#id2e865)
     * @name getCurrentUser
     * @function
     */
    getCurrentUser() {
        return this.doRequest(this.makeRequestHeader(this.makeUri({
            pathname: '/myself',
        })));
    }
}