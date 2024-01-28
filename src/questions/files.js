import inquirer from "inquirer";
import add from "../git/add.js";

export default async () => {
    if(![...process.argv].includes('-s')) return '.';

    let files = '.';

    let questions = [];
    const filesQuestion = await add.files()
    questions.push(filesQuestion)

    if([...process.argv].includes('-s')) {
    }

    const answers = await inquirer.prompt(questions)
    return answers.files.join(" ");
}