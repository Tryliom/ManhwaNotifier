import {Command} from "../Command.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {SecurityUtility} from "../../utility/SecurityUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {CustomMenu} from "../menus/CustomMenu.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";

export class Help extends Command
{
    static CommandsPerPages = 3;

    constructor()
    {
        super("help", [], "Display the help page with more informations", "Display the help page with all the commands available and long description.");
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const embeds = [];
        const actions = [];
        let count = 0;
        let description = "";

        for (const command of this._commandController.Commands)
        {
            const index = this._commandController.Commands.indexOf(command);

            if (command.OnlyCreator && !SecurityUtility.IsCreator(interaction.user.id)) continue;
            if (command.OnlyInServer && !interaction.guildId) continue;
            if (command.Admin && !DiscordUtility.IsAdministrator(interaction.user.id, interaction.guildId)) continue;

            const desc = command.LongDescription !== "" ? command.LongDescription : command.Description;
            let args = "";

            for (const arg of command.Args)
            {
                args += "\n";
                args += `- ${arg.name}${arg.required ? " (required)" : ""}\n${arg.description}`;
            }

            if (args.length > 0) args = `\n### Arguments${args}`;

            description += `## /${command.Name}\n${desc}${args}\n`;
            count++;

            if (count === Help.CommandsPerPages || (index + 1) === this._commandController.Commands.length)
            {
                embeds.push(EmbedUtility.GetGoodEmbedMessage("Help").setDescription(description));

                if (embeds.length === 1)
                {
                    embeds[0].addFields(
                        [
                            {name: "\u200B", value: "\u200B"},
                            {
                                name: "Supported websites",
                                value: Utils.getFormattedSupportedWebsite()
                            },
                            {
                                name: "Half supported websites",
                                value: "Mangakakalot, bato.to, comic.naver and Readmanganato are **half** supported, this means that you can only follow manhwa on them with the url."
                            },
                            {
                                name: "Want to add a website?",
                                value: "If you want to add a website, please contact the creator of the bot via the support server.\n" +
                                    "Also, if you want to check if a website is supported, you can use the `/check` command with the url of a manhwa."
                            }
                        ]
                    )
                }

                description = "";
                count = 0;
            }
        }

        if (count > 0)
        {
            embeds.push(EmbedUtility.GetGoodEmbedMessage("Help").setDescription(description));
        }

        for (let embed of embeds)
        {
            embed.setFooter({text: "Page " + (embeds.indexOf(embed) + 1) + "/" + embeds.length});
            actions.push([
                {
                    text: "Vote",
                    url: "https://top.gg/bot/774991048026882068/vote"
                },
                {
                    text: "Write a review",
                    url: "https://top.gg/bot/774991048026882068"
                },
                {
                    text: "Join the support server",
                    url: "https://discord.gg/RxfzAuPkcp"
                }
            ])
        }

        await new CustomMenu(interaction, embeds, actions).LaunchMenu();
    }
}