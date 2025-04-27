import {Command} from "../Command.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";

export class DeleteMyAccount extends Command
{
    constructor()
    {
        super(
            "delete",
            [],
            "Delete your account",
            "Remove all your data from the bot, can still be restored by contacting the bot owner"
        );
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const content = {
            embeds: [EmbedUtility.GetWarningEmbedMessage(
                "Are you sure you want to delete your account ?",
                "This action is not totally irreversible, if you want to restore your account, you will have to contact the bot owner on the support server."
            )],
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel("Yes")
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId("yes"),
                        new ButtonBuilder()
                            .setLabel("No")
                            .setStyle(ButtonStyle.Danger)
                            .setCustomId("no")
                    )
            ]
        };

        await DiscordUtility.Reply(interaction, content, true);
        const message = await interaction.fetchReply();
        const filter = (interaction) => interaction.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({filter, time: 60 * 1000});

        collector.on("collect", async interaction =>
        {
            if (interaction.customId === "yes")
            {
                await ManhwaNotifier.Instance.DataCenter.DeleteUser(interaction.user.id);
                await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage("Your account has been deleted successfully !"));
            }
            else if (interaction.customId === "no")
            {
                await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage("Deletion aborted"));
            }

            await DiscordUtility.Defer(interaction);
            collector.stop();
        });
    }
}