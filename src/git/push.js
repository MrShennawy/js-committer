import {execSync} from "child_process";

export default ({
    command() {
        try {
            return execSync(`git push`);
        } catch (err) {
            process.exit(1);
        }
    },
})