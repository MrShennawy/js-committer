import git from "../support/git.js";

// Reading a missing key is not an error, so failures return null.
const command = (...args) => git(['config', ...args], {allowFail: true});

const get = (key) => command('--get', key);

const set = (key, value) => command(key, value);

export default ({
    command,
    get,
    set,
})
