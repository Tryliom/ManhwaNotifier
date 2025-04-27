import { Manhwa } from "./Manhwa.mjs";
import { ChannelId } from "./ChannelId.mjs";
import { RoleId } from "./RoleId.mjs";
import { Code } from "./Code.mjs";

export class Server
{
    /** @type {ChannelId} */
    Channel = new ChannelId()
    /** @type {RoleId} */
    DefaultRole = new RoleId()
    /** @type {boolean} */
    MentionAllRoles = false
    /** @type {boolean} */
    AutoRoleCreation = false
    /** @type {Manhwa[]} */
    Manhwas = []
    /**
     * @brief The list of admins that have managed the server at least one time. Used to send changelogs.
     * @type {string[]} */
    Admins = []

    /** @type {Code[]} */
    Codes = []

    constructor()
    {
        this.Channel = new ChannelId();
        this.DefaultRole = new RoleId();
        this.MentionAllRoles = false;
        this.AutoRoleCreation = false;
        this.Manhwas = [];
        this.Admins = [];
        this.Codes = [];
    }

    FromJson(data)
    {
        this.Channel = new ChannelId().FromJson(data.Channel);
        this.DefaultRole = new RoleId().FromJson(data.DefaultRole);
        this.MentionAllRoles = data.MentionAllRoles;
        this.AutoRoleCreation = data.AutoRoleCreation;
        this.Manhwas = data.Manhwas.map(m => new Manhwa().FromJson(m));
        this.Admins = data.Admins;
        this.Codes = data.Codes?.map(c => new Code().FromJson(c));

        return this;
    }

    AddAllInfoToEmbed(embed)
    {
        this.AddChannelToEmbed(embed);
        this.AddDefaultRoleToEmbed(embed);
        this.AddAutoRoleToEmbed(embed);
        this.AddMentionToEmbed(embed);

        embed.setDescription(
            `${this.GetFormattedRolesInfo()}\n` +
            this.GetFormattedAdmins()
        );
    }

    GetFormattedRolesInfo()
    {
        let manhwaWithRole = 0;

        for (let i = 0; i < this.Manhwas.length; i++)
        {
            if (this.Manhwas[i].Role.IsDefined()) manhwaWithRole++;
        }

        return `🔰 ${manhwaWithRole} manhwas with a defined role\n` +
            `⚠️ ${this.Manhwas.length - manhwaWithRole} manhwas without a defined role`;
    }

    GetFormattedAdmins()
    {
        return `👥 ${this.Admins.length} admins registered (${this.Admins.map(admin => `<@${admin}>`).join(", ")})`;
    }

    AddChannelToEmbed(embed)
    {
        embed.addFields([
            {
                name: "Channel - " + this.Channel.Format(),
                value: "The channel where the notifications are sent"
            }
        ]);
    }

    AddAutoRoleToEmbed(embed)
    {
        embed.addFields([
            {
                name: "Auto role creation - " + (this.AutoRoleCreation ? "✅" : "❌"),
                value: "If the bot should create a role when a new manhwa is followed"
            }
        ]);
    }

    AddMentionToEmbed(embed)
    {
        embed.addFields([
            {
                name: "Mention all - " + (this.MentionAllRoles ? "✅" : "❌"),
                value: "If the bot should mention the default role (like @AllManhwas per example) and the manhwa role associated when a new chapter is released"
            }
        ]);
    }

    AddDefaultRoleToEmbed(embed)
    {
        embed.addFields([
            {
                name: "Default role to mention",
                value: this.DefaultRole.Format() + " - The default role to mention when a new chapter is released"
            }
        ]);
    }

    AddManhwaRoleToEmbed(embed, manhwaIndex)
    {
        const manhwa = this.Manhwas[manhwaIndex];

        embed.addFields([
            {
                name: `Role of **${manhwa.Name}**`,
                value: `${manhwa.Role.Format()} - The role to mention when a new chapter is released for this manhwa`
            }
        ]);
    }
}