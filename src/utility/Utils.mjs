import {Filter, LibraryFilter} from "../models/Filter.mjs";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import {ScrapInfo} from "../models/datas/ScrapInfo.mjs";
import {ScrapStatusType} from "../models/ScrapStatusType.mjs";

const SupportedWebsites = [
    "https://asuracomic.net/series/",
    "https://manhuaplus.com/manga/",
    "https://manhwabuddy.com/manhwa/",
    "https://kingofshojo.com/manga/",
    "https://toonclash.com/manga/",
    "https://mangabuddy.com/",
    "https://arenascan.com/manga/"
];

const titleFormat = /[\[\]',.’`?!()\n&:\/\\]/g;

export class Utils
{
    static MainBrowser
    /**
     * @brief The browser used when the main is being restarted
     */
    static ReplacementBrowser
    /** @type {string[]} */
    static WebsitesThatNeedToUseNetworkIdle2

    static getFormattedSupportedWebsite()
    {
        return SupportedWebsites.map(site => this.getWebsiteNameFromUrl(site)).join(", ");
    }

    static getWebsiteNameFromUrl(url)
    {
        try
        {
            const urlPart = url.split("/")[2].split("\.");
            let title = "";

            // Add each part of the url to the title except the last one
            for (let i = 0; i < urlPart.length - 1; i++)
            {
                if (urlPart[i] === "www") continue;

                if (title === "") title = urlPart[i].substring(0, 1).toUpperCase() + urlPart[i].substring(1);
                else title += " " + urlPart[i].substring(0, 1).toUpperCase() + urlPart[i].substring(1);
            }

            return title;
        }
        catch (e)
        {
            return "???";
        }
    }

    static getUrlWithChapter(urls, chapter)
    {
        const validChapters = urls.filter(item =>
            item.replace(/\./g, "")
                .replace(/\W/g, " ")
                .includes(`${urls[0].includes("chapter") ? "chapter" : "chap"} ${chapter.replace("chapter-", "")}`));

        return validChapters.length > 0 ? validChapters[validChapters.length - 1] : null;
    }

    /**
     * Get information about a manhwa
     * @param values {{name, site, chapter}}
     * @returns {Promise<ScrapInfo>}
     */
    static async SearchManhwa(values)
    {
        let supportedWebsites = SupportedWebsites;
        const isUrl = values.name.startsWith("http");
        let titleURL = values.name.replace(/ /g, "-").replace(titleFormat, "").toLowerCase();

        if (titleURL === "" || values.name === "")
        {
            const scrapInfo = new ScrapInfo();

            scrapInfo.StatusType = ScrapStatusType.Unknown;
            scrapInfo.CustomErrorMessage = "Title is empty";

            return scrapInfo;
        }

        if (values.site)
        {
            const site = values.site.toLowerCase();
            supportedWebsites = supportedWebsites.sort((a, b) => a.includes(site) ? -1 : b.includes(site) ? 1 : 0);
        }

        if (isUrl)
        {
            return await Utils.getAllInfo(values.name);
        }
        else
        {
            let currentURL = "";

            for (let key in supportedWebsites)
            {
                let url = supportedWebsites[key];
                currentURL = url + titleURL;
                const scrapInfo = await Utils.getAllInfo(currentURL);

                if (scrapInfo.StatusType !== ScrapStatusType.Success) continue;

                return scrapInfo;
            }
        }

        return null;
    }

    /**
     *
     * @param title {string}
     * @param siteToIgnore {string}
     * @param callback= {Function<{chapters: array, name: string, imageURL: string, description: string, url: string}>}
     * @returns {Promise<ScrapInfo[]>}
     */
    static async getAllWebsiteForTitle(title, siteToIgnore = "", callback = () => {})
    {
        const listURL = SupportedWebsites.filter(item => siteToIgnore === "" || !item.includes(siteToIgnore));
        let titleURL = title.replace(/ /g, "-").replace(titleFormat, "").toLowerCase();
        let scrapInfos = [];

        for (let url of listURL)
        {
            let finalUrl = url;

            if (url.includes("asura"))
            {
                finalUrl += titleURL + "-1f72d8f2";
            }
            else
            {
                finalUrl += titleURL;
            }

            const scrapInfo = await Utils.getAllInfo(finalUrl);

            if (scrapInfo.StatusType !== ScrapStatusType.Success) continue;

            scrapInfos.push(scrapInfo);
            callback(scrapInfo);
        }

        return scrapInfos;
    }

    static isSupported(url)
    {
        let name = Utils.getWebsiteNameFromUrl(url).toLowerCase();
        return SupportedWebsites.filter(url => url.includes(name)).length > 0;
    }

    static removeRow(userId, list, name, chapterURL = null)
    {
        let newList = [];
        for (let k in list)
        {
            const elem = list[k];

            if (this.formatTitle(elem.name).toLowerCase() !== this.formatTitle(name).toLowerCase() || (chapterURL != null && elem.url !== chapterURL))
                newList.push(elem);
        }

        return newList;
    }

    static formatTitle(title)
    {
        let titleSplit = title.toLowerCase().replace(/-/g, " ").replace(titleFormat, "").split(" ");

        for (let k in titleSplit)
        {
            let elem = titleSplit[k];
            titleSplit[k] = this.toUppercaseFirstLetter(elem);
        }

        return titleSplit.join(" ").replace(/  /g, " ");
    }

    static toUppercaseFirstLetter(text)
    {
        return text.substring(0, 1).toUpperCase() + text.substring(1, text.length);
    }

    static initPuppeteer()
    {
        const stealth = StealthPlugin()
        stealth.enabledEvasions.delete('user-agent-override')
        puppeteer.use(stealth);
        puppeteer.use(AdblockerPlugin());

        Utils.WebsitesThatNeedToUseNetworkIdle2 = [];
    }

    static async RestartBrowser()
    {
        Utils.ReplacementBrowser = await Utils.OpenNewBrowser();
        Utils.MainBrowser.close();
        Utils.MainBrowser = Utils.ReplacementBrowser;
        Utils.ReplacementBrowser = null;
    }

    static async StartMainBrowser()
    {
        Utils.MainBrowser = await Utils.OpenNewBrowser();
    }

    static async OpenNewBrowser()
    {
        return await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--deterministic-fetch",
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
            ],
            timeout: 120000
        });
    }

    static _getCurrentBrowser()
    {
        return Utils.ReplacementBrowser ? Utils.ReplacementBrowser : Utils.MainBrowser;
    }

    static async getNewPage(url)
    {
        if (Utils.MainBrowser == null) await Utils.StartMainBrowser();

        const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36";
        const page = await this._getCurrentBrowser().newPage();

        await page.setExtraHTTPHeaders({'Accept-Language': 'en-US,en;q=0.9'});
        await page.setUserAgent(ua);
        await page.setCookie({
            name: "wpmanga-adault",
            value: "1",
            domain: url
        });
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(30000);

        return page;
    }

    /**
     * Get the current id for a website, just keep it for the example
     * @param websiteUrl {string} Url checked
     * @returns {Promise<string | null>} Return null if the website is not supported, else return the {manhwa id, chapter id}
     */
    static async getCurrentIdFor(websiteUrl)
    {
        const page = await Utils.getNewPage(websiteUrl);

        try
        {
            await page.goto(websiteUrl, {waitUntil: "networkidle2", timeout: 30000});
            await page.waitForSelector('body');

            const id = await page.evaluate(() =>
            {
                let classes = document.getElementsByClassName("listupd");

                if (classes.length > 0)
                {
                    classes = classes[1].children;
                }
                else return null;

                let id = "";

                for (let item of classes)
                {
                    const manhwa = item.firstElementChild.children[1].firstElementChild.getAttribute("href");

                    const manhwaIdPart = manhwa.split("/")[4];

                    if (!id || isNaN(parseInt(id)) || id.length === 0)
                    {
                        id = manhwaIdPart.split("-")[0];
                    }

                    if (!isNaN(parseInt(id)))
                    {
                        return id;
                    }
                }

                return id;
            });

            await page.close();

            return id;
        }
        catch (e)
        {
            await page.close();

            console.log(e);

            return null;
        }
    }

    /**
     * Get all last manhwa updated from Asura website with their current id
     * @return {Promise<[{url: string, id: string}]>}
     */
    static async GetAsuraLastManhwa()
    {
        const page = await Utils.getNewPage("https://asuracomic.net/");

        try
        {
            await page.goto("https://asuracomic.net/", {waitUntil: "networkidle2", timeout: 30000});
            await page.waitForSelector('body');

            const list = await page.evaluate(() =>
            {
                let list = [];
                let classes = document.getElementsByClassName("grid grid-rows-1 grid-cols-1 sm:grid-cols-2 bg-[#222222] p-3 pb-0");

                if (classes.length === 0) return list;

                const returnFirstHref = (node) =>
                {
                    if (node.href && !list.includes(node.href))
                    {
                        return node.href;
                    }

                    if (node.children.length > 0)
                    {
                        for (let item of node.children)
                        {
                            const result = returnFirstHref(item);

                            if (result) return result;
                        }
                    }
                    else return null;
                }

                for (let item of classes[0].children)
                {
                    const manhwa = returnFirstHref(item);
                    const manhwaIdPart = manhwa.split("/")[4];
                    const manhwaParts = manhwaIdPart.split("-");

                    list.push({url: manhwa, id: manhwaParts[manhwaParts.length - 1]});
                }

                return list;
            });

            await page.close();

            return list;
        }
        catch (e)
        {
            await page.close();

            console.log(e);

            return null;
        }
    }

    /**
     * Return data about an url
     * @param url {string}
     * @returns {Promise<ScrapInfo>}
     */
    static async getAllInfo(url)
    {
        const page = await Utils.getNewPage(url);

        try
        {
            let scrapInfo;

            /**
             * Scan the current page
             * @param waitUntil {"domcontentloaded", "load", "networkidle2", "networkidle0"}
             * @returns {Promise<ScrapInfo>}
             */
            const ScanPage = async (waitUntil) =>
            {
                let response = await page.goto(url, {waitUntil: waitUntil, timeout: 30000}).catch((reason) => console.log(reason));

                if (response === null)
                {
                    response = await page.waitForResponse(() => true, {timeout: 3000}).catch(() => null);

                    if (response === null && !url.includes("asuracomic.net"))
                    {
                        const scrapInfo = new ScrapInfo();

                        scrapInfo.StatusType = ScrapStatusType.NoResponse;

                        return scrapInfo;
                    }
                }

                await page.waitForSelector('body', {timeout: 5000});

                if (response != null && (response.status().toString().startsWith("4") || response.status().toString().startsWith("5")))
                {
                    const scrapInfo = new ScrapInfo();

                    scrapInfo.Status = response.status();
                    scrapInfo.StatusType = ScrapStatusType.StatusError;

                    return scrapInfo;
                }

                const scrapInfo = new ScrapInfo().From(await page.evaluate((url, scrapInfo) =>
                {
                    const SearchHref = (node, list) =>
                    {
                        if (node.href && !list.includes(node.href) && !node.className.includes("dload") && (!node.rel || !node.rel.includes("noreferrer noopener")))
                        {
                            list.push(node.href);
                        }

                        if (node.children.length === 0) return;

                        for (let item of node.children)
                        {
                            SearchHref(item, list);
                        }
                    }

                    // ============ Chapters
                    // Chapters possible to get by class name
                    const chaptersEntryPoints = [
                        "pl-4 pr-2 pb-4 overflow-y-auto scrollbar-thumb-themecolor scrollbar-track-transparent scrollbar-thin mr-3 max-h-[20rem] space-y-2.5", // Asura
                        "listing-chapters_wrap", "eplister", "chapter-list", "row-content-chapter", "chapter-li", "EpisodeListList__episode_list--_N3ks"
                    ];

                    let listChapters;

                    if (url.includes("bato.to"))
                    {
                        listChapters = document.getElementsByName("chapter-list")[0];
                    }
                    else
                    {
                        for (let className of chaptersEntryPoints)
                        {
                            const cn = document.getElementsByClassName(className);

                            listChapters = cn[0];

                            if (listChapters) break;
                        }
                    }

                    if (listChapters) SearchHref(listChapters, scrapInfo.ChaptersUrls);

                    if (url.includes("bato.to"))
                    {
                        scrapInfo.ChaptersUrls = scrapInfo.ChaptersUrls.reverse();
                    }

                    // ============ Image URL
                    const isAnImageFormat = item => item && (item.endsWith(".png") || item.endsWith(".jpg") || item.endsWith(".jpeg") || item.endsWith(".gif") || item.endsWith(".webp"));
                    const imageOG = document.head.querySelector("meta[property~='og:image']");
                    const imageIn = document.getElementsByClassName("summary_image")[0];
                    const roi = document.getElementById("roi");
                    const roiroi = document.getElementById("roiroi");

                    if (url.includes("bato.to"))
                    {
                        const div = document.body.firstElementChild.children[2].firstElementChild.firstElementChild.firstElementChild.firstElementChild;

                        if (div)
                        {
                            scrapInfo.Image = div.getAttribute("src");
                        }
                    }
                    else if (roiroi)
                    {
                        scrapInfo.Image = roiroi.firstElementChild.getAttribute("data-src");
                    }
                    else if (roi)
                    {
                        scrapInfo.Image = roi.firstElementChild.getAttribute("data-src");
                    }
                    else if (imageIn && (isAnImageFormat(imageIn.firstElementChild.firstElementChild.getAttribute("data-src"))
                        || isAnImageFormat(imageIn.firstElementChild.firstElementChild.getAttribute("src"))))
                    {
                        const tag = imageIn.firstElementChild.firstElementChild;
                        scrapInfo.Image = tag.getAttribute("data-src") ? tag.getAttribute("data-src") : tag.getAttribute("src");
                    }
                    else if (imageOG)
                    {
                        scrapInfo.Image = imageOG.getAttribute("content");
                    }
                    else if (url.includes("flamecomics"))
                    {
                        const list = [];
                        const gallery = document.getElementById("gallery");

                        if (gallery)
                        {
                            SearchHref(gallery, list);

                            if (list.length > 0)
                            {
                                const image = list.filter(item => isAnImageFormat(item));

                                if (image.length > 0)
                                {
                                    scrapInfo.Image = image[0];
                                }
                            }
                        }
                    }
                    else if (url.includes("reaperscans"))
                    {
                        const image = document.getElementsByClassName("p-1 bg-background rounded overflow-hidden");

                        if (image !== undefined && image.length > 0)
                        {
                            scrapInfo.Image = image[0].getAttribute("src");

                            if (scrapInfo.Image.startsWith("/"))
                            {
                                scrapInfo.Image = "https://reaperscans.com" + scrapInfo.Image;
                            }
                        }
                    }
                    else if (url.includes("asura"))
                    {
                        const asuraImage = document.getElementsByClassName("rounded mx-auto md:mx-0")[0];

                        if (asuraImage)
                        {
                            const src = asuraImage.getAttribute("src");

                            if (src.startsWith("http"))
                            {
                                scrapInfo.Image = src;
                            }
                            else
                            {
                                scrapInfo.Image = "https://asuracomic.net" + src;
                            }
                        }
                    }

                    // Description
                    const summaryContent = document.getElementsByClassName("summary__content");
                    const summaryText = document.getElementsByClassName("summary-text");
                    const mangaKaka = document.getElementById("noidungm");
                    const readManganato = document.getElementsByClassName("panel-story-info-description");
                    const mangademon = document.getElementsByClassName("description");

                    if (summaryContent.length > 0)
                    {
                        scrapInfo.Description = summaryContent[0].textContent;
                    }
                    else if (summaryText.length > 0)
                    {
                        scrapInfo.Description = summaryText[0].firstElementChild.textContent;
                    }
                    else if (mangaKaka)
                    {
                        mangaKaka.removeChild(mangaKaka.firstElementChild);
                        scrapInfo.Description = mangaKaka.textContent;
                    }
                    else if (readManganato.length > 0)
                    {
                        readManganato[0].removeChild(readManganato[0].firstElementChild);
                        scrapInfo.Description = readManganato[0].textContent;
                    }
                    else if (url.includes("reaperscans"))
                    {
                        const items = document.getElementsByClassName("col-span-12 h-full self-end bg-background lg:col-span-9 rounded p-4 order-2 lg:order-1 z-10 flex flex-col gap-3");

                        if (items.length > 0 && items[0].children !== undefined && items[0].children.length > 2)
                        {
                            scrapInfo.Description = items[0].children[2].firstElementChild.textContent;
                        }
                    }
                    else if (url.includes("manhwabuddy"))
                    {
                        const description = document.getElementsByClassName("short-desc-content")[0];

                        if (description)
                        {
                            scrapInfo.Description = description.textContent;
                        }
                    }
                    else if (url.includes("bato.to"))
                    {
                        const descriptionOG = document.head.querySelector("meta[name~='description']");

                        if (descriptionOG)
                        {
                            scrapInfo.Description = descriptionOG.getAttribute("content");
                        }
                    }
                    else if (url.includes("comic.naver"))
                    {
                        const description = document.body.getElementsByClassName("EpisodeListInfo__summary--Jd1WG")[0];

                        if (description)
                        {
                            scrapInfo.Description = description.textContent;
                        }
                    }
                    else if (url.includes("asura"))
                    {
                        const description = document.getElementsByClassName("font-medium text-sm text-[#A2A2A2]")[0];

                        if (description)
                        {
                            scrapInfo.Description = description.textContent;
                        }
                    }
                    else if (mangademon.length > 0)
                    {
                        scrapInfo.Description = mangademon[0].textContent;
                    }
                    else if (url.includes("kingofshojo"))
                    {
                        const desc = document.getElementsByClassName("entry-content entry-content-single")[0];

                        if (desc)
                        {
                            scrapInfo.Description = desc.textContent;
                        }
                    }
                    else
                    {
                        const descriptionOG = document.head.querySelector("meta[property~='og:description']");
                        if (descriptionOG)
                        {
                            scrapInfo.Description = descriptionOG.getAttribute("content");
                        }
                    }

                    // =============== Name
                    if (url.includes("mangakakalot"))
                    {
                        scrapInfo.Name = document.getElementsByClassName("manga-info-text")[0].firstElementChild.firstElementChild.textContent;
                    }
                    else if (url.includes("manganato"))
                    {
                        scrapInfo.Name = document.getElementsByClassName("story-info-right")[0].firstElementChild.textContent;
                    }
                    else if (url.includes("roliascan"))
                    {
                        scrapInfo.Name = document.getElementsByClassName("post-type-header-inner")[0].children[3].textContent;
                    }
                    else if (url.includes("flamecomics") || url.includes("radiantscans") || url.includes("arenascan"))
                    {
                        if (document.getElementsByClassName("entry-title").length > 0)
                        {
                            scrapInfo.Name = document.getElementsByClassName("entry-title")[0].textContent;
                        }
                        else if (document.getElementsByClassName("title").length > 0)
                        {
                            scrapInfo.Name = document.getElementsByClassName("title")[0].textContent;
                        }
                    }
                    else if (url.includes("asura"))
                    {
                        const titles = document.querySelector("div.grid-cols-12 div.col-span-12 > div.text-center > span");

                        scrapInfo.Name = titles.textContent;
                    }
                    else if (url.includes("manhwabuddy"))
                    {
                        scrapInfo.Name = document.getElementsByClassName("main-info-title title-bigger")[0].textContent;
                    }
                    else if (url.includes("reaperscans"))
                    {
                        const items = document.getElementsByClassName("col-span-12 h-full self-end bg-background lg:col-span-9 rounded p-4 order-2 lg:order-1 z-10 flex flex-col gap-3");

                        if (items.length > 0)
                        {
                            scrapInfo.Name = items[0].firstElementChild.firstElementChild.firstElementChild.textContent;
                        }
                    }
                    else if (url.includes("bato.to"))
                    {
                        const div = document.body.firstElementChild.children[2].firstElementChild.children[1].firstElementChild.firstElementChild.firstElementChild;

                        if (div)
                        {
                            scrapInfo.Name = div.textContent;
                        }
                    }
                    else if (url.includes("comic.naver"))
                    {
                        const ogTitle = document.head.querySelector("meta[property~='og:title']");

                        if (ogTitle)
                        {
                            scrapInfo.Name = ogTitle.getAttribute("content");
                        }
                    }
                    else if (url.includes("mgdemon"))
                    {
                        const title = document.getElementsByClassName("novel-title")[0];

                        if (title)
                        {
                            scrapInfo.Name = title.textContent;
                        }
                    }
                    else if (url.includes("kingofshojo"))
                    {
                        const title = document.getElementsByClassName("entry-title")[0];

                        if (title)
                        {
                            scrapInfo.Name = title.textContent;
                        }
                    }
                    else
                    {
                        const postTitle = document.getElementsByClassName("post-title")[0];

                        if (postTitle)
                        {
                            const h1 = postTitle.getElementsByTagName("h1")[0];

                            if (h1)
                                for (let node of h1.childNodes)
                                {
                                    if (node.nodeName === "#text")
                                    {
                                        scrapInfo.Name += node.textContent;
                                    }
                                }
                        }
                    }

                    return scrapInfo;
                }, url, JSON.parse(JSON.stringify(new ScrapInfo()))));

                scrapInfo.StartUrl = url;
                if (response != null) scrapInfo.FinalUrl = response.url();
                scrapInfo.FinalClean();

                return scrapInfo;
            };

            const websiteName = Utils.getWebsiteNameFromUrl(url);

            if (Utils.WebsitesThatNeedToUseNetworkIdle2.includes(websiteName))
            {
                scrapInfo = await ScanPage("networkidle2");
            }
            else
            {
                scrapInfo = await ScanPage("domcontentloaded");
            }

            if (scrapInfo.ChaptersUrls.length === 0)
            {
                if (!Utils.WebsitesThatNeedToUseNetworkIdle2.includes(websiteName))
                {
                    Utils.WebsitesThatNeedToUseNetworkIdle2.push(websiteName);
                    scrapInfo = await ScanPage("networkidle2");
                }

                if (scrapInfo.ChaptersUrls.length === 0)
                {
                    scrapInfo.StatusType = ScrapStatusType.NoChapters;
                    scrapInfo.CustomErrorMessage = "No chapters found";
                }
            }

            try {await page.close();} catch (e) {}

            return scrapInfo;
        }
        catch (e)
        {
            try {await page.close();} catch (e) {}

            const scrapInfo = new ScrapInfo();

            if (e.toString().startsWith("Error: net::ERR_NAME_NOT_RESOLVED"))
            {
                scrapInfo.StatusType = ScrapStatusType.NameNotResolved;
                scrapInfo.CustomErrorMessage = "Url doesn't exist anymore";
            }
            else if (e.toString().startsWith("TimeoutError: Navigation timeout"))
            {
                scrapInfo.StatusType = ScrapStatusType.NavigationTimeout;
                scrapInfo.CustomErrorMessage = "Cannot load the page in the 30sec max";
            }
            else if (e.toString().startsWith("TypeError:"))
            {
                scrapInfo.StatusType = ScrapStatusType.TypeError;
                scrapInfo.CustomErrorMessage = e.toString();
            }
            else if (e.toString().startsWith("Error: net::ERR_TOO_MANY_REDIRECTS"))
            {
                scrapInfo.StatusType = ScrapStatusType.TooManyRedirects;
                scrapInfo.CustomErrorMessage = "Too many redirects";
            }
            else
            {
                if (e.toString().startsWith("Error: Navigation failed because browser has disconnected!"))
                {
                    return await Utils.getAllInfo(url);
                }

                console.log(e);

                scrapInfo.StatusType = ScrapStatusType.Unknown;
                scrapInfo.CustomErrorMessage = e.toString().split("\n")[0];
            }

            return scrapInfo;
        }
    }

    static getTextFrom(splitText, min, max)
    {
        let text = "";
        for (let key in splitText)
        {
            let elem = splitText[key];
            if (key >= min && key <= max)
            {
                if (text !== "")
                {
                    text += " ";
                }
                text += elem;
            }
        }

        return text;
    }

    static cutText(text, maxCharacter)
    {
        return text.length > maxCharacter ? `${text.substring(0, maxCharacter - 2)}..` : text;
    }

    static mentionRole(roleID)
    {
        return `<@&${roleID}>`;
    }

    /**
     * Sort the list of manhwas
     * @param list {Manhwa[] || LibraryManhwa[]} Manhwa list to sort
     * @param filterChoose {string} Filter to apply
     * @return {Manhwa[] || LibraryManhwa[]} Sorted list
     */
    static sortList(list, filterChoose)
    {
        if (filterChoose === Filter.Alphabetical)
        {
            return list.sort((a, b) => a.Name.localeCompare(b.Name));
        }

        if (filterChoose === Filter.AntiAlphabetical)
        {
            return list.sort((a, b) => b.Name.localeCompare(a.Name));
        }

        if (filterChoose === LibraryFilter.MostRead)
        {
            return list.sort((a, b) => b.Readers - a.Readers);
        }

        if (filterChoose === LibraryFilter.LeastRead)
        {
            return list.sort((a, b) => a.Readers - b.Readers);
        }

        return list;
    }

    static formatChapterFromURL(url)
    {
        try
        {
            let list = [];
            if (url.includes("mangakakalot"))
            {
                list = url.split("/")[5].split("-");
            }
            else if (url.includes("manganato") || url.includes("mangabuddy"))
            {
                list = url.split("/")[4].split("-");
            }
            else if (url.includes("bato.to"))
            {
                let chapter = url.split("/")[5].split("_");
                list = chapter[chapter.length - 1].split(".");
            }
            else if (url.includes("flamecomics"))
            {
                let chapter = url.split("/")[3];
                list = chapter.substring(chapter.indexOf("chapter") + 8, chapter.length).split("-");
            }
            else if (url.includes("asura"))
            {
                const parts = url.split("/");
                list = parts[parts.length - 1].split("-");
            }
            else if (url.includes("arenascan"))
            {
                const parts = url.split("/");
                list = parts[parts.length - 2].split("-");
            }
            else if (url.includes("kingofshojo"))
            {
                const parts = url.split("/");
                list = parts[parts.length - 2].split("-");
            }
            else if (url.includes("comic.naver"))
            {
                list = [url.split("no=")[1]];
            }
            else if (url.includes("mgdemon"))
            {
                let chapter = url.split("/")[6].replace("-VA54", "");

                list = chapter.split("-");
            }
            else
            {
                list = url.split("/")[5].split("-");
            }

            let chapterNumber = "";
            for (let str of list)
            {
                str = str.replace(/[a-zA-Z]/g, "");
                if (str !== "")
                {
                    if (chapterNumber !== "")
                        chapterNumber += ".";
                    chapterNumber += str.replace(/\D/g, ".");
                }
            }

            if (chapterNumber === "") return "Chapter ?";

            return `Chapter ${chapterNumber}`;
        }
        catch (e)
        {
            return `Chapter ?`;
        }
    }
}