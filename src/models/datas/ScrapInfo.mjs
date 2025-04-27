import {ScrapStatusType} from "../ScrapStatusType.mjs";
import {Utils} from "../../utility/Utils.mjs";

export class ScrapInfo
{
    /** @type {string} */
    Name = ""
    /** @type {string} */
    Description = ""
    /** @type {string} */
    Image = ""
    /**
     * @brief The URL given at the start of the scrap.
     * @type {string}
     */
    StartUrl = ""
    /**
     * @brief The URL after redirections of the scrap.
     * @type {string}
     */
    FinalUrl = ""
    /** @type {string[]} */
    ChaptersUrls = []

    // Errors
    /** @type {number} */
    Status = 0
    /** @type {string} */
    StatusType = ScrapStatusType.Unknown
    /** @type {string} */
    CustomErrorMessage = ""

    From(/** @type {ScrapInfo} */ other)
    {
        this.Name = other.Name;
        this.Description = other.Description;
        this.Image = other.Image;
        this.StartUrl = other.StartUrl;
        this.FinalUrl = other.FinalUrl;
        this.ChaptersUrls = other.ChaptersUrls;
        this.Status = other.Status;
        this.StatusType = other.StatusType;
        this.CustomErrorMessage = other.CustomErrorMessage;

        return this;
    }

    /**
     * @brief Clean the final data, like replacing space by %20.
     */
    FinalClean()
    {
        if (this.Image !== "")
        {
            this.Image = this.Image.replace(/ /g, "%20");
            //this.Image = this.Image.substring(this.Image.lastIndexOf("https://"), this.Image.length);
        }

        this.Description = this.Description.trim().replace(/\t|Read more$/g, "").trim();
        this.Name = this.Name.replace(/\n|\t|^NEW|^HOT| – Manhwa/gm, "").trim();

        if (this.Name === "")
        {
            this.Name = Utils.formatTitle(this.FinalUrl.split("/").pop());
        }

        this.StatusType = ScrapStatusType.Success;
    }

    IsImageValid()
    {
        return this.Image !== "" && this.Image.startsWith("http");
    }
}