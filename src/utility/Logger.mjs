import {ManhwaNotifier} from "../controller/ManhwaNotifier.mjs";
import {EmbedUtility} from "./EmbedUtility.mjs";

export class Logger
{
    /**
     * Log a message to the console with a timestamp
     * @param message {string[] || string} The message to log
     */
    static Log(...message)
    {
        console.log(`[${new Date().toLocaleTimeString()}]`, ...message);
    }

    /**
     * Log a message into users log channel that a new user use the bot
     * @param user {User}
     * @param interaction {Interaction}
     */
    static async LogNewUser(user, interaction)
    {
        const client = ManhwaNotifier.Instance.DiscordClient;
        const userChannel = ManhwaNotifier.Instance.DataCenter.GetUserLogChannel();

        if (!userChannel.IsDefined()) return;

        const channel = client.channels.cache.find(channel => channel.id === userChannel.Id);
        const source = interaction.guild ? `Server [${interaction.guild.name}] (${interaction.guild.id})` : "Direct Message";
        const embed = EmbedUtility.GetGoodEmbedMessage("New user", `User named ${user.username} (${user.id}) from ${source} has been created`);

        if (!channel) return;

        await channel.send({embeds: [embed]});
    }

    /**
     * Log a message into users log channel that a user was deleted from the bot
     * @param user {User}
     */
    static async LogDeletedUser(user)
    {
        const client = ManhwaNotifier.Instance.DiscordClient;
        const userChannel = ManhwaNotifier.Instance.DataCenter.GetUserLogChannel();

        if (!userChannel.IsDefined()) return;

        const channel = client.channels.cache.find(channel => channel.id === userChannel.Id);
        const embed = EmbedUtility.GetBadEmbedMessage(`User deleted`, `${user.username}#${user.discriminator} (${user.id})`);

        if (!channel) return;

        await channel.send({embeds: [embed]});
    }

    /**
     * Log a message into log channel
     * @param embed {EmbedBuilder} The embed to log
     * @return {Promise<void>}
     */
    static async LogEmbed(embed)
    {
        const client = ManhwaNotifier.Instance.DiscordClient;
        const globalLogChannel = ManhwaNotifier.Instance.DataCenter.GetGlobalLogChannel();

        if (!globalLogChannel.IsDefined()) return;

        const channel = client.channels.cache.find(channel => channel.id === globalLogChannel.Id);

        if (!channel) return;

        await channel.send({embeds: [embed]});
    }
}