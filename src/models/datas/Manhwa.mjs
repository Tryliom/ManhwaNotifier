import { RoleId } from "./RoleId.mjs";
import {Utils} from "../../utility/Utils.mjs";
import {MatchType} from "../MatchType.mjs";

export class Manhwa
{
    /** @type {string} */
    Name = ""
    /** @type {string} */
    Url = ""
    /** @type {string} */
    Chapter = ""
    /** @type {string} */
    PreviousChapter = ""
    /** @type {string} */
    Image = ""
    /** @type {string} */
    Description = ""

    // Only used in server
    /** @type {RoleId} */
    Role = new RoleId()

    constructor()
    {
        this.Name = "";
        this.Url = "";
        this.Chapter = "";
        this.PreviousChapter = "";
        this.Image = "";
        this.Description = "";
        this.Role = new RoleId();
    }

    FromJson(data)
    {
        if (data.url)
        {
            data.Name = data.name;
            data.Url = data.url;
            data.Chapter = data.chapter;
            data.PreviousChapter = data.previousChapter;
            data.Image = data.imageURL || "";
            data.Description = data.description;
            data.Role = new RoleId();
        }

        this.Name = data.Name;
        this.Url = data.Url;
        this.Chapter = data.Chapter;
        this.PreviousChapter = data.PreviousChapter;
        this.Image = data.Image;
        this.Description = data.Description;
        this.Role = new RoleId().FromJson(data.Role);

        return this;
    }

    From(name, url, chapter, image, description)
    {
        this.Name = name;
        this.Url = url;
        this.Chapter = chapter;
        this.Image = image;
        this.Description = description;

        return this;
    }

    IsRecognized()
    {
        return Utils.formatChapterFromURL(this.Chapter) !== "Chapter ?" && this.Name !== "" && this.Url !== "";
    }

    IsImageValid()
    {
        return this.Image !== "" && this.Image.startsWith("http");
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

        if (Utils.getWebsiteNameFromUrl(otherManhwa.Url) === Utils.getWebsiteNameFromUrl(this.Url))
        {
            return MatchType.Full;
        }

        return MatchType.Partial;
    }
}