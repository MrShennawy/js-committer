import {execSync} from "child_process";

const command = (args = '') => {
    try {
        return execSync(`git config ${args}`).toString().trim();
    } catch (err) {
        return null;
    }
}

export default ({
    command,
})