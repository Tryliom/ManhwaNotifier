import {CommandInterface} from "./CommandInterface.mjs";
import {MatchType} from "../MatchType.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";
import {EmojiUtility} from "../../utility/EmojiUtility.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {Manhwa} from "../datas/Manhwa.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";

const MergeType = {
    NotCompatible: 0,
    NeedAttention: 1,
    Ready: 2,
    Excluded: 3
}

class CompareManhwa
{
    /** @type {number} */
    _toIndex
    /** @type {number} */
    _mergeType

    constructor(toIndex, mergeType)
    {
        this._toIndex = toIndex;
        this._mergeType = mergeType;
    }

    Exclude()
    {
        this._mergeType = MergeType.NotCompatible;
    }

    Include()
    {
        this._mergeType = MergeType.Ready;
    }

    NeedAttention()
    {
        return this._mergeType === MergeType.NeedAttention;
    }

    IsReady()
    {
        return this._mergeType === MergeType.Ready;
    }
}

/**
 * A class used to import/export manhwas from one list to another, can have an unread list to transfer too
 */
export class TransferInterface extends CommandInterface
{
    /** @type {Manhwa[]} */
    _from = []
    /** @type {Manhwa[]} */
    _to = []

    /** @type {string} */
    _fromWhere = ""
    /** @type {string} */
    _toWhere = ""

    /**
     * @Brief List of match
     * @type {CompareManhwa[]} */
    _compareManhwas = []
    /** @type {number[]} */
    _numberPerMatch = []

    /** @type {number} */
    _page = 0

    // Optional
    /** @type {string} */
    _userID = ""
    /** @type {UnreadChapter[]} */
    _unreadToTransfer = []

    /** @type {function (lastInteraction: CommandInteraction)} */
    _onReturn

    /**
     * If the transfer has been done
     * @type {boolean} */
    _haveTransfer = false

    /**
     * Create a new TransferInterface
     * @param {Interaction | CommandInteraction} interaction
     * @param {CommandInteraction | ModalSubmitInteraction} lastInteraction
     * @param {function (lastInteraction: CommandInteraction)} onReturn
     * @param {Manhwa[]} from
     * @param {Manhwa[]} to
     * @param {string} fromWhere The name of the list where the manhwas are from
     * @param {string} toWhere The name of the list where the manhwas are going
     * @param {string} userID
     * @param {UnreadChapter[]} unreadToTransfer
     */
    constructor(interaction, lastInteraction, onReturn, from, to, fromWhere, toWhere, userID = "", unreadToTransfer = [])
    {
        super(interaction);

        this.SetLastInteraction(lastInteraction);
        this._onReturn = onReturn;

        this._from = from;
        this._to = to;
        this._fromWhere = fromWhere;
        this._toWhere = toWhere;
        this._userID = userID;
        this._unreadToTransfer = unreadToTransfer;

        this.UpdateTransferList();
        this.RecalculateNumberPerMatch();
        this.UpdatePageToMatch();

        this.SetMenuList(
            [
                {
                    onMenuClick: values => this._page = values[0],
                    getList: () => this._compareManhwas.map((manhwa, index) => {
                        return {
                            name: this._from[index].Name,
                            value: index,
                            shouldShow: manhwa.NeedAttention()
                        }
                    }),
                    options:
                    {
                        label: item => item.name,
                        value: item => item.value,
                        condition: item => item.shouldShow
                    },
                    placeholder: "Select a manhwa.."
                }
            ]
        );
    }

    ConstructEmbed()
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage(`Transfer Manhwa from ${this._fromWhere} to ${this._toWhere}`);

        if (this._numberPerMatch[1] === 0 && this._numberPerMatch[2] === 0 && this._numberPerMatch[3] === 0)
        {
            embed.addFields({
                name: "Status",
                value: "No manhwa to transfer",
            });

            return embed;
        }

        if (this._haveTransfer)
        {
            embed.addFields({
                name: "Status",
                value: "Transfer has been done",
            });

            return embed;
        }

        embed.addFields([
            {
                name: `= ${this._numberPerMatch[0]} same`,
                value: "Manhwas that are the same as the one in the list",
            },
            {
                name: `❌ ${this._numberPerMatch[3]} excluded`,
                value: "Manhwas that are excluded",
            },
            {
                name: `🔴 ${this._numberPerMatch[1]} need attention`,
                value: "Manhwas that need to take action before transferring",
            },
            {
                name: `🟢 ${this._numberPerMatch[2]} ready`,
                value: "Manhwas that are ready to be transferred",
            }
        ])

        embed.addFields([
            {
                name: "ℹ️ Transfer",
                value: "Will transfer all manhwas that are ready to be transferred",
                inline: true
            },
            {
                name: "ℹ️ Replace All",
                value: "Will include all manhwas that need to take action before transferring",
                inline: true
            },
            {
                name: "ℹ️ Ignore All",
                value: "Will exclude all manhwas that need to take action before transferring",
                inline: true
            }
        ])

        if (this._numberPerMatch[1] > 0)
        {
            const fromManhwa = this._from[this._page];
            const toManhwa = this._to[this._compareManhwas[this._page]._toIndex];

            embed.addFields(
                {
                    name: fromManhwa.Name,
                    value: `From \`${Utils.getWebsiteNameFromUrl(fromManhwa.Url) + " at " + Utils.formatChapterFromURL(fromManhwa.Chapter)}\` To \`${Utils.getWebsiteNameFromUrl(toManhwa.Url) + " at " + Utils.formatChapterFromURL(toManhwa.Chapter)}\``,
                }
            );

            if (fromManhwa.IsImageValid()) embed.setImage(fromManhwa.Image);
            else if (toManhwa.IsImageValid()) embed.setImage(toManhwa.Image);
        }
        else
        {
            embed.addFields({
                name: "Status",
                value: "Ready to transfer",
            });
        }

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        if (this._haveTransfer || this._numberPerMatch[1] === 0 && this._numberPerMatch[2] === 0 && this._numberPerMatch[3] === 0)
        {
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

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Transfer")
                    .setStyle(ButtonStyle.Success)
                    .setCustomId("transfer")
                    .setDisabled(this._numberPerMatch[1] !== 0),
                new ButtonBuilder()
                    .setLabel("Transfer Unread")
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("transfer-unread")
                    .setDisabled(this._userID === "" || this._unreadToTransfer.length === 0),
            )
        );

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Replace All")
                    .setEmoji({name: "✅"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("include-all")
                    .setDisabled(this._numberPerMatch[1] === 0 && this._numberPerMatch[3] === 0),
                new ButtonBuilder()
                    .setLabel("Ignore All")
                    .setEmoji({name: "🚫"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("exclude-all")
                    .setDisabled(this._numberPerMatch[1] === 0),
            )
        );

        if (this._numberPerMatch[1] > 1)
        {
            this.AddMenuComponents(components);
        }

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Replace")
                    .setEmoji({name: "✅"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("include")
                    .setDisabled(this._numberPerMatch[1] === 0),
                new ButtonBuilder()
                    .setLabel("Ignore")
                    .setEmoji({name: "🚫"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("exclude")
                    .setDisabled(this._numberPerMatch[1] === 0),
            )
        );

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
        switch (interaction.customId)
        {
            case "transfer":
                await this.Transfer();
                break;
            case "transfer-unread":
                await this.TransferUnread();
                break;
            case "include-all":
                this.IncludeAll();
                break;
            case "exclude-all":
                this.ExcludeAll();
                break;
            case "include":
                this.Include();
                break;
            case "exclude":
                this.Exclude();
                break;
            case "return":
                this.IgnoreInteractions = true;
                await this.StopCollector(false, false);
                await this._onReturn(this.LastInteraction);
                break;
        }

        this.RecalculateNumberPerMatch();
        this.UpdatePageToMatch();
    }

    async Transfer()
    {
        for (let i = 0; i < this._compareManhwas.length; i++)
        {
            if (!this._compareManhwas[i].IsReady()) continue;

            const fromManhwa = this._from[i];

            if (this._compareManhwas[i]._toIndex === -1)
            {
                this._to.push(new Manhwa().FromJson(fromManhwa));
                this._to[this._to.length - 1].Role.Reset();
                continue;
            }

            const toManhwa = this._to[this._compareManhwas[i]._toIndex];

            if (fromManhwa.IsImageValid())
            {
                toManhwa.Image = fromManhwa.Image;
            }

            toManhwa.Url = fromManhwa.Url;
            toManhwa.Chapter = fromManhwa.Chapter;
        }

        this._haveTransfer = true;
    }

    async TransferUnread()
    {
        for (let i = 0; i < this._unreadToTransfer.length; i++)
        {
            ManhwaNotifier.Instance.DataCenter.InsertUserUnreadChapter(this._userID, [this._unreadToTransfer[i]]);
        }

        this._unreadToTransfer = [];
        await this.DisplayConfirmationMessage("Unread chapters have been transferred");
    }

    IncludeAll()
    {
        for (let i = 0; i < this._compareManhwas.length; i++)
        {
            if (this._compareManhwas[i].NeedAttention())
            {
                this._compareManhwas[i].Include();
            }
        }
    }

    ExcludeAll()
    {
        for (let i = 0; i < this._compareManhwas.length; i++)
        {
            if (this._compareManhwas[i].NeedAttention())
            {
                this._compareManhwas[i].Exclude();
            }
        }
    }

    Include()
    {
        this._compareManhwas[this._page].Include();
    }

    Exclude()
    {
        this._compareManhwas[this._page].Exclude();
    }

    UpdateTransferList()
    {
        this._compareManhwas = [];

        for (let i = 0; i < this._from.length; i++)
        {
            let matchType = MatchType.Not;

            for (let j = 0; j < this._to.length; j++)
            {
                matchType = this._from[i].GetMatchType(this._to[j]);

                if (matchType === MatchType.Full || matchType === MatchType.Partial)
                {
                    this._compareManhwas.push(new CompareManhwa(j, matchType));
                    break;
                }
            }

            if (matchType === MatchType.Not)
            {
                this._compareManhwas.push(new CompareManhwa(-1, MergeType.Ready));
            }
        }

        this._page = 0;
    }

    RecalculateNumberPerMatch()
    {
        for (let i = 0; i < Object.keys(MergeType).length; i++)
        {
            this._numberPerMatch[i] = 0;
        }

        for (let i = 0; i < this._compareManhwas.length; i++)
        {
            this._numberPerMatch[this._compareManhwas[i]._mergeType]++;
        }
    }

    UpdatePageToMatch()
    {
        for (let i = 0; i < this._compareManhwas.length; i++)
        {
            if (this._compareManhwas[i].NeedAttention())
            {
                this._page = i;
                break;
            }
        }
    }
}