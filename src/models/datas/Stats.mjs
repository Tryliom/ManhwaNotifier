export class Stats
{
    /** @type {number} */
    TotalUsers
    /** @type {number} */
    TotalServers
    /** @type {number} */
    TotalServerManhwas
    /** @type {number} */
    TotalUniqueManhwas
    /** @type {number} */
    TotalManhwas
    /** @type {number} */
    UsersActiveLastDay
    /** @type {number} */
    UsersActiveLastWeek

    constructor()
    {
        this.TotalUsers = 0;
        this.TotalServers = 0;
        this.TotalServerManhwas = 0
        this.TotalUniqueManhwas = 0
        this.TotalManhwas = 0;
        this.UsersActiveLastDay = 0;
        this.UsersActiveLastWeek = 0;
    }

    AddToEmbed(embed)
    {
        embed.setDescription(
          `👥 Total Users: ${this.TotalUsers}\n` +
            `🛡️ Total Servers: ${this.TotalServers}\n\n` +
            `📚 Total Server Manhwas: ${this.TotalServerManhwas}\n` +
            `📚 Total Unique Manhwas: ${this.TotalUniqueManhwas}\n` +
            `📚 Total Manhwa: ${this.TotalManhwas}\n\n` +
            `🔍 Active Users Last Day: ${this.UsersActiveLastDay}\n` +
            `🔍 Active Users Last Week: ${this.UsersActiveLastWeek}`
        );
    }
}