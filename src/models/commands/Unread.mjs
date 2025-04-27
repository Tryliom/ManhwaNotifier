import {Command} from "../Command.mjs";
import {CommandInterface} from "../menus/CommandInterface.mjs";
import {EmbedUtility} from "../../utility/EmbedUtility.mjs";
import {ManhwaNotifier} from "../../controller/ManhwaNotifier.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle} from "discord.js";

class UndoChapters
{
    /** @type {UnreadChapter[]} */
    Chapters = []
    /**
     * @brief The index of the manhwa in the unread chapters list
     * @type {number} */
    Index = 0
    /**
     * @brief The page of the manhwa in the unread chapters list
     * @type {number} */
    Page = 0

    constructor(chapters, index, page)
    {
        this.Chapters = chapters;
        this.Index = index;
        this.Page = page;
    }
}

export class Unread extends Command
{
    constructor()
    {
        super(
            "unread",
            [],
            "Show all your unread chapters",
            "Manage your unread chapters order by manhwas. Mark them as read when you're done reading.",
        );

        this.SetNeedAnAccount();
    }

    async Run(interaction)
    {
        await super.Run(interaction);

        if (ManhwaNotifier.Instance.DataCenter.IsUserUnreadChaptersEmpty(interaction.user.id))
        {
            await interaction.reply({embeds: [EmbedUtility.GetNeutralEmbedMessage("You don't have any unread chapters")], ephemeral: interaction.guild !== null});
            return;
        }

        await new UnreadViewer(interaction).Start();
    }
}

class UnreadViewer extends CommandInterface
{
    /** @type {Object<string, UnreadManhwa>} */
    _unreadChapters = {}
    /** @type {UndoChapters[]} */
    _undoStack = []
    /** @type {number} */
    _page = 0

    constructor(interaction)
    {
        super(interaction);

        this.UpdateList();

        this.SetEphemeral(interaction.guild !== null);
        this.SetMenuList([
            {
                onMenuClick: values =>
                {
                    this._page = parseInt(values[0]);
                },
                getList: () => Object.keys(this._unreadChapters),
                options: {
                    label: (item) => `Page ${Object.keys(this._unreadChapters).indexOf(item) + 1}`,
                    description: (item) => item,
                    value: (item) => Object.keys(this._unreadChapters).indexOf(item)
                },
                placeholder: "Choose the manhwa.."
            },
            {
                // Value is manhwaName§orderedUrlsIndex
                onMenuClick: values =>
                {
                    const value = values[0];
                    const name = value.split("§")[0];
                    const index = parseInt(value.split("§")[1]);
                    const manhwa = this._unreadChapters[name];
                    const chaptersToRead = manhwa.OrderedUrls.slice(0, index + 1);

                    const readChapters = ManhwaNotifier.Instance.DataCenter.ReadChapters(
                        this.Interaction.user.id,
                        manhwa.Name,
                        chaptersToRead.map(chapter => chapter.Url)
                    );

                    this.SaveOldState(new UndoChapters(readChapters.chapters, readChapters.index, this._page));
                    this.UpdateMenuPageWithPage(1, 0);
                    this.UpdateList();
                },
                getList: () => this._unreadChapters[Object.keys(this._unreadChapters)[this._page]].OrderedUrls,
                options: {
                    label: (item) => item.Name,
                    value: (item) => this._unreadChapters[Object.keys(this._unreadChapters)[this._page]].Name + "§" +
                        this._unreadChapters[Object.keys(this._unreadChapters)[this._page]].OrderedUrls.indexOf(item)
                },
                placeholder: "Read all the way to.."
            }
        ]);
    }

    OnMenuPageChange(index)
    {
        if (index === 0)
        {
            this.UpdateMenuPageWithPage(1, 0);
        }
    }

    OnChangePage()
    {
        this.UpdateMenuPageWithPage(1, 0);
    }

    ConstructEmbed()
    {
        const manhwa = this._unreadChapters[Object.keys(this._unreadChapters)[this._page]];

        if (Object.keys(this._unreadChapters).length === 0)
        {
            return EmbedUtility.GetNeutralEmbedMessage("You don't have chapter to read");
        }
        else
        {
            const embed = EmbedUtility.GetGoodEmbedMessage(manhwa.Name);
            const description = [];
            let totalLength = 0;

            if (manhwa.IsImageValid()) embed.setImage(manhwa.Image);

            for (let formattedChapter of manhwa.OrderedUrls)
            {
                description.push(`[${formattedChapter.Name}](${formattedChapter.Url})`);
                totalLength += description[description.length - 1].length;

                if ((totalLength >= 3500 || manhwa.OrderedUrls.indexOf(formattedChapter) === 11) && manhwa.OrderedUrls.indexOf(formattedChapter) + 1 !== manhwa.OrderedUrls.length)
                {
                    description.push(`And ${manhwa.OrderedUrls.length - manhwa.OrderedUrls.indexOf(formattedChapter) - 1} more chapters..`);
                    break;
                }
            }

            embed.setDescription(description.join("\n"));
            embed.setFooter({text: `Page ${this._page + 1}/${Object.keys(this._unreadChapters).length}`});

            return embed;
        }
    }

    ConstructComponents()
    {
        const components = [];

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Undo")
                        .setEmoji({name: "↩️"})
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("undo")
                        .setDisabled(this._undoStack.length === 0)
                )
        );

        if (Object.keys(this._unreadChapters).length === 0)
        {
            if (this.Interaction.guild === null)
            {
                components.push(this.GetCloseButton());
            }

            return components;
        }

        if (Object.keys(this._unreadChapters).length > 1)
        {
            this.AddMenuComponents(components, 0);
        }

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Mark all as read")
                        .setEmoji({name: "📖"})
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId("read-all"),
                    new ButtonBuilder()
                        .setLabel("Open chapter")
                        .setStyle(ButtonStyle.Link)
                        .setURL(this._unreadChapters[Object.keys(this._unreadChapters)[this._page]].OrderedUrls[0].Url)
                )
        );

        this.AddMenuComponents(components, 1);

        if (this.Interaction.guild === null)
        {
            components.push(this.GetCloseButton());
        }

        return components;
    }

    async OnButton(interaction)
    {
        if (interaction.customId === "undo")
        {
            this.RestoreOldState();
        }

        if (Object.keys(this._unreadChapters).length === 0) return;

        if (interaction.customId === "read-all")
        {
            const manhwa = this._unreadChapters[Object.keys(this._unreadChapters)[this._page]];

            if (!manhwa) return;

            const readChapters = ManhwaNotifier.Instance.DataCenter.ReadChapters(this.Interaction.user.id, this._unreadChapters[Object.keys(this._unreadChapters)[this._page]].Name);

            this.SaveOldState(new UndoChapters(readChapters.chapters, readChapters.index, this._page));
            this._page = 0;
            this.UpdateMenuPageWithPage(0, 0);
            this.UpdateMenuPageWithPage(1, 0);
            this.UpdateList();
        }
    }

    UpdateList()
    {
        this._unreadChapters = ManhwaNotifier.Instance.DataCenter.GetUnreadChaptersByManhwa(this.Interaction.user.id);

        if (this._page >= Object.keys(this._unreadChapters).length)
        {
            this._page = 0;
            this.UpdateMenuPageWithPage(0, 0);
        }
    }

    /**
     * @brief Save the current state of the unread chapters list to be able to undo a read action, used when the user read a chapter
     * @param undoChapter {UndoChapters}
     */
    SaveOldState(undoChapter)
    {
        if (this._undoStack.length >= 20)
        {
            this._undoStack.shift();
        }

        this._undoStack.push(undoChapter);
    }

    RestoreOldState()
    {
        if (this._undoStack.length === 0) return;

        const dataController = ManhwaNotifier.Instance.DataCenter;
        const undoChapters = this._undoStack.pop();
        let index = undoChapters.Index;

        if (undoChapters.Index >= dataController.GetUserUnreadChaptersCount(this.Interaction.user.id))
        {
            index = -1;
        }

        dataController.InsertUserUnreadChapter(this.Interaction.user.id, undoChapters.Chapters, index);
        this._page = undoChapters.Page;
        this.UpdateList();
        this.UpdateMenuPageWithPage(0, 0);
        this.UpdateMenuPageWithPage(1, 0);
    }
}