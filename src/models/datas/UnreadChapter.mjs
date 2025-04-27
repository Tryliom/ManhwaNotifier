export class UnreadChapter
{
    /** @type {string} */
    Name = ""
    /** @type {string} */
    Url = ""
    /** @type {string} */
    Image = ""

    constructor()
    {
        this.Name = "";
        this.Url = "";
        this.Image = "";
    }

    FromJson(data)
    {
        if (data.url)
        {
            data.Name = data.name;
            data.Url = data.url;
            data.Image = data.imageURL || "";
        }

        this.Name = data.Name;
        this.Url = data.Url;
        this.Image = data.Image;

        return this;
    }

    From(name, url, image)
    {
        this.Name = name;
        this.Url = url;
        this.Image = image;

        return this;
    }
}