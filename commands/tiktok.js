const axios = require("axios")
const https = require("https")

// Custom HTTPS agent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

// Helper: Resolve short TikTok URL
async function resolveShortUrl(shortUrl) {
  try {
    const response = await axios.get(shortUrl, {
      maxRedirects: 0,
      validateStatus: status => status === 301 || status === 302,
      httpsAgent
    })
    return response.headers.location || shortUrl
  } catch (err) {
    if (err.response?.headers?.location) {
      return err.response.headers.location
    }
    return shortUrl
  }
}

module.exports = {
  name: "tiktok",
  description: "Download video dari TikTok",
  usage: "!tiktok <link>",
  
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid
    
    // Validasi input
    if (args.length === 0) {
      await sock.sendMessage(from, {
        text: "❌ Link TikTok tidak ditemukan!\n\n*Usage:*\n!tiktok <link>\n\n*Example:*\n!tiktok https://vt.tiktok.com/ZSYxxxxx/"
      })
      return
    }

    let url = args[0]
    
    // Validasi URL TikTok
    if (!url.includes("tiktok.com")) {
      await sock.sendMessage(from, {
        text: "❌ Link tidak valid!\n\nPastikan link dari TikTok (tiktok.com atau vt.tiktok.com)"
      })
      return
    }

    // Kirim loading message
    await sock.sendMessage(from, {
      text: "⏳ Sedang mengunduh video TikTok...\n\nMohon tunggu sebentar ⏰"
    })

    try {
      // Resolve short URL ke full URL
      if (url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
        console.log("   🔗 Resolving short URL...")
        url = await resolveShortUrl(url)
        console.log(`   ✅ Resolved to: ${url}`)
      }

      // Extract video ID from URL
      const videoIdMatch = url.match(/\/video\/(\d+)/) || 
                          url.match(/@[\w.-]+\/video\/(\d+)/) ||
                          url.match(/\/v\/(\d+)/)
      
      if (!videoIdMatch) {
        throw new Error("Cannot extract video ID from URL")
      }

      const videoId = videoIdMatch[1]
      console.log(`   📹 Video ID: ${videoId}`)

      // Try TikWM API with proper format
      console.log("   🔄 Trying TikWM...")
      
      const tikwmResponse = await axios.post(
        "https://www.tikwm.com/api/",
        {
          url: url,
          count: 12,
          cursor: 0,
          web: 1,
          hd: 1
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          },
          httpsAgent,
          timeout: 30000
        }
      )

      const data = tikwmResponse.data?.data
      
      if (!data || (!data.play && !data.wmplay)) {
        throw new Error("Video not available from TikWM")
      }

      const videoUrl = data.hdplay || data.play || data.wmplay
      const title = data.title || "TikTok Video"
      const author = data.author?.nickname || data.author?.unique_id || "Unknown"
      const duration = data.duration || 0

      console.log(`   ✅ Found video: ${videoUrl}`)

      // Download video
      const videoResponse = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.tiktok.com/"
        },
        httpsAgent
      })

      const videoBuffer = Buffer.from(videoResponse.data)

      // Validasi
      if (videoBuffer.length < 1000) {
        throw new Error("Invalid video data")
      }

      const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2)

      if (videoBuffer.length > 100 * 1024 * 1024) {
        throw new Error(`Video terlalu besar (${sizeMB}MB, max 100MB)`)
      }

      // Format duration
      const durationText = duration > 0 
        ? `\n⏱️ ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
        : ""

      // Kirim video
      await sock.sendMessage(from, {
        video: videoBuffer,
        caption: `✅ *TikTok Downloader*\n\n📝 ${title}\n👤 @${author}${durationText}\n💾 ${sizeMB}MB\n\n_Tanpa Watermark_`,
        mimetype: "video/mp4"
      })

      console.log(`   ✅ Success! Sent ${sizeMB}MB video`)

    } catch (err) {
      console.error("   ❌ TikTok download error:", err.message)

      let errorMsg = "❌ Gagal mengunduh video TikTok!\n\n"

      if (err.message.includes("extract video ID")) {
        errorMsg += "Format URL tidak valid.\n\nPastikan link dalam format:\n• https://vt.tiktok.com/xxxxx/\n• https://www.tiktok.com/@user/video/xxxxx"
      } else if (err.message.includes("not available") || err.message.includes("not found")) {
        errorMsg += "Video tidak ditemukan, mungkin sudah dihapus atau private."
      } else if (err.message.includes("timeout") || err.message.includes("ENOTFOUND")) {
        errorMsg += "Koneksi bermasalah. Coba:\n1. Cek koneksi internet\n2. Tunggu 1-2 menit\n3. Coba lagi"
      } else if (err.message.includes("terlalu besar")) {
        errorMsg += err.message
      } else if (err.message.includes("Invalid video data")) {
        errorMsg += "Data video tidak valid. Video mungkin rusak atau terlindungi."
      } else {
        errorMsg += `Server sedang bermasalah.\n\nError: ${err.message}\n\nCoba lagi dalam 1-2 menit.`
      }

      await sock.sendMessage(from, { text: errorMsg })
    }
  }
}