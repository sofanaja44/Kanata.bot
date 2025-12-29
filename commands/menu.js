module.exports = {
  name: "menu",
  description: "Menampilkan daftar command",
  usage: "!menu",
  
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid
    
    // Get user info
    const pushname = msg.pushName || "User"
    const isGroup = from.endsWith("@g.us")
    
    // Waktu greeting
    const hour = new Date().getHours()
    let greeting = "Selamat Malam"
    if (hour >= 4 && hour < 11) greeting = "Selamat Pagi"
    else if (hour >= 11 && hour < 15) greeting = "Selamat Siang"
    else if (hour >= 15 && hour < 18) greeting = "Selamat Sore"
    
    const menuText = `
╭━━━━━━━━━━━━━━━━━━━━╮
│     *🌸 Kanata.bot 🌸*
╰━━━━━━━━━━━━━━━━━━━━╯

${greeting}, *${pushname}*! 👋
Selamat datang di Kanata.bot~
Bot download serba bisa! ✨

┏━━━━ *📥 DOWNLOAD* ━━━━┓
┃
┃ ⭐ *!tiktok* <link>
┃    Download video TikTok tanpa watermark
┃    
┃    📌 Contoh:
┃    !tiktok https://vt.tiktok.com/ZSxxx
┃
┣━━━━━━━━━━━━━━━━━━━━━━
┃
┃ ⭐ *!youtube* <link> <type>
┃    Download video/audio dari YouTube
┃    
┃    📌 Type:
┃    • video → Download video MP4
┃    • audio → Download audio MP3
┃    
┃    📌 Contoh:
┃    !youtube https://youtu.be/xxx video
┃    !youtube https://youtu.be/xxx audio
┃
┣━━━━━━━━━━━━━━━━━━━━━━
┃
┃ ⭐ *!instagram* <link>
┃    Download foto/video dari Instagram
┃    
┃    📌 Contoh:
┃    !instagram https://instagram.com/p/xxx
┃    !instagram https://instagram.com/reel/xxx
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━ *⚙️ UTILITY* ━━━━━┓
┃
┃ 🔹 *!menu*
┃    Tampilkan menu ini
┃
┃ 🔹 *!ping*
┃    Cek status & kecepatan bot
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━ *💡 TIPS & INFO* ━━━━┓
┃
┃ ✅ Pastikan link public & valid
┃ ✅ Max durasi video: 10 menit
┃ ✅ Max ukuran file: 100MB
┃ ✅ Bot memproses 1 request per 3 detik
┃ ✅ Untuk video panjang, butuh waktu lebih
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━ *📊 BOT INFO* ━━━━━┓
┃
┃ 🤖 Nama: Kanata.bot
┃ 📅 Version: 1.0.0
┃ 💻 Platform: Multi-Platform
┃ 🌐 Support: TikTok, YouTube, Instagram
┃ ⏱️ Uptime: ${Math.floor(process.uptime() / 60)} menit
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

╭━━━━━━━━━━━━━━━━━━━━╮
│ _Terima kasih telah menggunakan_
│ _Kanata.bot! Have a nice day~_ 🌸
╰━━━━━━━━━━━━━━━━━━━━╯

> Kanata.bot © 2025 | Made with ❤️
`.trim()

    await sock.sendMessage(from, { text: menuText })
  }
}