import {Command} from "../Command.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {Filter, LibraryFilter} from "../Filter.mjs";
import {DataController} from "../../controller/DataController.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {LibraryManhwa} from "../datas/LibraryManhwa.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {MatchType} from "../MatchType.mjs";
import {ActionRowBuilder, StringSelectMenuBuilder} from "discord.js";
import {Manhwa} from "../datas/Manhwa.mjs";

export class Library extends Command
{
    constructor()
    {
        super(
            "library",
            [],
            "Shows the library of all manhwas in the bot. You can also follow any manhwa in the library with a simple button and filter the manhwa.",
            "Contains all unique manhwas in the bot. Filter them by number of readers, servers and follow them.",
        );
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        await new LibraryInterface(interaction).Start();
    }
}

class LibraryInterface extends CommandInterface
{
    /** @type {LibraryManhwa[]} */
    _libraryManhwas
    /** @type {string} */
    _filter
    /** @type {number} */
    page
    /** @type {boolean} */
    _affectServerManhwas = false
    /** @type {DataController} */
    _dataController

    constructor(interaction)
    {
        super(interaction);

        this._filter = Filter.Alphabetical;
        this._libraryManhwas = Utils.sortList(DataController.LibraryManhwas, this._filter);
        this.page = 0;
        this._dataController = ManhwaNotifier.Instance.DataCenter;

        if (interaction.guild !== null)
        {
            const serverID = interaction.guild.id;
            const userID = interaction.user.id;
            this._affectServerManhwas = this._dataController.CanManagerServerManhwas(userID, serverID);
        }

        this.SetEphemeral(true);
        this.SetMenuList([
            {
                onMenuClick: values => this.page = parseInt(values[0]),
                getList: () =>
                {
                    const list = [];

                    for (let libraryManhwa of this._libraryManhwas)
                    {
                        const index = this._libraryManhwas.indexOf(libraryManhwa);
                        const manhwaData = {name: libraryManhwa.Name, url: libraryManhwa.Urls[0]};
                        const option = {
                            label: this.page === index ? "Current" : `Page ${index + 1}`,
                            description: libraryManhwa.Name,
                            value: index,
                            emoji: this.GetMatchType(manhwaData) !== MatchType.Not ? "✅" : "📚"
                        };

                        list.push(option);
                    }

                    return list;
                },
                options: {
                    label: item => item.label,
                    description: item => item.description,
                    value: item => item.value,
                    emoji: item => item.emoji
                },
                placeholder: "Go to..."
            }
        ]);
    }

    async OnButton(interaction)
    {
        this.OnButtonChangePage(interaction, this._libraryManhwas.length, 0);
    }

    async OnMenu(interaction)
    {
        if (interaction.customId === "menu-follow")
        {
            const libraryManhwa = this._libraryManhwas[this.page];
            const manhwa = new Manhwa().From(
                libraryManhwa.Name,
                libraryManhwa.Urls[interaction.values[0]],
                libraryManhwa.LastChapters[interaction.values[0]],
                libraryManhwa.Image,
                libraryManhwa.Description
            );

            if (this._affectServerManhwas)
            {
                await this._dataController.AddServerManhwa(interaction.guild.id, manhwa);
            }
            else
            {
                this._dataController.AddUserManhwa(interaction.user.id, manhwa);
            }
        }
    }

    ConstructEmbed()
    {
        const manhwa = this._libraryManhwas[this.page];
        const manhwaData = {name: manhwa.Name, url: manhwa.Urls[0]};
        const followed = this.GetMatchType(manhwaData) !== MatchType.Not;
        const availableOn = [];

        const embed = EmbedUtility.GetNeutralEmbedMessage(Utils.formatTitle(manhwa.Name))
            .setURL(manhwa.Urls[0])
            .setDescription(manhwa.Description);

        if (manhwa.IsImageValid()) embed.setImage(manhwa.Image);

        for (let url of manhwa.Urls)
        {
            availableOn.push(`[${Utils.getWebsiteNameFromUrl(url)}](${url}) (${Utils.formatChapterFromURL(manhwa.LastChapters[manhwa.Urls.indexOf(url)])})`);
        }

        embed.addFields([
            {
                name: "Available on",
                value: availableOn.join("\n"),
                inline: true
            },
            {
                name: "Stats",
                value: `Followed by ${manhwa.Readers} user(s)\nIn ${manhwa.Servers} server(s)`,
                inline: true
            }
        ]);

        let footer = "";

        if (followed) footer = `✅ You follow this manhwa - `;

        footer += `Page ${this.page + 1}/${this._libraryManhwas.length}`;

        embed.setFooter({text: footer});

        return embed;
    }

    ConstructComponents()
    {
        const manhwa = this._libraryManhwas[this.page];
        const components = [];

        components.push(this.GetFilter({...Filter, ...LibraryFilter}));

        this.AddMenuComponents(components);

        components.push(this.GetChangePageButtons())

        const manhwaData = {name: manhwa.Name, url: manhwa.Urls[0]};
        const exist = this.GetMatchType(manhwaData) !== MatchType.Not;

        if (!exist)
        {
            components.push(new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("menu-follow")
                        .setPlaceholder("Follow it on..")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(...this.GetOptions(0, manhwa.Urls, {
                            label: item => Utils.getWebsiteNameFromUrl(item),
                            description: item => Utils.formatChapterFromURL(manhwa.LastChapters[manhwa.Urls.indexOf(item)]),
                            value: item => manhwa.Urls.indexOf(item)
                        }))
                ))
        }

        return components;
    }

    OnFilterChange()
    {
        this.SetMenuPage(0, 0);
        this._libraryManhwas = Utils.sortList(this._libraryManhwas, this._filter);
    }

    GetMatchType(manhwaData)
    {
        if (this._affectServerManhwas)
        {
            return this._dataController.GetMatchServerManhwa(this.Interaction.guild.id, manhwaData);
        }
        else
        {
            return this._dataController.GetMatchUserManhwa(this.Interaction.user.id, manhwaData);
        }
    }
}