import { GoogleGenerativeAI } from "@google/generative-ai";
import gitDiff from "../git/diff.js";

const genAI = new GoogleGenerativeAI("AIzaSyBVmv4MqOlWaGgKWyIAnl-v7vhxW6OVRPQ");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateCommitMessage = async (mode, commitType, details) => {
    console.log(gitDiff)
    retur;
    let prompt;
    // const gitDiff = await git.diff();

    if (mode === 'Fun Mode') {
        prompt = `
        You are a witty AI that helps generate git commit messages.
        Commit type: ${commitType}
        Details: ${details}
        Make the commit message funny, creative, and enjoyable. Limit the response to a maximum of 8 words.
        `;
    } else {
        prompt = `
        You are a serious AI that helps generate git commit messages.
        Commit type: ${commitType}
        Details: ${gitDiff}
        Generate a professional, concise git commit message. Limit the response to a git allowed commit length.
        `;
    }

    const result = await model.generateContent(prompt);
    console.log(result.response.text());
    return result.response.text();
};
