import {Command} from "../Command.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {CustomMenu} from "../menus/CustomMenu.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";

export class Faq extends Command
{
    constructor()
    {
        super("faq", [], "Display a list of frequently asked questions and answers", "Show the list of frequently asked questions and answers.");
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const faqList = ManhwaNotifier.Instance.DataCenter.GetFaqs();
        const embeds = [];

        if (faqList.length === 0)
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage("No FAQ", "There are no FAQ available."), true);
            return;
        }

        for (const faq of faqList)
        {
            embeds.push(EmbedUtility.GetNeutralEmbedMessage(faq.Question, faq.Answer));
        }

        await new CustomMenu(interaction, embeds).SetUsePageNumber(false).LaunchMenu();
    }
}