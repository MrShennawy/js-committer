import JiraApi from './api.js';
import { readSettings } from '../store/handler.js';

const setCredential = () => {
    const {host, email, token} = readSettings('jira');
    return new JiraApi({
        protocol: 'https',
        host,
        email,
        token,
        strictSSL: true
    });
}

const withJira = (callback) => {
    const jira = setCredential();
    return callback(jira);
}

const getCurrentUser = () => withJira((jira) => jira.getCurrentUser());

const findIssue = (issueNumber, fields) => withJira((jira) => jira.findIssue({issueNumber, fields}));

const updateIssue = (issueId, fields) => withJira((jira) => jira.updateIssue({issueId, issueUpdate: fields}));

const addNewIssue = (fields) => withJira((jira) => jira.addNewIssue(fields));

export {
    getCurrentUser,
    findIssue,
    addNewIssue,
    updateIssue,
}