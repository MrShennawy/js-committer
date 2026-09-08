import JiraApi from './api.js';
import {storedCredentials} from './credentials.js';

/**
 * Builds a client. Credentials can be passed in explicitly, which is what the
 * setup walkthrough does while verifying a token that is not stored yet.
 */
const client = (credentials = null) => {
    const {host, email, token} = credentials ?? storedCredentials() ?? {};

    return new JiraApi({
        protocol: 'https',
        host,
        email,
        token,
    });
}

const getCurrentUser = (credentials) => client(credentials).getCurrentUser();

const findIssue = (issueNumber, fields, credentials) => client(credentials).findIssue({issueNumber, fields});

const updateIssue = (issueId, fields, credentials) => client(credentials).updateIssue({issueId, issueUpdate: fields});

const addComment = (issueId, commentBody, credentials) => client(credentials).addComment(issueId, commentBody);

const addNewIssue = (fields, credentials) => client(credentials).addNewIssue(fields);

const searchIssues = (jql, fields, credentials) => client(credentials).searchIssues({jql, fields});

export {
    getCurrentUser,
    findIssue,
    addNewIssue,
    updateIssue,
    addComment,
    searchIssues,
}
