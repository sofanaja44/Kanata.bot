const axios = require(‘axios’);
const cheerio = require(‘cheerio’);
const { exec } = require(‘child_process’);
const fs = require(‘fs’);
const path = require(‘path’);
const { promisify } = require(‘util’);
const execPromise = promisify(exec);

module.exports = {
name: ‘tiktok’,
aliases: [‘tt’, ‘ttdl’, ‘tiktokdl’],
category: ‘downloader’,
description: ‘Download video TikTok tanpa watermark’,
usage: ‘.tiktok <url>’,

```
async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid;
    
    try {
        if (!args[0]) {
            await sock.sendMessage(chatId, {
                text: '❌ *Cara Penggunaan:*\n\n' +
                      '.tiktok <url>\n\n' +
                      '*Contoh:*\n' +
                      '.tiktok https://vt.tiktok.com/ZSxxxxx\n' +
                      '.tiktok https://www.tiktok.com/@user/video/xxxxx'
            });
            return;
        }

        const url = args[0];
        
        if (!this.isValidTikTokUrl(url)) {
            await sock.sendMessage(chatId, {
                text: '❌ URL tidak valid!\n\n' +
                      'Pastikan URL dari TikTok:\n' +
                      '• https://vt.tiktok.com/...\n' +
                      '• https://www.tiktok.com/@.../video/...\n' +
                      '• https://vm.tiktok.com/...'
            });
            return;
        }

        const loadingMsg = await sock.sendMessage(chatId, {
            text: '⏳ *Memproses video...*\n\n' +
                  '🔄 Mengambil informasi video\n' +
                  '⏰ Mohon tunggu sebentar...'
        });

        const realUrl = await this.getRealUrl(url);
        const videoInfo = await this.scrapeVideoInfo(realUrl);
        
        if (!videoInfo || !videoInfo.videoUrl) {
            throw new Error('Gagal mendapatkan informasi video');
        }

        await sock.sendMessage(chatId, {
            text: '⏳ *Mendownload video...*\n\n' +
                  '📥 Sedang mendownload\n' +
                  `📊 Ukuran: ${videoInfo.size || 'Unknown'}\n` +
                  '⏰ Mohon tunggu...',
            edit: loadingMsg.key
        });

        const outputPath = path.join(__dirname, '../temp', `tiktok_${Date.now()}.mp4`);
        await this.downloadWithFfmpeg(videoInfo.videoUrl, outputPath);

        await sock.sendMessage(chatId, {
            text: '⏳ *Mengupload video...*\n\n' +
                  '📤 Sedang mengupload ke WhatsApp\n' +
                  '⏰ Hampir selesai...',
            edit: loadingMsg.key
        });

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(outputPath),
            caption: `✅ *TikTok Download Success!*\n\n` +
                    `👤 *Author:* ${videoInfo.author || 'Unknown'}\n` +
                    `📝 *Caption:* ${videoInfo.title || 'No caption'}\n` +
                    `❤️ *Likes:* ${videoInfo.likes || '0'}\n` +
                    `💬 *Comments:* ${videoInfo.comments || '0'}\n` +
                    `🔄 *Shares:* ${videoInfo.shares || '0'}\n` +
                    `👁️ *Views:* ${videoInfo.views || '0'}\n\n` +
                    `🎵 *Music:* ${videoInfo.music || 'Unknown'}\n\n` +
                    `_No Watermark | Powered by Kanata Bot_`,
            mimetype: 'video/mp4'
        });

        this.cleanupFile(outputPath);
        await sock.sendMessage(chatId, { delete: loadingMsg.key });

    } catch (error) {
        console.error('TikTok Download Error:', error);
        
        let errorMessage = '❌ *Download Gagal!*\n\n';
        
        if (error.message.includes('Invalid URL')) {
            errorMessage += '🔗 URL tidak valid atau tidak bisa diakses\n';
        } else if (error.message.includes('Video not found')) {
            errorMessage += '❌ Video tidak ditemukan atau sudah dihapus\n';
        } else if (error.message.includes('Private')) {
            errorMessage += '🔒 Video ini private atau tidak bisa diakses\n';
        } else if (error.message.includes('ffmpeg')) {
            errorMessage += '⚠️ Gagal mendownload video (ffmpeg error)\n';
        } else {
            errorMessage += `⚠️ ${error.message}\n`;
        }
        
        errorMessage += '\n💡 *Tips:*\n' +
                      '• Pastikan video masih ada\n' +
                      '• Pastikan video tidak private\n' +
                      '• Coba URL yang berbeda\n' +
                      '• Coba beberapa saat lagi';

        await sock.sendMessage(chatId, { text: errorMessage });
    }
},

isValidTikTokUrl(url) {
    const patterns = [
        /tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /vt\.tiktok\.com\/[\w-]+/,
        /vm\.tiktok\.com\/[\w-]+/,
        /tiktok\.com\/t\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
},

async getRealUrl(url) {
    try {
        if (url.includes('tiktok.com/@') && url.includes('/video/')) {
            return url;
        }

        const response = await axios.get(url, {
            maxRedirects: 5,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        return response.request.res.responseUrl || url;
    } catch (error) {
        return url;
    }
},

async scrapeVideoInfo(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.tiktok.com/',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
            }
        });

        const html = response.data;
        const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/s);
        
        if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[1]);
            const videoData = jsonData.__DEFAULT_SCOPE__['webapp.video-detail'];
            
            if (videoData && videoData.itemInfo && videoData.itemInfo.itemStruct) {
                const item = videoData.itemInfo.itemStruct;
                
                let videoUrl = item.video.downloadAddr || 
                              item.video.playAddr || 
                              item.video.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];

                return {
                    videoUrl: videoUrl,
                    author: item.author.uniqueId || item.author.nickname,
                    title: item.desc || 'No caption',
                    likes: this.formatNumber(item.stats.diggCount),
                    comments: this.formatNumber(item.stats.commentCount),
                    shares: this.formatNumber(item.stats.shareCount),
                    views: this.formatNumber(item.stats.playCount),
                    music: item.music.title || item.music.authorName,
                    duration: item.video.duration,
                    size: this.formatBytes(item.video.bitrate)
                };
            }
        }

        const videoId = this.extractVideoId(url);
        if (videoId) {
            const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@i/video/${videoId}`;
            const oembedResponse = await axios.get(oembedUrl);
            
            if (oembedResponse.data) {
                const downloadUrl = `https://tikcdn.io/ssstik/${videoId}`;
                
                return {
                    videoUrl: downloadUrl,
                    author: oembedResponse.data.author_name || 'Unknown',
                    title: oembedResponse.data.title || 'No caption',
                    likes: '0',
                    comments: '0',
                    shares: '0',
                    views: '0',
                    music: 'Unknown',
                    duration: 0
                };
            }
        }

        throw new Error('Video not found or cannot be accessed');

    } catch (error) {
        console.error('Scrape error:', error.message);
        throw new Error('Failed to get video information');
    }
},

extractVideoId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
},

async downloadWithFfmpeg(videoUrl, outputPath) {
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const command = `ffmpeg -user_agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
                   `-headers "Referer: https://www.tiktok.com/" ` +
                   `-i "${videoUrl}" ` +
                   `-c copy ` +
                   `-bsf:a aac_adtstoasc ` +
                   `-y "${outputPath}"`;

    try {
        await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });
        
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error('Downloaded file is empty or does not exist');
        }
        
        return outputPath;
    } catch (error) {
        console.error('FFmpeg error:', error);
        
        try {
            return await this.downloadWithAxios(videoUrl, outputPath);
        } catch (axiosError) {
            throw new Error('ffmpeg and axios download failed: ' + error.message);
        }
    }
},

async downloadWithAxios(url, outputPath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.tiktok.com/'
        },
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
    });
},

formatNumber(num) {
    if (!num) return '0';
    
    num = parseInt(num);
    
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
},

formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    
    if (bytes >= 1048576) {
        return (bytes / 1048576).toFixed(2) + ' MB';
    }
    if (bytes >= 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    }
    return bytes + ' B';
},

cleanupFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}
```

};
