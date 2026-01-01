const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'instagram',
    aliases: ['ig', 'igdl', 'insta'],
    category: 'downloader',
    description: 'Download foto/video dari Instagram',
    usage: '.instagram <url>',
    examples: [
        'instagram https://www.instagram.com/p/xxxxx',
        'ig https://www.instagram.com/reel/xxxxx'
    ],
    
    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;
        
        try {
            if (!args[0]) {
                await sock.sendMessage(chatId, {
                    text: '❌ *Cara Penggunaan:*\n\n' +
                          '.instagram <url>\n\n' +
                          '*Contoh:*\n' +
                          '.instagram https://www.instagram.com/p/xxxxx\n' +
                          '.ig https://www.instagram.com/reel/xxxxx'
                });
                return;
            }

            const url = args[0];
            
            if (!this.isValidInstagramUrl(url)) {
                await sock.sendMessage(chatId, {
                    text: '❌ URL tidak valid!\n\nPastikan URL dari Instagram'
                });
                return;
            }

            const loadingMsg = await sock.sendMessage(chatId, {
                text: '⏳ *Memproses media...*\n\n🔄 Mengambil informasi\n⏰ Mohon tunggu...'
            });

            const mediaData = await this.getMediaData(url);
            
            if (!mediaData || !mediaData.media || mediaData.media.length === 0) {
                throw new Error('Media tidak ditemukan');
            }

            await sock.sendMessage(chatId, {
                text: '⏳ *Mendownload media...*\n\n📥 Sedang mendownload\n⏰ Mohon tunggu...',
                edit: loadingMsg.key
            });

            const caption = `✅ *Instagram Download Success!*\n\n` +
                          `👤 *Username:* ${mediaData.username || 'Unknown'}\n` +
                          `📝 *Caption:* ${mediaData.caption || 'No caption'}\n` +
                          `❤️ *Likes:* ${mediaData.likes || '-'}\n` +
                          `💬 *Comments:* ${mediaData.comments || '-'}\n` +
                          `📊 *Type:* ${mediaData.type || 'Unknown'}\n\n` +
                          `_Kanata Bot_`;

            for (let i = 0; i < mediaData.media.length; i++) {
                const item = mediaData.media[i];
                
                if (item.type === 'video') {
                    await sock.sendMessage(chatId, {
                        video: { url: item.url },
                        caption: i === 0 ? caption : `Video ${i + 1}/${mediaData.media.length}`,
                        mimetype: 'video/mp4'
                    });
                } else {
                    await sock.sendMessage(chatId, {
                        image: { url: item.url },
                        caption: i === 0 ? caption : `Foto ${i + 1}/${mediaData.media.length}`
                    });
                }
            }

            await sock.sendMessage(chatId, { delete: loadingMsg.key });

        } catch (error) {
            console.error('Instagram Download Error:', error);
            
            let errorMsg = '❌ *Download Gagal!*\n\n';
            errorMsg += `• ${error.message}\n\n`;
            errorMsg += '💡 *Solusi:*\n';
            errorMsg += '• Pastikan post tidak private\n';
            errorMsg += '• Pastikan URL valid\n';
            errorMsg += '• Coba beberapa saat lagi';

            await sock.sendMessage(chatId, { text: errorMsg });
        }
    },

    isValidInstagramUrl(url) {
        const patterns = [
            /instagram\.com\/(p|reel|tv)\/[\w-]+/,
            /instagr\.am\/(p|reel)\/[\w-]+/
        ];
        return patterns.some(pattern => pattern.test(url));
    },

    async getMediaData(url) {
        try {
            const response = await axios.post('https://v3.igdownloader.app/api/ajaxSearch', {
                recaptchaToken: '',
                q: url,
                t: 'media',
                lang: 'en'
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.data) {
                const html = response.data.data;
                const media = [];
                
                const videoMatches = html.matchAll(/href="([^"]+)"[^>]*>Download Video/gi);
                for (const match of videoMatches) {
                    media.push({ type: 'video', url: match[1] });
                }
                
                const imageMatches = html.matchAll(/href="([^"]+)"[^>]*>Download Image/gi);
                for (const match of imageMatches) {
                    media.push({ type: 'image', url: match[1] });
                }

                const usernameMatch = html.match(/@([\w.]+)/);
                const username = usernameMatch ? usernameMatch[1] : 'Unknown';

                return {
                    media: media,
                    username: username,
                    caption: 'Instagram Media',
                    type: media.length > 1 ? 'Carousel' : (media[0]?.type === 'video' ? 'Reel/Video' : 'Photo'),
                    likes: '-',
                    comments: '-'
                };
            }

            throw new Error('Gagal mendapatkan data media');
        } catch (error) {
            throw new Error('Instagram scraping failed: ' + error.message);
        }
    }
};