import {Command} from "../Command.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";

export class Stats extends Command
{
    constructor()
    {
        super(
            "stats",
            [],
            "Stats on how many users use it",
            "How many user use the bot, how many manhwa they follow, how many are active, etc."
        );
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const stats = ManhwaNotifier.Instance.DataCenter.GetBotStats();
        const embed = EmbedUtility.GetNeutralEmbedMessage("Stats");

        stats.AddToEmbed(embed);

        await DiscordUtility.Reply(interaction, embed);
    }
}