import {execFileSync, execFile} from "child_process";

/**
 * Small cross-platform helpers for talking to the desktop environment.
 * Every command is run without a shell and every failure is swallowed: these
 * are conveniences, so a missing tool must never break the commit flow.
 */

// Ordered by how likely each tool is to be present on the platform.
const CLIPBOARD_READERS = {
    darwin: [['pbpaste', []]],
    win32: [['powershell', ['-NoProfile', '-Command', 'Get-Clipboard']]],
    linux: [
        ['wl-paste', ['--no-newline']],
        ['xclip', ['-selection', 'clipboard', '-o']],
        ['xsel', ['--clipboard', '--output']],
    ],
};

const OPENERS = {
    darwin: ['open', []],
    win32: ['cmd', ['/c', 'start', '']],
    linux: ['xdg-open', []],
};

/**
 * Reads the system clipboard.
 * @returns {string|null} the clipboard text, or null when it cannot be read
 */
export const readClipboard = () => {
    const readers = CLIPBOARD_READERS[process.platform] ?? CLIPBOARD_READERS.linux;

    for (const [command, args] of readers) {
        try {
            return execFileSync(command, args, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 3000,
            });
        } catch {
            // Tool missing or no clipboard access: try the next one.
        }
    }

    return null;
}

/**
 * Opens a URL in the user's default browser.
 * @returns {boolean} whether the command was launched
 */
export const openUrl = (url) => {
    const opener = OPENERS[process.platform] ?? OPENERS.linux;
    if (!opener) return false;

    try {
        const [command, args] = opener;
        const child = execFile(command, [...args, url], () => {});
        // Let the process exit even if the browser command is still running.
        child.unref();
        return true;
    } catch {
        return false;
    }
}

export default {readClipboard, openUrl};
