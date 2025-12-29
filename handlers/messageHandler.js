const chalk = require("chalk")
const commands = require("../commands")

// Extract text dari berbagai tipe message
function getMessageText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ""
  )
}

// Rate limiting (anti-spam)
const userCooldown = new Map()
const COOLDOWN_TIME = 3000 // 3 detik

function isOnCooldown(userId) {
  if (userCooldown.has(userId)) {
    const lastUsed = userCooldown.get(userId)
    const timePassed = Date.now() - lastUsed
    
    if (timePassed < COOLDOWN_TIME) {
      return Math.ceil((COOLDOWN_TIME - timePassed) / 1000)
    }
  }
  
  userCooldown.set(userId, Date.now())
  return false
}

async function handleMessage(sock, msg) {
  try {
    const from = msg.key.remoteJid
    const text = getMessageText(msg).trim()
    
    if (!text) return

    const userId = msg.key.participant || from
    const cooldown = isOnCooldown(userId)
    
    if (cooldown) {
      console.log(chalk.yellow(`   ⏳ Cooldown: Waiting ${cooldown}s\n`))
      return
    }

    // Check if message starts with command prefix
    if (!text.startsWith("!")) return

    const args = text.slice(1).trim().split(/ +/)
    const commandName = args.shift().toLowerCase()

    console.log(chalk.white("   Command:  ") + chalk.magenta.bold(`!${commandName}`))
    
    if (args.length > 0) {
      console.log(chalk.white("   Args:     ") + chalk.gray(args.join(" ")))
    }
    
    console.log(chalk.magenta("─".repeat(65)))

    // Find command
    const command = commands[commandName]

    if (!command) {
      await sock.sendMessage(from, {
        text: `❌ Command *!${commandName}* tidak ditemukan.\n\n💡 Ketik *!menu* untuk melihat semua command yang tersedia.\n\n_Kanata.bot_ 🌸`
      })
      console.log(chalk.red.bold(`   ❌ Command Not Found: !${commandName}`))
      console.log(chalk.gray(`   Suggestion: Type !menu for help\n`))
      return
    }

    // Execute command
    console.log(chalk.blue.bold("   ⚡ Executing command..."))
    
    const startTime = Date.now()
    await command.execute(sock, msg, args)
    const executionTime = Date.now() - startTime
    
    console.log(chalk.green.bold(`   ✅ Command executed successfully (${executionTime}ms)`))
    console.log(chalk.magenta("═".repeat(65)) + "\n")

  } catch (err) {
    console.error(chalk.red.bold("   ❌ Error executing command:"))
    console.error(chalk.white(`   Message: ${err.message}`))
    console.error(chalk.gray(`   Stack: ${err.stack}`))
    console.log(chalk.magenta("═".repeat(65)) + "\n")
    
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ Terjadi error saat memproses command.\n\n*Error:* ${err.message}\n\nSilakan coba lagi atau ketik *!menu* untuk bantuan.\n\n_Kanata.bot_ 🌸`
      })
    } catch (sendErr) {
      console.error(chalk.red.bold("   ❌ Failed to send error message"))
      console.error(chalk.gray(`   ${sendErr.message}\n`))
    }
  }
}

module.exports = { handleMessage }