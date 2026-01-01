const fs = require("fs")
const path = require("path")

const COOKIE_PATH = path.join(__dirname, "../config/instagram.cookie.js")

function loadInstagramCookie() {
  if (!fs.existsSync(COOKIE_PATH)) {
    console.error("❌ Instagram cookie belum ada!")
    console.error("👉 Copy instagram.cookie.js.example → instagram.cookie.js")
    process.exit(1)
  }

  const cookieConfig = require(COOKIE_PATH)

  if (!cookieConfig.cookie || typeof cookieConfig.cookie !== "string") {
    console.error("❌ Format cookie invalid")
    process.exit(1)
  }

  return cookieConfig.cookie
}

module.exports = { loadInstagramCookie }
