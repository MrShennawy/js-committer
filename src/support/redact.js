/**
 * Removes credentials from a diff before it is sent to a model.
 *
 * The scan in support/scan.js decides whether to warn the user; this decides
 * what leaves the machine. They are deliberately separate: this one replaces
 * rather than reports, and errs towards removing too much, since a redacted
 * value costs the model nothing while a leaked one cannot be taken back.
 */

const RULES = [
    // Whole key blocks collapse to a single line.
    {pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, with: '[private key removed]'},
    {pattern: /\bAKIA[0-9A-Z]{16}\b/g, with: '[aws-key]'},
    {pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, with: '[google-key]'},
    {pattern: /\bAT[AC]TT[A-Za-z0-9_\-=.]{20,}/g, with: '[atlassian-token]'},
    {pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, with: '[github-token]'},
    {pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, with: '[slack-token]'},
    {pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, with: '[api-key]'},
    {pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, with: '[jwt]'},
    // Assignments keep their key name, which is the part that carries meaning.
    {
        pattern: /\b(secret|password|passwd|pwd|api[_-]?key|access[_-]?token|auth[_-]?token|token|private[_-]?key)(\s*[:=]\s*)(['"])[^'"\n]{8,}\3/gi,
        with: (_, name, joiner, quote) => `${name}${joiner}${quote}[redacted]${quote}`,
    },
    // Connection strings carry the password in the authority section.
    {pattern: /\b([a-z][a-z0-9+.-]*:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, with: (_, scheme, user) => `${scheme}${user}:[redacted]@`},
];

/**
 * @param {string} text
 * @returns {{text: string, removed: number}} the cleaned text and how many
 *   values were replaced, so the caller can tell the user
 */
export const redact = (text) => {
    if (!text) return {text: text ?? '', removed: 0};

    let result = text;
    let removed = 0;

    for (const {pattern, with: replacement} of RULES) {
        result = result.replace(pattern, (...args) => {
            removed += 1;
            return typeof replacement === 'function' ? replacement(...args) : replacement;
        });
    }

    return {text: result, removed};
}

export default redact;
