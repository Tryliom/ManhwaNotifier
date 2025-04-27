import {Command} from "../Command.mjs";
import {Utils} from "../../utility/Utils.mjs";

export class Test extends Command {
    constructor(commandController) {
        super("test", "", 0, "A test command used in development", commandController, true);
    }

    async Run(interaction) {
        await super.Run(interaction);

        console.log(await Utils.getCurrentIdFor("https://asuracomics.com"));
        console.log(await Utils.getCurrentIdFor("https://luminousscans.com"));
    }
}