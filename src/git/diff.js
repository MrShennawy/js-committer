import {execSync} from "child_process";

const command = (files) => {
    try {
        return execSync(`git diff ${files}`).toString().trim();
    } catch (err) {
        process.exit(1);
    }
}

export default {
    command,
}