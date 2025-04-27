import {MatchType} from "../MatchType.mjs";
import {Utils} from "../../utility/Utils.mjs";

/**
 * Used to store all the occurrences of a manhwa with the same name and some stats
 */
export class LibraryManhwa
{
    /** @type {string} */
    Name = ""
    /** @type {string[]} */
    Urls = []
    /** @type {string[]} */
    LastChapters = []
    /** @type {string} */
    Image = ""
    /** @type {string} */
    Description = ""

    // Stats
    /** @type {number} */
    Readers = 0
    /** @type {number} */
    Servers = 0

    constructor()
    {
        this.Name = "";
        this.Urls = [];
        this.LastChapters = [];
        this.Image = "";
        this.Description = "";

        this.Readers = 0;
        this.Servers = 0;
    }

    From(name, urls, lastChapters, image, description)
    {
        this.Name = name;
        this.Urls = urls;
        this.LastChapters = lastChapters;
        this.Image = image;
        this.Description = description;
    }

    /**
     * Get the match type between this manhwa and another one
     * @param otherManhwa {Manhwa} The manhwa to compare with
     * @returns {number} The match type
     */
    GetMatchType(otherManhwa)
    {
        if (Utils.formatTitle(this.Name) !== Utils.formatTitle(otherManhwa.Name))
        {
            return MatchType.Not;
        }

        if (this.Urls.filter(url => Utils.getWebsiteNameFromUrl(otherManhwa.Url) === Utils.getWebsiteNameFromUrl(url)).length > 0)
        {
            return MatchType.Full;
        }

        return MatchType.Partial;
    }

    IsImageValid()
    {
        return this.Image !== "" && this.Image.startsWith("http");
    }
}