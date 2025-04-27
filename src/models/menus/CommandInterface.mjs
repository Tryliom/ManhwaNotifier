import APIMessageComponentEmoji, {
    ButtonStyle,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    SelectMenuInteraction,
    StringSelectMenuBuilder,
    ButtonInteraction,
    InteractionCollector,
    ModalSubmitInteraction,
    CommandInteraction,
    Events,
    SelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    UserSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder, ChannelType
} from "discord.js";
import {StringUtility} from "../../utility/StringUtility.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {v4} from "uuid";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";

export class Option
{
    /** @type {Function<string>} */
    label
    /** @type {Function<string>} */
    value
    /** @type {Function<string>} */
    emoji
    /** @type {Function<string>} */
    description
    /** @type {Function<boolean>} */
    condition
    /** @type {Function<boolean>} */
    default
}

export class Menu
{
    /** @type {Function<number[]>} */
    onMenuClick
    /** @type {Function<any[]>} */
    getList
    /** @type {Option} */
    options
    /** @type {string} */
    placeholder
    /** @type {number} */
    minValues = 1
    /** @type {number} */
    maxValues = 1
    /** @type {number} */
    menuType = CommandInterface.MenuType.String

    // Channel type
    /**
     * @brief If empty, all channel types are accepted
     * @type {number[]} */
    channelTypes = []
}

const CollectorTime = 180 * 60 * 1000;

/**
 * Extend this class to create a command interface<br>
 * You can override the following functions:
 * <ul>
 *     <li>ConstructEmbed()</li>
 *     <li>ConstructComponents()</li>
 *     <li>OnButton(interaction)</li>
 *     <li>OnMenu(interaction)</li>
 *     <li>OnModal(interaction)</li>
 *     <li>OnMenuInteraction(interaction): Call it at the end of the function</li>
 *     <li>OnMenuPageChange(index): Call it at the end of the function</li>
 *     <li>OnChangePage()</li>
 *     <li>OnAction(): Call when an action is done by the user</li>
 * </ul>
 */
export class CommandInterface
{
    /**
     * @brief The original interaction that started the command
     * @type {CommandInteraction} */
    Interaction
    /**
     * @brief The last interaction that was made by the user
     * @type {CommandInteraction | null} */
    LastInteraction
    /** @type {Menu[]} */
    MenuList= []
    /** @type {boolean} */
    Ephemeral

    /** @type {string} */
    Error
    /** @type {string} */
    ConfirmationMessage
    /** @type {boolean} */
    IgnoreInteractions
    /** @type {boolean} */
    _modalSubmit
    /** @type {Function} */
    _collector
    /** @type {string} */
    _id
    /** @type {boolean} */
    _closed
    /** @type {string} */
    _messageId = undefined
    /** @type {any[]} */
    _threads = []
    /** @type {string} */
    _filter = ""

    /** @type {Object<string, number>} */
    _menus = {}

    static MenuType =
    {
        String: 0,
        User: 1,
        Role: 2,
        Channel: 3,
        Mentionable: 4,
    };

    /**
     * Command interface constructor
     * @constructor
     * @param interaction {CommandInteraction}
     */
    constructor(interaction)
    {
        this.Interaction = interaction;

        this.Error = "";
        this.ConfirmationMessage = "";
        this.IgnoreInteractions = false;

        this._id = v4();
    }

    SetLastInteraction(interaction)
    {
        this.LastInteraction = interaction;
    }

    /** @param menuList {Menu[]} */
    SetMenuList(menuList)
    {
        this.MenuList = menuList;

        for (let item of this.MenuList)
        {
            if (item.menuType === undefined) item.menuType = CommandInterface.MenuType.String;

            this._menus[`menu${this.MenuList.indexOf(item)}`] = 0;
        }
    }

    SetEphemeral(ephemeral)
    {
        this.Ephemeral = ephemeral;
    }

    async Start()
    {
        const filter = (interaction) =>
        {
            const isUser = interaction.user.id === this.Interaction.user.id || interaction.user.id === process.env.creatorId;
            const isCorrectMessage = interaction.message.id === this._messageId;

            return isUser && isCorrectMessage;
        };
        this._collector = async (interaction) =>
        {
            if (!filter(interaction)) return;

            this.LastInteraction = interaction;

            if (this.IgnoreInteractions) return;

            if (interaction.isButton()) await this.OnButtonClick(interaction);
            else if (interaction.isAnySelectMenu()) await this.OnMenuClick(interaction);

            await DiscordUtility.Defer(interaction);

            if (this._modalSubmit)
            {
                const submit = await this.LastInteraction.awaitModalSubmit({time: CollectorTime / 4, filter: filter});

                if (submit)
                {
                    this._modalSubmit = false;

                    await this.OnModalSubmit(submit);
                }

                await this.UpdateMsg();
                await DiscordUtility.Defer(submit);
            }
        };

        await this.UpdateMsg();

        const interaction = this.LastInteraction || this.Interaction;

        this._messageId = (await interaction.fetchReply()).id;

        ManhwaNotifier.Instance.SubscribeToEvent(this._id, this._collector);

        this._threads.push(setTimeout(() => this.StopCollector(), CollectorTime));
        this._threads.push(setInterval(async () =>
        {
            const interaction = this.LastInteraction || this.Interaction;
            try
            {
                await interaction.fetchReply();
            }
            catch (error)
            {
                await this.StopCollector(false, true);
            }
        }, 1000 * 60));
    }

    /**
     * Update a message by calling constructEmbed() and constructComponents() or the content
     * @param content {{embeds, content, components} | EmbedBuilder | null}
     * @returns {Promise<void>}
     */
    async UpdateMsg(content = null)
    {
        const interaction = this.LastInteraction || this.Interaction;

        if (this.IgnoreInteractions) return;

        await this.OnAction();

        if (this.Error !== "")
        {
            content = EmbedUtility.GetBadEmbedMessage("An error occurred")
                .setDescription(`${this.Error}\n\nYou will return to the menu after 5sec`);
        }
        else if (this.ConfirmationMessage !== "")
        {
            content = EmbedUtility.GetGoodEmbedMessage("Confirmation")
                .setDescription(`${this.ConfirmationMessage}\n\nYou will return to the menu after 5sec`);
        }

        if (!this._closed) await DiscordUtility.Reply(interaction, this.GetContent(content), this.Ephemeral);
    }

    async ShowModal(modal)
    {
        const interaction = this.LastInteraction || this.Interaction;

        this._modalSubmit = true;

        await interaction.showModal(modal);
    }

    /**
     * Format any content to send
     * @param content {{embeds, content, components} | EmbedBuilder | null}
     * @returns {{embeds, content, components}}
     */
    GetContent(content = null)
    {
        return EmbedUtility.FormatMessageContent(content || {embeds: this.ConstructEmbed(), components: this.ConstructComponents()});
    }

    /**
     * Called when a button is clicked
     * @param interaction {ButtonInteraction}
     * @returns {Promise<void>}
     */
    async OnButtonClick(interaction)
    {
        await this.OnButton(interaction);

        if (interaction.customId === "close")
        {
            await this.StopCollector(true);
        }
        else
        {
            await this.UpdateMsg();
        }
    }

    async OnButton(interaction) {}

    /**
     * Event when a menu is clicked
     * @param interaction {SelectMenuInteraction}
     * @returns {Promise<void>}
     */
    async OnMenuClick(interaction)
    {
        if (interaction.customId === "menu-filter")
        {
            this._filter = interaction.values[0];
            this.OnFilterChange();
        }

        await this.OnMenu(interaction);
        await this.OnMenuInteraction(interaction);
        await this.UpdateMsg();
    }

    /**
     * Use this function if you need to do something when filter change
     */
    OnFilterChange() {}

    async OnMenu(interaction) {}

    /**
     * Event when a modal is submitted
     * @param interaction {ModalSubmitInteraction}
     * @returns {Promise<void>}
     * @constructor
     */
    async OnModalSubmit(interaction)
    {
        await this.OnModal(interaction);
        await this.UpdateMsg();
    }

    /**
     * Event when a modal is submitted
     * @param interaction {ModalSubmitInteraction}
     * @returns {Promise<void>}
     * @constructor
     */
    async OnModal(interaction) {}

    async OnAction() {}

    async StopCollector(closeMessage = true, doNotUpdate = false)
    {
        if (closeMessage)
        {
            await this.UpdateMsg(EmbedUtility.GetClosedEmbedMessage());
            setTimeout(() => (this.LastInteraction || this.Interaction).deleteReply(), 5000);
        }
        else if (!doNotUpdate)
        {
            await this.UpdateMsg(this.ConstructEmbed());
        }

        ManhwaNotifier.Instance.UnsubscribeFromEvent(this._id);
        this._closed = true;

        for (let thread of this._threads)
        {
            clearTimeout(thread);
            clearInterval(thread);
        }
    }

    /**
     * Use this function if you need to do something when menu page change (not call if it's less and more)
     * @param index
     * @returns
     */
    OnMenuPageChange(index) {}

    /**
     * Set the menu page from the list
     * @param index start at 0
     * @param value integer
     */
    SetMenuPage(index, value)
    {
        this._menus[`menu${index}`] = value;
    }

    UpdateMenuPageWithPage(index, page)
    {
        let guessPage = 0;
        let minElements = 0;

        if (page < 24)
        {
            this.SetMenuPage(index, 0);
        }
        else
        {
            minElements = 24;

            while (page >= minElements) {
                guessPage++;
                minElements += 22;
            }

            this.SetMenuPage(index, guessPage);
        }
    }

    ConstructEmbed() 
    {
        return EmbedUtility.GetNeutralEmbedMessage("Default embed");
    }

    ConstructComponents() 
    {
        return [];
    }

    GetCloseButton() 
    {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Close")
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("close")
        )
    }

    GetFilter(filters)
    {
        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("menu-filter")
                    .setPlaceholder(`Filter: ${this._filter}`)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(...this.GetOptions(0, Object.keys(filters), {
                        label: (item) => filters[item],
                        value: (item) => filters[item]
                    }))
            )
    }

    GetChangePageButtons()
    {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setEmoji({name: "⏪"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("changepage-back+"),
                new ButtonBuilder()
                    .setEmoji({name: "◀️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("changepage-back"),
                new ButtonBuilder()
                    .setEmoji({name: "▶️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("changepage-next"),
                new ButtonBuilder()
                    .setEmoji({name: "⏩"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("changepage-next+")
            );
    }

    /**
     *
     * @param page If this doesn't have more than 1 page, put 0
     * @param list {*[]}
     * @param option {{label: Function, value: Function, emoji: Function | undefined, description: Function | undefined, condition: Function | undefined, default: Function | undefined}}
     * @returns {*[]}
     */
    GetOptions(page, list, option = {label: (item) => item, value: (item) => item})
    {
        const optionList = [];

        if (page > 0) optionList.push({label: "Less...", emoji: {name: "⬅"}, value: "less"});

        let minElements = 0;

        if (page > 0)   minElements = 24;
        if (page !== 1) minElements += (page - 1) * 22;

        for (let item of list)
        {
            if (minElements > list.indexOf(item)) continue;

            if (optionList.length === 24)
            {
                optionList.push({label: "More...", emoji: {name: "➡"}, value: "more"})
                break;
            }
            else if (!option.condition || option.condition(item))
            {
                const builder =
                {
                    label: StringUtility.CutText(option.label(item), 25),
                    value: `${option.value(item)}`
                };

                if (option.emoji)
                {
                    const emoji = option.emoji(item);
                    if (emoji) builder.emoji = emoji;
                }

                if (option.description)
                {
                    builder.description = StringUtility.CutText(option.description(item), 50);
                }

                if (option.default) builder.default = option.default(item);

                optionList.push(builder);
            }
        }

        return optionList;
    }

    async OnMenuInteraction(interaction)
    {
        for (let item of this.MenuList)
        {
            const index = this.MenuList.indexOf(item);

            if (interaction.customId === `menu${index}`)
            {
                if (interaction.values[0] === "less")
                {
                    this._menus[`menu${index}`]--;
                }
                else if (interaction.values[0] === "more")
                {
                    this._menus[`menu${index}`]++;
                }
                else
                {
                    await item.onMenuClick(interaction.values);
                    this.OnMenuPageChange(index);
                }
            }
        }
    }

    AddMenuComponents(components, index = null)
    {
        for (let item of this.MenuList)
        {
            const i = this.MenuList.indexOf(item);

            if (index !== null && index !== i) continue;

            const minValues = item.minValues === undefined ? 1 : item.minValues;
            const maxValues = item.maxValues === undefined ? 1 : item.maxValues;
            const data =
            {
                custom_id: `menu${i}`,
                placeholder: item.placeholder,
                min_values: minValues,
                max_values: maxValues,
            };
            let builder;

            if (item.menuType === CommandInterface.MenuType.String)
            {
                data.options = this.GetOptions(this._menus[`menu${i}`], item.getList(), item.options);
            }

            switch (item.menuType)
            {
                case CommandInterface.MenuType.String: builder = new StringSelectMenuBuilder(data); break;
                case CommandInterface.MenuType.User: builder = new UserSelectMenuBuilder(data); break;
                case CommandInterface.MenuType.Role: builder = new RoleSelectMenuBuilder(data); break;
                case CommandInterface.MenuType.Channel:
                    builder = new ChannelSelectMenuBuilder(data);

                    if (item.channelTypes.length > 0)
                    {
                        builder.addChannelTypes(item.channelTypes);
                    }

                    break;
                case CommandInterface.MenuType.Mentionable: builder = new MentionableSelectMenuBuilder(data); break;
            }

            components.push(new ActionRowBuilder().addComponents(builder));
        }
    }

    OnButtonChangePage(interaction, maxPage, menuIndexAssociated = null)
    {
        switch (interaction.customId)
        {
            case "changepage-next": this.page++; break;
            case "changepage-back": this.page--; break;
            case "changepage-next+": this.page += 25; break;
            case "changepage-back+": this.page -= 25; break;
        }

        if (this.page > maxPage - 1)  this.page = maxPage - 1;
        else if (this.page < 0)     this.page = 0;

        if (interaction.customId.startsWith("changepage"))
        {
            this.OnChangePage();
            if (menuIndexAssociated) this.UpdateMenuPageWithPage(menuIndexAssociated, this.page);
        }
    }

    OnChangePage() {}

    /**
     * Display an error during 5sec, the component is completely change during this period
     * @param errorContent {string}
     * @returns {Promise<void>}
     */
    async DisplayError(errorContent)
    {
        await DiscordUtility.Defer(this.LastInteraction);

        this.Error = errorContent;

        await this.UpdateMsg();

        setTimeout(() =>
        {
            this.Error = "";
            this.UpdateMsg();
        }, 5000);
    }

    /**
     * Display a confirmation message during 5sec, the component is completely change during this period
     * @param message {string}
     * @returns {Promise<void>}
     */
    async DisplayConfirmationMessage(message)
    {
        await DiscordUtility.Defer(this.LastInteraction);

        this.ConfirmationMessage = message;

        await this.UpdateMsg();

        setTimeout(() =>
        {
            this.ConfirmationMessage = "";
            this.UpdateMsg();
        }, 5000);
    }
}