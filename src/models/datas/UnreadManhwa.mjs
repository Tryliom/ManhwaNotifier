export class FormattedUrl
{
    /** @type {string} */
    Url = ""
    /** @type {string} */
    Name = ""

    constructor()
    {
        this.Url = "";
        this.Name = "";
    }

    From(url, name)
    {
        this.Url = url;
        this.Name = name;

        return this;
    }
}

/**
 * Only used before to store the unread chapters of a manhwa
 */
export class UnreadManhwa
{
    /** @type {string} */
    Name = ""
    /**
     * @brief The URL of the manhwa in the order, like 1 to 10
     * @type {FormattedUrl[]} */
    OrderedUrls = []
    /** @type {string} */
    Image = ""

    constructor()
    {
        this.Name = "";
        this.OrderedUrls = [];
        this.Image = "";
    }

    From(name, urls, image)
    {
        this.Name = name;
        this.OrderedUrls = urls.map(u => new FormattedUrl().From(u.Url, u.Name));
        this.Image = image;

        return this;
    }

    IsImageValid()
    {
        return this.Image !== "" && this.Image.startsWith("http");
    }
}