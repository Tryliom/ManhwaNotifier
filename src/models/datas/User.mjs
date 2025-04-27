import {Manhwa} from "./Manhwa.mjs";
import {UnreadChapter} from "./UnreadChapter.mjs";
import {Code} from "./Code.mjs";

export class User
{
    /** @type {Manhwa[]} */
    Manhwas= []
    /** @type {UnreadChapter[]} */
    UnreadChapters= []
    /** @type {Code[]} */
    Codes = []

    // Settings
    /** @type {boolean} */
    ReceiveChangelog = true
    /** @type {boolean} */
    ShowButtonOnNewChapter = false
    /** @type {boolean} */
    UnreadEnabled = true
    /** @type {boolean} */
    ShowAlerts = true
    /** @type {boolean} */
    ShowPolls = true

    // Misc
    /** @type {number} */
    LastActionDate = Date.now()
    /** @type {boolean} */
    HasShownUnreadAlert = false


    constructor()
    {
        this.Manhwas = [];
        this.UnreadChapters = [];
        this.Codes = [];

        this.ReceiveChangelog = true;
        this.ShowButtonOnNewChapter = false;
        this.UnreadEnabled = true;
        this.ShowAlerts = true;
        this.ShowPolls = true;

        this.LastActionDate = Date.now();
        this.HasShownUnreadAlert = false
    }

    FromJson(data)
    {
        if (data.manga)
        {
            data.Manhwas = data.manga.filter(u => u !== undefined).map(m => new Manhwa().FromJson(m));
            data.UnreadChapters = data.unread.filter(u => u !== undefined).map(u => new UnreadChapter().FromJson(u));
            data.Codes = [];

            data.ReceiveChangelog = data.changelog;
            data.ShowButtonOnNewChapter = data.buttonOnNewChapter;
            data.UnreadEnabled = data.useUnread;
            data.ShowAlerts = data.alert;
            data.ShowPolls = data.poll;

            data.LastCommandDate = data.lastCommandDate;
        }

        this.Manhwas = data.Manhwas.map(m => new Manhwa().FromJson(m));
        this.UnreadChapters = data.UnreadChapters.map(u => new UnreadChapter().FromJson(u));
        this.Codes = data.Codes?.map(c => new Code().FromJson(c));

        this.ReceiveChangelog = data.ReceiveChangelog;
        this.ShowButtonOnNewChapter = data.ShowButtonOnNewChapter;
        this.UnreadEnabled = data.UnreadEnabled;
        this.ShowAlerts = data.ShowAlerts;
        this.ShowPolls = data.ShowPolls;

        this.LastActionDate = new Date(data.LastActionDate).getTime();
        this.HasShownUnreadAlert = data.HasShownUnreadAlert;

        return this;
    }

    AddToEmbed(embed)
    {
        const ToBool = (value) => value ? "✅" : "❌";

        embed.setDescription(
            `### Display changelog - ${ToBool(this.ReceiveChangelog)}\n` +
            `If the bot should send you the changelog when it's updated\n` +
            `### Display buttons on new chapter - ${ToBool(this.ShowButtonOnNewChapter)}\n` +
            `If the bot should show buttons to read the new chapter instead of use /unread command\n` +
            `### Display polls - ${ToBool(this.ShowPolls)}\n` +
            `If the bot should show you polls, sometimes the bot will ask you to vote on something like if you want to see a new feature or keep an old one\n` +
            `### Use unread list - ${ToBool(this.UnreadEnabled)}\n` +
            `If the bot should show you the list of unread chapters\n` +
            `⚠️ This will clear your unread list if you disable it\n` +
            `### Display errors - ${ToBool(this.ShowAlerts)}\n` +
            `If the bot should show you errors when trying to get a chapter, like when the website the manhwa is on is down`
        );
    }
}