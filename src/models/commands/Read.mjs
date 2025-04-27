import {Command} from "../Command.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";

export class Read extends Command
{
    constructor()
    {
        super(
            "read",
            [
                {
                    name: "name",
                    description: "The name of the manhwa or all",
                    autocomplete: true,
                    required: true
                }
            ],
            "Remove from your unread list a manhwa or all of them",
            "Remove the chapters of the specified manhwa from your unread list or all chapters"
        );
    }

    async OnAutocomplete(interaction, focusedOption)
    {
        if (focusedOption.name !== "name") return;

        const list = ManhwaNotifier.Instance.DataCenter.GetTop25ManhwasUnread(interaction.user.id, focusedOption.value);

        await interaction.respond(list);
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const choice = interaction.options.get("name").value;

        if (ManhwaNotifier.Instance.DataCenter.IsUserUnreadChaptersEmpty(interaction.user.id))
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage("Your unread list is already empty"), true);
            return;
        }

        if (choice === "all")
        {
            ManhwaNotifier.Instance.DataCenter.ReadAllChapters(interaction.user.id);
            await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage("You have clear your unread list"), true);
        }
        else
        {
            ManhwaNotifier.Instance.DataCenter.ReadChapters(interaction.user.id, choice);
            await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage(`You have clear the unread chapters of ${choice}`), true);
        }
    }
}