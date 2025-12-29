const ytdl = require("ytdl-core")
const fs = require("fs")
const path = require("path")

module.exports = {
  name: "youtube",
  description: "Download video/audio dari YouTube",
  usage: "!youtube <link> <video/audio>",
  
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid
    
    // Validasi input
    if (args.length < 2) {
      await sock.sendMessage(from, {
        text: `❌ Format salah!

*Usage:*
!youtube <link> <type>

*Type:*
• video = Download video MP4
• audio = Download audio MP3

*Example:*
!youtube https://youtu.be/xxxxx video
!youtube https://youtu.be/xxxxx audio`
      })
      return
    }

    const url = args[0]
    const type = args[1].toLowerCase()
    
    // Validasi URL YouTube
    if (!ytdl.validateURL(url)) {
      await sock.sendMessage(from, {
        text: "❌ Link YouTube tidak valid!\n\nPastikan link dari youtube.com atau youtu.be"
      })
      return
    }

    // Validasi type
    if (!["video", "audio"].includes(type)) {
      await sock.sendMessage(from, {
        text: "❌ Type tidak valid!\n\nGunakan: *video* atau *audio*"
      })
      return
    }

    // Kirim loading message
    await sock.sendMessage(from, {
      text: `⏳ Sedang mengunduh ${type === "video" ? "video" : "audio"} dari YouTube...\n\nProses ini memakan waktu beberapa menit ⏰`
    })

    try {
      // Get video info
      const info = await ytdl.getInfo(url)
      const title = info.videoDetails.title
      const duration = parseInt(info.videoDetails.lengthSeconds)
      
      // Validasi durasi (max 10 menit)
      if (duration > 600) {
        await sock.sendMessage(from, {
          text: "❌ Video terlalu panjang!\n\nMaksimal durasi: 10 menit"
        })
        return
      }

      const fileName = `./temp/${Date.now()}.${type === "video" ? "mp4" : "mp3"}`
      
      // Pastikan folder temp ada
      if (!fs.existsSync("./temp")) {
        fs.mkdirSync("./temp")
      }

      if (type === "video") {
        // Download video
        const stream = ytdl(url, { 
          quality: "highestvideo",
          filter: format => format.container === "mp4"
        })
        
        const writer = fs.createWriteStream(fileName)
        stream.pipe(writer)
        
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve)
          writer.on("error", reject)
        })
        
        // Kirim video
        const videoBuffer = fs.readFileSync(fileName)
        await sock.sendMessage(from, {
          video: videoBuffer,
          caption: `✅ *YouTube Downloader*\n\n📝 ${title}\n⏱️ ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}\n\n_Video MP4_`,
          mimetype: "video/mp4"
        })
        
      } else {
        // Download audio
        const stream = ytdl(url, { 
          quality: "highestaudio",
          filter: "audioonly"
        })
        
        const writer = fs.createWriteStream(fileName)
        stream.pipe(writer)
        
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve)
          writer.on("error", reject)
        })
        
        // Kirim audio
        const audioBuffer = fs.readFileSync(fileName)
        await sock.sendMessage(from, {
          audio: audioBuffer,
          caption: `✅ *YouTube Downloader*\n\n📝 ${title}\n⏱️ ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}\n\n_Audio MP3_`,
          mimetype: "audio/mpeg",
          ptt: false
        })
      }
      
      // Hapus file temporary
      fs.unlinkSync(fileName)

    } catch (err) {
      console.error("YouTube download error:", err.message)
      
      let errorMsg = "❌ Gagal mengunduh dari YouTube!\n\n"
      
      if (err.message.includes("unavailable")) {
        errorMsg += "Video tidak tersedia atau sudah dihapus."
      } else if (err.message.includes("copyright")) {
        errorMsg += "Video dilindungi copyright."
      } else {
        errorMsg += "Terjadi kesalahan. Silakan coba lagi.\n\nKetik *!menu* untuk bantuan."
      }
      
      await sock.sendMessage(from, { text: errorMsg })
    }
  }
}