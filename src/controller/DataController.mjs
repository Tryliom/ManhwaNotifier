import fs from "fs";
import cjson from "compressed-json";
import {ManhwaNotifier} from "./ManhwaNotifier.mjs";
import {BotInfo} from "../models/datas/BotInfo.mjs";
import {Server} from "../models/datas/Server.mjs";
import {User} from "../models/datas/User.mjs";
import {Manhwa} from "../models/datas/Manhwa.mjs";
import {Logger} from "../utility/Logger.mjs";
import {DiscordUtility} from "../utility/DiscordUtility.mjs";
import {Utils} from "../utility/Utils.mjs";
import {MatchType} from "../models/MatchType.mjs";
import {LibraryManhwa} from "../models/datas/LibraryManhwa.mjs";
import {EmbedUtility} from "../utility/EmbedUtility.mjs";
import {Stats} from "../models/datas/Stats.mjs";
import {TimeDifference} from "../utility/TimeDifference.mjs";
import {LoadTime} from "../models/LoadTime.mjs";
import {ScrapStatusType} from "../models/ScrapStatusType.mjs";
import {UnreadChapter} from "../models/datas/UnreadChapter.mjs";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder} from "discord.js";
import {FormattedUrl, UnreadManhwa} from "../models/datas/UnreadManhwa.mjs";
import {StringUtility} from "../utility/StringUtility.mjs";
import {TextInputStyle} from "discord-api-types/v8";
import {Code} from "../models/datas/Code.mjs";

/**
 * Give a path where to load file if it's a .json or .txt
 * @param path
 * @returns {any}
 */
function LoadFile(path)
{
    if (fs.existsSync(`${path}.txt`))
    {
        const content = fs.readFileSync(`${path}.txt`).toString();
        return cjson.decompress(JSON.parse(content));
    }
    else if (fs.existsSync(`${path}.json`))
    {
        return JSON.parse(fs.readFileSync(`${path}.json`).toString());
    }
    else
    {
        return null;
    }
}

function SaveFile(path, content)
{
    if (content === "")
    {
        ManhwaNotifier.Instance.Restart(`${path} content is empty`);
        return;
    }

    if (path.endsWith(".json"))
    {
        fs.writeFileSync(path, content);
    }
    else
    {
        fs.writeFileSync(`${path}.txt`, JSON.stringify(cjson.compress(JSON.parse(content))));
    }
}

function SaveJsonToFile(path, content)
{
    SaveFile(path, JSON.stringify(content));
}

/**
 * Save a compressed file, content needs to be passed as JSON
 * @param path
 * @param content
 */
function SaveCompressedFile(path, content)
{
    if (content === "")
    {
        ManhwaNotifier.Instance.Restart(`${path} content is empty`);
    }
    else
    {
        fs.writeFileSync(`${path}.txt`, JSON.stringify(cjson.compress(content)));
    }
}

const Paths = {
    users: "./assets/data/users",
    bot: "./assets/data/bot-info",
    backup: "./assets/backup/",
    purge: "./assets/purge/",
    usersDirectory: "users/",
    allUsers: "users/user-",
    userList: "users-list",
    dataPath: "./assets/data/",
    servers: "servers"
};

export class DataController
{
    /** @type {BotInfo} */
    _botInfos
    /** @type {Object<string, Server>} */
    _servers = {}
    /** @type {Object<string, User>} */
    _users = {}

    /** @type {Object<string, {userId: string, serverId: string}>} */
    _codesAssociation = {}

    /** @type {LibraryManhwa[]} */
    static LibraryManhwas = []
    /** @type {number} */
    static MaxChapsPerMessage = 5
    /** @type {string[]} */
    static Emoji1to10 = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]

    constructor()
    {
        this._botInfos = new BotInfo();
        this._servers = {};
        this._users = {};

        this._botInfos = LoadFile(Paths.bot) || new BotInfo();
        this._servers = LoadFile(Paths.dataPath + Paths.servers) || {};

        // Convert data to Server objects
        for (const serverId in this._servers)
        {
            this._servers[serverId] = new Server().FromJson(this._servers[serverId]);

            if (this._servers[serverId].Codes?.length > 0)
            {
                for (let code of this._servers[serverId].Codes)
                {
                    this._codesAssociation[code.Id] = {userId: "", serverId: serverId};
                }
            }
        }

        this._loadUsers();

        // Convert data to BotInfo objects
        this._botInfos = new BotInfo().FromJson(this._botInfos);

        this._applyChangesToData();
        this.GenerateLibraryManhwas();
    }

    _loadUsers()
    {
        const userList = LoadFile(Paths.dataPath + Paths.userList);

        if (!userList) return;

        for (let userID of userList)
        {
            const user = LoadFile(`${Paths.dataPath + Paths.allUsers}${userID}`);

            if (!user) continue;

            if (user.guilds)
            {
                for (let guildId in user.guilds)
                {
                    if (this._servers[guildId])
                    {
                        this._servers[guildId].Admins.push(userID);
                        continue;
                    }

                    const guild = user.guilds[guildId];
                    const server = new Server();

                    server.Channel.SetChannel(guild.channel || "");
                    server.DefaultRole.SetRole(guild.role);
                    server.MentionAllRoles = guild.mentionAllRole;
                    server.AutoRoleCreation = guild.autoRole;
                    server.Admins.push(userID);

                    const userManga = user.manga;

                    if (userManga)
                    {
                        for (let manhwa of userManga)
                        {
                            if (manhwa.role[guildId] === undefined) continue;

                            const newManhwa = new Manhwa().FromJson(manhwa);

                            newManhwa.Role.SetRole(manhwa.role[guildId]);
                            server.Manhwas.push(newManhwa);
                        }
                    }

                    this._servers[guildId] = server;
                }
            }

            this._users[userID] = new User().FromJson(user);

            if (this._users[userID].Codes)
            {
                for (let code of this._users[userID].Codes)
                {
                    this._codesAssociation[code.Id] = {userId: userID, serverId: ""};
                }
            }
        }
    }

    _saveUsers(rootPath = Paths.dataPath)
    {
        if (!fs.existsSync(rootPath + Paths.usersDirectory)) fs.mkdirSync(rootPath + Paths.usersDirectory);

        const usersList = [];

        for (let userID in this._users)
        {
            usersList.push(userID);
            SaveCompressedFile(`${rootPath + Paths.allUsers}${userID}`, this._users[userID]);
        }

        SaveCompressedFile(rootPath + Paths.userList, usersList);
    }

    _saveBotInfo(path = Paths.bot)
    {
        SaveCompressedFile(path, this._botInfos);
    }

    _saveServers(path = Paths.dataPath)
    {
        SaveCompressedFile(`${path}${Paths.servers}`, this._servers);
    }

    SaveAll()
    {
        // Check if codes are expired
        for (let code in this._codesAssociation)
        {
            const association = this._codesAssociation[code];
            const user = this._users[association.userId];
            const server = this._servers[association.serverId];

            if (user)
            {
                const userCode = user.Codes.find(c => c.Id === code);

                if (userCode && userCode.IsExpired())
                {
                    delete this._codesAssociation[code];
                    user.Codes = user.Codes.filter(c => c.Id !== code);
                }
            }
            else if (server)
            {
                const serverCode = server.Codes.find(c => c.Id === code);

                if (serverCode && serverCode.IsExpired())
                {
                    delete this._codesAssociation[code];
                    server.Codes = server.Codes.filter(c => c.Id !== code);
                }
            }
        }

        this._saveUsers();
        this._saveBotInfo();
        this._saveServers();

        Logger.Log("Saved all data");
    }

    Backup()
    {
        let path = `${Paths.backup}${StringUtility.FormatDate(new Date())}/`;

        if (!fs.existsSync(path)) fs.mkdirSync(path);

        this._saveUsers(path);
        this._saveBotInfo(`${path}bot`);
        this._saveServers(path);
    }

    /**
     * Delete the user from the list
     * @param userID {string} The user ID
     * @return {Promise<void>}
     */
    async DeleteUser(userID)
    {
        const userExist = this._users[userID];

        if (!userExist) return;

        this.BackupDeletedUser(userID);

        for (let id in this._users)
        {
            if (id === userID)
            {
                delete this._users[id];
                break;
            }
        }

        for (let serverId in this._servers)
        {
            const server = this._servers[serverId];

            for (let i = 0; i < server.Admins.length; i++)
            {
                if (server.Admins[i] === userID)
                {
                    server.Admins.splice(i, 1);
                    break;
                }
            }
        }

        // Remove user file
        const userPath = `${Paths.dataPath}${Paths.usersDirectory}user-${userID}.txt`;

        if (fs.existsSync(userPath)) fs.unlinkSync(userPath);

        const user = await DiscordUtility.GetUser(userID);

        if (user)
        {
            await Logger.LogDeletedUser(user);
        }
    }

    /**
     * Save the user deleted into a backup file
     * @param userID {string}
     */
    BackupDeletedUser(userID)
    {
        SaveJsonToFile(`${Paths.purge}${userID}.json`, this._users[userID]);
    }

    /**
     * Restore into the users list the user that was deleted
     * @param userID {string}
     */
    RestorePurgedUser(userID)
    {
        const path = `${Paths.purge}${userID}.json`;

        if (fs.existsSync(path))
        {
            this._users[userID] = new User().FromJson(JSON.parse(fs.readFileSync(path)));
        }
    }

    // Data functions

    /**
     * Check if a code exists
     * @param code {string} The code
     * @param incrementUse {boolean} If the use of the code should be incremented
     * @return {{userId: string, serverId: string} | null} The association of the code
     */
    GetCode(code, incrementUse)
    {
        if (!this._codesAssociation[code]) return null;

        if (incrementUse)
        {
            const association = this._codesAssociation[code];
            const user = this._users[association.userId];
            const server = this._servers[association.serverId];

            if (user)
            {
                user.Codes.find(c => c.Id === code).Use();
            }
            else if (server)
            {
                server.Codes.find(c => c.Id === code).Use();
            }
        }

        return this._codesAssociation[code];
    }

    // User functions

    /**
     * Check if the user exists, if not, create it. Also update the last command date.
     * @param userID {string} The user ID
     */
    async CheckIfUserExist(userID)
    {
        if (!this._users[userID])
        {

            this._users[userID] = new User();

            // Send it to log that a new user has been created
            const user = await DiscordUtility.GetUser(userID);

            if (user) await Logger.LogNewUser(user);
        }

        this.UpdateUserLastActionDate(userID);
    }

    UpdateUserLastActionDate(userID)
    {
        this._users[userID].LastActionDate = Date.now();
    }

    /**
     * Find the manhwa with the same name in the user's list and replace it with the new one
     * @param userID {string} The user ID
     * @param manhwaData {ScrapInfo}
     */
    ReplaceUserManhwa(userID, manhwaData)
    {
        const manhwas = this._users[userID].Manhwas;

        this._replaceManhwas(manhwas, manhwaData);
    }

    /**
     * Add a manhwa to the user's list
     * @param userId {string} The user ID
     * @param manhwa {Manhwa} The manhwa to add
     */
    AddUserManhwa(userId, manhwa)
    {
        this._users[userId].Manhwas.push(manhwa);
    }

    RemoveUserManhwa(userId, manhwaIndex)
    {
        if (manhwaIndex >= this._users[userId].Manhwas.length) return;

        this._users[userId].Manhwas.splice(manhwaIndex, 1);
    }

    ToggleUserChangelog(userId)
    {
        this._users[userId].ReceiveChangelog = !this._users[userId].ReceiveChangelog;
    }

    ToggleUserButtonOnNewChapter(userId)
    {
        this._users[userId].ShowButtonOnNewChapter = !this._users[userId].ShowButtonOnNewChapter;
    }

    ToggleUserPolls(userId)
    {
        this._users[userId].ShowPolls = !this._users[userId].ShowPolls;
    }

    ToggleUserUnread(userId)
    {
        this._users[userId].UnreadEnabled = !this._users[userId].UnreadEnabled;

        if (!this._users[userId].UnreadEnabled)
        {
            this._users[userId].UnreadChapters = [];
        }
    }

    ToggleUserAlert(userId)
    {
        this._users[userId].ShowAlerts = !this._users[userId].ShowAlerts;
    }

    /**
     * Read the chapters from the user's unread list, remove them from the list
     * @param userId {string} The user ID
     * @param manhwaName {string} The manhwa name
     * @param chapterUrls {string[]} The chapter urls, if empty, it will remove all the chapters with the manhwa name
     * @returns {{chapters: UnreadChapter[], index: number}} The chapters read and the index of the first chapter read
     */
    ReadChapters(userId, manhwaName, chapterUrls = [])
    {
        const unreadChapters = this._users[userId].UnreadChapters;
        const readChapters = [];
        let firstIndex = -1;

        for (let i = 0; i < unreadChapters.length; i++)
        {
            const correctChapter = chapterUrls.includes(unreadChapters[i].Url) || chapterUrls.length === 0;

            if (Utils.formatTitle(unreadChapters[i].Name) === manhwaName && correctChapter)
            {
                readChapters.push(...unreadChapters.splice(i, 1));
                if (firstIndex === -1) firstIndex = i;
                i--;
            }
        }

        return {chapters: readChapters, index: firstIndex};
    }

    ReadAllChapters(userId)
    {
        this._users[userId].UnreadChapters = [];
    }

    /**
     * Insert a chapter into the user's unread list
     * @param userId {string} The user ID
     * @param chapters {UnreadChapter[]} The chapter to insert
     * @param index {number} The index where to insert the chapter, if -1, it will be inserted at the end
     */
    InsertUserUnreadChapter(userId, chapters, index = -1)
    {
        const user = this._users[userId];

        if (index === -1)
        {
            user.UnreadChapters.push(...chapters);
        }
        else
        {
            user.UnreadChapters.splice(index, 0, ...chapters);
        }
    }

    /**
     * Apply changes to server and user data if they need it
     * @private
     */
    _applyChangesToData()
    {
        // Change all url of asura to https://asuracomic.net
        const asuraUrl = "https://asuracomic.net";
        const urls = ["https://asuratoon.com", "https://asuracomics.com", "https://asura.nacm.xyz", "https://asura.gg", "https://asuracomics.gg", "https://www.asurascans.com"];

        const ReplaceUrl = (url, urlsToBeReplaced, replaceUrl) =>
        {
            for (let urlToReplace of urlsToBeReplaced)
            {
                if (url.startsWith(urlToReplace))
                {
                    return url.replace(urlToReplace, replaceUrl);
                }
            }

            return url;
        };
        /** @type {(manhwas: Manhwa[] || UnreadChapter[]) => void} */
        const CheckAsuraLinks = (manhwas) =>
        {
            for (let manhwa of manhwas)
            {
                if (manhwa.Url == null)
                {
                    manhwas.splice(manhwas.indexOf(manhwa), 1);
                    continue;
                }

                manhwa.Url = ReplaceUrl(manhwa.Url, urls, asuraUrl);

                if (manhwa.Url.startsWith("https://asuracomic.net/manga/"))
                {
                    // Remove old id from the url
                    const urlParts = manhwa.Url.split("/");

                    if (urlParts.length < 5) continue;

                    const id = urlParts[4].split("-")[0];

                    manhwa.Url = manhwa.Url.replace("https://asuracomic.net/manga/" + id + "-", "https://asuracomic.net/series/");
                    manhwa.Url = manhwa.Url.replace(manhwa.Url.split("/")[4], manhwa.Url.split("/")[4] + "-12345678");
                }
            }
        }

        for (let serverID in this._servers)
        {
            const server = this._servers[serverID];

            CheckAsuraLinks(server.Manhwas);
        }

        for (let userID in this._users)
        {
            const user = this._users[userID];

            CheckAsuraLinks(user.Manhwas);
            CheckAsuraLinks(user.UnreadChapters);
        }
    }

    AddUserCode(userId)
    {
        const code = new Code(this._generateNewUniqueCode());
        this._users[userId].Codes.push(code);
        this._codesAssociation[code.Id] = {userId: userId, serverId: ""};
    }

    DeleteUserCode(userId, codeIndex)
    {
        if (codeIndex >= this._users[userId].Codes.length) return;

        const code = this._users[userId].Codes[codeIndex];

        delete this._codesAssociation[code.Id];
        this._users[userId].Codes.splice(codeIndex, 1);
    }

    EditUserCode(userId, codeIndex, newCode)
    {
        if (codeIndex >= this._users[userId].Codes.length) return;

        delete this._codesAssociation[this._users[userId].Codes[codeIndex].Id];
        this._users[userId].Codes[codeIndex].ChangeCode(newCode);
        this._codesAssociation[this._users[userId].Codes[codeIndex].Id] = {userId: userId, serverId: ""};
    }

    EditUserCodeLimit(userId, codeIndex, newLimit)
    {
        if (codeIndex >= this._users[userId].Codes.length) return;

        this._users[userId].Codes[codeIndex].LimitDate = newLimit;
    }

    /**
     * Find the manhwa with the same name in the user's list, check if the url is the same or not
     * @param userID {string} The user ID
     * @param manhwaData {{name: string, url: string}}
     * @returns {number} The type of match
     */
    GetMatchUserManhwa(userID, manhwaData)
    {
        const manhwas = this._users[userID].Manhwas;

        return this._getMatchManhwa(manhwas, manhwaData);
    }

    /**
     * Get the number of manhwas in the user
     * @param userId {string} The user ID
     * @return {number} The number of manhwas in the user
     */
    GetUserManhwasCount(userId)
    {
        return this._users[userId].Manhwas.length;
    }

    /**
     * Get the user manhwa list with the filter
     * @param userId {string} The user ID
     * @param filter {string} The filter to apply
     * @returns {Manhwa[]} The manhwa list
     */
    GetUserManhwasFiltered(userId, filter)
    {
        return Utils.sortList(this._users[userId].Manhwas, filter);
    }

    /**
     * Get the manhwa with the index in the user
     * @param userId {string} The user ID
     * @param manhwaIndex {number} The index of the manhwa in the user
     * @return {Manhwa} The manhwa
     */
    GetUserManhwa(userId, manhwaIndex)
    {
        return this._users[userId].Manhwas[manhwaIndex];
    }

    /**
     * Check if the manhwa index is valid
     * @param userId {string} The user ID
     * @param manhwaIndex {number} The index of the manhwa in the user
     * @return {boolean} If the manhwa index is valid or not
     */
    IsUserManhwaIndexValid(userId, manhwaIndex)
    {
        return manhwaIndex < this._users[userId].Manhwas.length;
    }

    /**
     * Get the user
     * @param userId {string} The user ID
     * @return {User} The user
     */
    GetUser(userId)
    {
        return this._users[userId];
    }

    GetTop25ManhwasUnread(userId, startsWith)
    {
        const list = [{name: "all", value: "all"}];
        const user = this._users[userId];

        for (let manhwa of user.UnreadChapters)
        {
            const name = Utils.formatTitle(manhwa.Name);

            if (list.filter(item => item.name === name).length === 0 && name.startsWith(startsWith))
            {
                list.push({name: name, value: name});
            }

            if (list.length === 25) break;
        }

        return list;
    }

    IsUserUnreadChaptersEmpty(userId)
    {
        return this._users[userId].UnreadChapters.length === 0;
    }

    GetUserUnreadChaptersCount(userId)
    {
        return this._users[userId].UnreadChapters.length;
    }

    /**
     *
     * @param userId
     * @returns {Object<string, UnreadManhwa>} The unread manhwas, grouped by manhwa name
     */
    GetUnreadChaptersByManhwa(userId)
    {
        const unreadChapters = this._users[userId].UnreadChapters;
        const manhwas = {};

        for (let chapter of unreadChapters)
        {
            const name = Utils.formatTitle(chapter.Name);

            if (!manhwas[name])
            {
                manhwas[name] = new UnreadManhwa().From(name, [], chapter.Image);
            }

            manhwas[name].OrderedUrls.push(new FormattedUrl().From(chapter.Url, Utils.formatChapterFromURL(chapter.Url)));
        }

        return manhwas;
    }

    GetUserManhwas(userId)
    {
        return this._users[userId].Manhwas;
    }

    GetUserCodes(userId)
    {
        return this._users[userId].Codes;
    }

    GetUserUnreadList(userId)
    {
        return this._users[userId].UnreadChapters;
    }

    // Server functions

    /**
     * Replace the current channelId associated to the serverId
     * @param serverId {string}
     * @param channelId {string}
     */
    SetServerChannel(serverId, channelId)
    {
        this._servers[serverId].Channel.SetChannel(channelId);
    }

    /**
     * Replace the current roleId associated to the serverId
     * @param serverId {string} The server ID
     * @param manhwaIndex {number} The index of the manhwa in the server
     * @param roleId {string} The role ID
     * @constructor
     */
    SetServerManhwaRole(serverId, manhwaIndex, roleId)
    {
        this._servers[serverId].Manhwas[manhwaIndex].Role.SetRole(roleId);
    }

    SetServerDefaultRole(serverId, roleId)
    {
        this._servers[serverId].DefaultRole.SetRole(roleId);
    }

    ToggleServerMentionAllRoles(serverId)
    {
        this._servers[serverId].MentionAllRoles = !this._servers[serverId].MentionAllRoles;
    }

    ToggleServerAutoRoleCreation(serverId)
    {
        this._servers[serverId].AutoRoleCreation = !this._servers[serverId].AutoRoleCreation;
    }

    RemoveServerChannel(serverId)
    {
        this._servers[serverId].Channel.Reset();
    }

    RemoveServerManhwaRole(serverId, manhwaIndex)
    {
        this._servers[serverId].Manhwas[manhwaIndex].Role.Reset()
    }

    RemoveServerDefaultRole(serverId)
    {
        this._servers[serverId].DefaultRole.Reset();
    }

    AddServer(serverId)
    {
        this._servers[serverId] = new Server();
    }

    /**
     * Find the manhwa with the same name in the server manhwa list and replace it with the new one
     * @param serverId {string} The server ID
     * @param manhwaData {ScrapInfo}
     */
    ReplaceServerManhwa(serverId, manhwaData)
    {
        const manhwas = this._servers[serverId].Manhwas;

        this._replaceManhwas(manhwas, manhwaData);
    }

    RemoveServer(serverId)
    {
        delete this._servers[serverId];
    }

    /**
     * Add a manhwa to the server's list
     * @param serverId {string} The server ID
     * @param manhwa {Manhwa} The manhwa to add
     */
    async AddServerManhwa(serverId, manhwa)
    {
        const server = this._servers[serverId];

        server.Manhwas.push(manhwa);

        if (!server.AutoRoleCreation) return;

        const guild = DiscordUtility.GetGuild(serverId);

        if (!guild) return;

        const role = await guild.roles.create({
            name: `MN ${manhwa.Name}`,
            data: {
                color: "grey",
            },
            reason: "Role created by Manhwa Notifier"
        });

        server.Manhwas[server.Manhwas.length - 1].Role.SetRole(role.id);
    }

    async RemoveServerManhwa(serverId, manhwaIndex)
    {
        if (manhwaIndex >= this._servers[serverId].Manhwas.length) return;

        const server = this._servers[serverId];
        const manhwa = server.Manhwas[manhwaIndex];

        if (manhwa.Role.IsDefined())
        {
            const guild = DiscordUtility.GetGuild(serverId);

            if (!guild) return;

            const role = guild.roles.cache.get(manhwa.Role.Id);

            if (role && role.name.startsWith("MN "))
            {
                await role.delete();
            }
        }

        server.Manhwas.splice(manhwaIndex, 1);
    }

    AddServerAdmin(serverId, userId)
    {
        if (this._servers[serverId].Admins.includes(userId)) return;

        this._servers[serverId].Admins.push(userId);
    }

    RemoveServerAdmin(serverId, userId)
    {
        const server = this._servers[serverId];

        for (let i = 0; i < server.Admins.length; i++)
        {
            if (server.Admins[i] === userId)
            {
                server.Admins.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Add a code to the server's list
     * @param serverId {string} The server ID
     */
    AddServerCode(serverId)
    {
        const code = new Code(this._generateNewUniqueCode());
        this._servers[serverId].Codes.push(code);
        this._codesAssociation[code.Id] = {userId: "", serverId: serverId};
    }

    DeleteServerCode(serverId, codeIndex)
    {
        if (codeIndex >= this._servers[serverId].Codes.length) return;

        const code = this._servers[serverId].Codes[codeIndex];

        delete this._codesAssociation[code.Id];
        this._servers[serverId].Codes.splice(codeIndex, 1);
    }

    EditServerCode(serverId, codeIndex, newCode)
    {
        if (codeIndex >= this._servers[serverId].Codes.length) return;

        delete this._codesAssociation[this._servers[serverId].Codes[codeIndex].Id];
        this._servers[serverId].Codes[codeIndex].ChangeCode(newCode);
        this._codesAssociation[this._servers[serverId].Codes[codeIndex].Id] = {userId: "", serverId: serverId};
    }

    EditServerCodeLimit(serverId, codeIndex, newLimit)
    {
        if (codeIndex >= this._servers[serverId].Codes.length) return;

        this._servers[serverId].Codes[codeIndex].LimitDate = Code.GetTimeLimit(newLimit);
    }

    GetServerAdmins(serverId)
    {
        if (!this._servers[serverId]) return [];

        return this._servers[serverId].Admins;
    }

    GetServerDefaultRole(serverId)
    {
        return this._servers[serverId].DefaultRole.Id;
    }

    GetServerManhwaRole(serverId, manhwaIndex)
    {
        return this._servers[serverId].Manhwas[manhwaIndex].Role.Id;
    }

    GetServer(serverId)
    {
        return this._servers[serverId];
    }

    ExistsServer(serverId)
    {
        return this._servers[serverId] !== undefined;
    }

    CanManagerServerManhwas(userID, serverID)
    {
        return ManhwaNotifier.Instance.DataCenter.ExistsServer(serverID) &&
            (DiscordUtility.IsAdministrator(userID, serverID) || ManhwaNotifier.Instance.DataCenter.GetServer(serverID).Admins.includes(userID));
    }

    /**
     * Find the manhwa with the same name in the user's list, check if the url is the same or not
     * @param serverId {string} The server ID
     * @param manhwaData {{name: string, url: string}}
     * @returns {number} The type of match
     */
    GetMatchServerManhwa(serverId, manhwaData)
    {
        const manhwas = this._servers[serverId].Manhwas;

        return this._getMatchManhwa(manhwas, manhwaData);
    }

    /**
     * Get the number of manhwas in the server
     * @param serverId {string} The server ID
     * @return {number} The number of manhwas in the server
     */
    GetServerManhwasCount(serverId)
    {
        return this._servers[serverId].Manhwas.length;
    }

    /**
     * Get the server manhwa list with the filter
     * @param serverId {string} The server ID
     * @param filter {string} The filter to apply
     * @return {Manhwa[]} The manhwa list
     * @constructor
     */
    GetServerManhwasFiltered(serverId, filter)
    {
        return Utils.sortList(this._servers[serverId].Manhwas, filter);
    }

    /**
     * Get the manhwa with the index in the server
     * @param serverId {string} The server ID
     * @param manhwaIndex {number} The index of the manhwa in the server
     * @return {Manhwa} The manhwa
     */
    GetServerManhwa(serverId, manhwaIndex)
    {
        return this._servers[serverId].Manhwas[manhwaIndex];
    }

    /**
     * Check if the manhwa index is valid
     * @param serverId {string} The server ID
     * @param manhwaIndex {number} The index of the manhwa in the server
     * @return {boolean} If the manhwa index is valid or not
     */
    IsServerManhwaIndexValid(serverId, manhwaIndex)
    {
        return manhwaIndex < this._servers[serverId].Manhwas.length;
    }

    /**
     * Get the number of servers
     * @return {number} The number of servers
     */
    GetServerCount()
    {
        return Object.keys(this._servers).length;
    }

    /**
     * Get manhwas from the server
     * @param serverId {string} The server ID
     * @return {Manhwa[]} The manhwas
     */
    GetServerManhwas(serverId)
    {
        return this._servers[serverId].Manhwas;
    }

    GetServerCodes(serverId)
    {
        return this._servers[serverId].Codes;
    }

    // Bot functions

    GetFaqs()
    {
        return this._botInfos.Faqs;
    }

    GetGlobalLogChannel()
    {
        return this._botInfos.GlobalLogChannel;
    }

    GetUserLogChannel()
    {
        return this._botInfos.UserLogChannel;
    }

    GetChangelogChannel()
    {
        return this._botInfos.ChangelogChannel;
    }

    AddFaq(faq)
    {
        this._botInfos.Faqs.push(faq);
    }

    DeleteFaq(index)
    {
        if (index >= this._botInfos.Faqs.length) return;

        this._botInfos.Faqs.splice(index, 1);
    }

    SetGlobalLogChannel(channelId)
    {
        this._botInfos.GlobalLogChannel.SetChannel(channelId);
    }

    SetUserLogChannel(channelId)
    {
        this._botInfos.UserLogChannel.SetChannel(channelId);
    }

    SetChangelogChannel(channelId)
    {
        this._botInfos.ChangelogChannel.SetChannel(channelId);
    }

    // Global functions

    /**
     * Generate the list of manhwas for the library, accessible with LibraryManhwas
     */
    GenerateLibraryManhwas()
    {
        /** @type {LibraryManhwa[]} */
        const libraryManhwas = [];

        /**
         * Check if the manhwa is already in the library or add it
         * @param manhwa {Manhwa} The manhwa to check
         * @param fromServer {boolean} If the manhwa is from the server or not
         */
        const CheckManhwa = (manhwa, fromServer) =>
        {
            if (!manhwa.IsRecognized()) return;

            let matchType = MatchType.Not;
            let libraryIndex = -1;

            for (let libraryManhwa of libraryManhwas)
            {
                matchType = libraryManhwa.GetMatchType(manhwa);

                if (matchType === MatchType.Not) continue;

                libraryIndex = libraryManhwas.indexOf(libraryManhwa);
                break;
            }

            if (matchType === MatchType.Not)
            {
                const libraryManhwa = new LibraryManhwa();

                libraryManhwa.From(manhwa.Name, [manhwa.Url], [manhwa.Chapter], manhwa.Image, manhwa.Description);
                libraryManhwas.push(libraryManhwa);
                libraryIndex = libraryManhwas.length - 1;
            }
            else if (matchType === MatchType.Partial)
            {
                const libraryManhwa = libraryManhwas[libraryIndex];

                libraryManhwa.Urls.push(manhwa.Url);
                libraryManhwa.LastChapters.push(manhwa.Chapter);

                if (libraryManhwa.Image === "") libraryManhwa.Image = manhwa.Image;
                if (libraryManhwa.Description === "") libraryManhwa.Description = manhwa.Description;
            }

            if (fromServer) libraryManhwas[libraryIndex].Servers++;
            else libraryManhwas[libraryIndex].Readers++;
        };

        for (let serverId in this._servers)
        {
            const server = this._servers[serverId];

            for (let manhwa of server.Manhwas)
            {
                CheckManhwa(manhwa, true);
            }
        }

        for (let userId in this._users)
        {
            const user = this._users[userId];

            for (let manhwa of user.Manhwas)
            {
                CheckManhwa(manhwa, false);
            }
        }

        DataController.LibraryManhwas = libraryManhwas;
    }

    /**
     * Find the manhwa with the same name in the manhwa list given and replace it with the new one
     * @param manhwas {Manhwa[]} The list of manhwas
     * @param manhwaData {ScrapInfo}
     */
    _replaceManhwas(manhwas, manhwaData)
    {
        const formattedName = Utils.formatTitle(manhwaData.Name);

        for (let manhwa of manhwas)
        {
            if (formattedName !== Utils.formatTitle(manhwa.Name)) continue;

            const oldChapter = manhwa.Chapter;

            manhwa.Description = manhwaData.Description;
            manhwa.Url = manhwaData.FinalUrl;
            manhwa.Image = manhwaData.Image;
            manhwa.Chapter = Utils.getUrlWithChapter(manhwaData.ChaptersUrls, Utils.formatChapterFromURL(manhwa.Chapter).replace("Chapter ", ""));

            // Check if the chapter is not found and might be not correctly formatted, try to save it by searching the chapter number in the previous url and replace it
            if (!manhwa.Chapter)
            {
                const allNumbersInChapter = StringUtility.GetAllNumbersInString(oldChapter);
                let urlFound = "";

                for (let nb of allNumbersInChapter)
                {
                    for (let url of manhwaData.ChaptersUrls)
                    {
                        const chapter = Utils.formatChapterFromURL(url);

                        if (chapter === "Chapter ?") return false;

                        const chapterNumber = parseInt(chapter.replace("Chapter ", ""));

                        if (chapterNumber === nb)
                        {
                            urlFound = url;
                        }

                        if (urlFound !== "") break;
                    }

                    if (urlFound !== "") break;
                }

                if (urlFound !== "")
                {
                    manhwa.Chapter = urlFound;
                }
                else if (manhwaData.ChaptersUrls.length > 1)
                {
                    manhwa.Chapter = manhwaData.ChaptersUrls[1];
                }
            }

            break;
        }
    }

    /**
     * Find the manhwa with the same name in the manhwa list given, check if the url is the same or not
     * @param manhwas {Manhwa[]} The list of manhwas
     * @param manhwaData {{name: string, url: string}}
     * @returns {number} The type of match
     */
    _getMatchManhwa(manhwas, manhwaData)
    {
        const formattedName = Utils.formatTitle(manhwaData.name);

        for (let manhwa of manhwas)
        {
            if (formattedName !== Utils.formatTitle(manhwa.Name)) continue;

            if (manhwa.Url === manhwaData.url) return MatchType.Full;

            return MatchType.Partial;
        }

        return MatchType.Not;
    }

    /**
     * Start the purge of users with not linked servers
     * @param channel {CacheTypeReducer<CacheType, GuildTextBasedChannel | null, GuildTextBasedChannel | null, GuildTextBasedChannel | null, TextBasedChannel | null>} The channel where to send
     * @return {Promise<void>} The promise
     */
    async StartPurge(channel)
    {
        let userDeleted = 0, serverDeleted = 0;
        let lastUser, lastServer;
        const totalOldServer = Object.keys(this._servers).length;
        const oldKeyServers = Object.keys(this._servers);
        const totalOldUser = Object.keys(this._users).length;
        const oldKeyUsers = Object.keys(this._users);
        const ConstructEmbed = () =>
        {
            return EmbedUtility.GetNeutralEmbedMessage(
                "Purge",
                `Server: ${Math.round(oldKeyServers.indexOf(lastServer) / totalOldServer * 10000) / 100}%\n` +
                `User: ${Math.round(oldKeyUsers.indexOf(lastUser) / totalOldUser * 10000) / 100}%\n\n` +
                `${serverDeleted}/${oldKeyServers.length} server deleted\n` +
                `${userDeleted}/${oldKeyUsers.length} user deleted`
            );
        };

        lastServer = oldKeyServers[0];
        lastUser = oldKeyUsers[0];

        const msg = await channel.send({embeds: [ConstructEmbed()]});

        const continuousMessageEdit = setInterval(async () => msg.edit({embeds: [ConstructEmbed()]}), 1000 * 30);

        for (let serverID in this._servers)
        {
            lastServer = serverID;

            const guild = ManhwaNotifier.Instance.DiscordClient.guilds.cache.get(serverID);

            if (!guild)
            {
                serverDeleted++;
                this.RemoveServer(serverID);
            }
        }

        const guilds = ManhwaNotifier.Instance.DiscordClient.guilds.cache;

        for (let userID in this._users)
        {
            lastUser = userID;

            let exists = false;
            for (let guild of guilds)
            {
                try
                {
                    if (await guild[1].members.fetch(userID))
                    {
                        exists = true;
                        break;
                    }
                }
                catch (e) {}
            }

            if (!exists)
            {
                userDeleted++;
                await this.DeleteUser(userID);
            }
        }

        clearInterval(continuousMessageEdit);
        msg.edit({embeds: [EmbedUtility.GetNeutralEmbedMessage(`Purge finished with ${userDeleted} deleted users and ${serverDeleted} deleted servers`)]});
    }

    /**
     * Generate the stats of the bot and return it
     * @return {Stats} The stats
     */
    GetBotStats()
    {
        const stats = new Stats();

        stats.TotalUsers = Object.keys(this._users).length;
        stats.TotalServers = Object.keys(this._servers).length;

        for (let serverId in this._servers)
        {
            stats.TotalServerManhwas += this._servers[serverId].Manhwas.length;
        }

        stats.TotalUniqueManhwas = DataController.LibraryManhwas.length;

        for (let user in this._users)
        {
            stats.TotalManhwas += this._users[user].Manhwas.length;
        }

        stats.TotalManhwas += stats.TotalServerManhwas;

        const dateFrom1Day = Date.now() - 86400000;
        const dateFrom1Week = Date.now() - 604800000;

        for (let id in this._users)
        {
            const user = this._users[id];

            if (user.LastActionDate > dateFrom1Day)
            {
                stats.UsersActiveLastDay++;
            }

            if (user.LastActionDate > dateFrom1Week)
            {
                stats.UsersActiveLastWeek++;
            }
        }

        return stats;
    }

    async _replaceAllIdFromLuminous()
    {
        const website = "https://luminouscomics.org";
        const websiteName = Utils.getWebsiteNameFromUrl(website);
        const id = await Utils.getCurrentIdFor(website);
        const ReplaceId = (manhwas) =>
        {
            for (let manhwa of manhwas)
            {
                if (Utils.getWebsiteNameFromUrl(manhwa.url) !== websiteName) continue;

                try
                {
                    // Check if the url has already an id in it and that is an integer
                    const oldId = manhwa.url.split("/")[4].split("-")[0];

                    if (oldId.length < 7) continue;

                    if (isNaN(parseInt(oldId)))
                    {
                        // Add the id to the url
                        const indexStartTitle = manhwa.url.indexOf(manhwa.url.split("/")[3]);
                        manhwa.url = manhwa.url.slice(0, indexStartTitle) + id + "-" + manhwa.url.slice(indexStartTitle);
                    }
                    else
                    {
                        // Replace the id
                        manhwa.url = manhwa.url.replace(oldId, id);
                    }
                }
                catch (e) {}
            }
        };

        if (id === null) return;
        if (isNaN(parseInt(id))) return;

        // Check for each user, check all manhwas with the same website name and replace the id of the beginning title if they have one
        for (let userID in this._users)
        {
            const user = this._users[userID];

            ReplaceId(user.Manhwas);
        }

        // Check for each server, check all manhwas with the same website name and replace the id of the beginning title if they have one
        for (let serverID in this._servers)
        {
            const server = this._servers[serverID];

            ReplaceId(server.Manhwas);
        }
    }

    /**
     * Replace all ids from asura manhwas
     * @param manhwas {[{url: string, id: string}]}
     */
    _replaceAllIdFromAsura(manhwas)
    {
        if (!manhwas) return;

        const isSameManhwa = (url1, url2) =>
        {
            const url1Split = url1.split("/")[4].split("-");
            const url2Split = url2.split("/")[4].split("-");

            for (let i = 0; i < url1Split.length - 1; i++)
            {
                if (url1Split[i] !== url2Split[i]) return false;
            }

            return true;
        }

        for (let manhwa of manhwas)
        {
            if (manhwa.url === "") continue;
            if (manhwa.id.length !== 8) continue;

            const namePart = manhwa.url.split("/")[4];

            try
            {
                for (let userID in this._users)
                {
                    const user = this._users[userID];

                    for (let userManhwa of user.Manhwas)
                    {
                        if (!isSameManhwa(userManhwa.Url, manhwa.url)) continue;

                        userManhwa.Url = userManhwa.Url.replace(userManhwa.Url.split("/")[4], namePart);

                        for (let chapter of user.UnreadChapters)
                        {
                            if (isSameManhwa(chapter.Url, manhwa.url))
                            {
                                chapter.Url = chapter.Url.replace(chapter.Url.split("/")[4], namePart);
                            }
                        }

                        break;
                    }
                }

                for (let serverID in this._servers)
                {
                    const server = this._servers[serverID];

                    for (let serverManhwa of server.Manhwas)
                    {
                        if (!isSameManhwa(serverManhwa.Url, manhwa.url)) continue;

                        serverManhwa.Url = serverManhwa.Url.replace(serverManhwa.Url.split("/")[4], namePart);

                        break;
                    }
                }
            }
            catch (e) {}
        }
    }

    /**
     * Replace all ids from reaper scans manhwas
     * @param manhwas {[{url: string, id: string}]}
     */
    _replaceAllIdFromReaperScans(manhwas)
    {
        if (!manhwas) return;

        const isSameManhwa = (url1, url2) =>
        {
            const url1Split = url1.split("/")[4].split("-");
            const url2Split = url2.split("/")[4].split("-");
            const length = url1Split.length > url2Split.length ? url2Split.length : url1Split.length;

            for (let i = 0; i < length - 1; i++)
            {
                if (i >= url1Split.length || i >= url2Split.length) return false;
                if (url1Split[i] !== url2Split[i]) return false;
            }

            return true;
        }

        for (let manhwa of manhwas)
        {
            if (manhwa.url === "") continue;
            if (manhwa.id.length !== 3) continue;

            const namePart = manhwa.url.split("/")[4];

            try
            {
                for (let userID in this._users)
                {
                    const user = this._users[userID];

                    for (let userManhwa of user.Manhwas)
                    {
                        if (!isSameManhwa(userManhwa.Url, manhwa.url)) continue;

                        userManhwa.Url = userManhwa.Url.replace(userManhwa.Url.split("/")[4], namePart);

                        for (let chapter of user.UnreadChapters)
                        {
                            if (isSameManhwa(chapter.Url, manhwa.url))
                            {
                                chapter.Url = chapter.Url.replace(chapter.Url.split("/")[4], namePart);
                            }
                        }

                        break;
                    }
                }

                for (let serverID in this._servers)
                {
                    const server = this._servers[serverID];

                    for (let serverManhwa of server.Manhwas)
                    {
                        if (!isSameManhwa(serverManhwa.Url, manhwa.url)) continue;

                        serverManhwa.Url = serverManhwa.Url.replace(serverManhwa.Url.split("/")[4], namePart);

                        break;
                    }
                }
            }
            catch (e) {}
        }
    }

    /**
     * Try to scrap the manhwa from the url
     * @param url {string} The url of the manhwa
     * @param userIDs {string[]} The user IDs to send the error message
     * @param serverID {string} The server ID if the manhwa is from a server
     * @return {Promise<ScrapInfo|null>} The scrap info, return null if the scrap failed
     */
    async _tryToScrapManhwa(url, userIDs, serverID = "")
    {
        const websiteName = Utils.getWebsiteNameFromUrl(url);
        const statusTypesDisplayable = [ScrapStatusType.Unknown, ScrapStatusType.NameNotResolved];

        try
        {
            const time = new TimeDifference();
            const scrapInfos = await Utils.getAllInfo(url);
            const timeElapsed = time.getDifference();

            if (ManhwaNotifier.LoadTimePerWebsite[websiteName] === undefined)
            {
                ManhwaNotifier.LoadTimePerWebsite[websiteName] = new LoadTime();
            }

            ManhwaNotifier.LoadTimePerWebsite[websiteName].AddTime(timeElapsed);

            if (scrapInfos.StatusType === ScrapStatusType.Success) return scrapInfos;

            Logger.Log(`Failed to get manhwa page of ${url} (${scrapInfos.CustomErrorMessage})`);

            if (statusTypesDisplayable.includes(scrapInfos.StatusType) || scrapInfos.Status === 404)
            {
                for (let userID of userIDs)
                {
                    if (!this._users[userID]) continue;
                    if (!this._users[userID].ShowAlerts) continue;

                    try
                    {
                        const user = await DiscordUtility.GetUser(userID);

                        if (!user) continue;

                        let fromServer = "";

                        if (serverID !== "")
                        {
                            const guild = DiscordUtility.GetGuild(serverID);
                            fromServer = ` from server 🔰 ${guild !== undefined ? guild.name : `Unknown (${serverID})`} 🔰`;
                        }

                        const embed = EmbedUtility.GetWarningEmbedMessage(`${scrapInfos.StatusType}: ${scrapInfos.CustomErrorMessage}${fromServer}`);

                        embed.setDescription(
                            `Failed to access to ${url}\n\n` +
                            `To avoid this warning, transfer the manhwa related to a supported website.\n` +
                            `This can be a temporary error of the website, try to access to the url before doing anything.`
                        );
                        embed.setFooter({text: `If you want to disable this warning, use the command \`/Settings\` to disable these warnings`});

                        await user.send({embeds: [embed]});
                    }
                    catch (e)
                    {
                        if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                        {
                            await this.DeleteUser(userID);
                        }
                    }
                }
            }

            let websiteDown = false;

            if (scrapInfos.StatusType === ScrapStatusType.NavigationTimeout)
            {
                if (ManhwaNotifier.LoadPageTimeExceedsPerWebsite[websiteName] === undefined)
                {
                    ManhwaNotifier.LoadPageTimeExceedsPerWebsite[websiteName] = 0;
                }

                ManhwaNotifier.LoadPageTimeExceedsPerWebsite[websiteName]++;

                const loadTime = ManhwaNotifier.LoadTimePerWebsite[websiteName];

                if (loadTime >= ManhwaNotifier.MaxLoadTimeOccurrence && (websiteName !== "Asuracomic" || loadTime >= ManhwaNotifier.MaxLoadTimeOccurrenceAsura))
                {
                    websiteDown = true;
                }
            }

            if (scrapInfos.Status === 521 || scrapInfos.Status === 403 || scrapInfos.StatusType === ScrapStatusType.NameNotResolved)
            {
                websiteDown = true;
            }

            if (!websiteDown) return null;

            ManhwaNotifier.WebsitesDown.push(Utils.getWebsiteNameFromUrl(url));

            const embed = EmbedUtility.GetWarningEmbedMessage(`Added ${Utils.getWebsiteNameFromUrl(url)} to the down list`);

            embed.setDescription(
                `${scrapInfos.StatusType}: ${scrapInfos.CustomErrorMessage}\n\n` +
                `Url: ${url}\nUsers: ${userIDs.join(", ")}`
            );

            await Logger.LogEmbed(embed);
        }
        catch (e)
        {
            Logger.Log(`Failed to get manhwa page of ${url} (${e})`);
        }

        return null;
    }

    /**
     * Get the new chapters of the manhwa in an embed message
     * @param newChapters {string[]} The new chapters (urls)
     * @param manhwa {Manhwa} The manhwa
     * @return {EmbedBuilder} The embed message
     * @private
     */
    _getNewChaptersEmbed(newChapters, manhwa)
    {
        const embed = EmbedUtility.GetGoodEmbedMessage(manhwa.Name);
        const description = ["**New**"];

        if (manhwa.IsImageValid())
        {
            embed.setImage(manhwa.Image);
        }

        for (let url of newChapters)
        {
            const index = newChapters.indexOf(url);

            if (index === DataController.MaxChapsPerMessage)
            {
                description.push(`And ${newChapters.length - index} other chapters...`);
                break;
            }

            description.push(`${DataController.Emoji1to10[index]} [${Utils.formatChapterFromURL(url)}](${url})`);
        }

        embed.setDescription(description.join("\n"));

        return embed;
    }

    /**
     * Generate buttons for the new chapters and send it to the user
     * @param embed {EmbedBuilder} The embed message
     * @param newChapters {string[]} The new chapters (urls)
     * @param manhwa {Manhwa} The manhwa
     * @param userID {string} The user ID
     * @return {Promise<void>}
     * @private
     */
    async _sendNewChaptersToUser(embed, newChapters, manhwa, userID)
    {
        if (!this._users[userID]) return;

        const user = await DiscordUtility.GetUser(userID);

        if (!user) return;

        await user.createDM();

        if (!this._users[userID].UnreadEnabled || !this._users[userID].ShowButtonOnNewChapter)
        {
            await user.send({embeds: [embed]});
            return;
        }

        embed.setFooter({text: "Find all your chapters not read in /unread"});

        // Max time to react - 3hrs
        const MaxTime = 1000 * 60 * 60 * 3;
        const components = [];

        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Mark all chapters as read")
                    .setEmoji({name: "✅"})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId("mark-all")
            )
        );
        components.push(new ActionRowBuilder());

        for (let chapter of newChapters)
        {
            const index = newChapters.indexOf(chapter);

            if (index === DataController.MaxChapsPerMessage)
            {
                break;
            }

            components[components.length - 1].addComponents(
                new ButtonBuilder()
                    .setEmoji({name: DataController.Emoji1to10[index]})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(index.toString())
            );
        }

        let message = null;
        let collector = null;
        const UpdateMessage = async () =>
        {
            if (message === null)
            {
                // Error
                try
                {
                    message = await user.send({embeds: [embed], components: components});
                }
                catch (e)
                {
                    if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                    {
                        await this.DeleteUser(user.id);
                    }
                }

                if (message === null) return;
            }
            else
            {
                collector.stop();
                message = await message.edit({embeds: [embed], components: components});
            }

            collector = message.createMessageComponentCollector({time: MaxTime});
            collector.on("collect", async interaction =>
            {
                if (interaction.user.id !== userID)
                {
                    await interaction.deferUpdate();
                    return;
                }

                this.UpdateUserLastActionDate(interaction.user.id);

                if (interaction.customId === "close")
                {
                    await interaction.deferUpdate();
                    collector.stop();
                    await message.delete();
                    return;
                }

                if (interaction.customId === "mark-all")
                {
                    this.ReadChapters(userID, manhwa.Name, newChapters);

                    for (let emoji of DataController.Emoji1to10)
                    {
                        embed.data.description = embed.data.description.replace(emoji, "✅");
                    }
                }
                else
                {
                    const index = parseInt(interaction.customId);

                    if (index < 0 || index >= newChapters.length) return;

                    const url = newChapters[index];

                    this.ReadChapters(userID, manhwa.Name, [url]);

                    embed.data.description = embed.data.description.replace(DataController.Emoji1to10[index], "✅");
                }

                // Check if there is still a chapter not read in the description, by checking if there is a Emoji1to10
                if (DataController.Emoji1to10.filter(emoji => embed.data.description.includes(emoji)).length === 0)
                {
                    await interaction.deferUpdate();
                    await message.edit({embeds: [embed], components: []});
                    return;
                }

                await interaction.deferUpdate();
                await UpdateMessage();
            });
        };

        await UpdateMessage();
    }

    async _sendNewChaptersToServer(embed, newChapters, manhwa, serverID)
    {
        const server = this._servers[serverID];

        if (!server)
        {
            // Remove the server from the list
            this.RemoveServer(serverID);
            return;
        }

        const channel = this._getServerChannel(serverID);

        if (!channel) return;

        const roleToMention = [];

        if (manhwa.Role.IsDefined()) roleToMention.push(manhwa.Role.Format());

        if ((server.MentionAllRoles || roleToMention.length === 0) && server.DefaultRole.IsDefined())
        {
            roleToMention.push(server.DefaultRole.Format());
        }

        try
        {
            await channel.send({embeds: [embed], content: roleToMention.join(" ")});
        }
        catch (e)
        {
            if (`${e}`.startsWith("DiscordAPIError"))
            {
                const guild = DiscordUtility.GetGuild(serverID);
                const embed = EmbedUtility.GetWarningEmbedMessage(
                    `Discord API Error from server 🔰 ${guild !== undefined ? guild.name : `Unknown (${serverID})`} 🔰`,
                    "The bot doesn't have the permission to send messages in the channel or doesn't see it\n" +
                    `\`${e}\``
                );

                for (let admin of server.Admins)
                {
                    const user = await DiscordUtility.GetUser(admin);

                    if (user)
                    {
                        try
                        {
                            await user.send({embeds: [embed]});
                        }
                        catch (e)
                        {
                            if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                            {
                                await this.DeleteUser(admin);
                                server.Admins.splice(server.Admins.indexOf(admin), 1);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Get the server channel, send a message to all admins if the channel is not found or not defined
     * @param serverID {string} The server ID
     * @private
     */
    _getServerChannel(serverID)
    {
        const server = this._servers[serverID];
        const guild = DiscordUtility.GetGuild(serverID);
        const embed = EmbedUtility.GetWarningEmbedMessage("Channel error on server " + (guild !== undefined ? guild.name : "Unknown (ID: " + serverID + ")"));

        const SendError = (message) =>
        {
            embed.setDescription(message + "\nYou receive this message because you are an admin of this server.");
            embed.setFooter({text: `If you want to disable this warning, use the command \`/Settings\` to disable these warnings`});

            for (let userID of server.Admins)
            {
                try
                {
                    DiscordUtility.GetUser(userID).then(async user =>
                    {
                        if (!user) return;

                        try
                        {
                            await user.send({embeds: [embed]});
                        }
                        catch (e)
                        {
                            if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                            {
                                await this.DeleteUser(userID);
                                server.Admins.splice(server.Admins.indexOf(userID), 1);
                            }
                        }
                    });
                }
                catch (e) {}
            }
        }

        if (!server.Channel.IsDefined())
        {
            SendError("The channel where to publish new chapters is not defined.");

            return null;
        }

        const channel = DiscordUtility.GetChannel(server.Channel.Id);

        if (!channel)
        {
            SendError("The channel where to publish new chapters doesn't exist anymore.");

            return null;
        }

        return channel;
    }

    /**
     * Get the new chapters for the manhwa, update the cache, the users and the unread chapters
     * @param manhwa {Manhwa} The manhwa
     * @param cache {ScrapInfo[]} The cache
     * @param users {string[]} The users
     * @param serverID {string} The server ID if the manhwa is from a server
     * @return {Promise<string[]>} The new chapters, already reversed
     * @private
     */
    async _getNewChaptersForManhwa(manhwa, cache, users, serverID = "")
    {
        const url = manhwa.Url.replace(/--/g, "-");
        const websiteName = Utils.getWebsiteNameFromUrl(url);

        if (ManhwaNotifier.WebsitesDown.includes(websiteName)) return [];

        const cachedScrap = cache.filter(scrap => scrap.StartUrl === url || scrap.FinalUrl === url);
        const scrapInfo = cachedScrap.length > 0 ? cachedScrap[0] : await this._tryToScrapManhwa(url, users, serverID);

        if (scrapInfo === null) return [];
        if (cachedScrap.length === 0) cache.push(scrapInfo);
        // If the chapter get contains GitHub, then continue
        if (scrapInfo.ChaptersUrls[0].includes("github.com")) return [];

        if (scrapInfo.IsImageValid())
        {
            manhwa.Image = scrapInfo.Image;
        }

        manhwa.Description = scrapInfo.Description;
        manhwa.Name = scrapInfo.Name;

        if (serverID === "")
        {
            const user = this._users[users[0]];

            if (user.UnreadEnabled)
            {
                this._updateUnreadChaptersForUser(users[0], manhwa, scrapInfo.ChaptersUrls);
            }
        }

        /** @type {string[]} */
        let newChapters = [];
        /** @type {UnreadChapter[]} */
        const futureUnread = [];

        for (let url of scrapInfo.ChaptersUrls)
        {
            const formattedUrl = Utils.formatChapterFromURL(url);

            if (formattedUrl === Utils.formatChapterFromURL(manhwa.Chapter) || formattedUrl === Utils.formatChapterFromURL(manhwa.PreviousChapter))
            {
                break;
            }

            newChapters.push(url);
            futureUnread.push(new UnreadChapter().From(manhwa.Name, url, manhwa.Image));
        }

        if (serverID === "")
        {
            const user = this._users[users[0]];

            if (user.UnreadEnabled)
            {
                user.UnreadChapters.push(...futureUnread.reverse());
            }
        }

        manhwa.Chapter = scrapInfo.ChaptersUrls[0];
        manhwa.PreviousChapter = scrapInfo.ChaptersUrls[1];

        newChapters = newChapters.reverse();

        return newChapters;
    }

    /**
     * Update the unread chapters for the user if the link to them has changed
     * @param userID {string} The user ID
     * @param manhwa {Manhwa} The manhwa to update
     * @param chapters {string[]} The chapters urls, not reversed, not new chapters, just chapters from scrapInfo
     * @private
     */
    _updateUnreadChaptersForUser(userID, manhwa, chapters)
    {
        const user = this._users[userID];
        const unread = user.UnreadChapters.filter(unreadChapter =>
            Utils.formatTitle(manhwa.Name) === Utils.formatTitle(unreadChapter.Name)
        );

        if (unread.length === 0) return;

        for (let newUrl of chapters)
        {
            // Check if the chapter is already in the unread list, then check if the url is the same, otherwise, replace it
            const unreadChapters = unread.filter(unreadChapter =>
                Utils.formatChapterFromURL(unreadChapter.Url) === Utils.formatChapterFromURL(newUrl)
            );

            if (unreadChapters.length === 0) break;

            const manhwaUnread = unreadChapters[0];

            if (manhwaUnread.Url !== newUrl)
            {
                user.UnreadChapters.find(unreadChapter => unreadChapter.Url === manhwaUnread.Url).Url = newUrl;
            }
        }
    }

    async StartCheckOfAllManhwas()
    {
        const dateFrom12hrs = new Date() - 43200000;
        const dateFrom1Week = new Date() - 604800000;
        const dateFrom1Month = new Date() - 2592000000;
        /** @type {ScrapInfo[]} */
        const cache = [];
        /** @type {number} */
        let currentUserIndex = 0;
        /** @type {number} */
        let currentServerIndex = 0;

        ManhwaNotifier.LastCheckStep = "Check ids";

        await this._replaceAllIdFromLuminous();
        await this._replaceAllIdFromAsura(await Utils.GetAsuraLastManhwa());
        await this._replaceAllIdFromReaperScans(await Utils.GetReaperLastManhwas());

        ManhwaNotifier.LastCheckStep = "Begin server check";

        const serverIDs = Object.keys(this._servers);

        for (let serverID of serverIDs)
        {
            currentServerIndex++;

            const server = this._servers[serverID];
            const manhwas = server.Manhwas;
            const channel = this._getServerChannel(serverID);

            // Check that all admins are also users, if not remove them from the server
            const adminToRemove = [];

            for (let admin of server.Admins)
            {
                if (!this._users[admin])
                {
                    adminToRemove.push(admin);
                }
            }

            server.Admins = server.Admins.filter(admin => !adminToRemove.includes(admin));

            if (!channel)
            {
                ManhwaNotifier.TotalCheckManhwas += manhwas.length;
                continue;
            }

            for (let manhwa of manhwas)
            {
                ManhwaNotifier.LastCheckStep = `Server ${currentServerIndex}/${Object.keys(this._servers).length} - (${manhwas.indexOf(manhwa)}/${manhwas.length} manhwas)`;
                ManhwaNotifier.TotalCheckManhwas++;

                const newChapters = await this._getNewChaptersForManhwa(manhwa, cache, server.Admins, serverID);

                if (newChapters.length === 0) continue;
                if (manhwa.Name === "") continue;

                try
                {
                    const embed = this._getNewChaptersEmbed(newChapters, manhwa);

                    await this._sendNewChaptersToServer(embed, newChapters, manhwa, serverID);
                }
                catch (e) {}

                if (!this.ExistsServer(serverID)) break;
            }
        }

        const userIDs = Object.keys(this._users);

        for (let userID of userIDs)
        {
            currentUserIndex++;

            const user = this._users[userID];
            const manhwas = user.Manhwas;

            if (user.UnreadEnabled && user.UnreadChapters.length > 5000)
            {
                const embed = EmbedUtility.GetWarningEmbedMessage("⚠️ Too many unread chapters");

                embed.setDescription(
                    "You have more than 5000 chapters unread, please mark some of them as read to avoid any issue or disable the unread list feature in `/settings`.\n" +
                    "Until you do so, you will not receive any new chapters notifications."
                );

                await (await DiscordUtility.GetUser(userID)).send({embeds: [embed]});
                continue;
            }

            // If the user has not been active the last month, don't check
            if (user.LastActionDate < dateFrom1Month)
            {
                ManhwaNotifier.TotalCheckManhwas += manhwas.length;
                continue;
            }

            for (let manhwa of manhwas)
            {
                ManhwaNotifier.LastCheckStep = `User ${currentUserIndex}/${Object.keys(this._users).length} - (${manhwas.indexOf(manhwa)}/${manhwas.length} manhwas)`;
                ManhwaNotifier.TotalCheckManhwas++;

                const newChapters = await this._getNewChaptersForManhwa(manhwa, cache, [userID]);

                if (newChapters.length === 0) continue;
                if (manhwa.Name === "") continue;

                try
                {
                    const embed = this._getNewChaptersEmbed(newChapters, manhwa);

                    await this._sendNewChaptersToUser(embed, newChapters, manhwa, userID);
                }
                catch (e) {}

                if (!this._users[userID]) break;
            }
        }

        await Utils.RestartBrowser();
    }

    /**
     * Fix urls and many things before the update
     * 1. Replace double // by / (except for https://)
     * 2. Clear the unread chapters if the unread is disabled
     * 3. Remove admins from server that are not users
     * 4. Remove manhwa/unread chapters with too long names or links
     */
    async CorrectDataStored()
    {
        const maxGlobalLength = 500;
        const maxLinkLength = 1000;
        /** @type {(manhwas: Manhwa[] || UnreadChapter[]) => void} */
        const FixManhwa = (manhwas) =>
        {
            for (let i = 0; i < manhwas.length; i++)
            {
                const manhwa = manhwas[i];

                if (manhwa.Url.length > maxGlobalLength || manhwa.Name > maxGlobalLength || manhwa.Image.length > maxLinkLength)
                {
                    manhwas.splice(i, 1);
                    i--;
                    continue;
                }

                manhwa.Url = manhwa.Url.replace(/([^:]\/)\/+/g, "$1");
            }
        }

        for (let serverID in this._servers)
        {
            const server = this._servers[serverID];

            // Check if the server is accessible
            try
            {
                const guild = await ManhwaNotifier.Instance.DiscordClient.guilds.fetch(serverID);

                if (!guild)
                {
                    delete this._servers[serverID];
                    continue;
                }
            }
            catch (e)
            {
                delete this._servers[serverID];
                continue;
            }

            // Check that all admins are also users, if not remove them from the server
            const adminToRemove = [];

            for (let admin of server.Admins)
            {
                if (!this._users[admin])
                {
                    adminToRemove.push(admin);
                }
            }

            server.Admins = server.Admins.filter(admin => !adminToRemove.includes(admin));

            FixManhwa(server.Manhwas);
        }

        for (let userID in this._users)
        {
            const user = this._users[userID];

            if (!user.UnreadEnabled)
            {
                user.UnreadChapters = [];
            }

            FixManhwa(user.Manhwas);
            FixManhwa(user.UnreadChapters);
        }
    }

    async SendChangelogToAll(version, content)
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage(`📰 ${version}`, content);

        embed.setFooter({text: "If you want to disable this message, use the command `/Settings` to disable the changelog"});

        for (let userID in this._users)
        {
            const user = this._users[userID];

            if (!user.ReceiveChangelog) continue;

            try
            {
                await (await DiscordUtility.GetUser(userID)).send({embeds: [embed]});
            }
            catch (e)
            {
                if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                {
                    await this.DeleteUser(userID);
                }
            }
        }

        if (!this._botInfos.ChangelogChannel.IsDefined()) return;

        // Then, send it in bot info changelog channel
        const channel = DiscordUtility.GetChannel(this._botInfos.ChangelogChannel.Id);

        if (!channel) return;

        try
        {
            channel.send({embeds: [embed]});
        }
        catch (e)
        {
            if (`${e}`.startsWith("DiscordAPIError"))
            {
                const embed = EmbedUtility.GetWarningEmbedMessage("Discord API Error", "The bot doesn't have the permission to send messages in the channel or doesn't see it\n" +
                    `\`${e}\``);

                await Logger.LogEmbed(embed);
            }
        }
    }

    async SendBroadcastToAll(title, content)
    {
        const embed = EmbedUtility.GetNeutralEmbedMessage(`📰 ${title}`, content);

        for (let userID in this._users)
        {
            try
            {
                await (await DiscordUtility.GetUser(userID)).send({embeds: [embed]});
            }
            catch (e)
            {
                if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                {
                    await this.DeleteUser(userID);
                }
            }
        }
    }

    /**
     * Send a poll to all users and update the poll message with the results
     * @param question The question of the poll
     * @param answers The answers of the poll
     * @param receiver Where to send the poll responses
     * @return {Promise<void>}
     */
    async SendPollToAll(question, answers, receiver)
    {
        const userEmbed = EmbedUtility.GetNeutralEmbedMessage("📊 Poll", question);
        const userComponents = [new ActionRowBuilder()];
        const responseEmbed = EmbedUtility.GetGoodEmbedMessage("📊 Poll results", "Thanks for your participation!");
        const responses = [];

        userEmbed.setFooter({text: "24 hours to respond. If you don't want to participate to any polls, you can disable it in `/Settings`"});

        for (let answer of answers)
        {
            userComponents[0].addComponents(
                new ButtonBuilder()
                    .setLabel(answer)
                    .setEmoji({name: DataController.Emoji1to10[answers.indexOf(answer)]})
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(answer)
            );

            responses.push(0);
        }

        responses.push(0);

        userComponents.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Custom response")
                .setEmoji({name: "📝"})
                .setStyle(ButtonStyle.Secondary)
                .setCustomId("custom-response")
        ));

        let totalUsers = 0;
        const fields = [];
        const UpdateFields = () =>
        {
            if (fields.length === 0)
            {
                for (let i = 0; i < responses.length; i++)
                {
                    fields.push({name: "0", value: "0"});
                }
            }

            for (let i = 0; i < responses.length - 1; i++)
            {
                fields[i].name = answers[i];
                fields[i].value = responses[i].toString();
            }

            fields[responses.length - 1].name = "Custom response";
            fields[responses.length - 1].value = responses[responses.length - 1].toString();
        };
        const GetUpdateEmbed = () =>
        {
            const embed = EmbedUtility.GetNeutralEmbedMessage(`📊 Poll | ${responses.reduce((a, b) => a + b, 0)}/${totalUsers}`, question);

            embed.addFields(...fields);

            return embed;
        };
        const UpdateResponseEmbed = () =>
        {
            responseEmbed.data.fields = [];
            responseEmbed.addFields(...fields);
        };
        const Update = async (userMessage) =>
        {
            UpdateFields();
            UpdateResponseEmbed();

            await updatedMessage.edit(EmbedUtility.FormatMessageContent(GetUpdateEmbed()));
            await userMessage.edit({embeds: [responseEmbed], components: []});
        };

        UpdateFields();

        const updatedMessage = await receiver.send(EmbedUtility.FormatMessageContent(GetUpdateEmbed()));

        for (let userID in this._users)
        {
            const user = this._users[userID];

            if (!user.ShowPolls) continue;

            totalUsers++;

            try
            {
                const userMessage = await (await DiscordUtility.GetUser(userID)).send({embeds: [userEmbed], components: userComponents});
                const collector = userMessage.createMessageComponentCollector({time: 1000 * 60 * 60 * 24});

                collector.on("collect", async interaction =>
                {
                    if (interaction.user.id !== userID)
                    {
                        await interaction.deferUpdate();
                        return;
                    }

                    if (answers.includes(interaction.customId))
                    {
                        responses[answers.indexOf(interaction.customId)]++;
                    }

                    if (interaction.customId === "custom-response")
                    {
                        // Show modal to ask the custom response
                        const modal = new ModalBuilder()
                            .setCustomId("custom-modal")
                            .setTitle("Custom response");

                        modal.addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId(`response`)
                                    .setLabel("Explain your response")
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setMinLength(1)
                                    .setMaxLength(500)
                                    .setRequired(true)
                            )
                        );

                        await interaction.showModal(modal);

                        const submit = await interaction.awaitModalSubmit({time: 1000 * 60 * 60});

                        if (submit)
                        {
                            const response = submit.fields.getTextInputValue("response");

                            // Send response to the receiver
                            const responseEmbed = EmbedUtility.GetNeutralEmbedMessage("📊 Poll custom response from " + interaction.user.username, response);

                            responses[responses.length - 1]++;
                            await receiver.send({embeds: [responseEmbed]});
                            await DiscordUtility.Defer(submit);
                        }
                        else return;
                    }

                    await Update(userMessage);
                    await DiscordUtility.Defer(interaction);

                    collector.stop();
                });
            }
            catch (e)
            {
                if (`${e}` === "DiscordAPIError: Cannot send messages to this user")
                {
                    await this.DeleteUser(userID);
                }
            }
        }
    }

    _generateNewUniqueCode()
    {
        const code = StringUtility.GetRandomString(Code.MaxLength);

        if (this._codesAssociation[code] !== undefined)
        {
            return this._generateNewUniqueCode();
        }

        return code;
    }
}