import {Command} from "../Command.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ScrapStatusType} from "../ScrapStatusType.mjs";

export class CheckManhwaUrl extends Command
{
    constructor()
    {
        super(
            "check",
            [
                {
                    name: "url",
                    description: "The URL to a manhwa",
                    required: true
                }
            ],
            "Check if the URL is a valid manhwa URL",
            "Get info about a manhwa URL, if title, description, chapters and image are correctly fetched"
        );
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const url = interaction.options.get("url").value;

        await DiscordUtility.Reply(interaction, EmbedUtility.GetNeutralEmbedMessage("URL Check", "Loading.."));

        const scrapInfo = await Utils.getAllInfo(url);

        if (scrapInfo.StatusType !== ScrapStatusType.Success)
        {
            const embed = EmbedUtility.GetBadEmbedMessage(`Error`);

            embed.setDescription(
                `We cannot get any information about ${url}` +
                `\n\n${scrapInfo.StatusType}: ${scrapInfo.CustomErrorMessage}`
            );

            await DiscordUtility.Reply(interaction, embed);
            return;
        }

        const embed = EmbedUtility.GetGoodEmbedMessage(`Scan of [${scrapInfo.Name}]`)
            .addFields([
                {name: "Total chapters", value: `${scrapInfo.ChaptersUrls.length} chapters`, inline: true},
                {name: "Last chapter", value: `[${Utils.formatChapterFromURL(scrapInfo.ChaptersUrls[0])}](${scrapInfo.ChaptersUrls[0]})`, inline: true},
                {name: "Image url", value: `${scrapInfo.Image} (raw link)`, inline: true},
                {name: "\u200B", value: "\u200B", inline: false}
            ]);
        const conditions = [];
        const isOk = (condition) => {
            conditions.push(condition);
            return condition ? "✅" : "❌";
        };
        const checks = [];

        checks.push(`Title: ${isOk(scrapInfo.Name !== "")}`);
        checks.push(`Description: ${isOk(scrapInfo.Description !== "")}`);
        checks.push(`Image: ${isOk(scrapInfo.IsImageValid())}`);
        checks.push(`Chapters: ${isOk(scrapInfo.ChaptersUrls.length > 0)}`);
        checks.push(`Chapter format: ${isOk(Utils.formatChapterFromURL(scrapInfo.ChaptersUrls[0]) !== "Chapter ?")}`);

        if (scrapInfo.FinalUrl.length > 0 && scrapInfo.FinalUrl.startsWith("http"))
        {
            embed.setURL(scrapInfo.FinalUrl);
        }

        embed.addFields([
            {
                name: `Is ${Utils.getWebsiteNameFromUrl(url)} supported ? ${conditions.filter(v => v).length === conditions.length ? "Yes" : "No"}`,
                value: checks.join("\n")
            }
        ]);

        if (scrapInfo.Description !== "")
        {
            embed.setDescription(scrapInfo.Description);
        }

        if (scrapInfo.IsImageValid())
        {
            embed.setImage(scrapInfo.Image);
        }

        embed.setFooter({text: `If you want to add a supported website, ask the bot owner on the support server available in /help`});

        await DiscordUtility.Reply(interaction, embed);
    }
}