import {EmbedUtility} from "./EmbedUtility.mjs";
import {
    ButtonInteraction,
    SelectMenuInteraction,
    EmbedBuilder,
    MessageComponentInteraction,
    CommandInteraction
} from "discord.js";
import {ManhwaNotifier} from "../controller/ManhwaNotifier.mjs";
import {PermissionFlagsBits} from "discord-api-types/v10";
import {SecurityUtility} from "./SecurityUtility.mjs";

export class DiscordUtility
{
    /**
     * Reply to an interaction, automatically choose reply or update
     * @param interaction {MessageComponentInteraction, ButtonInteraction, SelectMenuInteraction}
     * @param content {{embeds, content, components}, EmbedBuilder}
     * @param ephemeral {boolean} Whether the message should be ephemeral or not (default: false)
     * @returns {Promise<void>}
     */
    static async Reply(interaction, content, ephemeral = false)
    {
        content = EmbedUtility.FormatMessageContent(content, ephemeral);

        try
        {
            if (interaction instanceof CommandInteraction && !interaction.replied)
            {
                await interaction.reply(content);
            }
            else
            {
                if (interaction.replied || interaction.deferred)
                {
                    await interaction.editReply(content);
                }
                else
                {
                    await interaction.update(content);
                }
            }
        }
        catch (e) {}
    }

    /**
     * Defer automatically if it's not already deferred
     * @param interaction {SelectMenuInteraction | ButtonInteraction}
     * @returns {Promise<void>}
     */
    static async Defer(interaction)
    {
        try
        {
            if (!interaction.deferred)
            {
                await interaction.deferUpdate();
            }
        }
        catch (e) {}
    }

    static MentionRole(roleID)
    {
        return `<@&${roleID}>`;
    }

    /**
     * Get the user object from discord.
     * @param userID The ID of the user you want to get
     * @returns {Promise<User>}
     */
    static async GetUser(userID)
    {
        return await ManhwaNotifier.Instance.DiscordClient.users.fetch(userID);
    }

    /**
     * Check if the user is an administrator of the guild
     * @param userID {string} The ID of the user
     * @param guildID {string} The ID of the guild
     * @return {boolean} True if the user is an administrator, false otherwise
     */
    static IsAdministrator(userID, guildID)
    {
        return SecurityUtility.IsCreator(userID) || ManhwaNotifier.Instance.DiscordClient.guilds.cache.get(guildID).members.cache.get(userID).permissions.has(PermissionFlagsBits.Administrator);
    }

    static GetGuild(guildID)
    {
        return ManhwaNotifier.Instance.DiscordClient.guilds.cache.get(guildID);
    }

    static GetChannel(channelID)
    {
        return ManhwaNotifier.Instance.DiscordClient.channels.cache.get(channelID);
    }
}