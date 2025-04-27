import {Command} from "../Command.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {StringUtility} from "../../utility/StringUtility.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {EmojiUtility} from "../../utility/EmojiUtility.mjs";
import {MatchType} from "../MatchType.mjs";
import {Manhwa} from "../datas/Manhwa.mjs";
import {DataController} from "../../controller/DataController.mjs";
import {ScrapStatusType} from "../ScrapStatusType.mjs";

export class Follow extends Command
{
    /** @type {LibraryManhwa[]}*/
    _libraryManhwas
    /** @type {{name: string, value: string}[]} */
    _libraryChoices

    constructor()
    {
        super(
            "follow",
            [
                {
                    name: "name",
                    description: "The name of the manhwa, the link to a manhwa page or from the library",
                    required: true,
                    autocomplete: true
                },
                {
                    name: "chapter",
                    description: "From which chapter you want to start",
                    required: false
                },
                {
                    name: "site",
                    description: "The preferred website where you want to follow the manhwa",
                    required: false,
                    getList: () => Utils.getFormattedSupportedWebsite().split(", ").map(item => {return {name: item, value: `${item}`}})
                }
            ],
            "Add a manhwa to your list from library or the web",
            "Add a manhwa to your personal list. You can give the name of the manhwa, the link to a manhwa page or from the library"
        );

        this.SetNeedAnAccount();
        this.UpdateLibraryChoice();
    }

    UpdateLibraryChoice()
    {
        const libraryManhwas = DataController.LibraryManhwas;
        const tempChoices = [];

        for (let manhwa of libraryManhwas)
        {
            for (let url of manhwa.Urls)
            {
                tempChoices.push({
                    name: `${Utils.formatTitle(manhwa.Name)} on ${Utils.getWebsiteNameFromUrl(url)} (${Utils.formatChapterFromURL(manhwa.LastChapters[manhwa.Urls.indexOf(url)])})`,
                    value: `§${libraryManhwas.indexOf(manhwa)}:${manhwa.Urls.indexOf(url)}`
                });
            }
        }

        this._libraryChoices = tempChoices;
        this._libraryManhwas = libraryManhwas;
    }

    OnUpdateLibrary()
    {
        this.UpdateLibraryChoice();
    }

    async OnAutocomplete(interaction, focusedOption)
    {
        if (focusedOption.name !== "name") return;

        const result = [];

        for (let item of this._libraryChoices)
        {
            const manhwaInfo = item.value.replace("§", "").split(":");
            const manhwa = this._libraryManhwas[parseInt(manhwaInfo[0])];
            const url = manhwa.Urls[manhwaInfo[1]];

            const matchStartTitle = Utils.formatTitle(manhwa.Name).toLowerCase().startsWith(focusedOption.value.toString().toLowerCase());
            const matchManhwa = ManhwaNotifier.Instance.DataCenter.GetMatchUserManhwa(interaction.user.id, {name: manhwa.Name, url: url});

            if (matchStartTitle && matchManhwa !== MatchType.Full)
            {
                result.push({name: StringUtility.CutText(item.name, 100), value: item.value});
            }

            if (result.length === 25) break;
        }

        await interaction.respond(result);
    }

    async Run(interaction)
    {
        await super.Run(interaction);
        
        const isFromAutoComplete = interaction.options.get("name").value.startsWith("§");

        if (isFromAutoComplete) await this.FollowFromAutoComplete(interaction);
        else await this.FollowCustom(interaction);
    }

    async FollowCustom(interaction)
    {
        const affectedServerManhwas = this.AffectServerManhwas(interaction);
        const name = interaction.options.get("name").value;
        const values = 
        {
            name: name
        }

        if (interaction.options.get("chapter")) values.chapter = interaction.options.get("chapter").value;
        if (interaction.options.get("site")) values.site = interaction.options.get("site").value;
        
        const isUrl = values.name.startsWith("http");
        let description = `Looking for **${values.name}** in the supported websites`;

        if (isUrl) description = `Getting the information about ${values.name}`;

        await DiscordUtility.Reply(interaction, EmbedUtility.GetGoodEmbedMessage("Waiting..", description));

        // ============ Searching
        const scrapInfo = await Utils.SearchManhwa(values);

        if (!scrapInfo)
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage("Not found", `**${values.name}** was not found in the supported websites`));
            return;
        }

        // ============ Error check
        if (scrapInfo.StatusType !== ScrapStatusType.Success)
        {
            const embed = EmbedUtility.GetBadEmbedMessage(`Error`);
            let description = isUrl ? `We cannot get any information about ${values.name}` : `${values.name} was not found in the list of supported websites`;

            description += `\n\n${scrapInfo.StatusType}: ${scrapInfo.CustomErrorMessage}`;

            embed.setDescription(description);

            await DiscordUtility.Reply(interaction, embed);
            return;
        }

        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const manhwaData = {name: scrapInfo.Name, url: scrapInfo.FinalUrl};
        const matchType = affectedServerManhwas ? dataCenter.GetMatchServerManhwa(interaction.guild.id, manhwaData)
            : dataCenter.GetMatchUserManhwa(interaction.user.id, manhwaData);

        // ============ Replace if already exists
        if (matchType === MatchType.Partial)
        {
            await new ReplaceManhwa(interaction, scrapInfo).Start();
            return;
        }
        else if (matchType === MatchType.Full)
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetNeutralEmbedMessage("Already added", `${scrapInfo.Name} was already added`));
            return;
        }

        // ============ Adding
        let lastChapter = scrapInfo.ChaptersUrls[0];

        if (values.chapter)
        {
            const chooseChapter = Utils.getUrlWithChapter(scrapInfo.ChaptersUrls, values.chapter);

            if (!chooseChapter)
            {
                await new ChapterSelector(interaction, scrapInfo).Start();
                return;
            }

            lastChapter = chooseChapter;
        }

        const manhwa = new Manhwa().From(scrapInfo.Name, scrapInfo.FinalUrl, lastChapter, scrapInfo.Image, scrapInfo.Description);

        if (affectedServerManhwas)
        {
            await dataCenter.AddServerManhwa(interaction.guild.id, manhwa);
        }
        else
        {
            dataCenter.AddUserManhwa(interaction.user.id, manhwa);
        }

        const embed = EmbedUtility
            .GetGoodEmbedMessage(`${scrapInfo.Name} has been added to ${Utils.formatChapterFromURL(lastChapter)} on ${Utils.getWebsiteNameFromUrl(scrapInfo.FinalUrl)}`)
            .setImage(scrapInfo.Image);

        await DiscordUtility.Reply(interaction, embed);
    }

    async FollowFromAutoComplete(interaction)
    {
        const name = interaction.options.get("name").value;
        const manhwaInfo = name.replace("§", "").split(":");
        const libraryManhwa = this._libraryManhwas[parseInt(manhwaInfo[0])];
        const url = libraryManhwa.Urls[manhwaInfo[1]];
        const chapter = libraryManhwa.LastChapters[manhwaInfo[1]];

        const serverID = interaction.guild.id;
        const userID = interaction.user.id;
        const dataCenter = ManhwaNotifier.Instance.DataCenter;
        const affectServerManhwas = dataCenter.CanManagerServerManhwas(userID, serverID);
        const infos = { name: libraryManhwa.Name, url: libraryManhwa.Urls[0] };
        const matchType = affectServerManhwas ? dataCenter.GetMatchServerManhwa(serverID, infos) : dataCenter.GetMatchUserManhwa(userID, infos);

        if (matchType === MatchType.Partial)
        {
            await new ReplaceManhwa(interaction, infos).Start();
            return;
        }

        if (matchType === MatchType.Full)
        {
            await DiscordUtility.Reply(interaction, EmbedUtility.GetNeutralEmbedMessage("Already added", `${infos.name} was already added`));
            return;
        }

        const manhwa = new Manhwa().From(libraryManhwa.Name, url, chapter, libraryManhwa.Image, libraryManhwa.Description);

        if (affectServerManhwas)
        {
            await dataCenter.AddServerManhwa(serverID, manhwa);
        }
        else
        {
            dataCenter.AddUserManhwa(userID, manhwa);
        }

        const embed = EmbedUtility
            .GetGoodEmbedMessage(`${libraryManhwa.Name} has been added to ${Utils.formatChapterFromURL(chapter)} on ${Utils.getWebsiteNameFromUrl(url)}`)
            .setImage(libraryManhwa.Image);

        await DiscordUtility.Reply(interaction, embed);
    }

    AffectServerManhwas(interaction)
    {
        if (interaction.guild === null) return false;

        const serverID = interaction.guild.id;
        const userID = interaction.user.id;

        return ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(userID, serverID);
    }
}

class ChapterSelector extends CommandInterface
{
    /** @type {ScrapInfo} */
    _infos
    /** @type {number} */
    _chapterIndex
    /** @type {boolean} */
    _affectServerManhwas = false

    constructor(interaction, infos)
    {
        super(interaction);

        this._infos = infos;
        this._chapterIndex = -1;

        if (interaction.guild !== null)
        {
            const serverID = interaction.guild.id;
            const userID = interaction.user.id;
            this._affectServerManhwas = ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(userID, serverID);
        }

        this.SetMenuList([
            {
                onMenuClick: async (values) =>
                {
                    this._chapterIndex = values[0];
                    await this.OnChooseChapter();
                },
                getList: () =>
                {
                    const list = [];
                    for (let item of this._infos.ChaptersUrls)
                    {
                        const index = this._infos.ChaptersUrls.indexOf(item);

                        list.push({label: Utils.formatChapterFromURL(item), value: index});
                    }
                    return list;
                },
                options: {
                    label: item => item.label,
                    value: item => item.value
                },
                placeholder: "Choose specific chapter..."
            }
        ]);
    }

    async OnChooseChapter()
    {
        const manhwa = new Manhwa().From(this._infos.Name, this._infos.FinalUrl, this._infos.ChaptersUrls[this._chapterIndex], this._infos.Image, this._infos.Description);

        if (this._affectServerManhwas)
        {
            await ManhwaNotifier.Instance.DataCenter.AddServerManhwa(this.Interaction.guild.id, manhwa);
        }
        else
        {
            ManhwaNotifier.Instance.DataCenter.AddUserManhwa(this.Interaction.user.id, manhwa);
        }
    }

    ConstructEmbed()
    {
        if (this._chapterIndex !== -1)
        {
            return EmbedUtility
                .GetGoodEmbedMessage(`${this._infos.Name} was added to ${Utils.formatChapterFromURL(this._infos.ChaptersUrls[this._chapterIndex])}`)
                .setImage(this._infos.Image);
        }
        else
        {
            return EmbedUtility.GetNeutralEmbedMessage(
                "The chapter is missing",
                `${this._infos.Name} was found, but the given chapter was not.\nChoose the chapter in the menu below or with the given buttons`
            );
        }
    }

    ConstructComponents()
    {
        const components = [];

        if (this._chapterIndex !== -1) return components;

        this.AddMenuComponents(components);

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(`${Utils.formatChapterFromURL(this._infos.ChaptersUrls[this._infos.ChaptersUrls.length - 1])}`)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Return))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`first`),
                new ButtonBuilder()
                    .setLabel(`${Utils.formatChapterFromURL(this._infos.ChaptersUrls[0])}`)
                    .setEmoji(EmojiUtility.GetEmojiData(EmojiUtility.Emojis.Right))
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`last`)
            )
        );

        return components;
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "last")
        {
            this._chapterIndex = 0;
        }
        else
        {
            this._chapterIndex = this._infos.ChaptersUrls.length - 1;
        }

        await this.OnChooseChapter();
    }
}

const ReplaceManhwaState = {
    "NoActionDone": 0,
    "Replaced": 1,
    "NotReplaced": 2
}

export class ReplaceManhwa extends CommandInterface
{
    /** @type {ScrapInfo} */
    _infos
    /** @type {ReplaceManhwaState} */
    _state
    /** @type {boolean} */
    _affectServerManhwas = false

    constructor(interaction, infos)
    {
        super(interaction);

        this._infos = infos;
        this._state = ReplaceManhwaState.NoActionDone;

        if (interaction.guild !== null)
        {
            const serverID = interaction.guild.id;
            const userID = interaction.user.id;
            this._affectServerManhwas = ManhwaNotifier.Instance.DataCenter.CanManagerServerManhwas(userID, serverID);
        }
    }

    ConstructEmbed()
    {
        if (this._state === ReplaceManhwaState.NoActionDone)
        {
            return EmbedUtility
                .GetNeutralEmbedMessage(
                    `${this._infos.Name} has been found on ${Utils.getWebsiteNameFromUrl(this._infos.FinalUrl)} but was already added`,
                    "Do you want to replace it ?"
                )
                .setImage(this._infos.Image);
        }
        else if (this._state === ReplaceManhwaState.NotReplaced)
        {
            return EmbedUtility
                .GetNeutralEmbedMessage(`${this._infos.Name} was not added`)
                .setImage(this._infos.Image);
        }

        return EmbedUtility
            .GetGoodEmbedMessage(`${this._infos.Name} has been replaced by this one`)
            .setImage(this._infos.Image);
    }

    ConstructComponents()
    {
        if (this._state !== ReplaceManhwaState.NoActionDone) return [];

        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(`Yes`)
                    .setStyle(ButtonStyle.Success)
                    .setCustomId(`yes`),
                new ButtonBuilder()
                    .setLabel(`No`)
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId(`no`)
            )
        ];
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "yes")
        {
            this._state = ReplaceManhwaState.Replaced;

            if (this._affectServerManhwas)
            {
                ManhwaNotifier.Instance.DataCenter.ReplaceServerManhwa(this.Interaction.guild.id, this._infos);
            }
            else
            {
                ManhwaNotifier.Instance.DataCenter.ReplaceUserManhwa(this.Interaction.user.id, this._infos);
            }
        }
        else
        {
            this._state = ReplaceManhwaState.NotReplaced;
        }
    }
}