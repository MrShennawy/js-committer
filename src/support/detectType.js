/**
 * Works out a conventional commit type from the changed files alone.
 *
 * This is the fallback used when the model is unavailable (no API key, no
 * network) and as a guard when the model answers with an unknown type. It is
 * deliberately conservative: the user still sees the result in the editable
 * commit prompt.
 */

// A Jira issue type is a stronger signal than any file name, so it wins.
const JIRA_TYPE_MAP = {
    bug: 'fix',
    defect: 'fix',
    fix: 'fix',
    incident: 'fix',
    story: 'feat',
    'new feature': 'feat',
    feature: 'feat',
    epic: 'feat',
    improvement: 'refactor',
    task: 'chore',
    'sub-task': 'chore',
    subtask: 'chore',
};

// Each rule claims a file. A type is only chosen when it claims every file.
const FILE_RULES = [
    {type: 'test', test: (p) => /(^|\/)(tests?|__tests__|spec|specs)\//i.test(p) || /\.(test|spec)\.[a-z0-9]+$/i.test(p)},
    {type: 'docs', test: (p) => /(^|\/)docs?\//i.test(p) || /\.(md|mdx|rst|adoc|txt)$/i.test(p) || /(^|\/)(readme|changelog|license|contributing)/i.test(p)},
    {type: 'style', test: (p) => /\.(css|scss|sass|less|styl)$/i.test(p)},
    {
        type: 'build',
        test: (p) => /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|composer\.(json|lock)|dockerfile|docker-compose\.ya?ml|makefile|[^/]*\.gradle)$/i.test(p)
            || /(^|\/)\.github\/workflows\//i.test(p)
            || /(^|\/)\.(travis|gitlab-ci|circleci)/i.test(p),
    },
];

/** Normalises a Jira issue type name to a commit type, or null. */
export const fromJiraIssueType = (issueTypeName) => {
    if (!issueTypeName) return null;
    return JIRA_TYPE_MAP[String(issueTypeName).trim().toLowerCase()] ?? null;
};

/**
 * @param {{status: string, path: string}[]} files - from `git diff --name-status`
 * @param {string|null} jiraIssueType - the Jira issue type name, when available
 * @returns {string} one of the conventional commit types
 */
export const detectType = (files = [], jiraIssueType = null) => {
    const fromJira = fromJiraIssueType(jiraIssueType);
    if (fromJira) return fromJira;

    if (!files.length) return 'chore';

    const paths = files.map(file => file.path);

    // A type only wins when it explains the whole change set: a commit that
    // touches docs and source at once is not a docs commit.
    for (const rule of FILE_RULES) {
        if (paths.every(rule.test)) return rule.type;
    }

    // Deletions only, with nothing added, is usually clean-up.
    if (files.every(file => file.status === 'D')) return 'chore';

    // A new file is far more often a feature than a fix.
    if (files.some(file => file.status === 'A')) return 'feat';

    return 'fix';
};

export default detectType;
