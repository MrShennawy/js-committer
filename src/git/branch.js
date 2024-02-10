import {execSync} from "child_process";

const command = (args) => {
    try {
        return execSync(`git branch ${args}`).toString().trim();
    } catch (err) {
        process.exit(1);
    }
}

export default {
    command,
}