/**
 * CLI flags, parsed once at startup.
 * Previously every module re-scanned process.argv, which made the behaviour
 * hard to follow and impossible to test.
 */
const argv = process.argv.slice(2);

const has = (...names) => names.some(name => argv.includes(name));

/** Reads the value that follows a flag, e.g. --set-key <value>. */
const valueOf = (...names) => {
    for (const name of names) {
        const index = argv.indexOf(name);
        if (index !== -1) {
            const value = argv[index + 1];
            if (value && !value.startsWith('-')) return value;
        }

        // Also accept the --flag=value form.
        const inline = argv.find(arg => arg.startsWith(`${name}=`));
        if (inline) return inline.slice(name.length + 1);
    }

    return null;
};

export const flags = {
    // -s : pick the files to stage instead of staging everything
    selectFiles: has('-s'),
    // -b : run a build command and use it as the commit sentence
    build: has('-b'),
    // -jr : link the commit to a Jira issue
    jira: has('-jr'),
    // -lc : reuse the last commit message
    lastCommit: has('-lc'),
    // --setup : configure the AI key and exit
    setup: has('--setup'),
    // --no-ai : write the message by hand this once
    noAi: has('--no-ai'),
    // --set-key <key> : store a key without the walkthrough
    setKey: valueOf('--set-key'),
    // -y : accept every confirmation, for unattended runs
    yes: has('-y', '--yes'),
    // --amend : rewrite the previous commit instead of creating one
    amend: has('--amend'),
    // --dry-run : show what would happen and stop
    dryRun: has('--dry-run', '-n'),
    // --undo : soft reset the previous commit
    undo: has('--undo'),
    // --split : group the changes into several commits
    split: has('--split'),
    // -h / --help, -v / --version
    help: has('-h', '--help'),
    version: has('-v', '--version'),
};

// Everything the tool answers to. A typo such as --amned used to be ignored in
// silence, which meant asking for an amend and quietly getting a new commit.
const KNOWN = new Set([
    '-s', '-b', '-jr', '-lc', '-y', '-n', '-h', '-v',
    '--setup', '--no-ai', '--set-key', '--yes', '--amend',
    '--dry-run', '--undo', '--split', '--help', '--version',
]);

// The value of --set-key is an argument, not a flag, so it is not checked.
const VALUE_OWNERS = new Set(['--set-key']);

/** Arguments that are not flags this tool knows, in the order they were given. */
export const unknownFlags = () => {
    const found = [];

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (!arg.startsWith('-')) continue;

        const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
        if (!KNOWN.has(name)) {
            found.push(arg);
            continue;
        }

        // Step over the value that belongs to this flag, when it was given as
        // a separate argument rather than with "=".
        if (VALUE_OWNERS.has(name) && !arg.includes('=')) index++;
    }

    return found;
}

flags.unknown = unknownFlags();

export default flags;
