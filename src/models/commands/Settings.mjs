import {Command} from "../Command.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";

export class Settings extends Command
{
    constructor()
    {
        super(
            "settings",
            [],
            "Toggle features and alerts you can receive",
            "Toggle features like unread list and you can disable alerts like changelog, polls, errors and buttons on new chapter"
        );
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        await new SettingsInterface(interaction, this._manhwaNotifier).Start();
    }
}

class SettingsInterface extends CommandInterface
{
    constructor(interaction)
    {
        super(interaction);

        this.SetEphemeral(true);
    }

    async OnButton(interaction)
    {
        const userID = interaction.user.id;
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (interaction.customId === "toggle-changelog")
        {
            dataCenter.ToggleUserChangelog(userID);
        }

        if (interaction.customId === "toggle-button-on-new-chapter")
        {
            dataCenter.ToggleUserButtonOnNewChapter(userID);
        }

        if (interaction.customId === "toggle-polls")
        {
            dataCenter.ToggleUserPolls(userID);
        }

        if (interaction.customId === "toggle-unread")
        {
            dataCenter.ToggleUserUnread(userID);
        }

        if (interaction.customId === "toggle-alert")
        {
            dataCenter.ToggleUserAlert(userID);
        }
    }

    ConstructEmbed()
    {
        const embed = EmbedUtility.GetGoodEmbedMessage("Settings");

        ManhwaNotifier.Instance.DataCenter.GetUser(this.Interaction.user.id).AddToEmbed(embed);

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Changelog")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("toggle-changelog")
                        .setEmoji({name: "🔄"}),
                    new ButtonBuilder()
                        .setLabel("Chapter Buttons")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("toggle-button-on-new-chapter")
                        .setEmoji({name: "🔄"}),
                    new ButtonBuilder()
                        .setLabel("Polls")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("toggle-polls")
                        .setEmoji({name: "🔄"}),
                )
        );
        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Unread")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("toggle-unread")
                        .setEmoji({name: "🔄"}),
                    new ButtonBuilder()
                        .setLabel("Alert")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("toggle-alert")
                        .setEmoji({name: "🔄"})
                )
        );

        return components;
    }
}