import {GuildEmoji} from "discord.js";

import {ManhwaNotifier} from "../controller/ManhwaNotifier.mjs";

/** @return {GuildEmoji} */
function RetrieveEmojiData(emojiName)
{
    const guild = ManhwaNotifier.Instance.DiscordClient.guilds.resolve(process.env.mainServerId);

    return guild.emojis.cache.find(emoji => emoji.name === emojiName);
}

export class EmojiUtility
{
    static Emojis =
    {
        Return: "Return", // Aka left arrow
        Add: "Add",
        Import: "Import",
        List: "List",
        Up: "Up",
        Down: "Down",
        Right: "Right",
        Export: "Export"
    };

    static GetEmoji(emojiName)
    {
        const emoji = RetrieveEmojiData(emojiName);
        const prefix = emoji.animated ? "a" : "";

        return `<${prefix}:${emoji.name}:${emoji.id}>`;
    }

    static GetEmojiData(emojiName)
    {
        const emoji = RetrieveEmojiData(emojiName);

        return {name: emojiName, id: emoji.id, animated: emoji.animated};
    }
}