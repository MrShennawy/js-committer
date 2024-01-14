import {execSync} from "child_process";
import {replaceArray} from "../support/helper.js"
import chalk from "chalk";

const statuses = {
    "??": "Untracked",
    "M": "modified",
    "A": "added",
    "D": "deleted",
    "R": "renamed"
};

export default ({
    command() {
        try {
            return execSync("git status -s").toString().trim();
        } catch (err) {
            process.exit(1);
            // const data = Buffer.from(err.output[2]);
            // const decodedData = data.toString("utf8");
            // console.log(decodedData);
        }
    },
    async handleFiles() {
        let selectFiles = [];
        let files = this.command().split("\n");
        files.forEach(file => {
            let lineTrim = file.trim();
            let lineArr = lineTrim.split(" ");
            let statusLetters = lineArr.shift();
            let letters = this.handleStatusLetters(statusLetters);
            let status = replaceArray(letters, Object.keys(statuses), Object.values(statuses))
            let fileTitle = `${chalk.bold[this.statusColor(status)](status)}: ${lineArr.join(" ").trimStart()}`;
            lineArr.splice(1, 0);
            if(lineArr.includes('->')) lineArr.splice(0,3)
            let filePath = lineArr.join(" ").trimStart();
            selectFiles.push({
                name: fileTitle,
                value: filePath
            })
        });
        return selectFiles;
    },
    handleStatusLetters(letters) {
        if (letters === "??") return letters;
        return letters.split("").join(" + ");
    },
    statusColor(status) {
        switch (status) {
            case "Untracked":
            case "deleted":
                return "red";
            case "modified":
                return "yellow";
            case "added":
                return "cyan";
            case "renamed":
                return "blueBright";
            default:
                return "green";
        }
    }
})