import {Changelog} from "./Changelog.mjs";
import {Faq} from "./Faq.mjs";
import {ChannelId} from "./ChannelId.mjs";

export class BotInfo
{
    /** @type {Changelog[]} */
    Changelogs = []
    /** @type {Faq[]} */
    Faqs = []

    // Channels
    /** @type {ChannelId} */
    GlobalLogChannel = new ChannelId()
    /** @type {ChannelId} */
    UserLogChannel = new ChannelId()
    /** @type {ChannelId} */
    ChangelogChannel = new ChannelId()

    // Stats
    /** @type {{String, int}} */
    CommandsUsed = {};

    constructor()
    {
        this.Changelogs = [];
        this.Faqs = [];
        this.GlobalLogChannel = new ChannelId();
        this.UserLogChannel = new ChannelId();
        this.ChangelogChannel = new ChannelId();
        this.CommandsUsed = {};
    }

    FromJson(data)
    {
        this.Changelogs = [];
        this.Faqs = [];

        if (!data) return this;

        for (const changelog of data.Changelogs)
        {
            this.Changelogs.push(new Changelog().FromJson(changelog));
        }

        for (const faq of data.Faqs)
        {
            this.Faqs.push(new Faq().FromJson(faq));
        }

        this.GlobalLogChannel = new ChannelId().FromJson(data.GlobalLogChannel);
        this.UserLogChannel = new ChannelId().FromJson(data.UserLogChannel);
        this.ChangelogChannel = new ChannelId().FromJson(data.ChangelogChannel);

        if (data.CommandsUsed)
        {
            this.CommandsUsed = data.CommandsUsed;
        }

        return this;
    }

    AddCommandsToEmbed(embed)
    {
        let commands = [];

        for (const command in this.CommandsUsed)
        {
            commands.push(`${command}: ${this.CommandsUsed[command]}`);
        }

        embed.addFields({ name: 'Commands Used', value: commands.join('\n') || 'No commands used yet' });
    }
}