import {Command} from "../Command.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {ReplaceManhwa} from "./Follow.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {MatchType} from "../MatchType.mjs";
import {ScrapInfo} from "../datas/ScrapInfo.mjs";
import {DiscordUtility} from "../../utility/DiscordUtility.mjs";
import {Manhwa} from "../datas/Manhwa.mjs";

export class Get extends Command
{
    constructor()
    {
        super("get",
            [
                {
                    name: "name",
                    description: "The name of the manhwa",
                    required: true
                }
            ],
            "Get informations about a manhwa to follow it",
            "Give you one or more link to the manhwa you search and if it exists on the supported websites"
        );

        this.SetNeedAnAccount();
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        const title = interaction.options.get("name").value;

        await new Searcher(interaction, Utils.formatTitle(title)).Start();
    }
}

class Searcher extends CommandInterface
{
    /** @type {string} */
    _title
    /** @type {ScrapInfo[]} */
    _manhwas = []
    /** @type {boolean} */
    _searching = true
    /** @type {string} */
    _addedMessage = ""
    /** @type {boolean} */
    _affectServerManhwas = false

    constructor(interaction, title)
    {
        super(interaction);

        this._title = title;

        if (interaction.guild !== null)
        {
            const serverID = interaction.guild.id;
            const userID = interaction.user.id;
            const dataCenter = ManhwaNotifier.Instance.DataCenter;
            this._affectServerManhwas = dataCenter.CanManagerServerManhwas(userID, serverID);
        }

        this.SetMenuList([
            {
                onMenuClick: async (values) =>
                {
                    const scrapInfo = this._manhwas[values[0]];
                    const dataCenter = ManhwaNotifier.Instance.DataCenter;
                    const manhwaData = {name: scrapInfo.Name, url: scrapInfo.FinalUrl};
                    const matchType = this._affectServerManhwas ? dataCenter.GetMatchServerManhwa(interaction.guild.id, manhwaData) :
                        dataCenter.GetMatchUserManhwa(interaction.user.id, manhwaData);

                    if (matchType !== MatchType.Not)
                    {
                        this.IgnoreInteractions = true;
                        await new ReplaceManhwa(this.Interaction, scrapInfo, this.LastInteraction).Start();
                    }
                    else
                    {
                        const manhwa = new Manhwa().From(scrapInfo.Name, scrapInfo.FinalUrl, scrapInfo.ChaptersUrls[0], scrapInfo.Image, scrapInfo.Description);

                        if (this._affectServerManhwas)
                        {
                            await dataCenter.AddServerManhwa(interaction.guild.id, manhwa);
                        }
                        else
                        {
                            await dataCenter.AddUserManhwa(interaction.user.id, manhwa);
                        }

                        this._addedMessage = `**${manhwa.Name}** has been followed`;
                        await this.StopCollector(false);
                    }
                },
                getList: () => this._manhwas,
                options:
                {
                    label: item => Utils.getWebsiteNameFromUrl(item.FinalUrl),
                    description: item => Utils.formatChapterFromURL(item.ChaptersUrls[0]),
                    value: item => this._manhwas.indexOf(item)
                },
                placeholder: "Follow it on.."
            }
        ]);
        this.SetEphemeral(true);
    }

    async Start()
    {
        await super.Start();

        await Utils.getAllWebsiteForTitle(this._title, "", infos =>
        {
            this._manhwas.push(infos);
            this.UpdateMsg();
        });

        this._searching = false;
        await this.UpdateMsg();
    }

    ConstructEmbed()
    {
        if (this._manhwas.length === 0)
        {
            if (this._searching)
            {
                return EmbedUtility.GetNeutralEmbedMessage(`Please wait a bit`, `We are searching **${this._title}** throughout the supported websites..`);
            }
            else
            {
                return EmbedUtility.GetBadEmbedMessage(`Error`, `**${this._title}** is not available in the supported websites..`);
            }
        }

        if (this._addedMessage !== "")
        {
            return EmbedUtility.GetNeutralEmbedMessage(`Success`, this._addedMessage).setImage(this._manhwas[0].Image);
        }

        const embed = EmbedUtility.GetNeutralEmbedMessage(Utils.formatTitle(this._title), this._manhwas[0].Description).setImage(this._manhwas[0].Image);
        let websites = "";

        for (let item of this._manhwas)
        {
            if (websites !== "") websites += "\n";
            websites += `[${Utils.getWebsiteNameFromUrl(item.FinalUrl)}](${item.FinalUrl}) (${Utils.formatChapterFromURL(item.ChaptersUrls[0])})`;
        }

        if (this._searching) websites += "\n\nSearching more...";

        embed.addFields([{name: "Websites", value: websites}]);

        const matchManhwa = ManhwaNotifier.Instance.DataCenter.GetMatchUserManhwa(this.Interaction.user.id, {name: this._manhwas[0].Name, url: this._manhwas[0].FinalUrl});
        let footer = "";

        if (this._affectServerManhwas)
        {
            footer = `ℹ️ This is the manhwas list of the server`;
        }

        if (matchManhwa === MatchType.Full)
        {
            if (footer !== "") footer += " - ";

            footer += "This manhwa is already in your list";
        }

        if (footer !== "")
        {
            embed.setFooter({text: footer});
        }

        return embed;
    }

    ConstructComponents()
    {
        const components = [];

        if (this._searching || this._manhwas.length === 0) return components;

        this.AddMenuComponents(components);
        components.push(this.GetCloseButton());

        return components;
    }
}