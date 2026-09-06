/**
 * CLI flags, parsed once at startup.
 * Previously every module re-scanned process.argv, which made the behaviour
 * hard to follow and impossible to test.
 */
const argv = process.argv.slice(2);

const has = (...names) => names.some(name => argv.includes(name));

export const flags = {
    // -s : pick the files to stage instead of staging everything
    selectFiles: has('-s'),
    // -b : run a build command and use it as the commit sentence
    build: has('-b'),
    // -jr : link the commit to a Jira issue
    jira: has('-jr'),
    // -lc : prefill the prompts from the last commit
    lastCommit: has('-lc'),
};

export default flags;
