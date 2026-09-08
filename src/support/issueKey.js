/**
 * Recognising and separating issue references.
 *
 * The separator written into a commit subject is "❯", which never occurs in
 * ordinary text and so splits unambiguously. A hyphen form was briefly used as
 * well, and is still read back, but only when the trailing token is a Jira
 * style key: a bare hyphen is far too common inside real descriptions
 * ("update auth-service") to be treated as a separator on its own.
 */

// SHEN-33, ABC-1234, and the plain "#12" / "12" used by GitHub style trackers.
export const ISSUE_KEY = /^(?:#?\d+|[A-Za-z][A-Za-z0-9]*-\d+)$/;

// The stricter shape required before a hyphen is read as a separator.
const JIRA_STYLE_KEY = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

// Used when reading a key out of a branch name.
const BRANCH_KEY = /\b([A-Za-z][A-Za-z0-9]*-\d+)\b/;

export const SEPARATOR = '❯';
export const HYPHEN_SEPARATOR = '-';

/** True when the text is shaped like an issue reference. */
export const looksLikeIssueKey = (text) => ISSUE_KEY.test((text ?? '').trim());

/** Appends the issue reference to a commit description. */
export const withIssue = (sentence, issueId) => (
    issueId ? `${sentence} ${SEPARATOR} ${issueId}` : sentence
);

/**
 * Splits a description from a trailing issue reference.
 *
 * @param {string} text
 * @returns {{sentence: string, issueId: string|null}}
 */
export const splitIssue = (text) => {
    const value = text ?? '';

    const marker = value.indexOf(SEPARATOR);
    if (marker !== -1) {
        return {
            sentence: value.slice(0, marker).trim(),
            issueId: value.slice(marker + SEPARATOR.length).trim() || null,
        };
    }

    // Hyphen form: only the last one, and only ahead of a Jira style key, so
    // "update auth-service" and "rename a - b" keep their hyphens.
    const hyphen = ` ${HYPHEN_SEPARATOR} `;
    const index = value.lastIndexOf(hyphen);
    if (index !== -1) {
        const candidate = value.slice(index + hyphen.length).trim();
        if (JIRA_STYLE_KEY.test(candidate)) {
            return {sentence: value.slice(0, index).trim(), issueId: candidate};
        }
    }

    return {sentence: value.trim(), issueId: null};
};

/**
 * Reads a Jira key out of a branch name, e.g. "feature/SHEN-33-add-login".
 * @returns {string|null} the key in upper case, or null
 */
export const issueKeyFromBranch = (branchName) => {
    if (!branchName) return null;

    // Slashes and underscores are word boundaries here, unlike in the regex.
    const match = branchName.replace(/[/_]/g, ' ').match(BRANCH_KEY);
    return match ? match[1].toUpperCase() : null;
};
