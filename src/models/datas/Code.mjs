import {time} from "discord.js";

export class Code
{
    static TimeLimits = ["1 hour", "12 hours", "1 day", "7 days", "30 days", "No limit"];
    static MaxCodes = 5;
    static MaxLength = 16;

    /** @type {string} */
    Id = ""
    /** @type {string} */
    LimitDate = ""
    /** @type {number} */
    UseTimes

    constructor(id)
    {
        this.Id = id;
        this.LimitDate = "";
        this.UseTimes = 0;
    }

    FromJson(data)
    {
        this.Id = data.Id;
        this.LimitDate = data.LimitDate;
        this.UseTimes = data.UseTimes;

        return this;
    }

    ChangeCode(newId)
    {
        this.Id = newId;

        return this;
    }

    Use()
    {
        this.UseTimes++;
    }

    FormatDate()
    {
        if (this.LimitDate === "")
        {
            return "No expiration";
        }

        return `Expire ${time(new Date(this.LimitDate), "R")}`;
    }

    IsExpired()
    {
        if (this.LimitDate === "") return false;

        return new Date(this.LimitDate) < new Date();
    }

    /**
     * Get the time limit in date format
     * @param timeLimit
     * @returns {string}
     */
    static GetTimeLimit(timeLimit)
    {
        switch (timeLimit)
        {
            case Code.TimeLimits[0]:
                return new Date(new Date().getTime() + 60 * 60 * 1000).toISOString();
            case Code.TimeLimits[1]:
                return new Date(new Date().getTime() + 12 * 60 * 60 * 1000).toISOString();
            case Code.TimeLimits[2]:
                return new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString();
            case Code.TimeLimits[3]:
                return new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            case Code.TimeLimits[4]:
                return new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
            default:
                return "";
        }
    }
}