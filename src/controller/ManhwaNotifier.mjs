import {Client, GatewayIntentBits} from "discord.js";
import {CommandController} from "./CommandController.mjs";
import {Utils} from "../utility/Utils.mjs";
import {Logger} from "../utility/Logger.mjs";
import {EmbedUtility} from "../utility/EmbedUtility.mjs";
import {DataController} from "./DataController.mjs";
import {LoadTime} from "../models/LoadTime.mjs";

export class ManhwaNotifier
{
    // Variables are named differently than their class name to avoid conflicts with the class name
    /** @type {ManhwaNotifier} */
    static Instance
    /** @type {CommandController} */
    CommandCenter
    /** @type {DataController} */
    DataCenter
    /** @type {Client} */
    DiscordClient

    /** @type {Object<string, Function>[]} */
    _events = []

    // Checks
    /** @type {string} */
    static LastCheckStep = "none"
    /** @type {number} */
    static TotalCheckManhwas = 0
    /** @type {[string]} */
    static WebsitesDown = []
    /** @type {Object<string, LoadTime>} */
    static LoadTimePerWebsite = {};
    /** @type {Object<string, number>} */
    static LoadPageTimeExceedsPerWebsite = {};
    /** @type {number} */
    static MaxLoadTimeOccurrence = 5;
    /** @type {number} */
    static MaxLoadTimeOccurrenceAsura = 10;

    constructor()
    {
        ManhwaNotifier.Instance = this;
        this.DataCenter = new DataController();
        this.CommandCenter = new CommandController();
        this.CommandCenter.Initialize();

        this.DiscordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMessageReactions
            ]
        });

        this.DiscordClient.login(process.env.token).catch((reason) =>
        {
            Logger.Log(`Login failed for ${reason}`);
        });

        this.DiscordClient.on("disconnect", async () =>
        {
            Logger.Log("Disconnected");
            await this.Restart("Disconnected");
        });

        this.DiscordClient.once('ready', async () =>
        {
            Logger.Log('Connected');

            this.ResetDownList();
            await this.CommandCenter.RefreshSlashCommands();

            Utils.initPuppeteer();
            await Utils.StartMainBrowser();

            setInterval(() => this.DataCenter.SaveAll(), 1000 * 60 * 5);
            setInterval(() => this.DataCenter.Backup(), 1000 * 60 * 60 * 24);
            setInterval(() => this.ResetDownList(), 1000 * 60 * 60 * 6);

            this.DataCenter.Backup();
            await this._regularCheck();

            await Logger.LogEmbed(EmbedUtility.GetNeutralEmbedMessage("Bot started", `v${process.env.npm_package_version}`));
        });

        this.DiscordClient.on("error", e =>
        {
            Logger.Log("DiscordError", e);

            if (e.message.startsWith("TimeoutError: Timed out after"))
            {
                this.Restart("Browser timeout");
            }
        });

        this.DiscordClient.on("interactionCreate", async interaction =>
        {
            if (interaction.isAutocomplete())
            {
                try
                {
                    await this.CommandCenter.OnAutocomplete(interaction);
                }
                catch (error)
                {
                    Logger.Log(`Autocomplete`, error);
                }
            }
            else if (interaction.isCommand()) {
                try
                {
                    await this.CommandCenter.OnCommand(interaction);
                }
                catch (error)
                {
                    Logger.Log(`Command`, error);
                }
            }
            else
            {
                for (let i = 0; i < this._events.length; i++)
                {
                    try
                    {
                        await this._events[i].event(interaction);
                    }
                    catch (error)
                    {
                        Logger.Log(error);
                    }
                }
            }
        });
    }

    SubscribeToEvent(id, event)
    {
        this._events.push({id: id, event: event});
    }

    UnsubscribeFromEvent(id)
    {
        for (let i = 0; i < this._events.length; i++)
        {
            if (this._events[i].id === id)
            {
                this._events.splice(i, 1);
                return;
            }
        }
    }

    // Functions

    async Restart(reason = "none")
    {
        await Logger.LogEmbed(EmbedUtility.GetNeutralEmbedMessage(`Restarting`, `Reason: ${reason}`));
        this.DataCenter.SaveAll();
        process.exit();
    }

    async PostCheckSummary()
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage("Check error summary");

        if (ManhwaNotifier.WebsitesDown.length > 0)
        {
            embed.addFields(
                [
                    {
                        name: "Websites down",
                        value: ManhwaNotifier.WebsitesDown.join(", "),
                        inline: true
                    }
                ]
            )
        }

        // Use the average load time per website
        if (Object.keys(ManhwaNotifier.LoadTimePerWebsite).length > 0)
        {
            // Make a list of the top ten website with the longest time to load
            const topTenWebsite = Object.keys(ManhwaNotifier.LoadTimePerWebsite).sort((a, b) => ManhwaNotifier.LoadTimePerWebsite[b].TotalTime - ManhwaNotifier.LoadTimePerWebsite[a].TotalTime).slice(0, 10);

            embed.addFields(
                [
                    {
                        name: "Average load time per website",
                        value: "Website: [Count] Shortest / Median / Longest / Total time taken",
                        inline: false
                    }
                ]
            )

            for (let website of topTenWebsite)
            {
                const websiteInfo = ManhwaNotifier.LoadTimePerWebsite[website];
                const totalMinutes = Math.round(websiteInfo.TotalTime / 1000 / 60);

                embed.addFields(
                    [
                        {
                            name: website,
                            value: `[${websiteInfo.Total}] ${websiteInfo.ShortestTime}ms / ${Math.round(websiteInfo.TotalTime / websiteInfo.Total)}ms / ${websiteInfo.LongestTime}ms / ${totalMinutes}min`,
                            inline: false
                        }
                    ]
                );
            }
        }

        await Logger.LogEmbed(embed);
    }

    async _regularCheck()
    {
        const totalManhwas = this.DataCenter.GetBotStats().TotalManhwas;
        let timeElapsed = 0;
        let lastPercent = 0;
        let timeFromSamePercent = 0;

        ManhwaNotifier.LoadPageTimeExceedsPerWebsite = {};
        ManhwaNotifier.LoadTimePerWebsite = {};
        ManhwaNotifier.TotalCheckManhwas = 0;
        ManhwaNotifier.LastCheckStep = "Check started";
        ManhwaNotifier.ServerPartTime = [[], [], []];
        ManhwaNotifier.UserPartTime = [[], [], []];

        const updateCheck = setInterval(() =>
        {
            const actualPercent = Math.round(ManhwaNotifier.TotalCheckManhwas / totalManhwas * 10000) / 100;
            const actualTime = new Date(timeElapsed * 1000).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0];

            timeElapsed += 10;
            timeFromSamePercent += 10;

            if (lastPercent !== actualPercent)
            {
                lastPercent = actualPercent;
                timeFromSamePercent = 0;
            }

            try
            {
                this.DiscordClient.user.setActivity(`/Help | v${process.env.npm_package_version} | ${actualPercent}% (${actualTime})`);
            }
            catch (e) {}

            // If the time elapsed is greater or equal to 3 hours, restart the bot
            if (timeElapsed >= 10800)
            {
                clearInterval(updateCheck);
                this.Restart("3 hours of check elapsed\nLast status: " + ManhwaNotifier.LastCheckStep);
            }

            // If the time from the same percent is greater or equal to 10 minutes, restart the bot
            if (timeFromSamePercent >= 600)
            {
                clearInterval(updateCheck);
                this.Restart("10 minutes of the same percent\nLast status: " + ManhwaNotifier.LastCheckStep);
            }

        }, 10 * 1000);

        await this.DataCenter.CorrectDataStored();
        await this.DataCenter.StartCheckOfAllManhwas();
        await this.PostCheckSummary();

        clearInterval(updateCheck);
        this.DiscordClient.user.setActivity(`/Help | v${process.env.npm_package_version}`);
        await Logger.LogEmbed(EmbedUtility.GetNeutralEmbedMessage(
            "The check has been finished",
            `It took ${(new Date(timeElapsed * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0]} to check all manhwas`)
        );
        ManhwaNotifier.LastCheckStep = "Check finished";

        const startDate = new Date();

        this.CommandCenter.OnUpdateLibrary().then(() =>
        {
            const endDate = new Date();

            console.log(`Library updated in ${endDate - startDate}ms`);

            // Start the check again in 5 minutes
            setTimeout(() => this._regularCheck(), 1000 * 60 * 5);
        });
    }

    ResetDownList()
    {
        Utils.WebsitesThatNeedToUseNetworkIdle2 = [];
        ManhwaNotifier.WebsitesDown = ["Isekaiscan", "Mm-scans", "Toonily", "Nitroscans", "Readmanganato", "Comickiba", "Vofeg", "Flonescans",
            "Manhwa-freak", "Neroscans", "Manhuascan", "Freakscans", "Tecnosca", "Kumascans", "247manga", "Mangatone", "Scansraw", "Mangatoo", "Scansraw",
            "Mangaeffect", "Mangatx"
        ];
    }
}