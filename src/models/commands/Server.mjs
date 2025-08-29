import {Command} from "../Command.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType} from "discord.js";
import {TransferInterface} from "../menus/TransferInterface.mjs";
import {PermissionFlagsBits} from "discord-api-types/v10";
import {EmojiUtility} from "../../utility/EmojiUtility.mjs";

export class Server extends Command
{
    constructor()
    {
        super(
            "server",
            [
                {
                    name: "role",
                    description: "Role to assign to a manhwa",
                    autocomplete: true
                },
                {
                    name: "manhwa",
                    description: "Manhwa to assign a role",
                    autocomplete: true
                }
            ],
            "Open a menu to manage in which channel you want notifications about your manhwas (Default in private message), if you want to mention a role or assign a role to a manhwa (and other options).\n" +
            "You can also directly assign a role to a manhwa using the options");

        this.SetNeedAnAccount();
        this.SetOnlyInServer();
    }

    async OnAutocomplete(interaction, focusedOption)
    {
        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(interaction.user.id, interaction.guild.id)) return;

        if (focusedOption.name === "role")
        {
            const roles = [];

            interaction.guild.roles.cache.forEach(role =>
            {
                if (roles.length < 25)
                {
                    if (role.name.toString().toLowerCase().startsWith(focusedOption.value.toLowerCase()))
                    {
                        roles.push({name: role.name, value: `${role.id}`});
                    }
                }
            });

            await interaction.respond(roles);
        }
        else if (focusedOption.name === "manhwa")
        {
            const manhwas = [];
            const allManhwas = ManhwaNotifier.Instance.DataCenter.GetServerManhwas(interaction.guild.id);
            let i = 0;

            for (let manhwa of allManhwas)
            {
                if (manhwa.Name.toLowerCase().startsWith(focusedOption.value.toLowerCase()))
                {
                    manhwas.push({name: manhwa.Name, value: `${i}`});
                }

                if (manhwas.length === 25)
                {
                    break;
                }

                i++;
            }

            await interaction.respond(manhwas);
        }
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (dataCenter.ExistsServer(interaction.guild.id) && !dataCenter.CanManagerServerManhwas(interaction.user.id, interaction.guild.id) ||
            !dataCenter.ExistsServer(interaction.guild.id) && !DiscordUtility.IsAdministrator(interaction.user.id, interaction.guild.id))
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage("You are not allowed to manage the server"), true);
            return;
        }

        if (dataCenter.ExistsServer(interaction.guild.id)) dataCenter.AddServerAdmin(interaction.guild.id, interaction.user.id);

        if (interaction.options.get("role") && interaction.options.get("manhwa"))
        {
            const manhwaIndex = parseInt(interaction.options.get("manhwa").value);
            const role = interaction.guild.roles.cache.find(role => role.id === parseInt(interaction.options.get("role").value));
            const manhwa = ManhwaNotifier.Instance.DataCenter.GetServerManhwas(interaction.guild.id)[manhwaIndex];

            if (role && manhwa)
            {
                ManhwaNotifier.Instance.DataCenter.SetServerManhwaRole(interaction.guild.id, manhwaIndex, role.id);
                await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage("Role assigned successfully !"));
            }
            else
            {
                await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage("Role or manhwa not found !"));
            }
        }
        else
        {
            try
            {
                await new ServerInterface(interaction).Start();
            }
            catch (e)
            {
                console.error(e);
            }
        }
    }
}

class ServerInterface extends CommandInterface
{
    /** @type {boolean} */
    _needToConfirmDelete = false

    constructor(interaction)
    {
        super(interaction);
    }

    async OnButton(interaction)
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (dataCenter.ExistsServer(interaction.guild.id) && !dataCenter.CanManagerServerManhwas(interaction.user.id, interaction.guild.id) ||
            !dataCenter.ExistsServer(interaction.guild.id) && !DiscordUtility.IsAdministrator(interaction.user.id, interaction.guild.id)) return;

        const serverId = this.Interaction.guild.id;

        if (interaction.customId === "change-channel")
        {
            this.IgnoreInteractions = true;
            await new ChannelManager(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "change-roles")
        {
            this.IgnoreInteractions = true;
            await new RoleManager(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "change-admins")
        {
            this.IgnoreInteractions = true;
            await new AdminManager(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "start")
        {
            dataCenter.AddServer(serverId);
            dataCenter.GetServer(serverId).Admins.push(this.Interaction.user.id);
        }

        if (interaction.customId === "delete-guild")
        {
            if (this._needToConfirmDelete)
            {
                dataCenter.RemoveServer(serverId);
                this._needToConfirmDelete = false;
            }
            else
            {
                this._needToConfirmDelete = true;
            }
        }

        if (interaction.customId === "cancel-delete-guild")
        {
            this._needToConfirmDelete = false;
        }

        if (interaction.customId === "import")
        {
            this.IgnoreInteractions = true;
            await new TransferInterface(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                },
                dataCenter.GetUserManhwas(interaction.user.id),
                dataCenter.GetServerManhwas(interaction.guild.id),
                "your manhwas",
                `${this.Interaction.guild.name} manhwas`
            ).Start();
        }

        if (interaction.customId === "export")
        {
            this.IgnoreInteractions = true;
            await new TransferInterface(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                },
                dataCenter.GetServerManhwas(interaction.guild.id),
                dataCenter.GetUserManhwas(interaction.user.id),
                `${this.Interaction.guild.name} manhwas`,
                "your manhwas"
            ).Start();
        }

        if (interaction.customId === "test")
        {
            const server = dataCenter.GetServer(serverId);
            const channel = dataCenter._getServerChannel(serverId);

            if (!channel) return;

            const roleToMention = [];

            if (server.DefaultRole.IsDefined())
            {
                roleToMention.push(server.DefaultRole.Format());
            }

            try
            {
                await channel.send({
                    embeds: [EmbedUtility.GetNeutralEmbedMessage("Test alert", "Used to test that alerts are sent in the correct channel.\nDefault role is mentioned if defined.")],
                    content: roleToMention.join(" ")
                });
            }
            catch (e)
            {
                if (`${e}`.startsWith("DiscordAPIError"))
                {
                    const guild = DiscordUtility.GetGuild(serverId);
                    const embed = EmbedUtility.GetWarningEmbedMessage(
                        `Discord API Error from server 🔰 ${guild !== undefined ? guild.name : `Unknown (${serverId})`} 🔰`,
                        "The bot doesn't have the permission to send messages in the channel or doesn't see it\n" +
                        `\`${e}\``
                    );

                    for (let admin of server.Admins)
                    {
                        const user = await DiscordUtility.GetUser(admin);

                        if (user)
                        {
                            try
                            {
                                await user.send({embeds: [embed]});
                            }
                            catch (e)
                            {
                                if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                                {
                                    await this.DeleteUser(admin);
                                    server.Admins.splice(server.Admins.indexOf(admin), 1);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    ConstructEmbed()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const serverId = this.Interaction.guild.id;
        const embed = EmbedUtility.GetNeutralEmbedMessage("Server Manager - Overview");

        if (dataCenter.ExistsServer(serverId) && !dataCenter.CanManagerServerManhwas(this.Interaction.user.id, serverId) ||
            !dataCenter.ExistsServer(serverId) && !DiscordUtility.IsAdministrator(this.Interaction.user.id, serverId))
        {
            embed.setDescription("⚠️ You are not allowed to manage the server profile");
            return embed;
        }

        if (!dataCenter.ExistsServer(serverId))
        {
            embed.setDescription("You need to initialize the server profile first");
        }
        else if (this._needToConfirmDelete)
        {
            embed.setDescription("⚠️ Are you sure you want to delete the server profile ? ⚠️");
        }
        else
        {
            const server = dataCenter.GetServer(serverId);

            server.AddAllInfoToEmbed(embed);

            if (!server.Channel.IsDefined())
            {
                embed.addFields([
                    {
                        name: "⚠️ Warning",
                        value: "You need to set a channel to receive notifications"
                    }
                ]);
            }

            if (dataCenter.GetServerManhwasCount(this.Interaction.guild.id) === 0)
            {
                embed.addFields([
                    {
                        name: "⚠️ Warning",
                        value: "You need to add manhwas to the server to be able to assign roles\nBe wary that personal and server profiles are independent, use import if you want to copy your manhwas from your personal profile into the server profile"
                    }
                ]);
            }
        }

        if (!this.Interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
        {
            embed.addFields([
                {
                    name: "⚠️ Error",
                    value: "I cannot create roles because you don't allow me to manage roles."
                }
            ]);
        }

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const serverId = this.Interaction.guild.id;
        const server = dataCenter.GetServer(serverId);

        if (dataCenter.ExistsServer(serverId) && !dataCenter.CanManagerServerManhwas(this.Interaction.user.id, serverId) ||
            !dataCenter.ExistsServer(serverId) && !DiscordUtility.IsAdministrator(this.Interaction.user.id, serverId))
        {
            return components;
        }

        if (!server)
        {
            components.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`Start`)
                        .setEmoji({name: "🚀"})
                        .setStyle(ButtonStyle.Success)
                        .setCustomId(`start`)
                )
            )

            return components;
        }
        else if (this._needToConfirmDelete)
        {
            components.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(`Yes`)
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId(`delete-guild`),
                    new ButtonBuilder()
                        .setLabel(`No`)
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`cancel-delete-guild`)
                )
            )

            return components;
        }

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Admin Manager")
                    .setEmoji({name: "📝"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("change-admins")
                    .setDisabled(!DiscordUtility.IsAdministrator(this.Interaction.user.id, serverId)),
                new ButtonBuilder()
                    .setLabel("Channel Manager")
                    .setEmoji({name: "📝"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("change-channel"),
                new ButtonBuilder()
                    .setLabel("Role Manager")
                    .setEmoji({name: "📝"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("change-roles")
                    .setDisabled(dataCenter.GetServerManhwasCount(this.Interaction.guild.id) === 0),
                new ButtonBuilder()
                    .setLabel("Import")
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Import))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("import")
                    .setDisabled(dataCenter.GetUserManhwasCount(this.Interaction.user.id) === 0),
                new ButtonBuilder()
                    .setLabel("Export")
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Export))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("export")
                    .setDisabled(dataCenter.GetServerManhwasCount(this.Interaction.guild.id) === 0)
            )
        );

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("DELETE SERVER PROFILE")
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId("delete-guild")
                    .setDisabled(!DiscordUtility.IsAdministrator(this.Interaction.user.id, serverId)),
                new ButtonBuilder()
                    .setLabel("Test alert message")
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("test"),
            )
        );

        components.push(this.GetCloseButton())

        return components;
    }
}

class AdminManager extends CommandInterface
{
    /** @type {DataController} */
    _dataController
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        this._dataController = ManhwaNotifier.Instance.DataCenter;
        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetMenuList([
            {
                onMenuClick: values =>
                {
                    this._dataController.AddServerAdmin(this.Interaction.guild.id, values[0]);
                },
                placeholder: "Add admin..",
                menuType: CommandInterface.MenuType.User
            },
            {
                onMenuClick: values =>
                {
                    this._dataController.RemoveServerAdmin(this.Interaction.guild.id, values[0]);
                },
                getList: () => this._dataController.GetServerAdmins(this.Interaction.guild.id).map(item => {
                    return {
                        user: ManhwaNotifier.Instance.DiscordClient.users.cache.get(item),
                        id: item
                    };
                }),
                options: {
                    label: item => item.user ? item.user.displayName : "Unknown",
                    value: item => item.id
                },
                placeholder: "Remove admin.."
            }
        ]);
    }

    ConstructEmbed()
    {
        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id))
        {
            return EmbedUtility.GetBadEmbedMessage("Admin Manager", "You are not the admin of this server.");
        }

        const server = this._dataController.GetServer(this.Interaction.guild.id);
        const embed = EmbedUtility.GetNeutralEmbedMessage("Server Manager - Admin Manager");

        embed.setDescription(
            `You can add or remove admins to the server. People with admin rights can manage the server without the need to add them to admins.\n` +
            server.GetFormattedAdmins()
        )

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const server = this._dataController.GetServer(this.Interaction.guild.id);

        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id))
        {
            return components;
        }

        this.AddMenuComponents(components, 0);

        if (server.Admins.length > 0)
        {
            this.AddMenuComponents(components, 1);
        }

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Return")
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("return")
            )
        );

        return components;
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
        }
    }
}

class ChannelManager extends CommandInterface
{
    /** @type {DataController} */
    _dataController
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        this._dataController = ManhwaNotifier.Instance.DataCenter;
        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetMenuList([
            {
                onMenuClick: async values =>
                {
                    const channel = this.Interaction.guild.channels.cache.find(item => item.id === values[0]);

                    if (!this.Interaction.guild.members.me.permissionsIn(channel).has(PermissionFlagsBits.SendMessages))
                    {
                        await this.DisplayError(`⚠️ You need to allow first the bot to write messages in the ${channel} channel`);
                    }
                    else
                    {
                        ManhwaNotifier.Instance.DataCenter.SetServerChannel(this.Interaction.guild.id, values[0]);
                    }
                },
                placeholder: "Select channel..",
                menuType: CommandInterface.MenuType.Channel,
                channelTypes: [ChannelType.GuildText, ChannelType.GuildNews]
            },
        ]);
    }

    ConstructEmbed()
    {
        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id))
        {
            return EmbedUtility.GetBadEmbedMessage("Channel Manager", "You are not the admin of this server.");
        }

        const server = this._dataController.GetServer(this.Interaction.guild.id);
        const embed = EmbedUtility.GetNeutralEmbedMessage("Server Manager - Channel Manager");

        server.AddChannelToEmbed(embed);

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const server = this._dataController.GetServer(this.Interaction.guild.id);
        const currentChannel = server.Channel.Id;

        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id))
        {
            return components;
        }

        if (currentChannel)
        {
            components.push(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("Remove channel")
                        .setEmoji({name: "❌"})
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("remove-channel")
                )
            );
        }

        this.AddMenuComponents(components);

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Return")
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("return")
            )
        );

        return components;
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
        }

        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id)) return;

        if (interaction.customId === "remove-channel")
        {
            this._dataController.RemoveServerChannel(this.Interaction.guild.id);
        }
    }
}

class RoleManager extends CommandInterface
{
    /** @type {DataController} */
    _dataController
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn
    /** @type {number} */
    _manhwaIndex = -1

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        this._dataController = ManhwaNotifier.Instance.DataCenter;
        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetMenuList([
            {
                onMenuClick: values =>
                {
                    const value = values[0];
                    this._manhwaIndex = value === "default" ? -1 : value;
                },
                getList: () => [null, ...ManhwaNotifier.Instance.DataCenter.GetServerManhwas(interaction.guild.id)],
                options: {
                    label: (item) => item ? item.Name : "Default",
                    value: item => item ? ManhwaNotifier.Instance.DataCenter.GetServerManhwas(interaction.guild.id).indexOf(item) : "default"
                },
                placeholder: "Select a manhwa or the default.."
            },
            {
                onMenuClick: values =>
                {
                    const dataCenter = ManhwaNotifier.Instance.DataCenter;

                    if (this._manhwaIndex !== -1)
                    {
                        dataCenter.SetServerManhwaRole(this.Interaction.guild.id, this._manhwaIndex, values[0]);
                    }
                    else
                    {
                        dataCenter.SetServerDefaultRole(this.Interaction.guild.id, values[0]);
                    }
                },
                getList: () => this.Interaction.guild.roles.cache.map(item => item),
                options: {
                    label: item => item.name,
                    value: item => item.id
                },
                placeholder: "Select a role to associate.."
            }
        ]);
    }

    ConstructEmbed()
    {
        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id))
        {
            return EmbedUtility.GetBadEmbedMessage("Role Manager", "You are not the admin of this server.");
        }

        const server = this._dataController.GetServer(this.Interaction.guild.id);
        const embed = EmbedUtility.GetNeutralEmbedMessage("Server Manager - Role Manager");

        if (this._manhwaIndex === -1)
        {
            server.AddDefaultRoleToEmbed(embed);
        }
        else
        {
            server.AddManhwaRoleToEmbed(embed, this._manhwaIndex);
        }

        embed.addFields([
            {
                name: "\u200B",
                value: "\u200B"
            }
        ]);

        server.AddAutoRoleToEmbed(embed);
        server.AddMentionToEmbed(embed);

        // Add description for some fields
        embed.setDescription(server.GetFormattedRolesInfo());

        embed.addFields([
            {
                name: "\u200B",
                value: "\u200B"
            },
            {
                name: "Role creation",
                value: "The bot will create a role that starts with `MN`, when removed, it will only delete roles with `MN` at the start"
            },
            {
                name: "Remove all role vs Remove all MN role",
                value: "Remove all MN role will remove all roles that starts with `MN` while the other one will delete all roles from manhwas AND delete the MN role associated"
            }
        ])

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id))
        {
            return components;
        }

        const server = this._dataController.GetServer(this.Interaction.guild.id);
        const canCreateRoles = this.Interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles);
        const currentRole = this._manhwaIndex === -1 ? server.DefaultRole : server.Manhwas[this._manhwaIndex].Role;

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Remove role")
                    .setEmoji({name: "❌"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("remove-role")
                    .setDisabled(!currentRole.IsDefined()),
                new ButtonBuilder()
                    .setLabel("Create a role for it")
                    .setEmoji({name: "✏️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("create-role")
                    .setDisabled(!canCreateRoles || this._manhwaIndex === -1 || server.Manhwas[this._manhwaIndex].Role.IsDefined())
            )
        );

        this.AddMenuComponents(components);

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Remove all role")
                    .setEmoji({name: "❌"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("remove-all-role"),
                new ButtonBuilder()
                    .setLabel(`Remove all MN roles`)
                    .setEmoji({name: "❌"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("delete-all-mn-roles")
                    .setDisabled(!canCreateRoles),
                new ButtonBuilder()
                    .setLabel("Create a role for all")
                    .setEmoji({name: "✏️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("create-roles")
                    .setDisabled(!canCreateRoles)
            )
        );

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Return")
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("return"),
                new ButtonBuilder()
                    .setLabel(`Auto role creation`)
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("enable-auto-create")
                    .setEmoji({name: "🔄"})
                    .setDisabled(!canCreateRoles),
                new ButtonBuilder()
                    .setLabel(`Mention all`)
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("toggle-mention-all-role")
                    .setEmoji({name: "🔄"})
                    .setDisabled(!canCreateRoles)
            )
        );

        return components;
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
        }

        if (!ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(this.Interaction.user.id, this.Interaction.guild.id)) return;

        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const serverId = this.Interaction.guild.id;
        const manhwas = dataCenter.GetServerManhwas(serverId);

        if (interaction.customId === "remove-all-role")
        {
            await DiscordUtility.Defer(interaction);

            let error = false;

            for (let manhwa of manhwas)
            {
                if (!manhwa.Role.IsDefined()) continue;

                const role = this.Interaction.guild.roles.cache.find(item => item.id === manhwa.Role.Id);

                if (role && role.name.startsWith("MN "))
                {
                    try
                    {
                        await role.delete();
                    }
                    catch (e)
                    {
                        if (e.code === 50013)
                        {
                            error = true;
                        }
                    }
                }

                dataCenter.RemoveServerManhwaRole(serverId, manhwas.indexOf(manhwa));
            }

            dataCenter.RemoveServerDefaultRole(serverId);

            if (error)
            {
                await this.DisplayError("The bot doesn't have the permission to delete roles");
            }
        }

        if (interaction.customId === "remove-role")
        {
            const dataCenter = ManhwaNotifier.Instance.DataCenter;
            let roleID = dataCenter.GetServerDefaultRole(serverId);

            if (this._manhwaIndex !== -1)
            {
                roleID = dataCenter.GetServerManhwaRole(serverId, this._manhwaIndex);
                dataCenter.SetServerManhwaRole(serverId, this._manhwaIndex, "");
            }
            else
            {
                dataCenter.SetServerDefaultRole(serverId, "");
            }

            const role = this.Interaction.guild.roles.cache.find(item => item.id === roleID);

            if (role && role.name.startsWith("MN "))
            {
                try
                {
                    await role.delete();
                }
                catch (e)
                {
                    if (e.code === 50013)
                    {
                        await this.DisplayError("The bot doesn't have the permission to delete roles");
                    }
                }
            }
        }

        if (interaction.customId === "create-role")
        {
            const manhwa = manhwas[this._manhwaIndex];
            const roleName = manhwa.Name.length > 97 ? manhwa.Name.substring(0, 97) : manhwa.Name;
            try
            {
                const role = await this.Interaction.guild.roles.create({
                    name: `MN ${roleName}`,
                    data: {
                        color: "grey"
                    },
                    reason: "Role created by Manhwa Notifier"
                });

                dataCenter.SetServerManhwaRole(serverId, this._manhwaIndex, role.id);
            }
            catch (e)
            {
                if (e.code === 30005)
                {
                    await this.DisplayError("The bot cannot create more roles because the limit of 250 roles has been reached");
                }
            }
        }

        if (interaction.customId === "create-roles")
        {
            await DiscordUtility.Defer(interaction);

            for (let manhwa of manhwas)
            {
                if (manhwa.Role.IsDefined()) continue;

                try
                {
                    const roleName = manhwa.Name.length > 97 ? manhwa.Name.substring(0, 97) : manhwa.Name;
                    const role = await this.Interaction.guild.roles.create({
                        name: `MN ${roleName}`,
                        data: {
                            color: "grey"
                        },
                        reason: "Role created by Manhwa Notifier"
                    });

                    dataCenter.SetServerManhwaRole(serverId, manhwas.indexOf(manhwa), role.id);
                }
                catch (e)
                {
                    if (e.code === 30005)
                    {
                        await this.DisplayError("The bot cannot create more roles because the limit of 250 roles has been reached");
                        break;
                    }
                }
            }
        }

        if (interaction.customId === "delete-all-mn-roles")
        {
            await DiscordUtility.Defer(interaction);
            let error = false;
            for (let [id, value] of this.Interaction.guild.roles.cache)
            {
                if (value.name.startsWith("MN "))
                {
                    try
                    {
                        await value.delete();
                    }
                    catch (e)
                    {
                        if (e.code === 50013)
                        {
                            error = true;
                        }
                    }
                }
            }

            if (error)
            {
                await this.DisplayError("The bot doesn't have the permission to delete roles");
            }
        }

        if (interaction.customId === "enable-auto-create")
        {
            ManhwaNotifier.Instance.DataCenter.ToggleServerAutoRoleCreation(serverId);
        }

        if (interaction.customId === "toggle-mention-all-role")
        {
            ManhwaNotifier.Instance.DataCenter.ToggleServerMentionAllRoles(serverId);
        }
    }
}