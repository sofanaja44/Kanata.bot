const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execPromise = promisify(exec);

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'ttdl'],
    category: 'downloader',
    description: 'Download video TikTok tanpa watermark',

    async execute(sock, msg, args) {
        const chatId = msg.key.remoteJid;

        if (!args[0]) {
            return sock.sendMessage(chatId, {
                text: '❌ contoh:\n.tiktok https://vt.tiktok.com/xxxx'
            });
        }

        let inputUrl = args[0];
        let retry = 0;
        let lastError;

        const loading = await sock.sendMessage(chatId, { text: '⏳ proses dulu yaa…' });

        while (retry < 3) {
            try {
                console.log(`🔁 Retry ke-${retry + 1}`);

                const realUrl = await this.resolveTikTokUrl(inputUrl);
                const data = await this.getVideoData(realUrl);

                if (!data?.videoUrl) throw new Error('Video URL kosong');

                const output = path.join(__dirname, '../temp', `tt_${Date.now()}.mp4`);
                await this.downloadVideo(data.videoUrl, output);

                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(output),
                    caption:
                        `✅ TikTok berhasil\n\n` +
                        `👤 ${data.author}\n` +
                        `📝 ${data.title}\n\n` +
                        `_Kanata Bot_`,
                    mimetype: 'video/mp4'
                });

                fs.unlinkSync(output);
                await sock.sendMessage(chatId, { delete: loading.key });
                return;

            } catch (e) {
                lastError = e;
                console.log('❌ Error:', e.message);
                retry++;
            }
        }

        await sock.sendMessage(chatId, {
            text: `❌ gagal juga 😭\n\n${lastError.message}`
        });
    },

    /* =========================
       VALIDATION & RESOLVE
    ========================== */

    async resolveTikTokUrl(url) {
        if (url.includes('/@') && url.includes('/video/')) return url;

        const res = await axios.get(url, {
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        return res.request?.res?.responseUrl || url;
    },

    normalizeVideoUrl(url) {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return 'https://www.tikwm.com' + url;
        return url;
    },

    /* =========================
       VIDEO DATA
    ========================== */

    async getVideoData(url) {
        const methods = [
            () => this.fromTikWM(url),
            () => this.fromSnapTik(url),
            () => this.fromDirect(url)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                console.log(`⚡ Method ${i + 1}`);
                const res = await methods[i]();
                if (res?.videoUrl) return res;
            } catch (e) {
                console.log(`❌ Method ${i + 1} gagal`);
            }
        }
        throw new Error('Semua metode gagal');
    },

    async fromTikWM(url) {
        const res = await axios.post(
            'https://www.tikwm.com/api/',
            new URLSearchParams({ url, hd: 1 }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        if (res.data.code !== 0) throw new Error('TikWM gagal');

        const d = res.data.data;
        return {
            videoUrl: this.normalizeVideoUrl(d.hdplay || d.play),
            author: d.author?.unique_id || '-',
            title: d.title || '-'
        };
    },

    async fromSnapTik(url) {
        const res = await axios.get('https://snaptik.app/abc2.php', {
            params: { url },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const m = res.data.match(/href="([^"]+)"[^>]*download/i);
        if (!m) throw new Error('SnapTik gagal');

        return {
            videoUrl: m[1],
            author: '-',
            title: '-'
        };
    },

    async fromDirect(url) {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        const m = res.data.match(/"downloadAddr":"([^"]+)"/);
        if (!m) throw new Error('Direct gagal');

        return {
            videoUrl: m[1].replace(/\\u002F/g, '/'),
            author: '-',
            title: '-'
        };
    },

    /* =========================
       DOWNLOAD SYSTEM
    ========================== */

    async downloadVideo(videoUrl, output) {
        videoUrl = this.normalizeVideoUrl(videoUrl);
        if (!videoUrl.startsWith('http')) throw new Error('URL video invalid');

        try {
            await execPromise(
                `ffmpeg -y -headers "Referer: https://www.tiktok.com/" -i "${videoUrl}" -c copy "${output}"`,
                { timeout: 60000 }
            );
            if (!fs.existsSync(output)) throw new Error();
            return;
        } catch {
            console.log('⚠️ ffmpeg gagal → axios');
        }

        const res = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        const writer = fs.createWriteStream(output);
        res.data.pipe(writer);

        return new Promise((ok, fail) => {
            writer.on('finish', ok);
            writer.on('error', fail);
        });
    }
};
