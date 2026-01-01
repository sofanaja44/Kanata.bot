const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execPromise = promisify(exec);

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'ttdl', 'tiktokdl'],
    category: 'downloader',
    description: 'Download video TikTok tanpa watermark',
    usage: '.tiktok <url>',
    examples: [
        'tiktok https://vt.tiktok.com/ZSxxxxx',
        'tt https://www.tiktok.com/@user/video/1234567'
    ],
    
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        
        try {
            if (!args[0]) {
                await sock.sendMessage(chatId, {
                    text: '❌ *Cara Penggunaan:*\n\n' +
                          '.tiktok <url>\n\n' +
                          '*Contoh:*\n' +
                          '.tiktok https://vt.tiktok.com/ZSxxxxx\n' +
                          '.tiktok https://www.tiktok.com/@user/video/1234567'
                });
                return;
            }

            const url = args[0];
            
            if (!this.isValidTikTokUrl(url)) {
                await sock.sendMessage(chatId, {
                    text: '❌ URL tidak valid!\n\nPastikan URL dari TikTok'
                });
                return;
            }

            const loadingMsg = await sock.sendMessage(chatId, {
                text: '⏳ *Memproses video...*\n\n🔄 Mengambil informasi\n⏰ Mohon tunggu...'
            });

            const videoData = await this.getVideoData(url);
            
            if (!videoData || !videoData.videoUrl) {
                throw new Error('Video tidak ditemukan atau tidak bisa diakses');
            }

            await sock.sendMessage(chatId, {
                text: '⏳ *Mendownload video...*\n\n📥 Sedang mendownload\n⏰ Mohon tunggu...',
                edit: loadingMsg.key
            });

            const outputPath = path.join(__dirname, '../temp', `tiktok_${Date.now()}.mp4`);
            await this.downloadVideo(videoData.videoUrl, outputPath);

            await sock.sendMessage(chatId, {
                text: '⏳ *Mengupload...*\n\n📤 Hampir selesai...',
                edit: loadingMsg.key
            });

            const caption = `✅ *TikTok Download Success!*\n\n` +
                          `👤 *Author:* ${videoData.author || 'Unknown'}\n` +
                          `📝 *Caption:* ${videoData.title || 'No caption'}\n` +
                          `❤️ *Likes:* ${videoData.likes || '-'}\n` +
                          `👁️ *Views:* ${videoData.views || '-'}\n` +
                          `⏱️ *Duration:* ${videoData.duration || '-'}s\n\n` +
                          `_No Watermark | Kanata Bot_`;

            await sock.sendMessage(chatId, {
                video: fs.readFileSync(outputPath),
                caption: caption,
                mimetype: 'video/mp4'
            });

            this.cleanupFile(outputPath);
            await sock.sendMessage(chatId, { delete: loadingMsg.key });

        } catch (error) {
            console.error('TikTok Download Error:', error);
            
            let errorMsg = '❌ *Download Gagal!*\n\n';
            
            if (error.message.includes('tidak ditemukan')) {
                errorMsg += '• Video tidak ditemukan atau sudah dihapus\n';
            } else if (error.message.includes('private')) {
                errorMsg += '• Video ini bersifat private\n';
            } else if (error.message.includes('network')) {
                errorMsg += '• Masalah koneksi internet\n';
            } else {
                errorMsg += `• ${error.message}\n`;
            }
            
            errorMsg += '\n💡 *Solusi:*\n';
            errorMsg += '• Pastikan video masih ada\n';
            errorMsg += '• Pastikan video tidak private\n';
            errorMsg += '• Coba beberapa saat lagi\n';
            errorMsg += '• Gunakan URL yang berbeda';

            await sock.sendMessage(chatId, { text: errorMsg });
        }
    },

    isValidTikTokUrl(url) {
        const patterns = [
            /tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /vt\.tiktok\.com\/[\w-]+/,
            /vm\.tiktok\.com\/[\w-]+/,
            /tiktok\.com\/t\/[\w-]+/,
            /tiktok\.com\/v\/\d+/
        ];
        return patterns.some(pattern => pattern.test(url));
    },

    async getVideoData(url) {
        const methods = [
            () => this.method1_TikWM(url),
            () => this.method2_SnapTik(url),
            () => this.method3_Direct(url)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`Trying method ${i + 1}...`);
                const result = await methods[i]();
                if (result && result.videoUrl) {
                    console.log(`Method ${i + 1} success!`);
                    return result;
                }
            } catch (error) {
                console.log(`Method ${i + 1} failed:`, error.message);
                if (i === methods.length - 1) {
                    throw error;
                }
            }
        }

        throw new Error('Semua metode download gagal');
    },

    async method1_TikWM(url) {
        try {
            const realUrl = await this.getRealUrl(url);
            
            const response = await axios.post('https://www.tikwm.com/api/', {
                url: realUrl,
                count: 12,
                cursor: 0,
                web: 1,
                hd: 1
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data.code === 0 && response.data.data) {
                const data = response.data.data;
                return {
                    videoUrl: data.hdplay || data.play,
                    author: data.author?.unique_id || 'Unknown',
                    title: data.title || 'No caption',
                    likes: this.formatNumber(data.digg_count),
                    views: this.formatNumber(data.play_count),
                    duration: data.duration
                };
            }

            throw new Error('TikWM API failed');
        } catch (error) {
            throw new Error('Method 1 failed: ' + error.message);
        }
    },

    async method2_SnapTik(url) {
        try {
            const realUrl = await this.getRealUrl(url);
            
            const response = await axios.get('https://snaptik.app/abc2.php', {
                params: { url: realUrl, lang: 'en' },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const html = response.data;
            const videoMatch = html.match(/href="([^"]*)"[^>]*download/i);
            
            if (videoMatch && videoMatch[1]) {
                const videoUrl = videoMatch[1];
                
                const titleMatch = html.match(/<div class="video-title">([^<]+)<\/div>/i);
                const title = titleMatch ? titleMatch[1].trim() : 'No caption';

                return {
                    videoUrl: videoUrl,
                    author: 'Unknown',
                    title: title,
                    likes: '-',
                    views: '-',
                    duration: '-'
                };
            }

            throw new Error('SnapTik parsing failed');
        } catch (error) {
            throw new Error('Method 2 failed: ' + error.message);
        }
    },

    async method3_Direct(url) {
        try {
            const realUrl = await this.getRealUrl(url);
            
            const response = await axios.get(realUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.tiktok.com/',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate'
                }
            });

            const html = response.data;
            
            const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
            if (scriptMatch) {
                const jsonData = JSON.parse(scriptMatch[1]);
                const detail = jsonData?.__DEFAULT_SCOPE__?.['webapp.video-detail'];
                
                if (detail?.itemInfo?.itemStruct) {
                    const item = detail.itemInfo.itemStruct;
                    const video = item.video;
                    
                    let videoUrl = video.downloadAddr || video.playAddr;
                    
                    if (video.bitrateInfo && video.bitrateInfo.length > 0) {
                        videoUrl = video.bitrateInfo[0].PlayAddr?.UrlList?.[0] || videoUrl;
                    }

                    return {
                        videoUrl: videoUrl,
                        author: item.author?.uniqueId || item.author?.nickname || 'Unknown',
                        title: item.desc || 'No caption',
                        likes: this.formatNumber(item.stats?.diggCount),
                        views: this.formatNumber(item.stats?.playCount),
                        duration: video.duration
                    };
                }
            }

            const oembedMatch = html.match(/"downloadAddr":"([^"]+)"/);
            if (oembedMatch) {
                const videoUrl = oembedMatch[1].replace(/\\u002F/g, '/');
                return {
                    videoUrl: videoUrl,
                    author: 'Unknown',
                    title: 'TikTok Video',
                    likes: '-',
                    views: '-',
                    duration: '-'
                };
            }

            throw new Error('Direct scraping failed');
        } catch (error) {
            throw new Error('Method 3 failed: ' + error.message);
        }
    },

    async getRealUrl(url) {
        try {
            if (url.includes('tiktok.com/@') && url.includes('/video/')) {
                return url;
            }

            const response = await axios.get(url, {
                maxRedirects: 10,
                validateStatus: () => true,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return response.request?.res?.responseUrl || response.request?.path || url;
        } catch (error) {
            return url;
        }
    },

    async downloadVideo(videoUrl, outputPath) {
        const tempDir = path.dirname(outputPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            const command = `ffmpeg -user_agent "Mozilla/5.0" -headers "Referer: https://www.tiktok.com/" -i "${videoUrl}" -c copy -y "${outputPath}"`;
            
            await execPromise(command, { 
                maxBuffer: 50 * 1024 * 1024,
                timeout: 60000
            });
            
            if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
                throw new Error('FFmpeg failed');
            }
            
            return outputPath;
        } catch (error) {
            console.log('FFmpeg failed, trying axios...');
            return await this.downloadWithAxios(videoUrl, outputPath);
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
            timeout: 60000
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                    resolve(outputPath);
                } else {
                    reject(new Error('Downloaded file is empty'));
                }
            });
            writer.on('error', reject);
            
            setTimeout(() => {
                writer.close();
                reject(new Error('Download timeout'));
            }, 60000);
        });
    },

    formatNumber(num) {
        if (!num) return '-';
        num = parseInt(num);
        if (isNaN(num)) return '-';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
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
};
EOF