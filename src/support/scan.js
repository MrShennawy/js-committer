import {statSync} from 'fs';
import {join} from 'path';
import git from './git.js';
import {repoRoot} from './config.js';

/**
 * A last look at what is about to be staged.
 *
 * The checks are deliberately narrow: a commit tool is the wrong place for a
 * full secret scanner, and every false positive costs the user a keystroke.
 * Findings are warnings that ask for confirmation, never hard failures.
 */

// Filenames that are almost never meant to be committed.
const RISKY_NAMES = [
    {pattern: /(^|\/)\.env(\.|$)/i, label: 'environment file'},
    {pattern: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i, label: 'private ssh key'},
    {pattern: /\.(pem|p12|pfx|keystore|jks)$/i, label: 'key or certificate store'},
    {pattern: /(^|\/)\.npmrc$/i, label: 'npm credentials file'},
    {pattern: /(^|\/)(credentials|service-account.*\.json)$/i, label: 'credentials file'},
];

// Content that looks like a live credential rather than a placeholder.
const RISKY_CONTENT = [
    {pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'private key'},
    {pattern: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id'},
    {pattern: /\bAIza[0-9A-Za-z_-]{35}\b/, label: 'Google API key'},
    {pattern: /\bAT[AC]TT[A-Za-z0-9_\-=.]{20,}/, label: 'Atlassian API token'},
    {pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, label: 'GitHub token'},
    {pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token'},
    {pattern: /\b(secret|password|passwd|api[_-]?key|token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i, label: 'hard coded credential'},
];

// A line that reads a value from somewhere else holds no secret of its own.
const INDIRECTION = /(process\.env|import\.meta\.env|\$\{[^}]+\}|<[^>]+>|\{\{[^}]+\}\})/i;

// Applied to the matched value rather than the whole line, so a real key is
// still reported when the word "example" appears elsewhere on the line.
const PLACEHOLDER = /(example|changeme|placeholder|your[_-]?key|dummy|sample|redacted|x{4,})/i;

const MB = 1024 * 1024;

/**
 * @param {{status: string, path: string}[]} files
 * @param {string} diff - the added lines are what matters
 * @param {{maxFileSizeMb: number}} options
 * @returns {{path: string, label: string}[]}
 */
export const scanChanges = (files = [], diff = '', {maxFileSizeMb = 5} = {}) => {
    const findings = [];
    const root = repoRoot();

    for (const file of files) {
        if (file.status === 'D') continue;

        for (const {pattern, label} of RISKY_NAMES) {
            if (pattern.test(file.path)) findings.push({path: file.path, label});
        }

        try {
            const {size} = statSync(join(root, file.path));
            if (size > maxFileSizeMb * MB) {
                findings.push({path: file.path, label: `large file, ${(size / MB).toFixed(1)} MB`});
            }
        } catch {
            // Removed or unreadable between listing and scanning: nothing to say.
        }
    }

    // Only added lines can introduce a secret, so removals are skipped.
    const added = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));

    for (const line of added) {
        if (INDIRECTION.test(line)) continue;

        for (const {pattern, label} of RISKY_CONTENT) {
            const match = line.match(pattern);
            if (!match) continue;

            // AWS publishes AKIAIOSFODNN7EXAMPLE in its own docs; values like
            // that are copied into fixtures all the time and are not secrets.
            if (PLACEHOLDER.test(match[0])) continue;

            findings.push({path: 'diff', label});
            break;
        }
    }

    // One entry per path and label, however many lines matched.
    const seen = new Set();
    return findings.filter(({path, label}) => {
        const key = `${path}::${label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** True when the branch is one the project asked to be careful with. */
export const isProtectedBranch = (branchName, protectedBranches = []) => (
    protectedBranches.some(name => name.toLowerCase() === (branchName ?? '').toLowerCase())
);

export default {scanChanges, isProtectedBranch};
