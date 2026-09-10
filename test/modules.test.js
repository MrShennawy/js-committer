import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

// index.js runs the tool on import, so it is checked by the bin tests instead.
const ENTRY_POINT = join(srcDir, 'index.js');

const modulesUnder = (dir) => readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return modulesUnder(path);
    return entry.name.endsWith('.js') && path !== ENTRY_POINT ? [path] : [];
});

/**
 * Importing every module catches what parsing cannot: a reference to something
 * that no longer exists. A refactor that removed a function while leaving its
 * callers behind passed both --check and the unit tests, and only failed once
 * a person reached that prompt.
 */
test('every module imports without a missing reference', async () => {
    const modules = modulesUnder(srcDir);
    assert.ok(modules.length > 20, 'the walk found the source tree');

    const failures = [];

    for (const path of modules) {
        try {
            await import(pathToFileURL(path).href);
        } catch (err) {
            failures.push(`${relative(root, path)}: ${err.message}`);
        }
    }

    assert.deepEqual(failures, [], `modules failed to load:\n${failures.join('\n')}`);
});

test('the exports the entry point depends on exist', async () => {
    const expected = {
        '../src/ai/settings.js': ['setupAi', 'setApiKeyDirectly', 'ENV_VARIABLE_NAMES', 'resolveAi', 'chooseModel', 'validateKey', 'clearApiKey'],
        '../src/jira/credentials.js': ['setupJira', 'JIRA_ENV_NAMES', 'resolveCredentials', 'storedCredentials'],
        '../src/ai/generate.js': ['generateSuggestions', 'generateCommitMessage', 'resolveMessage', 'parseReply'],
        '../src/ai/split.js': ['planCommits', 'parseGroups'],
        '../src/git/commit.js': ['parseSubject', 'formatSubject', 'isKnownType', 'typeNames', 'typeGuide', 'commitLink'],
    };

    for (const [path, names] of Object.entries(expected)) {
        const module = await import(path);
        for (const name of names) {
            assert.equal(typeof module[name] !== 'undefined', true, `${path} must export ${name}`);
        }
    }
});
