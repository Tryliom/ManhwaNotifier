/**
 * A class that contains the id of a channel.
 */
export class ChannelId
{
    /** @type {string} */
    Id = ""

    constructor()
    {
        this.Id = "";
    }

    FromJson(data)
    {
        this.Id = data.Id;

        return this;
    }

    SetChannel(value)
    {
        this.Id = value;
    }

    Reset()
    {
        this.Id = "";
    }

    IsDefined()
    {
        return this.Id !== "";
    }

    /**
     * Formats the channel id to be displayed in a message. If the channel id is not defined, it will return "Not defined".
     * @return {string}
     */
    Format()
    {
        if (!this.IsDefined()) return "Not defined";

        return `<#${this.Id}>`;
    }
}