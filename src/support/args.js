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
    // -h / --help
    help: has('-h', '--help'),
};

export default flags;
