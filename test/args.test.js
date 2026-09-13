import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

/**
 * The flags are read from process.argv when the module loads, so each case
 * needs its own process. `--` keeps node from claiming the flags for itself,
 * and the "cmt" placeholder stands in for the script name that a real run has
 * in that position, which is where the module starts reading.
 */
const unknownIn = (...argv) => JSON.parse(execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `const {unknownFlags} = await import(${JSON.stringify(new URL('../src/support/args.js', import.meta.url).href)});
     process.stdout.write(JSON.stringify(unknownFlags()));`,
    '--',
    'cmt',
    ...argv,
], {encoding: 'utf8'}));

test('every documented flag is recognised', () => {
    const documented = [
        '-s', '-b', '-jr', '-lc', '-y', '--yes', '-n', '--dry-run',
        '--setup', '--no-ai', '--amend', '--undo', '--split',
        '-h', '--help', '-v', '--version',
    ];

    for (const flag of documented) {
        assert.deepEqual(unknownIn(flag), [], `${flag} must be a known flag`);
    }

    assert.deepEqual(unknownIn('-s', '-b', '-y', '--split'), [], 'flags combine');
});

test('a mistyped flag is reported rather than ignored', () => {
    // Asking for --amned and silently getting an ordinary commit is the worst
    // possible answer: the previous commit is left alone and a new one appears.
    assert.deepEqual(unknownIn('--amned'), ['--amned']);
    assert.deepEqual(unknownIn('-x', '--nope'), ['-x', '--nope']);
    assert.deepEqual(unknownIn('--dry'), ['--dry'], 'a prefix of a real flag is not a real flag');
});

test('the value of --set-key is not mistaken for a flag', () => {
    assert.deepEqual(unknownIn('--set-key', 'AIza-not-a-real-key'), []);
    assert.deepEqual(unknownIn('--set-key=AIza-not-a-real-key'), []);
    assert.deepEqual(unknownIn('--set-key'), [], 'a missing value is not an unknown flag');
});
