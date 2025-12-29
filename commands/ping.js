module.exports = {
  name: "ping",
  description: "Cek status bot dan response time",
  usage: "!ping",
  
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid
    const start = Date.now()
    
    // Get user info
    const pushname = msg.pushName || "User"
    
    // Initial response
    await sock.sendMessage(from, { 
      text: "🏓 Pong! Mengecek status..." 
    })
    
    const latency = Date.now() - start
    const uptime = process.uptime()
    const uptimeMinutes = Math.floor(uptime / 60)
    const uptimeSeconds = Math.floor(uptime % 60)
    const memory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    
    // Status indicator
    let statusEmoji = "🟢"
    let statusText = "Excellent"
    
    if (latency > 1000) {
      statusEmoji = "🔴"
      statusText = "Poor"
    } else if (latency > 500) {
      statusEmoji = "🟡"
      statusText = "Fair"
    } else if (latency > 200) {
      statusEmoji = "🟢"
      statusText = "Good"
    }
    
    const statusMessage = `
╭━━━━━━━━━━━━━━━━━━━━╮
│     *🌸 Kanata.bot 🌸*
│       _Status Check_
╰━━━━━━━━━━━━━━━━━━━━╯

Halo, *${pushname}*! 👋

┏━━━ *📊 BOT STATUS* ━━━┓
┃
┃ ${statusEmoji} Status: *${statusText}*
┃ ⚡ Response: *${latency}ms*
┃ ⏱️ Uptime: *${uptimeMinutes}m ${uptimeSeconds}s*
┃ 💾 Memory: *${memory}MB*
┃ 🤖 Version: *1.0.0*
┃
┗━━━━━━━━━━━━━━━━━━━━━┛

┏━━━ *🌐 NETWORK* ━━━━━┓
┃
┃ 📡 Connection: Active
┃ 🔗 WhatsApp: Connected
┃ 🌍 Server: Online
┃
┗━━━━━━━━━━━━━━━━━━━━━┛

┏━━━ *💡 INFO* ━━━━━━━━┓
┃
┃ Response time menunjukkan
┃ kecepatan bot merespon command.
┃
┃ • <200ms = Excellent ✨
┃ • 200-500ms = Good 👍
┃ • 500-1000ms = Fair ⚠️
┃ • >1000ms = Poor 🔴
┃
┗━━━━━━━━━━━━━━━━━━━━━┛

_Kanata.bot siap melayani!_ 🌸
`.trim()

    await sock.sendMessage(from, { text: statusMessage })
  }
}