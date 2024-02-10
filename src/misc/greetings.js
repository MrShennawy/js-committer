import chalk from "chalk";
import status from "../git/status.js";

export const greetings = () => {
    console.log(chalk.yellow(`
   _____                              _  _    _                 
  / ____|                            (_)| |  | |                
 | |      ___   _ __ ___   _ __ ___   _ | |_ | |_  ___  _ __    
 | |     / _ \\ | '_ \` _ \\ | '_ \` _ \\ | || __|| __|/ _ \\| '__|   
 | |____| (_) || | | | | || | | | | || || |_ | |_|  __/| |      
  \\_____|\\___/ |_| |_| |_||_| |_| |_||_| \\__| \\__|\\___||_|      
                                                                `));

    // check repo Files status
    if(status.command().includes('nothing to commit')) {
        console.log(chalk.black.bgYellowBright.bold('Nothing to commit, working tree clean', "\n"));
        process.exit(1);
    }
};