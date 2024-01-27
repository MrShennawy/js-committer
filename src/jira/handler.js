import JiraApi from './api.js';
import { readSettings } from '../store/handler.js';

const jiraData = readSettings('jira')

const jira = new JiraApi({
    protocol: 'https',
    host: jiraData.host,
    email: jiraData.email,
    token: jiraData.token,
    strictSSL: true
});

const getCurrentUser = () => {
    return jira.getCurrentUser()
}

const findIssue = (issueNumber, fields) => {
    return jira.findIssue({issueNumber, fields})
}

const updateIssue = (issueId, fields) => {
    return jira.updateIssue({issueId, issueUpdate: fields});
}

const addNewIssue = (fields) => {
    return jira.addNewIssue(fields);
}

export {
    findIssue,
    addNewIssue,
    updateIssue,
    getCurrentUser
}