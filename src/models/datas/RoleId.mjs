/**
 * A class that contains the id of a role.
 */
export class RoleId
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

    SetRole(value)
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
     * Formats the role id to be displayed in a message. If the role id is not defined, it will return "Not defined".
     * @return {string}
     */
    Format()
    {
        if (!this.IsDefined()) return "Not defined";

        return `<@&${this.Id}>`;
    }
}