const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
  name: "tiktok",
  alias: ["tik"],
  async execute(message, args) {
    const url = args[0];
    if (!url.includes('tiktok.com')) {
      return message.reply('Please provide a valid TikTok URL.');
    }

    try {
      const response = await axios.get(`https://ttdownloader.com`);
      const $ = cheerio.load(response.data);
      const token = $('input[name="token"]').val();

      const downloaderResponse = await axios.post(
        'https://ttdownloader.com/req/',
        new URLSearchParams({
          "url": url,
          "format": '',
          "token": token
        }),
        {
          headers: {
            "content-type": "application/x-www-form-urlencoded"
          }
        }
      );

      const $downloader = cheerio.load(downloaderResponse.data);
      const videoUrl = $downloader('a[target="_blank"]').attr('href');

      if (videoUrl) {
        return message.reply(`Here is your TikTok video link: ${videoUrl}`);
      } else {
        return message.reply('Failed to retrieve video. Please try again later.');
      }
    } catch (error) {
      console.error('Error while downloading TikTok video:', error);
      return message.reply('An error occurred. Please check the URL and try again');
    }
  }
};