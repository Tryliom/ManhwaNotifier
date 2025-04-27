import {EmbedBuilder} from "discord.js";

export class EmbedUtility
{
    /**
     * Get a basic embed message, used to create custom embed basic messages.
     * @param color Color at the left of the embed message
     * @param title Title of the embed message
     * @param description Description if specified of the embed message
     * @returns {EmbedBuilder} A embed message
     */
    static GetGenericEmbedMessage(color, title, description = "")
    {
        const embedMessage = new EmbedBuilder()
            .setColor(color)
            .setTitle(title);

        if (description !== "") embedMessage.setDescription(description);

        return embedMessage;
    }

    /**
     * Get an embed message with a blue color.
     * @param title Title of the embed message
     * @param description Description if specified of the embed message
     * @returns {EmbedBuilder} A embed message
     */
    static GetNeutralEmbedMessage(title, description = "")
    {
        return EmbedUtility.GetGenericEmbedMessage("#0099ff", title, description);
    }

    /**
     * Get an embed message with a green color.
     * @param title Title of the embed message
     * @param description Description if specified of the embed message
     * @returns {EmbedBuilder} A embed message
     * */
    static GetGoodEmbedMessage(title, description = "")
    {
        return EmbedUtility.GetGenericEmbedMessage("#11aa11", title, description);
    }

    /**
     * Get an embed message with a red color.
     * @param title Title of the embed message
     * @param description Description if specified of the embed message
     * @returns {EmbedBuilder} A embed message
     */
    static GetBadEmbedMessage(title, description = "")
    {
        return EmbedUtility.GetGenericEmbedMessage("#aa1111", title, description);
    }

    /**
     * Get an embed message with a color for a warning.
     * @param title Title of the embed message
     * @param description Description if specified of the embed message
     * @returns {EmbedBuilder} A embed message
     */
    static GetWarningEmbedMessage(title, description = "")
    {
        return EmbedUtility.GetGenericEmbedMessage("#ff9900", title, description);
    }

    static GetClosedEmbedMessage()
    {
        return EmbedUtility.GetGenericEmbedMessage("#6b858e", "Closed", "This menu has been closed");
    }

    /**
     * Format content to match content of a message
     * @param content {{embeds, content, components}, EmbedBuilder}
     * @param ephemeral {boolean} Whether the message should be ephemeral or not (default: false)
     * @returns {{embeds, content, components, ephemeral}}
     */
    static FormatMessageContent(content, ephemeral = false)
    {
        if (content instanceof EmbedBuilder)
        {
            content = {embeds: [content]};
        }
        else if (content.embeds)
        {
            content.embeds = content.embeds instanceof Array ? content.embeds : [content.embeds];
        }

        if (!content.components) content.components = [];
        if (ephemeral) content.ephemeral = true;

        return content;
    }
}