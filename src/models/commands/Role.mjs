import {Command} from "../Command.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";

export class Role extends Command
{
    constructor()
    {
        super(
            "role",
            [
                {
                    name: "assign",
                    description: "Assign a role to yourself",
                    autocomplete: true,
                    required: false
                },
                {
                    name: "remove",
                    description: "Remove a role from yourself",
                    autocomplete: true,
                    required: false
                }
            ],
            "Assign a role to yourself to be mentioned for a manhwa notification",
            "Assign or remove a role to yourself to be mentioned for a manhwa notification"
        );

        this.SetOnlyInServer();
    }

    async OnAutocomplete(interaction, focusedOption)
    {
        const server = ManhwaNotifier.Instance.DataCenter.GetServer(interaction.guild.id);

        if (!server || server.Manhwas.length === 0)
        {
            await interaction.respond([{name: "There are no roles available in this server", value: "none"}]);
            return;
        }

        const value = focusedOption.value.toString().toLowerCase();
        const result = [];
        const guildRoles = [interaction.guild.roles.cache.find(role => role.id === server.DefaultRole.Id)];
        /** @type {string[]} */
        const userRoles = interaction.member.roles.cache.map(role => role.id);

        for (let manhwa of server.Manhwas)
        {
            if (manhwa.Role.IsDefined())
            {
                const role = interaction.guild.roles.cache.find(role => role.id === manhwa.Role.Id);

                if (role) guildRoles.push(role);
            }
        }

        for (let role of guildRoles)
        {
            if (role === undefined) continue;

            if (focusedOption.name === "assign" && userRoles.includes(role.id)) continue;
            if (focusedOption.name === "remove" && !userRoles.includes(role.id)) continue;

            if (role.name.toLowerCase().includes(value))
            {
                result.push({name: role.name, value: role.id});

                if (result.length === 25) break;
            }
        }

        await interaction.respond(result);
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const assign = interaction.options.get("assign");
        const remove = interaction.options.get("remove");


        if (!assign && !remove)
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage("Error", `You must specify an option: assign or remove`), true);
            return;
        }

        const value = assign ? assign.value : remove.value;
        let role = interaction.guild.roles.cache.find(role => role.id === value);

        if (!role)
        {
            role = interaction.guild.roles.cache.find(role => role.name.toLowerCase().includes(value.toLowerCase()));
        }

        if (!role)
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage("Error", `Role was not found\nYou need to select the option from autocomplete or use a role id`), true);
            return;
        }

        if (assign)
        {
            await interaction.member.roles.add(role);
            await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage(`The role ${role.name} has been attributed`), true);
        }
        else if (remove)
        {
            await interaction.member.roles.remove(role);
            await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage(`The role ${role.name} has been removed from you`), true);
        }
    }
}