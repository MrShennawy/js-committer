import {execSync} from "child_process";

export default ({
    command() {
        try {
            return execSync(`git pull`);
        } catch (err) {
            process.exit(1);
        }
    },
})