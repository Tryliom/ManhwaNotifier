import {Routes} from "discord-api-types/v10";
import {ManhwaNotifier} from "./ManhwaNotifier.mjs";
import {SecurityUtility} from "../utility/SecurityUtility.mjs";
import {DiscordUtility} from "../utility/DiscordUtility.mjs";
import {EmbedUtility} from "../utility/EmbedUtility.mjs";
import {REST} from "discord.js";

import {Help} from "../models/commands/Help.mjs";
import {Get} from "../models/commands/Get.mjs";
import {Follow} from "../models/commands/Follow.mjs";
import {CheckManhwaUrl} from "../models/commands/CheckManhwaUrl.mjs";
import {Stats} from "../models/commands/Stats.mjs";
import {Read} from "../models/commands/Read.mjs";
import {Manhwas} from "../models/commands/Manhwas.mjs";
import {Unread} from "../models/commands/Unread.mjs";
import {Faq} from "../models/commands/Faq.mjs";
import {Settings} from "../models/commands/Settings.mjs";
import {DeleteMyAccount} from "../models/commands/deleteMyAccount.mjs";
import {Role} from "../models/commands/Role.mjs";
import {Library} from "../models/commands/Library.mjs";
import {Panel} from "../models/commands/Panel.mjs";
import {Server} from "../models/commands/Server.mjs";

// Random funny message to display when a user doesn't have the permission to use a creator command
const creatorErrorRandomMessages =
[
    "You doesn't have enough power to handle this command.",
    "Your dark energy is not strong enough to handle this command.",
    "Your cultivation stage is too low to handle this command.",
    "You are not the chosen one to handle this command.",
    "A superior entity prevent you from using this command.",
    "You are not worthy to use this command.",
    "You fool ! You can't handle this command !",
    "Your qi is too weak to handle this command.",
    "The dragon council doesn't knowledge you as a worthy user of this command.",
    "Nooo, you're not the one I awaited for !",
    "Only Kayden that fat cat can hope to use this command.",
    "Your synchronization rate is too low to handle this command.",
    "Available only for regressors.",
    "Harry, you're not a wizard.",
];

export class CommandController
{
    /** @type {Command[]} */
    Commands

    Initialize()
    {
        // Create all commands to be used
        this.Commands =
        [
            new Help(),
            new Get(),
            new Follow(),
            new Manhwas(),
            new CheckManhwaUrl(),
            new Stats(),
            new Read(),
            new Unread(),
            new Faq(),
            new Settings(),
            new DeleteMyAccount(),
            new Role(),
            new Library(),
            new Panel(),
            new Server()
            //new Test()
        ];
    }

    async RefreshSlashCommands()
    {
        const rest = new REST({version: '10'}).setToken(process.env.token);
        await rest.put(
            Routes.applicationCommands(ManhwaNotifier.Instance.DiscordClient.user.id),
            {
                body: this.Commands.map(command => command.AsSlashCommand())
            },
        );
    }

    async OnCommand(interaction)
    {
        for (let command of this.Commands)
        {
            if (command.Name !== interaction.commandName) continue;

            if (command.OnlyCreator && !SecurityUtility.IsCreator(interaction.user.id))
            {
                await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage(
                    "Creator command",
                    creatorErrorRandomMessages[Math.floor(Math.random() * creatorErrorRandomMessages.length)]
                ), true);
            }
            else if (command.Admin && !DiscordUtility.IsAdministrator(interaction.user.id, interaction.guildId))
            {
                await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage(
                    "Admin command",
                    `You are not the admin of this server.`
                ), true)
            }
            else if (command.MinArgs + 1 > interaction.options.length)
            {
                await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage(
                    "Args are missing",
                    `/${command.Name} ${command.Args}\n\nRequire minimum ${command.MinArgs} parameters to the command.`
                ), true);
            }
            else
            {
                try
                {
                    await command.Run(interaction);
                }
                catch (e)
                {
                    await DiscordUtility.Reply(interaction, EmbedUtility.GetBadEmbedMessage(
                        "Error",
                        `An error occurred: ` + e.toString()
                    ));

                    console.error(e);
                }
            }
        }
    }

    async OnAutocomplete(interaction)
    {
        const focusedOption = interaction.options.getFocused(true);

        for (let command of this.Commands)
        {
            if (command.Name !== interaction.commandName) continue;

            if (command.NeedAnAccount)
            {
                await ManhwaNotifier.Instance.DataCenter.CheckIfUserExist(interaction.user.id, interaction);
            }

            await command.OnAutocomplete(interaction, focusedOption);
        }
    }

    async OnUpdateLibrary()
    {
        ManhwaNotifier.Instance.DataCenter.GenerateLibraryManhwas();

        for (let command of this.Commands)
        {
            command.OnUpdateLibrary();
        }
    }
}