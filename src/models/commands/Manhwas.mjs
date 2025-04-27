import {Command} from "../Command.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {Filter} from "../Filter.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder} from "discord.js";
import {EmojiUtility} from "../../utility/EmojiUtility.mjs";
import {ScrapStatusType} from "../ScrapStatusType.mjs";
import {TextInputStyle} from "discord-api-types/v8";
import {Code} from "../datas/Code.mjs";
import {DataController} from "../../controller/DataController.mjs";
import {TransferInterface} from "../menus/TransferInterface.mjs";

export class Manhwas extends Command
{
    constructor()
    {
        super(
            "manhwas",
            [],
            "List and manage your manhwas, access to your import-export features",
            "Access to a simple list of your manhwas, or manage them with the interface (remove, edit), or create code to share your list with others",
        );

        this.SetNeedAnAccount();
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        await new ManhwasInterface(interaction).Start();
    }
}

class ManhwasInterface extends CommandInterface
{
    /** @type {boolean} */
    _affectServerManhwas = false

    constructor(interaction)
    {
        super(interaction);

        if (interaction.guild === null) return;

        const serverID = interaction.guild.id;
        const userID = interaction.user.id;
        this._affectServerManhwas = ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(userID, serverID);
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "list")
        {
            this.IgnoreInteractions = true;
            await new ListManhwasInterface(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "manage")
        {
            this.IgnoreInteractions = true;
            await new ManageListInterface(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }

        if (interaction.customId === "codes")
        {
            this.IgnoreInteractions = true;
            await new CodesInterface(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                }
            ).Start();
        }
    }

    ConstructEmbed()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const manhwasCount = this._affectServerManhwas ? dataCenter.GetServerManhwasCount(this.Interaction.guild.id) : dataCenter.GetUserManhwasCount(this.Interaction.user.id);

        const embed = EmbedUtility.GetNeutralEmbedMessage("Manhwas Manager");

        embed.setDescription(`You have ${manhwasCount} manhwas in your list`);

        embed.addFields([
            {
                name: `${EmojiUtility.GetEmoji(EmojiUtility.Emojis.List)} List`,
                value: "List all your manhwas in a simple list",
            },
            {
                name: "✏️ Manage",
                value: "Manage your manhwas (remove, edit)",
            },
            {
                name: "📝 Codes",
                value: "Create/import a code to share your list with others"
            }
        ])

        if (manhwasCount === 0)
        {
            embed.setFooter({text: "⚠️ List and Manage buttons are disabled because you have no manhwas"});
        }
        else if (this._affectServerManhwas)
        {
            embed.setFooter({text: "ℹ️ This is the manhwas list of the server"});
        }

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const manhwasCount = this._affectServerManhwas ? dataCenter.GetServerManhwasCount(this.Interaction.guild.id) : dataCenter.GetUserManhwasCount(this.Interaction.user.id);

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(`List`)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.List))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`list`)
                    .setDisabled(manhwasCount === 0),
                new ButtonBuilder()
                    .setLabel(`Manage`)
                    .setEmoji({name: "✏️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`manage`)
                    .setDisabled(manhwasCount === 0),
                new ButtonBuilder()
                    .setLabel(`Codes`)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Import))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`codes`)
            )
        );

        components.push(this.GetCloseButton());

        return components;
    }
}

class CodesInterface extends CommandInterface
{
    /** @type {boolean} */
    _affectServerManhwas = false
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn
    /** @type {number} */
    _selectedCode = -1
    /** @type {Code[]} */
    _codes = []

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        if (interaction.guild !== null)
        {
            const serverID = interaction.guild.id;
            const userID = interaction.user.id;

            this._affectServerManhwas = ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(userID, serverID);
            this._codes = this._affectServerManhwas ? ManhwaNotifier.Instance.DataCenter.GetServerCodes(serverID) : ManhwaNotifier.Instance.DataCenter.GetUserCodes(userID);
        }

        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetMenuList([
            {
                onMenuClick: values => this._selectedCode = parseInt(values[0]),
                getList: () => this._codes.map((c, i) =>
                {
                    return {label: c.Id, value: i};
                }),
                options: {
                    label: item => item.label,
                    value: item => item.value,
                    emoji: item => DataController.Emoji1to10[item.value],
                    default: item => item.value === this._selectedCode
                },
                placeholder: "Choose the code.."
            },
            {
                onMenuClick: values => this._affectServerManhwas ? ManhwaNotifier.Instance.DataCenter.EditServerCodeLimit(this.Interaction.guild.id, this._selectedCode, values[0]) :
                    ManhwaNotifier.Instance.DataCenter.EditUserCodeLimit(this.Interaction.user.id, this._selectedCode, values[0]),
                getList: () => Code.TimeLimits,
                options: {
                    label: item => item,
                    value: item => item
                },
                placeholder: "Edit time limit.."
            }
        ]);
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
        }

        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const codes = this._affectServerManhwas ? dataCenter.GetServerCodes(this.Interaction.guild.id) : dataCenter.GetUserCodes(this.Interaction.user.id);

        if (interaction.customId === "add" && codes.length < Code.MaxCodes)
        {
            if (this._affectServerManhwas)
            {
                await dataCenter.AddServerCode(this.Interaction.guild.id);
            }
            else
            {
                await dataCenter.AddUserCode(this.Interaction.user.id);
            }

            if (this._selectedCode === -1)
            {
                this._selectedCode = codes.length - 1;
            }
        }

        if (interaction.customId === "edit")
        {
            const modal = new ModalBuilder()
                .setCustomId("edit")
                .setTitle("Edit the code");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`code`)
                        .setLabel("The new code")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(Code.MaxLength)
                        .setValue(codes[this._selectedCode].Id)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }

        if (interaction.customId === "delete")
        {
            if (this._affectServerManhwas)
            {
                await dataCenter.DeleteServerCode(this.Interaction.guild.id, this._selectedCode);
            }
            else
            {
                await dataCenter.DeleteUserCode(this.Interaction.user.id, this._selectedCode);
            }

            this._selectedCode = this._affectServerManhwas ? dataCenter.GetServerCodes(this.Interaction.guild.id).length - 1 : dataCenter.GetUserCodes(this.Interaction.user.id).length - 1;
        }

        if (interaction.customId === "import")
        {
            const modal = new ModalBuilder()
                .setCustomId("import")
                .setTitle("Import from a code");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`code`)
                        .setLabel("The code")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(Code.MaxLength)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }
    }

    async OnModal(interaction)
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (interaction.customId === "edit")
        {
            const code = interaction.fields.getTextInputValue('code');

            if (!this.IsCodeValid(code))
            {
                await this.DisplayError(`The code must be between 1 and ${Code.MaxLength} characters and contain only letters and numbers`);
                return;
            }

            if (this._affectServerManhwas)
            {
                await dataCenter.EditServerCode(this.Interaction.guild.id, this._selectedCode, code);
            }
            else
            {
                await dataCenter.EditUserCode(this.Interaction.user.id, this._selectedCode, code);
            }
        }

        if (interaction.customId === "import")
        {
            const code = interaction.fields.getTextInputValue('code');

            if (!this.IsCodeValid(code))
            {
                await this.DisplayError(`The code must be between 1 and ${Code.MaxLength} characters and contain only letters and numbers`);
                return;
            }

            const realCode = dataCenter.GetCode(code, true);

            if (realCode === null)
            {
                await this.DisplayError("The code is invalid or expired");
                return;
            }

            const from = realCode.userId === "" ? dataCenter.GetServerManhwas(realCode.serverId) : dataCenter.GetUserManhwas(realCode.userId);

            if (from.length === 0)
            {
                await this.DisplayError("There is no manhwas to import from this code");
                return;
            }

            const to = this._affectServerManhwas ? dataCenter.GetServerManhwas(this.Interaction.guild.id) : dataCenter.GetUserManhwas(this.Interaction.user.id);
            let unreadList = [];

            if (realCode.userId !== "" && !this._affectServerManhwas)
            {
                unreadList = dataCenter.GetUserUnreadList(this.Interaction.user.id);
            }

            this.IgnoreInteractions = true;
            await new TransferInterface(this.Interaction, interaction, async (lastInteraction) =>
                {
                    this.IgnoreInteractions = false;
                    this.LastInteraction = lastInteraction;
                    await this.UpdateMsg();
                },
                from, to,
                "code [" + code + "]", "your manhwas",
                !this._affectServerManhwas ? this.Interaction.user.id : "", unreadList
            ).Start();
        }
    }

    ConstructEmbed()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const codes = this._affectServerManhwas ? dataCenter.GetServerCodes(this.Interaction.guild.id) : dataCenter.GetUserCodes(this.Interaction.user.id);
        const embed = EmbedUtility.GetNeutralEmbedMessage("Manhwas Manager - Codes");

        embed.setDescription(`Codes are used to share your manhwas list with others.\nMax ${Code.MaxLength} characters and use only letters and numbers.`);

        embed.addFields(
            {
                name: "ℹ️ Import",
                value: "Import manhwas using a code"
            }
        );

        if (codes.length === 0)
        {
            embed.data.description += "\n\nYou have no codes";
            return embed;
        }

        embed.addFields(
            {
                name: "\u200b",
                value: "\u200b"
            }
        );

        for (let code of codes)
        {
            const prefix = this._selectedCode === codes.indexOf(code) ? "▶ " : "";

            embed.addFields(
                {
                    name: `${prefix}Code: ${code.Id}`,
                    value: `Used ${code.UseTimes} times | ${code.FormatDate()}`
                }
            );
        }

        if (this._affectServerManhwas)
        {
            embed.setFooter({text: "ℹ️ This is the codes of the server"});
        }

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const codes = this._affectServerManhwas ? dataCenter.GetServerCodes(this.Interaction.guild.id) : dataCenter.GetUserCodes(this.Interaction.user.id);

        if (codes.length > 1)
        {
            this.AddMenuComponents(components, 0);
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Add))
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("add")
                .setDisabled(codes.length === Code.MaxCodes),
            new ButtonBuilder()
                .setEmoji({name: "✏️"})
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("edit")
                .setDisabled(codes.length === 0),
            new ButtonBuilder()
                .setEmoji({name: "🗑️"})
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("delete")
                .setDisabled(codes.length === 0)
        ));

        if (this._selectedCode !== -1)
        {
            this.AddMenuComponents(components, 1);
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Import")
                .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Import))
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("import")
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Return")
                .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("return")
        ));

        return components;
    }

    IsCodeValid(code)
    {
        return code.length > 0 && code.length <= Code.MaxLength && /^[a-zA-Z0-9]*$/.test(code);
    }
}

class ListManhwasInterface extends CommandInterface
{
    /** @type {boolean} */
    _affectServerManhwas = false
    /** @type {number} */
    page = 0
    /** @type {string} */
    _filter = Filter.Alphabetical
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        if (interaction.guild !== null)
        {
            const serverID = interaction.guild.id;
            const userID = interaction.user.id;
            this._affectServerManhwas = ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(userID, serverID);
        }

        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetMenuList(
            [
                {
                    onMenuClick: values => this.page = parseInt(values[0]),
                    getList: () =>
                    {
                        const dataCenter = ManhwaNotifier.Instance.DataCenter;
                        const manhwasCount = this._affectServerManhwas ? dataCenter.GetServerManhwasCount(this.Interaction.guild.id) : dataCenter.GetUserManhwasCount(this.Interaction.user.id);
                        const maxPage = Math.round(manhwasCount / 12);
                        const list = [];

                        for (let i = 0; i < maxPage; i++)
                        {
                            list.push({label: `Page ${i + 1}`, value: i});
                        }

                        return list;
                    },
                    options: {
                        label: item => item.label,
                        value: item => item.value,
                        default: item => item.value === this.page
                    },
                    placeholder: "Go to..."
                }
            ]
        )
    }

    async OnButton(interaction)
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const manhwasCount = this._affectServerManhwas ? dataCenter.GetServerManhwasCount(this.Interaction.guild.id) : dataCenter.GetUserManhwasCount(this.Interaction.user.id);
        const maxPage = Math.round(manhwasCount / 12);

        this.OnButtonChangePage(interaction, maxPage, 0);

        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
        }
    }

    ConstructEmbed()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const manhwas = this._affectServerManhwas ? dataCenter.GetServerManhwasFiltered(this.Interaction.guild.id, this._filter) :
            dataCenter.GetUserManhwasFiltered(this.Interaction.user.id, this._filter);
        const maxPage = Math.round(manhwas.length / 12);
        let description = "";

        for (let manhwa of manhwas)
        {
            const index = manhwas.indexOf(manhwa);

            if (this.page * 12 <= index && (this.page + 1) * 12 > index)
            {
                if (description !== "") description += "\n\n";

                description += `[${manhwa.Name}](${manhwa.Url}) from ${Utils.getWebsiteNameFromUrl(manhwa.Url)}\n${Utils.formatChapterFromURL(manhwa.Chapter)}`;
            }
        }

        if (manhwas.length === 0) description = "Your list is empty";

        return EmbedUtility.GetGoodEmbedMessage(`Manhwas Manager - List (${manhwas.length})`)
            .setDescription(description)
            .setFooter({text: `Page ${this.page + 1}/${maxPage === 0 ? 1 : maxPage}`});
    }

    ConstructComponents()
    {
        const components = [];
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const manhwasCount = this._affectServerManhwas ? dataCenter.GetServerManhwasCount(this.Interaction.guild.id)
            : dataCenter.GetUserManhwasCount(this.Interaction.user.id);
        const maxPage = Math.round(manhwasCount / 12);

        if (manhwasCount > 0)
        {
            components.push(this.GetFilter(Filter));

            if (maxPage > 1)
            {
                this.AddMenuComponents(components)
                components.push(this.GetChangePageButtons());
            }
        }

        const lastActionRow = this.GetCloseButton();

        lastActionRow.addComponents(
            new ButtonBuilder()
                .setLabel("Return")
                .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("return")
        );

        lastActionRow.components.reverse();

        components.push(lastActionRow);

        return components;
    }

    OnFilterChange()
    {
        this.SetMenuPage(0, 0);
    }
}

class ManageListInterface extends CommandInterface
{
    /** @type {boolean} */
    _affectServerManhwas
    /** @type {string} */
    _serverID
    /** @type {string} */
    _userID
    /** @type {number} */
    _manhwaIndex = 0;
    /** @type {Manhwa[]} */
    _manhwas = [];
    /** @type {string} */
    _filter = Filter.Alphabetical
    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn
    /** @type {ScrapInfo[]} */
    _transferList
    /** @type {boolean} */
    _collectScrapInfo = false

    constructor(interaction, lastInteraction, onReturn)
    {
        super(interaction);

        this._userID = interaction.user.id;

        if (interaction.guild !== null)
        {
            this._serverID = interaction.guild.id;
            this._affectServerManhwas = ManhwaNotifier.Instance.DataCenter.ExistsServer(this._serverID) && DiscordUtility.IsAdministrator(this._userID, this._serverID);
        }

        this._onReturn = onReturn;

        this.SetLastInteraction(lastInteraction);
        this.SetMenuList(
            [
                // Manhwa menu
                {
                    onMenuClick: values =>
                    {
                        this._manhwaIndex = parseInt(values[0]);
                    },
                    getList: () => this._manhwas.map((m, i) => {
                        return {
                            Name: m.Name,
                            Chapter: m.Chapter,
                            Url: m.Url,
                            Index: i
                        };
                    }),
                    options: {
                        label: (item) => item.Name,
                        description: (item) => `${Utils.formatChapterFromURL(item.Chapter)} | ${Utils.getWebsiteNameFromUrl(item.Url)}`,
                        value: (item) => item.Index,
                        default: (item) => item.Index === this._manhwaIndex
                    },
                    placeholder: "Choose the manhwa.."
                },
                // Chapter menu
                {
                    onMenuClick: values =>
                    {
                        const manhwa = this.GetCurrentManhwa();
                        const value = values[0];

                        manhwa.Chapter = this.chapterList[value];

                        if ((parseInt(value) + 1) < this.chapterList.length)
                        {
                            manhwa.PreviousChapter = this.chapterList[parseInt(value) + 1];
                        }

                        this.chapterList = [];
                        this.UpdateList();
                    },
                    getList: () => this.chapterList,
                    options: {
                        label: (item) => Utils.formatChapterFromURL(item),
                        value: (item) => this.chapterList.indexOf(item)
                    },
                    placeholder: "Select the chapter.."
                }
            ]
        );

        this._transferList = [];
        this.transferLoading = false;
        this.chapterLoading = false;
        this.chapterList = [];
        this.disableAll = false;
        this.UpdateList();
    }

    OnFilterChange()
    {
        this.UpdateList();
        this.SetMenuPage(0, 0);
    }

    UpdateList()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (this._affectServerManhwas)
        {
            this._manhwas = dataCenter.GetServerManhwasFiltered(this._serverID, this._filter);
        }
        else
        {
            this._manhwas = dataCenter.GetUserManhwasFiltered(this._userID, this._filter);
        }
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "return")
        {
            this.IgnoreInteractions = true;
            await this.StopCollector(false, false);
            await this._onReturn(this.LastInteraction);
            return;
        }

        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const isIndexStillValid = this._affectServerManhwas ? dataCenter.IsServerManhwaIndexValid(this._serverID, this._manhwaIndex) :
            dataCenter.IsUserManhwaIndexValid(this._userID, this._manhwaIndex);

        if (!isIndexStillValid)
        {
            this._manhwaIndex = 0;
            await this.DisplayError("Manhwa list has changed, please select the manhwa again");
            return;
        }

        if (interaction.customId === "unfollow")
        {
            if (this._affectServerManhwas)
            {
                await dataCenter.RemoveServerManhwa(this._serverID, this._manhwaIndex);
            }
            else
            {
                await dataCenter.RemoveUserManhwa(this._userID, this._manhwaIndex);
            }

            this._manhwaIndex = 0;
        }

        if (interaction.customId === "transfer")
        {
            const manhwa = this.GetCurrentManhwa();

            this.transferLoading = true;
            this.disableAll = true;

            await this.UpdateMsg();

            this.transferLoading = false;
            this.disableAll = false;
            this._transferList = await Utils.getAllWebsiteForTitle(manhwa.Name, Utils.getWebsiteNameFromUrl(manhwa.Url).toLowerCase());

            if (this._transferList.length === 0)
            {
                await this.DisplayError("The manhwa was not found on other supported websites");
            }
        }

        if (interaction.customId === "edit-chapter")
        {
            this.chapterLoading = true;
            this.disableAll = true;

            await this.UpdateMsg();

            this.chapterLoading = false;
            this.disableAll = false;
            const scrapInfo = await Utils.getAllInfo(this.GetCurrentManhwa().Url);

            if (scrapInfo.StatusType !== ScrapStatusType.Success)
            {
                await this.DisplayError(`Failed to get this manhwa page: ${scrapInfo.StatusType} - ${scrapInfo.CustomErrorMessage}`);
            }
            else
            {
                this.chapterList = scrapInfo.ChaptersUrls;
            }
        }

        if (interaction.customId === "edit-link")
        {
            const modal = new ModalBuilder()
                .setCustomId("edit-link")
                .setTitle("Edit the manhwa link");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId(`link`)
                        .setLabel("The raw link to the manhwa page")
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(1)
                        .setMaxLength(300)
                        .setRequired(true)
                )
            );

            await this.ShowModal(modal);
        }

        if (interaction.customId === "cancel")
        {
            this._transferList = [];
            this.chapterList = [];
        }

        this.UpdateList();
    }

    async OnModal(interaction)
    {
        if (interaction.customId === "edit-link")
        {
            const link = interaction.fields.getTextInputValue('link');

            if (!link.startsWith("http"))
            {
                await this.DisplayError("The link must start with http or https");
                return;
            }

            this._collectScrapInfo = true;
            await this.UpdateMsg();

            setTimeout(async () =>
                {
                    const scrapInfo = await Utils.getAllInfo(link);

                    if (scrapInfo.StatusType !== ScrapStatusType.Success)
                    {
                        await this.DisplayError(`Failed to get this manhwa page: ${scrapInfo.StatusType} - ${scrapInfo.CustomErrorMessage}`);
                        this._collectScrapInfo = false;
                        return;
                    }

                    if (Utils.formatChapterFromURL(scrapInfo.ChaptersUrls[0]) === "Chapter ?")
                    {
                        await this.DisplayError("The chapter is not recognized, please try another website or ask the bot owner to add this website using the support server in /help");
                        this._collectScrapInfo = false;
                        return;
                    }

                    if (scrapInfo.Name === "")
                    {
                        await this.DisplayError("The name of the manhwa is not recognized, please try another website or ask the bot owner to add this website using the support server in /help");
                        this._collectScrapInfo = false;
                        return;
                    }

                    this.ReplaceManhwa(scrapInfo);

                    this._collectScrapInfo = false;
                    await this.UpdateMsg();
                },
            2000);
        }
    }

    async OnMenu(interaction)
    {
        if (interaction.customId === "menu-transfer")
        {
            const dataCenter = ManhwaNotifier.Instance.DataCenter;
            const manhwa = this._transferList[interaction.values[0]];

            if (this._affectServerManhwas)
            {
                await dataCenter.ReplaceServerManhwa(this._serverID, manhwa);
            }
            else
            {
                await dataCenter.ReplaceUserManhwa(this._userID, manhwa);
            }

            this._transferList = [];
            this.UpdateList();
        }
    }

    ConstructEmbed()
    {
        const embed = EmbedUtility.GetGoodEmbedMessage("Manhwa Manager - Manage");
        const manhwasCount = this.GetManhwaCount();

        if (manhwasCount === 0)
        {
            embed.setDescription("Your list is empty");
            return embed;
        }

        const manhwa = this.GetCurrentManhwa();

        if (this.transferLoading)
        {
            embed.addFields(
                [
                    {
                        name: "ℹ️ Status",
                        value: `Wait while searching **${manhwa.Name}** in another supported websites, this can take a while...`
                    }
                ]
            );
        }
        else if (this.chapterLoading)
        {
            embed.addFields(
                [
                    {
                        name: "ℹ️ Status",
                        value: `Wait while retrieving chapters from **${manhwa.Name}**...`
                    }
                ]
            );
        }
        else
        {
            const manhwa = this.GetCurrentManhwa();

            embed.setTitle(manhwa.Name.length === 0 ? "Unknown" : manhwa.Name);
            embed.setDescription(
                `From [${Utils.getWebsiteNameFromUrl(manhwa.Url)}](${manhwa.Url}) on [${Utils.formatChapterFromURL(manhwa.Chapter)}](${manhwa.Chapter})\n\n` +
                manhwa.Description
            );

            if (manhwa.Image.startsWith("http")) embed.setImage(manhwa.Image);

            if (this._collectScrapInfo)
            {
                embed.addFields(
                    [
                        {
                            name: "ℹ️ Status",
                            value: `Wait while getting the manhwa page...`
                        }
                    ]
                );
            }
        }

        if (this._affectServerManhwas)
        {
            embed.setFooter({text: `ℹ️ This is the manhwas list of the server`});
        }

        return embed;
    }

    ConstructComponents()
    {
        const components = [];
        const manhwasCount = this.GetManhwaCount();
        const lastActionRow = this.GetCloseButton();

        lastActionRow.addComponents(
            new ButtonBuilder()
                .setLabel("Return")
                .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("return")
                .setDisabled(this._collectScrapInfo)
        );

        lastActionRow.components.reverse();

        if (manhwasCount === 0)
        {
            components.push(lastActionRow);

            return components;
        }

        if (this._transferList.length > 0 && !this.disableAll)
        {
            components.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("menu-transfer")
                        .setPlaceholder("Choose the website..")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(...this.GetOptions(0, this._transferList, {
                            label: item => Utils.getWebsiteNameFromUrl(item.FinalUrl),
                            description: item => `Up to ${Utils.formatChapterFromURL(item.ChaptersUrls[0]).toLowerCase()}`,
                            value: item => this._transferList.indexOf(item)
                        }))
                )
            )
        }
        else if (this.chapterList.length > 0 && !this.disableAll)
        {
            this.AddMenuComponents(components, 1);
        }
        else if (!this.disableAll && this._manhwas.length > 0)
        {
            this.AddMenuComponents(components, 0);
            components.push(this.GetFilter(Filter));
        }

        let actionRow = new ActionRowBuilder();
        const isDisabled = this._transferList.length > 0 || this.disableAll || this.chapterList.length > 0;

        if (this._transferList.length > 0 || this.chapterList.length > 0)
        {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("cancel")
            );
        }
        else
        {
            const disabled = this.GetCurrentManhwa() === null || isDisabled || this._collectScrapInfo;

            actionRow.addComponents(
                new ButtonBuilder()
                    .setLabel("Unfollow")
                    .setEmoji({name: "💔"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("unfollow")
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setLabel("Edit chapter")
                    .setEmoji({name: "✍️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("edit-chapter")
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setLabel("Edit link")
                    .setEmoji({name: "✍️"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("edit-link")
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setLabel("Transfer")
                    .setEmoji({name: "📡"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("transfer")
                    .setDisabled(disabled)
            );
        }


        components.push(actionRow);
        components.push(lastActionRow);

        return components;
    }

    /**
     * Return the current manhwa
     * @return {Manhwa} The current manhwa
     */
    GetCurrentManhwa()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (this._affectServerManhwas)
        {
            return dataCenter.GetServerManhwa(this._serverID, this._manhwaIndex);
        }

        return dataCenter.GetUserManhwa(this._userID, this._manhwaIndex);
    }

    /**
     * Return manhwa list count
     * @return {number} The manhwa list count
     */
    GetManhwaCount()
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (this._affectServerManhwas)
        {
            return dataCenter.GetServerManhwasCount(this._serverID);
        }

        return dataCenter.GetUserManhwasCount(this._userID);
    }

    /**
     * Replace the current manhwa with the new one
     * @param scrapInfos {ScrapInfo} The new manhwa
     */
    ReplaceManhwa(scrapInfos)
    {
        const dataCenter = ManhwaNotifier.Instance.DataCenter;

        if (this._affectServerManhwas)
        {
            dataCenter.ReplaceServerManhwa(this._serverID, scrapInfos);
        }
        else
        {
            dataCenter.ReplaceUserManhwa(this._userID, scrapInfos);
        }
    }
}