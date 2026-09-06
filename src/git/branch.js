import git from "../support/git.js";

const command = (...args) => git(['branch', ...args]);

/** Name of the branch that is currently checked out. */
const current = () => git(['rev-parse', '--abbrev-ref', 'HEAD']);

export default {
    command,
    current,
}
