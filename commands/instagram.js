const axios = require("axios")
const { loadInstagramCookie } = require("../lib/instagramCookieLoader")

const IG_COOKIE = loadInstagramCookie()
const MAX_CAPTION_LENGTH = 300

const IG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Cookie": IG_COOKIE,
  "X-IG-App-ID": "936619743392459",
  "Referer": "https://www.instagram.com/"
}

module.exports = {
  name: "instagram",
  aliases: ["ig", "igdl"],

  async execute(sock, msg, args) {
    const chatId = msg.key.remoteJid
    const url = args[0]

    if (!url) {
      return sock.sendMessage(chatId, {
        text: "❌ Kirim link Instagram ya"
      })
    }

    const waitMsg = await sock.sendMessage(chatId, {
      text: "⏳ Lagi ambil data Instagram..."
    })

    try {
      await checkLogin()

      const cleanUrl = url.split("?")[0]
      const mediaId = await getMediaId(cleanUrl)
      const { medias, info } = await fetchMedia(mediaId)

      // kirim media dulu
      for (const m of medias) {
        await sock.sendMessage(chatId, {
          [m.type]: { url: m.url },
          mimetype: m.type === "video" ? "video/mp4" : undefined
        })
      }

      // info markdown
      let text =
        `📸 *Instagram ${info.isVideo ? "Reel" : "Post"}*\n\n` +
        `👤 *Username* : @${info.username}\n` +
        `❤️ *Likes*    : ${formatNumber(info.likeCount)}\n`

      if (info.viewCount) {
        text += `👀 *Views*    : ${formatNumber(info.viewCount)}\n`
      }

      if (info.caption) {
        text += `\n📝 *Caption*\n${shortenCaption(info.caption)}`
      }

      await sock.sendMessage(chatId, { text })
      await sock.sendMessage(chatId, { delete: waitMsg.key })

    } catch (err) {
      console.error("[IG ERROR]", err.message)
      await sock.sendMessage(chatId, {
        text: "❌ Gagal mengambil media Instagram"
      })
    }
  }
}

/* =========================
   LOGIN CHECK
========================= */
async function checkLogin() {
  const res = await axios.get(
    "https://www.instagram.com/accounts/edit/",
    {
      headers: IG_HEADERS,
      validateStatus: () => true
    }
  )

  if (res.status === 200 && res.data.includes("AccountsCenter")) {
    return true
  }

  throw new Error("COOKIE NOT LOGGED IN")
}

/* =========================
   GET MEDIA ID
========================= */
async function getMediaId(url) {
  try {
    const res = await axios.get(
      "https://www.instagram.com/oembed/",
      {
        params: { url },
        headers: {
          "User-Agent": IG_HEADERS["User-Agent"]
        },
        timeout: 5000
      }
    )

    if (res.data?.media_id) {
      return res.data.media_id.split("_")[0]
    }
  } catch {
    // fallback
  }

  const match = url.match(/\/(reel|p|tv)\/([^/]+)/)
  if (!match) throw new Error("INVALID URL")

  return shortcodeToMediaId(match[2])
}

/* =========================
   SHORTCODE → MEDIA ID
========================= */
function shortcodeToMediaId(shortcode) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

  let id = BigInt(0)

  for (const char of shortcode) {
    const index = alphabet.indexOf(char)
    if (index === -1) throw new Error("INVALID SHORTCODE")
    id = id * BigInt(64) + BigInt(index)
  }

  return id.toString()
}

/* =========================
   FETCH MEDIA + INFO
========================= */
async function fetchMedia(mediaId) {
  const res = await axios.get(
    `https://www.instagram.com/api/v1/media/${mediaId}/info/`,
    {
      headers: {
        ...IG_HEADERS,
        "User-Agent": "Instagram 155.0.0.37.107"
      },
      validateStatus: () => true
    }
  )

  const item = res.data?.items?.[0]
  if (!item) throw new Error("MEDIA NOT FOUND")

  const medias = []

  if (item.carousel_media) {
    for (const c of item.carousel_media) {
      medias.push({
        type: c.video_versions ? "video" : "image",
        url: c.video_versions
          ? c.video_versions[0].url
          : c.image_versions2.candidates[0].url
      })
    }
  } else if (item.video_versions) {
    medias.push({
      type: "video",
      url: item.video_versions[0].url
    })
  } else if (item.image_versions2) {
    medias.push({
      type: "image",
      url: item.image_versions2.candidates[0].url
    })
  }

  return {
    medias,
    info: {
      username: item.user?.username || "unknown",
      caption: item.caption?.text || "",
      likeCount: item.like_count || 0,
      viewCount: item.view_count || null,
      isVideo: !!item.video_versions
    }
  }
}

/* =========================
   UTIL
========================= */
function shortenCaption(text) {
  if (text.length <= MAX_CAPTION_LENGTH) return text
  return text.slice(0, MAX_CAPTION_LENGTH) + "…"
}

function formatNumber(num) {
  return new Intl.NumberFormat("id-ID").format(num)
}
