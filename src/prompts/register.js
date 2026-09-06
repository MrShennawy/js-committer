import inquirer from "inquirer";
import ConfirmPrompt from "./confirm.js";
import InputPrompt from "./input.js";

/**
 * Registers the custom prompt types once, in one place.
 * Previously some modules used 'enhanced-confirm' without registering it and
 * only worked because an unrelated import happened to register it first.
 */
inquirer.registerPrompt('enhanced-confirm', ConfirmPrompt);
inquirer.registerPrompt('default-editable-input', InputPrompt);

export default inquirer;
