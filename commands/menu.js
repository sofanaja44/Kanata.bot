const fs = require("fs");
const path = require("path");

module.exports = {
  name: "menu",
  description: "Menampilkan daftar lengkap command bot dengan informasi detail",
  usage: "!menu",
  aliases: ["help", "commands"],

  async execute(sock, msg) {
    const from = msg.key.remoteJid;
    const pushname = msg.pushName || "User";

    try {
      const greeting = getGreeting();
      const uptime = formatUptime(process.uptime());
      const commandCount = await getCommandCount();

      const menuText = buildMenuText({
        pushname,
        greeting,
        uptime,
        commandCount
      });

      await sock.sendMessage(from, { 
        text: menuText.trim() 
      });

      logMenuUsage(pushname, from);

    } catch (err) {
      console.error("[MENU ERROR]", {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      await sock.sendMessage(from, {
        text: getFallbackMenu(pushname)
      });
    }
  }
};

// ================= HELPER FUNCTIONS =================

function getGreeting() {
  const hour = new Date().getHours();
  
  if (hour >= 4 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  
  return parts.length > 0 ? parts.join(" ") : "Baru saja";
}

async function getCommandCount() {
  try {
    const commandsPath = path.join(__dirname);
    const files = await fs.promises.readdir(commandsPath);
    const jsFiles = files.filter(f => f.endsWith(".js") && f !== "menu.js");
    return jsFiles.length;
  } catch {
    return 8;
  }
}

function buildMenuText(data) {
  const { pushname, greeting, uptime, commandCount } = data;
  
  const lines = [
    "🌸 *KANATA.BOT* 🌸",
    "",
    `Hai *${pushname}*! Selamat ${greeting} ✨`,
    "",
    "*📥 DOWNLOAD COMMANDS*",
    "",
    "🎵 *TikTok*",
    "!tiktok <link>",
    "Download video tanpa watermark",
    "",
    "🎬 *YouTube*",
    "!youtube <link> <video|audio>",
    "Download video 720p atau audio MP3",
    "",
    "📸 *Instagram*",
    "!instagram <link>",
    "Download post, reel & carousel",
    "",
    "*🔧 INSTAGRAM TOOLS*",
    "",
    "👤 *Profile Info*",
    "!igme",
    "Lihat info lengkap akun Instagram kamu",
    "",
    "👻 *Ghost Follower*",
    "!igghost",
    "Cek siapa yang tidak follow back",
    "& deteksi ghost followers",
    "",
    "*⚙️ UTILITY*",
    "",
    "!menu - Tampilkan menu ini",
    "!ping - Cek status bot",
    "",
    "*📊 BOT INFO*",
    "",
    `Commands: ${commandCount} | Uptime: ${uptime}`,
    `Platform: WhatsApp | v2.0.0`,
    "",
    "*💡 TIPS*",
    "• Rate limit: 1 request/3 detik",
    "• Link harus public & valid",
    "• Data aman & tidak disimpan",
    "",
    "✨ _Simple. Powerful. Private._",
    "",
    `📅 ${new Date().toLocaleDateString("id-ID", {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })} | ${new Date().toLocaleTimeString("id-ID", {
      hour: '2-digit',
      minute: '2-digit'
    })}`
  ];

  return lines.join("\n");
}

function getFallbackMenu(pushname) {
  return `
🌸 *KANATA.BOT* 🌸

Hai ${pushname}! 👋

*📥 DOWNLOAD*
!tiktok <link>
!youtube <link> <video|audio>
!instagram <link>

*🔧 INSTAGRAM*
!igme - Info akun
!igghost - Ghost followers

*⚙️ UTILITY*
!menu - Menu ini
!ping - Status bot

Bot ready! ✨
`.trim();
}

function logMenuUsage(username, chatId) {
  try {
    const logData = {
      command: "menu",
      user: username,
      chatId: chatId.replace("@s.whatsapp.net", ""),
      timestamp: new Date().toISOString()
    };

    console.log("[MENU ACCESSED]", logData);
  } catch (err) {
    console.error("[LOG ERROR]", err.message);
  }
}