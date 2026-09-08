import test from 'node:test';
import assert from 'node:assert/strict';
import JiraApi from '../src/jira/api.js';

/** Records every call and replies with whatever the test queues up. */
const fakeTransport = (replies) => {
    const calls = [];
    const request = async (url, options) => {
        calls.push({url, ...options});
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        return reply;
    };
    return {calls, request};
};

const client = (transport) => new JiraApi({
    protocol: 'https',
    host: 'acme.atlassian.net',
    email: 'me@acme.com',
    token: 'secret-token',
    request: transport.request,
});

test('the issue request carries basic auth and the requested fields', async () => {
    const transport = fakeTransport([{fields: {summary: 'Login is broken'}}]);
    await client(transport).findIssue({issueNumber: 'AB-1', fields: 'summary,issuetype'});

    const [call] = transport.calls;
    assert.match(call.url, /^https:\/\/acme\.atlassian\.net\/rest\/api\/3\/issue\/AB-1\?/);
    assert.match(call.url, /fields=summary%2Cissuetype/);
    assert.equal(call.method, 'GET');
    assert.equal(
        call.headers.Authorization,
        `Basic ${Buffer.from('me@acme.com:secret-token').toString('base64')}`,
    );
});

test('search uses the current endpoint and falls back to the retired one', async () => {
    const gone = Object.assign(new Error('Gone'), {status: 410});
    const transport = fakeTransport([gone, {issues: [{key: 'AB-2'}]}]);

    const result = await client(transport).searchIssues({jql: 'assignee = currentUser()'});

    assert.equal(transport.calls.length, 2, 'the retired endpoint is tried second');
    assert.match(transport.calls[0].url, /\/rest\/api\/3\/search\/jql\?/);
    assert.match(transport.calls[1].url, /\/rest\/api\/3\/search\?/);
    assert.deepEqual(result.issues, [{key: 'AB-2'}]);
});

test('a real search error is not retried against the old endpoint', async () => {
    const denied = Object.assign(new Error('Unauthorized'), {status: 401});
    const transport = fakeTransport([denied]);

    await assert.rejects(() => client(transport).searchIssues({jql: 'x'}), /Unauthorized/);
    assert.equal(transport.calls.length, 1);
});

test('a comment is posted as a JSON body', async () => {
    const transport = fakeTransport([{id: '1'}]);
    await client(transport).addComment('AB-1', {type: 'doc'});

    const [call] = transport.calls;
    assert.equal(call.method, 'POST');
    assert.match(call.url, /\/issue\/AB-1\/comment$/);
    assert.deepEqual(JSON.parse(call.body), {body: {type: 'doc'}});
});

test("Jira's own error list is surfaced as the error message", async () => {
    const transport = fakeTransport([{errorMessages: ['Issue does not exist']}]);
    await assert.rejects(() => client(transport).findIssue({issueNumber: 'NOPE-1'}), /Issue does not exist/);
});
