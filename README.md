# ManhwaNotifier
This is a discord bot written in JavaScript that notifies you when a new chapter of your favorite manhwa is released.

## Features
Basically,
anyone can follow a manhwa (or manga/manhua)
from a supported website and the bot will notify you when a new chapter is released.

## Supported Websites
- [AsuraComic](https://asuracomic.net/)
- [ReaperScans](https://reaperscans.com/)
- [ZinManga](https://zinmanga.net/)
- [ManhuaPlus](https://manhuaplus.com/)
- [ManhwaBuddy](https://manhwabuddy.com/)
- [KingOfShojo](https://kingofshojo.com/)
- [ToonClash](https://toonclash.com/)
- [MangaBuddy](https://mangabuddy.com/)
- [RoliaScan](https://roliascan.com/)

And a lot of websites are supported by default because they use the same WordPress template. 
They can be tested with /check command.

## Development
### Prerequisites
- Node.js
- npm
- Discord bot token

### Installation
1. Clone the repository
```bash
git clone https://github.com/Tryliom/ManhwaNotifier.git
```
2. Install dependencies
```bash
npm install
```
3. You need to duplicate the `.env.example` file and rename it to `.env`.
   Then, fill in the required fields.
4. You need to create the folder `./assets/` with the following structure:
```
assets
├── backup
├── data
├── purge
```

### Start the bot
```bash
npm start
```

Warning: the bot uses puppeteer to scrape the websites,
so it will take a lot of memory and can create a lot of logs on some machines.

You will need to run the command `/panel` to set up the bot server for the logs and other things.