/**
 * Recognising and separating issue references.
 *
 * The separator between the description and the issue reference is a hyphen,
 * which also appears inside ordinary words ("auth-service"). Splitting is
 * therefore driven by the shape of the reference rather than by the hyphen
 * alone: only a trailing token that actually looks like an issue key is taken.
 */

// SHEN-33, ABC-1234, and the plain "#12" / "12" used by GitHub style trackers.
export const ISSUE_KEY = /^(?:#?\d+|[A-Za-z][A-Za-z0-9]*-\d+)$/;

// Jira keys only, used when reading a key out of a branch name.
const JIRA_KEY = /\b([A-Za-z][A-Za-z0-9]*-\d+)\b/;

export const SEPARATOR = '-';
export const LEGACY_SEPARATOR = '❯';

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

    // Commits written before the separator changed still parse.
    const legacy = value.indexOf(LEGACY_SEPARATOR);
    if (legacy !== -1) {
        return {
            sentence: value.slice(0, legacy).trim(),
            issueId: value.slice(legacy + LEGACY_SEPARATOR.length).trim() || null,
        };
    }

    // Take the last separator, and only when what follows is a real key, so
    // "update auth-service" and "fix a - b" keep their hyphens.
    const marker = ` ${SEPARATOR} `;
    const index = value.lastIndexOf(marker);
    if (index !== -1) {
        const candidate = value.slice(index + marker.length).trim();
        if (looksLikeIssueKey(candidate)) {
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
    const match = branchName.replace(/[/_]/g, ' ').match(JIRA_KEY);
    return match ? match[1].toUpperCase() : null;
};
