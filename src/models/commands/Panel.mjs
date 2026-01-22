import {Command} from "../Command.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {exec} from "child_process";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {TextInputStyle} from "discord-api-types/v8";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder} from "discord.js";
import {EmojiUtility} from "../../utility/EmojiUtility.mjs";
import {Faq} from "./Faq.mjs";

export class Panel extends Command
{
    constructor()
    {
        super("panel", [], "Panel admin");

        this.SetOnlyCreator();
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        await new PanelInterface(interaction).Start();
    }
}

class PanelInterface extends CommandInterface
{
    /** @type {DataController} */
    _dataController = ManhwaNotifier.Instance.DataCenter

    constructor(interaction)
    {
        super(interaction);

        this.SetEphemeral(true);
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "faq-manager")
        {
            this.IgnoreInteractions = true;
            await new FaqManager(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "channel-manager")
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

        if (interaction.customId === "servers")
        {
            this.IgnoreInteractions = true;
            await new ServerManager(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "restart")
        {
            await this.UpdateMsg(EmbedUtility.GetGoodEmbedMessage("Success", "Bot is restarting.."));
            await ManhwaNotifier.Instance.Restart("Manually restarted by " + interaction.user.username);
        }

        if (interaction.customId === "add-changelog")
        {
            const modal = new ModalBuilder()
                .setCustomId("add-changelog")
                .setTitle("Add changelog");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`version`)
                        .setLabel("Version")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(32)
                        .setRequired(true)
                        .setPlaceholder("Like 4.0.0, the title shown in the embed")
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`content`)
                        .setLabel("Content")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(1)
                        .setMaxLength(4000)
                        .setRequired(true)
                        .setPlaceholder("The changelog content, can use markdown")
                )
            );

            await this.ShowModal(modal);
        }

        if (interaction.customId === "broadcast")
        {
            const modal = new ModalBuilder()
                .setCustomId("broadcast")
                .setTitle("Broadcast");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`title`)
                        .setLabel("Title")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(32)
                        .setRequired(true)),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`content`)
                        .setLabel("Content")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(1)
                        .setMaxLength(4000)
                        .setRequired(true)
                        .setPlaceholder("Can use markdown")
                )
            );

            await this.ShowModal(modal);
        }

        if (interaction.customId === "add-poll")
        {
            const modal = new ModalBuilder()
                .setCustomId("poll")
                .setTitle("New poll");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`question`)
                        .setLabel("Question to ask")
                        .setStyle(TextInputStyle.Paragraph)
                        .setMinLength(1)
                        .setMaxLength(1000)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`answers`)
                        .setLabel("Yes/No/Other")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(100)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }

        if (interaction.customId === "purge")
        {
            await this.DisplayConfirmationMessage("The purge has begin below");

            await this._dataController.StartPurge(this.Interaction.channel);
        }

        if (interaction.customId === "save")
        {
            await this.DisplayConfirmationMessage("Begin saving..");
            this._dataController.SaveAll();
        }

        if (interaction.customId === "update-restart")
        {
            exec("git pull", (error, stdout1, stderr) =>
            {
                if (error)
                {
                    this.DisplayError(error);
                    return;
                }

                exec("npm install", (error, stdout2, stderr) =>
                {
                    if (error)
                    {
                        this.DisplayError(error);
                        return;
                    }

                    this.DisplayConfirmationMessage("Update finished\n\n**Git pull result**\n" + stdout1 + "\n\n**npm install result**\n" + stdout2);
                    ManhwaNotifier.Instance.Restart("Manually restarted by " + interaction.user.username);
                });
            });
        }

        if (interaction.customId === "restore")
        {
            const modal = new ModalBuilder()
                .setCustomId("restore-userid")
                .setTitle("Restore user");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`userid`)
                        .setLabel("User ID")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(32)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }

        if (interaction.customId === "post-check-summary")
        {
            ManhwaNotifier.Instance.PostCheckSummary();
        }
    }

    async OnModal(interaction)
    {
        if (interaction.customId === "restore-userid")
        {
            const userID = interaction.fields.getTextInputValue('userid');

            this._dataController.RestorePurgedUser(userID);

            await this.DisplayConfirmationMessage(`User ${userID} restored`);
        }
        else if (interaction.customId === "add-changelog")
        {
            const version = interaction.fields.getTextInputValue('version');
            const content = interaction.fields.getTextInputValue('content');

            await this.DisplayConfirmationMessage(`Changelog sent`);
            this._dataController.SendChangelogToAll(version, content);
        }
        else if (interaction.customId === "broadcast")
        {
            const title = interaction.fields.getTextInputValue('title');
            const content = interaction.fields.getTextInputValue('content');

            await this.DisplayConfirmationMessage(`Broadcast sent`);
            this._dataController.SendBroadcastToAll(title, content);
        }
        else if (interaction.customId === "poll")
        {
            const question = interaction.fields.getTextInputValue('question');
            const answers = interaction.fields.getTextInputValue('answers');

            await this.DisplayConfirmationMessage(`Poll sent`);
            this._dataController.SendPollToAll(question, answers.split("/"), this.Interaction.guild !== null ? this.Interaction.channel : this.Interaction.user);
        }
    }

    ConstructEmbed()
    {
        const stats = ManhwaNotifier.Instance.DataCenter.GetBotStats();
        const embed = EmbedUtility.GetNeutralEmbedMessage("Admin panel");

        stats.AddToEmbed(embed);

        embed.addFields([
            {
                name: "Global log channel",
                value: this._dataController.GetGlobalLogChannel().Format()
            },
            {
                name: "User log channel",
                value: this._dataController.GetUserLogChannel().Format()
            },
            {
                name: "Changelog channel",
                value: this._dataController.GetChangelogChannel().Format()
            },
            {
                name: "Faq count",
                value: this._dataController.GetFaqs().length.toString()
            }
        ]);

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Restart")
                    .setEmoji({name: "🔄"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("restart"),
                new ButtonBuilder()
                    .setLabel("Update & Restart")
                    .setEmoji({name: "🔄"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("update-restart"),
                new ButtonBuilder()
                    .setLabel("Save")
                    .setEmoji({name: "💾"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("save"),
                new ButtonBuilder()
                    .setLabel("Post Check Summary")
                    .setEmoji({name: "📊"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("post-check-summary")
            )
        );

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Purge")
                    .setEmoji({name: "🗑️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("purge"),
                new ButtonBuilder()
                    .setLabel("Restore")
                    .setEmoji({name: "🔄"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("restore"),
                new ButtonBuilder()
                    .setLabel("Add Changelog")
                    .setEmoji({name: "📰"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("add-changelog"),
                new ButtonBuilder()
                    .setLabel("Broadcast")
                    .setEmoji({name: "📰"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("broadcast"),
                new ButtonBuilder()
                    .setLabel("Add poll")
                    .setEmoji({name: "📊"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("add-poll")
            )
        );

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Faq manager")
                    .setEmoji({name: "❓"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("faq-manager"),
                new ButtonBuilder()
                    .setLabel("Channel manager")
                    .setEmoji({name: "📺"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("channel-manager")
                    .setDisabled(this.Interaction.guild === null),
                new ButtonBuilder()
                    .setLabel("Servers")
                    .setEmoji({name: "🛠️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("servers"),
            )
        );

        return components;
    }
}

class FaqManager extends CommandInterface
{
    /** @type {DataController} */
    _dataController
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn
    /** @type {number} */
    page = 0

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        this._dataController = ManhwaNotifier.Instance.DataCenter;
        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetEphemeral(true);
        this.SetMenuList([
            // List of faqs
            {
                onMenuClick: values => this.page = parseInt(values[0]),
                getList: () => this._dataController.GetFaqs(),
                options: {
                    label: item => item.Question,
                    value: item => this._dataController.GetFaqs().indexOf(item),
                    default: item => this._dataController.GetFaqs().indexOf(item) === this.page
                },
                placeholder: "Select faq.."
            }
        ]);
    }

    ConstructEmbed()
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage("Faq manager");
        const faqs = this._dataController.GetFaqs();

        if (faqs.length === 0)
        {
            embed.setDescription("There are no faqs available.");
            return embed;
        }

        const faq = faqs[this.page];

        embed.setDescription(`**${faq.Question}**\n\n${faq.Answer}`);

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const faqs = this._dataController.GetFaqs();

        if (faqs.length > 1)
        {
            this.AddMenuComponents(components);
            components.push(this.GetChangePageButtons());
        }

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`return`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return)),
                new ButtonBuilder()
                    .setCustomId(`faq_edit`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji({name: "✏️"})
                    .setDisabled(faqs.length === 0),
                new ButtonBuilder()
                    .setCustomId(`faq_add`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Add)),
                new ButtonBuilder()
                    .setCustomId(`faq_delete`)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji({name: "🗑️"})
                    .setDisabled(faqs.length === 0)
            )
        );

        return components;
    }

    async OnButton(interaction)
    {
        const faqs = this._dataController.GetFaqs();

        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
        }
        else if (interaction.customId === "faq_edit")
        {
            // Open a modal to edit a faq
            const modal = new ModalBuilder()
                .setCustomId("faq_edit")
                .setTitle("Faq edition")

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('question')
                        .setLabel("Question")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("The question")
                        .setMinLength(1)
                        .setMaxLength(150)
                        .setValue(faqs[this.page].Question)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('answer')
                        .setLabel("Answer")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("The answer")
                        .setMinLength(1)
                        .setMaxLength(3999)
                        .setValue(faqs[this.page].Answer)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }
        else if (interaction.customId === "faq_delete")
        {
            this._dataController.DeleteFaq(this.page);
            this.page = 0;
        }
        else if (interaction.customId === "faq_add")
        {
            // Open a modal to add a faq
            const modal = new ModalBuilder()
                .setCustomId("faq_create")
                .setTitle("Faq creation")

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('question')
                        .setLabel("Question")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("The question")
                        .setMinLength(1)
                        .setMaxLength(150)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('answer')
                        .setLabel("Answer")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("The answer")
                        .setMinLength(1)
                        .setMaxLength(3999)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }
        else
        {
            this.OnButtonChangePage(interaction, faqs.length, 1);
        }
    }

    async OnModal(interaction)
    {
        if (interaction.customId === "faq_edit")
        {
            const faqs = this._dataController.GetFaqs();
            const faq = faqs[this.page];

            faq.Question = interaction.fields.getTextInputValue('question');
            faq.Answer = interaction.fields.getTextInputValue('answer');

            await this.UpdateMsg();
        }
        else if (interaction.customId === "faq_create")
        {
            const faq = new Faq();

            faq.Question = interaction.fields.getTextInputValue('question');
            faq.Answer = interaction.fields.getTextInputValue('answer');

            this._dataController.AddFaq(faq);
            this.page = this._dataController.GetFaqs().length - 1;

            await this.UpdateMsg();
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
        this.SetEphemeral(true);
        this.SetMenuList([
            {
                onMenuClick: values =>
                {
                    this._dataController.SetGlobalLogChannel(values[0]);
                },
                menuType: ChannelManager.MenuType.Channel,
                placeholder: "Global log channel..",
                channelTypes: [ChannelType.GuildNews, ChannelType.GuildText]
            },
            {
                onMenuClick: values =>
                {
                    this._dataController.SetUserLogChannel(values[0]);
                },
                menuType: ChannelManager.MenuType.Channel,
                placeholder: "User log channel..",
                channelTypes: [ChannelType.GuildNews, ChannelType.GuildText]
            },
            {
                onMenuClick: values =>
                {
                    this._dataController.SetChangelogChannel(values[0]);
                },
                menuType: ChannelManager.MenuType.Channel,
                placeholder: "Changelog channel..",
                channelTypes: [ChannelType.GuildNews, ChannelType.GuildText]
            }
        ]);
    }

    ConstructEmbed()
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage("Channel manager");

        embed.addFields([
            {
                name: "Global log channel",
                value: this._dataController.GetGlobalLogChannel().Format()
            },
            {
                name: "User log channel",
                value: this._dataController.GetUserLogChannel().Format()
            },
            {
                name: "Changelog channel",
                value: this._dataController.GetChangelogChannel().Format()
            }
        ]);

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        this.AddMenuComponents(components);

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`return`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
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

class ServerManager extends CommandInterface
{
    /** @type {DataController} */
    _dataController
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn
    /** @type {number} */
    page = 0;
    /** @type {boolean} */
    _loading = true;
    /** @type {number} */
    _loadingCounter = 0;
    /** @type {number} */
    _loadingMaxCounter = 0;
    /** @type {string} */
    _loadingStep = "";
    /** @type {Object<string, Server>} */
    _servers = {}
    /** @type {Guild[]} */
    _guilds = []

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        this._dataController = ManhwaNotifier.Instance.DataCenter;
        this._onReturn = onReturn;
        this._servers = this._dataController.GetServers();
        this._loadingStep = "Fetching guilds";

        this.SetLastInteraction(lastInteraction);
        this.SetEphemeral(true);
        this.SetMenuList([
            {
                onMenuClick: values => this.page = parseInt(values[0]),
                getList: () =>
                {
                    const list = [];

                    for (const server of this._guilds)
                    {
                        const index = this._guilds.indexOf(server);
                        const serverData = this._dataController.GetServer(server.id);
                        const option = {label: server, description: `${serverData.Manhwas.length} manhwas`, value: index};

                        if (index === this.page) option.default = true;

                        list.push(option);
                    }

                    return list;
                },
                options: {label: item => item.label, description: item => item.description, value: item => item.value, default: item => item.default || false},
                placeholder: "Select server.."
            }
        ]);

        this.Load();
    }

    async Load()
    {
        const updateLoading = setInterval(() =>
        {
            this.UpdateMsg();
        }, 5 * 1000);

        this._loadingCounter = 0;
        this._loadingMaxCounter = Object.keys(this._servers).length;
        this._loadingStep = "Fetching guilds";

        // Fetch non cached guilds
        for (const serverId in this._servers)
        {
            let server = ManhwaNotifier.Instance.DiscordClient.guilds.cache.get(serverId);

            if (!server)
            {
                try
                {
                    await ManhwaNotifier.Instance.DiscordClient.guilds.fetch(serverId);
                }
                catch (error) {}
            }

            this._loadingCounter++;
        }

        this._loadingCounter = 0;
        this._loadingMaxCounter = Object.keys(this._servers).length;
        this._loadingStep = "Loading guilds";

        for (const serverId in this._servers)
        {
            let server = ManhwaNotifier.Instance.DiscordClient.guilds.cache.get(serverId);

            this._loadingCounter++;

            if (!server) continue;

            this._guilds.push(server);
        }

        await new Promise(r => setTimeout(r, 10000));

        this._loadingCounter = 0;
        this._loadingMaxCounter = this._guilds.length;
        this._loadingStep = "Preloading owners";

        for (let guild of this._guilds)
        {
            this._loadingCounter++;

            if (!guild.ownerId) continue;

            // Preload owners
            await ManhwaNotifier.Instance.DiscordClient.users.fetch(guild.ownerId);
        }

        this._loading = false;
        clearInterval(updateLoading);

        await this.UpdateMsg();
    }

    ConstructEmbed()
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage("Servers");

        if (this._loading)
        {
            embed.setDescription(`Loading servers - ${this._loadingStep} - (${this._loadingCounter}/${this._loadingMaxCounter})`);
            return embed;
        }

        if (this._guilds.length === 0)
        {
            embed.setDescription("There are no servers available.");
            return embed;
        }

        console.log("Displaying server " + this.page + " / " + this._guilds.length);

        /** @type {Guild} */
        const server = this._guilds[this.page];
        const owner = ManhwaNotifier.Instance.DiscordClient.users.cache.get(server.ownerId);
        const serverData = this._dataController.GetServer(server.id);

        console.log(`${server.name} owned by ${owner ? owner.username : "unknown"}`);

        embed.setDescription(`**${server.name}** (${server.id})`);
        embed.addFields([
            {name: "Members", value: `${server.memberCount} members`, inline: true},
            {name: "Owner", value: owner.username, inline: true},
            {name: "\u200B", value: "\u200B"},
            {name: "Infos", value: `${serverData.Manhwas.length} manhwas`},
        ]);

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        if (this._loading) return components;

        if (this._guilds.length > 1)
        {
            this.AddMenuComponents(components);
            components.push(this.GetChangePageButtons());
        }

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`return`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
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
        else
        {
            this.OnButtonChangePage(interaction, this._guilds.length, 0);
        }
    }
}