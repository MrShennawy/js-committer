import chalk from "chalk";
import git from "../support/git.js";

// Human readable label for each porcelain status letter.
const STATUS_LABELS = {
    "?": "Untracked",
    "M": "modified",
    "A": "added",
    "D": "deleted",
    "R": "renamed",
    "C": "copied",
    "U": "unmerged",
    "T": "type changed",
};

const COLORS = {
    "Untracked": "red",
    "deleted": "red",
    "modified": "yellow",
    "added": "cyan",
    "renamed": "blueBright",
    "copied": "blueBright",
    "unmerged": "magenta",
};

/**
 * Parses `git status --porcelain -z`.
 *
 * The NUL separated form is used on purpose: it is the only output that stays
 * correct for paths containing spaces, quotes or non-ASCII characters. Each
 * record is "XY <path>", and rename/copy records are followed by a second
 * record holding the original path.
 *
 * @returns {{x: string, y: string, path: string, origPath: string|null}[]}
 */
const entries = () => {
    // Not trimmed: in porcelain output a leading space is part of the status.
    const raw = git(['status', '--porcelain', '-z'], {trim: false});
    if (!raw) return [];

    const tokens = raw.split('\0').filter(token => token.length);
    const result = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const x = token[0];
        const y = token[1];
        const path = token.slice(3);

        // For renames and copies git emits the original path as the next token.
        let origPath = null;
        if (x === 'R' || x === 'C' || y === 'R' || y === 'C') origPath = tokens[++i] ?? null;

        result.push({x, y, path, origPath});
    }

    return result;
};

/** Describes a record the way git does, e.g. "modified" or "added + modified". */
const describe = ({x, y}) => {
    if (x === '?' && y === '?') return STATUS_LABELS['?'];
    return [x, y]
        .filter(letter => letter && letter !== ' ')
        .map(letter => STATUS_LABELS[letter] ?? letter)
        .join(' + ');
};

const statusColor = (status) => COLORS[status.split(' + ')[0]] ?? 'green';

export default ({
    entries,
    describe,
    statusColor,

    /** True when there is nothing to commit. Does not depend on git's locale. */
    isClean() {
        return entries().length === 0;
    },

    /** Number of changed paths, for the greeting box. */
    changesCount() {
        return entries().length;
    },

    /** Inquirer checkbox choices, one per changed path. */
    async handleFiles() {
        return entries().map(entry => {
            const status = describe(entry);
            const label = entry.origPath ? `${entry.origPath} -> ${entry.path}` : entry.path;
            return {
                name: `${chalk.bold[statusColor(status)](status)}: ${label}`,
                value: entry.path,
            };
        });
    },
})
