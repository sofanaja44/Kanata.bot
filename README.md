# 🌸 Kanata.bot

> Bot WhatsApp multifungsi untuk download media dan kontrol Instagram pribadi  
> **Stabil • Private • Powerful**

[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-active-success.svg)]()

---

## ✨ Features

### 📥 Media Downloader

#### 🎵 TikTok Downloader
- Download video tanpa watermark
- Support semua format TikTok
- Kualitas HD original
- Auto retry jika gagal

```
!tiktok https://vt.tiktok.com/xxxxx
```

#### 🎬 YouTube Downloader
- Download video hingga 720p
- Download audio MP3 320kbps
- Support shorts & video panjang
- Smart format detection

```
!youtube https://youtu.be/xxxxx video
!youtube https://youtu.be/xxxxx audio
```

#### 📸 Instagram Downloader
- Download post, reel, carousel
- Tampilkan caption, likes & views
- Support multiple media
- Cookie-based authentication

```
!instagram https://instagram.com/p/xxxxx
```

---

### 🔧 Instagram Control Tools

> **⚠️ Requires Instagram Cookie** - Data pribadi tetap aman

#### 👤 Profile Info (`!igme`)
Tampilkan informasi lengkap akun Instagram:
- Username & nama lengkap
- Statistik: followers, following, posts
- Bio & link eksternal
- Foto profil HD

#### 👻 Ghost Follower Analyzer (`!igghost`)
Analisis relationship Instagram:
- ❌ Tidak follow back
- 🔄 Kamu tidak follow balik
- ✅ Mutual follows
- 📊 Statistik lengkap
- 📄 Export ke file `.txt`

---

### ⚙️ Utility Commands

| Command | Deskripsi |
|---------|-----------|
| `!menu` | Tampilkan daftar command |
| `!help` | Alias untuk menu |
| `!ping` | Cek status & response time |

---

## 🚀 Quick Start

### Prerequisites

```bash
# Check Node.js version (minimum v16)
node --version

# Check FFmpeg installation
ffmpeg -version
```

**Required:**
- ✅ Node.js v16 atau lebih tinggi
- ✅ FFmpeg (untuk convert media)
- ✅ WhatsApp account
- ✅ Instagram account (untuk fitur IG tools)

---

### Installation

**1. Clone Repository**
```bash
git clone https://github.com/yourusername/kanata-bot.git
cd kanata-bot
```

**2. Install Dependencies**
```bash
npm install
```

**3. Setup Instagram Cookie** (opsional, untuk IG tools)
```bash
# Copy template cookie
cp cookie.template.json cookie.json

# Edit cookie.json dengan cookie Instagram kamu
nano cookie.json
```

**4. Start Bot**
```bash
npm start
```

**5. Scan QR Code**
- Buka WhatsApp di HP
- Pilih **Linked Devices**
- Scan QR code yang muncul di terminal

---

## 🔐 Instagram Cookie Setup

### Cara Mendapatkan Cookie

**Method 1: Browser Extension (Recommended)**

1. Install extension **EditThisCookie** atau **Cookie Editor**
2. Login ke Instagram di browser
3. Buka extension dan export cookies
4. Copy hasil export ke `cookie.json`

**Method 2: Browser DevTools**

1. Login ke Instagram
2. Tekan `F12` untuk buka DevTools
3. Pergi ke **Application** > **Cookies**
4. Salin cookie yang diperlukan:
   - `sessionid`
   - `ds_user_id`
   - `csrftoken`

**Format `cookie.json`:**
```json
[
  {
    "name": "sessionid",
    "value": "your_session_id_here",
    "domain": ".instagram.com"
  },
  {
    "name": "ds_user_id",
    "value": "your_user_id_here",
    "domain": ".instagram.com"
  },
  {
    "name": "csrftoken",
    "value": "your_csrf_token_here",
    "domain": ".instagram.com"
  }
]
```

### 🛡️ Cookie Security

- ✅ `cookie.json` sudah ada di `.gitignore`
- ✅ Cookie **TIDAK AKAN** ter-upload ke GitHub
- ✅ Template (`cookie.template.json`) aman untuk dibagikan
- ⚠️ **JANGAN** share `cookie.json` asli ke siapapun
- 🔄 Ganti cookie secara berkala untuk keamanan

---

## 📁 Project Structure

```
kanata-bot/
├── commands/           # Command files
│   ├── menu.js
│   ├── ping.js
│   ├── tiktok.js
│   ├── youtube.js
│   ├── instagram.js
│   ├── igme.js
│   └── igghost.js
├── utils/              # Utility functions
│   └── rateLimit.js
├── services/           # External services
│   ├── tiktok.service.js
│   ├── youtube.service.js
│   └── instagram.service.js
├── temp/               # Temporary download files (auto cleanup)
├── cookie.json         # Your Instagram cookie (gitignored)
├── cookie.template.json # Template for setup
├── .gitignore          # Git ignore rules
├── package.json        # Dependencies
└── index.js            # Main bot file
```

---

## 🎯 Usage Examples

### Download TikTok Video
```
User: !tiktok https://vt.tiktok.com/ZS8xxxxx/
Bot:  ✅ Video berhasil didownload!
      [Sends video without watermark]
```

### Download YouTube Audio
```
User: !youtube https://youtu.be/dQw4w9WgXcQ audio
Bot:  ⏳ Mengunduh audio dari YouTube...
      ✅ Audio berhasil didownload!
      [Sends MP3 file]
```

### Check Instagram Ghost Followers
```
User: !igghost
Bot:  ⏳ Menganalisis followers...
      
      📊 Hasil Analisis:
      • Tidak follow back: 25 orang
      • Kamu tidak follow balik: 12 orang
      • Mutual: 150 orang
      
      ✅ Laporan lengkap dikirim!
      [Sends ghost_followers.txt]
```

---

## ⚡ Performance & Features

### Smart Features
- 🔄 **Auto Reconnect** - Otomatis reconnect jika koneksi terputus
- 🛡️ **Rate Limiting** - Mencegah spam (1 request/3 detik)
- 🧠 **Smart Retry** - Auto retry dengan backoff strategy
- 🧹 **Auto Cleanup** - File temporary otomatis terhapus
- 📊 **Error Logging** - Log error untuk debugging

### Multi-Method System
Bot menggunakan multiple methods untuk download:
- Primary method gagal → Auto fallback ke backup
- Backup gagal → Coba alternative method
- Semua gagal → Kirim error message yang jelas

### Rate Limits
| Action | Limit |
|--------|-------|
| Command requests | 1 per 3 detik per user |
| Instagram API calls | Built-in Instagram limits |
| Download requests | Concurrent limit: 3 |

---

## 🐛 Troubleshooting

### Bot tidak merespon
```bash
# 1. Cek koneksi internet
ping google.com

# 2. Restart bot
npm start

# 3. Clear cache
rm -rf node_modules
npm install
```

### Error "Cookie invalid"
- Cookie Instagram expired
- Login ulang di browser
- Export cookie baru
- Update `cookie.json`

### Error "FFmpeg not found"
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# MacOS
brew install ffmpeg

# Windows
# Download dari: https://ffmpeg.org/download.html
```

### Download gagal terus
- Cek link valid & public
- Cek koneksi internet stabil
- Tunggu 1-2 menit lalu coba lagi
- Cek rate limit tidak exceeded

---

## 🔧 Configuration

### Environment Variables (Optional)

Create `.env` file:
```env
# WhatsApp
WA_AUTO_RECONNECT=true
WA_PRINT_QR_IN_TERMINAL=true

# Rate Limiting
RATE_LIMIT_REQUESTS=1
RATE_LIMIT_WINDOW=3000

# Logging
LOG_LEVEL=info
DEBUG_MODE=false

# Cleanup
AUTO_CLEANUP_TEMP=true
CLEANUP_INTERVAL=300000
```

---

## 📊 Bot Statistics

Real-time stats yang ditampilkan di `!menu`:
- Total commands available
- Bot uptime
- Platform info
- Version info

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 Changelog

### v2.0.0 (Current)
- ✨ Redesigned menu system
- 🔧 Improved Instagram tools
- 🐛 Fixed multiple bugs
- ⚡ Better performance
- 📚 Enhanced documentation

### v1.0.0
- 🎉 Initial release
- Basic download features
- Instagram ghost checker

---

## ⚠️ Disclaimer

- Bot ini untuk **personal use** dan **educational purposes**
- Respect platform ToS (Terms of Service)
- Jangan spam atau abuse fitur
- Developer tidak bertanggung jawab atas penyalahgunaan
- Gunakan cookie Instagram dengan **bijak dan aman**
- **JANGAN** share cookie ke orang lain

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💙 Support

Jika bot ini membantu, kasih ⭐ star di GitHub!

**Need help?**
- 📧 Email: yaradit74@gmail.com
- 💬 Issues: [GitHub Issues](https://github.com/yourusername/kanata-bot/issues)
- 📖 Wiki: [Documentation](https://github.com/yourusername/kanata-bot/wiki)

---

<div align="center">

**Made with ❤️ by Your Team**

_Simple. Powerful. Private._

[⬆ Back to Top](#-kanatabot)

</div>
