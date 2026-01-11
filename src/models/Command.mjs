import {SlashCommandBuilder, AutocompleteInteraction, Client} from "discord.js";
import {StringUtility} from "../utility/StringUtility.mjs";
import {ManhwaNotifier} from "../controller/ManhwaNotifier.mjs";

export class Command
{
    /** @type {ManhwaNotifier} */
    _manhwaNotifier
    /** @type {CommandController} */
    _commandController
    /** @type {Client} */
    _client

    /** @type {string} */
    Name
    /** @type {[{name: string, description: string, required: boolean, autocomplete: boolean, getList: Function<{}[]>}]} */
    Args
    /** @type {number} */
    MinArgs
    /** @type {string} */
    Description
    /** @type {string} */
    LongDescription
    /** @type {boolean} */
    NeedAnAccount = false
    /** @type {boolean} */
    Admin = false
    /** @type {boolean} */
    OnlyInServer = false
    /** @type {boolean} */
    OnlyCreator = false

    constructor(name, args, description, longDescription = "")
    {
        this.Name = name;
        this.Description = description;
        this.LongDescription = longDescription;

        this._manhwaNotifier = ManhwaNotifier.Instance;
        this._commandController = this._manhwaNotifier.CommandCenter;
        this._client = this._manhwaNotifier.DiscordClient;

        this.Args = [];
        this.MinArgs = 0;

        for (const arg of args)
        {
            arg.required = arg.required ?? false;
            arg.autocomplete = arg.autocomplete ?? false;
            arg.getList = arg.getList ?? (() => []);

            this.Args.push(arg);

            if (arg.required) this.MinArgs++;
        }
    }

    SetAdmin()
    {
        this.Admin = true;
    }

    SetOnlyInServer()
    {
        this.OnlyInServer = true;
    }

    SetOnlyCreator()
    {
        this.OnlyCreator = true;
    }

    SetNeedAnAccount()
    {
        this.NeedAnAccount = true;
    }

    AsSlashCommand()
    {
        let description = StringUtility.CutText(this.OnlyCreator ? "이 봇을 만든 사람만 사용할 수 있는 명령입니다" : this.Description, 100);

        const slashCommand = new SlashCommandBuilder()
            .setName(this.Name)
            .setDescription(description)
            .setDMPermission(!this.OnlyInServer);

        for (const arg of this.Args)
        {
            slashCommand.addStringOption(option =>
                option
                    .setName(arg.name)
                    .setDescription(arg.description)
                    .setRequired(arg.required)
                    .setAutocomplete(arg.autocomplete)
                    .addChoices(arg.getList())
            );
        }

        return slashCommand;
    }

    /**
     *
     * @param interaction {AutocompleteInteraction}
     * @param focusedOption
     * @returns {Promise<void>}
     */
    async OnAutocomplete(interaction, focusedOption) {}

    async Run(interaction)
    {
        if (this.NeedAnAccount) await ManhwaNotifier.Instance.DataCenter.CheckIfUserExist(interaction.user.id, interaction);
    }

    OnUpdateLibrary() {}
}