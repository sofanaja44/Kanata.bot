const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")
const pino = require("pino")
const chalk = require("chalk")
const figlet = require("figlet")
const { handleMessage } = require("./handlers/messageHandler")

let isReconnecting = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

// =====================
// 🎨 BEAUTIFUL BANNER
// =====================
function showBanner() {
  console.clear()
  
  // ASCII Art Banner
  console.log(chalk.magenta("═".repeat(65)))
  console.log(chalk.cyan(figlet.textSync("Kanata.bot", { 
    font: "ANSI Shadow",
    horizontalLayout: "default" 
  })))
  console.log(chalk.magenta("═".repeat(65)))
  
  // Bot Info
  console.log(chalk.white.bold("  🌸 Kanata.bot - Multi-Platform Downloader"))
  console.log(chalk.gray("  ─".repeat(62)))
  console.log(chalk.cyan("  📦 Version:   ") + chalk.white("1.0.0"))
  console.log(chalk.cyan("  🤖 Type:      ") + chalk.white("WhatsApp Auto Downloader"))
  console.log(chalk.cyan("  🌐 Support:   ") + chalk.white("TikTok, YouTube, Instagram"))
  console.log(chalk.cyan("  👨‍💻 Author:    ") + chalk.white("Kanata Development Team"))
  console.log(chalk.gray("  ─".repeat(62)))
  console.log(chalk.yellow("  💡 Tip: Ketik ") + chalk.white.bold("!menu") + chalk.yellow(" untuk melihat semua command"))
  console.log(chalk.magenta("═".repeat(65)) + "\n")
}

// =====================
// 🤖 START BOT
// =====================
async function startBot() {
  try {
    showBanner()
    
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()

    console.log(chalk.blue.bold("⚙️  Initializing Kanata.bot..."))
    console.log(chalk.gray(`   WhatsApp Version: ${version.join(".")}`))
    console.log(chalk.gray(`   Node Version: ${process.version}\n`))

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
      },
      version,
      logger: pino({ level: "silent" }),
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      printQRInTerminal: false,
      getMessage: async (key) => {
        return { conversation: "" }
      }
    })

    // Save credentials
    sock.ev.on("creds.update", saveCreds)

    // =====================
    // 🔌 CONNECTION UPDATE
    // =====================
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log(chalk.yellow.bold("📱 QR Code - Scan untuk Login:\n"))
        qrcode.generate(qr, { small: true })
        console.log(chalk.gray("\n   1. Buka WhatsApp di HP"))
        console.log(chalk.gray("   2. Tap ⋮ (Menu) → Linked Devices"))
        console.log(chalk.gray("   3. Tap 'Link a Device'"))
        console.log(chalk.gray("   4. Scan QR code di atas\n"))
      }

      if (connection === "open") {
        console.log(chalk.magenta("═".repeat(65)))
        console.log(chalk.green.bold("✅ Kanata.bot Successfully Connected!"))
        console.log(chalk.magenta("═".repeat(65)))
        console.log(chalk.cyan("  📊 Status:    ") + chalk.green.bold("ONLINE & READY"))
        console.log(chalk.cyan("  🕐 Time:      ") + chalk.white(new Date().toLocaleString("id-ID", { 
          timeZone: "Asia/Jakarta",
          dateStyle: "full",
          timeStyle: "medium"
        })))
        console.log(chalk.cyan("  🌍 Location:  ") + chalk.white("Indonesia (WIB)"))
        console.log(chalk.magenta("═".repeat(65)))
        console.log(chalk.yellow.bold("\n💬 Waiting for incoming messages...\n"))
        
        isReconnecting = false
        reconnectAttempts = 0
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode

        console.log(chalk.red.bold("\n❌ Connection Closed"))
        console.log(chalk.gray(`   Reason Code: ${reason}`))
        console.log(chalk.gray(`   Time: ${new Date().toLocaleTimeString("id-ID")}\n`))

        if (reason === DisconnectReason.loggedOut) {
          console.log(chalk.yellow("⚠️  Account Logged Out"))
          console.log(chalk.white("   Please delete 'session' folder and restart bot."))
          console.log(chalk.gray("   Command: rm -rf session/ (Linux/Mac) or del session (Windows)\n"))
          process.exit(0)
        }

        if (reason === DisconnectReason.badSession) {
          console.log(chalk.yellow("⚠️  Bad Session Detected"))
          console.log(chalk.white("   Please delete 'session' folder and restart bot.\n"))
          process.exit(0)
        }

        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(chalk.red.bold("❌ Max Reconnection Attempts Reached"))
          console.log(chalk.white("   Failed to reconnect after 5 attempts."))
          console.log(chalk.yellow("   Please restart the bot manually.\n"))
          process.exit(1)
        }

        if (!isReconnecting) {
          isReconnecting = true
          reconnectAttempts++
          
          const delay = Math.min(10000 * reconnectAttempts, 60000)
          
          console.log(chalk.blue(`🔄 Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`))
          console.log(chalk.gray(`   Waiting ${delay/1000} seconds...\n`))

          setTimeout(() => {
            isReconnecting = false
            startBot()
          }, delay)
        }
      }
    })

    // =====================
    // 📩 MESSAGE HANDLER
    // =====================
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return
      
      const msg = messages[0]
      if (!msg.message) return
      if (msg.key.fromMe) return

      // Log incoming message
      const from = msg.key.remoteJid
      const isGroup = from.endsWith("@g.us")
      const sender = isGroup 
        ? msg.key.participant?.split("@")[0] 
        : from.split("@")[0]
      const pushName = msg.pushName || "Unknown"

      console.log(chalk.magenta("─".repeat(65)))
      console.log(chalk.blue.bold("📩 New Message"))
      console.log(chalk.white("   From:     ") + chalk.cyan(pushName) + chalk.gray(` (@${sender})`))
      console.log(chalk.white("   Type:     ") + chalk.yellow(isGroup ? "Group Chat" : "Private Chat"))
      console.log(chalk.white("   Time:     ") + chalk.gray(new Date().toLocaleTimeString("id-ID")))
      
      // Handle message
      await handleMessage(sock, msg)
    })

    // =====================
    // 🛑 GRACEFUL SHUTDOWN
    // =====================
    process.on("SIGINT", async () => {
      console.log(chalk.yellow.bold("\n\n⏹️  Shutting down Kanata.bot gracefully..."))
      console.log(chalk.gray("   Closing connections..."))
      await sock.end()
      console.log(chalk.green.bold("✅ Kanata.bot stopped successfully."))
      console.log(chalk.white("   Thank you for using Kanata.bot! 🌸\n"))
      process.exit(0)
    })

  } catch (err) {
    console.error(chalk.red.bold("❌ Fatal Error Starting Bot:"))
    console.error(chalk.white(err.message))
    console.error(chalk.gray("\nStack Trace:"))
    console.error(chalk.gray(err.stack))
    process.exit(1)
  }
}

// =====================
// 🚀 START APPLICATION
// =====================
console.log(chalk.cyan("\n🚀 Starting Kanata.bot...\n"))
startBot()

// =====================
// 🛡️ ERROR HANDLERS
// =====================
process.on("unhandledRejection", (err) => {
  console.error(chalk.red.bold("\n❌ Unhandled Promise Rejection:"))
  console.error(chalk.white(err.message))
  console.error(chalk.gray(err.stack))
})

process.on("uncaughtException", (err) => {
  console.error(chalk.red.bold("\n❌ Uncaught Exception:"))
  console.error(chalk.white(err.message))
  console.error(chalk.gray(err.stack))
})