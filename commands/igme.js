const axios = require("axios");
const { cookie } = require("../config/instagram.cookie");

module.exports = {
  name: "igme",
  description: "Menampilkan informasi lengkap akun Instagram Anda",

  async execute(sock, msg) {
    const from = msg.key.remoteJid;
    let loadingMsg;

    try {
      // Kirim pesan loading
      loadingMsg = await sock.sendMessage(from, { 
        text: "🔍 Mengambil informasi akun Instagram..." 
      });

      // Validasi cookie terlebih dahulu
      if (!cookie || cookie.trim() === "") {
        throw new Error("COOKIE_MISSING");
      }

      // Ambil informasi user dengan timeout
      const me = await fetchWithTimeout(
        "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
        {
          headers: getIGHeaders(),
          timeout: 10000
        }
      );

      // Validasi response
      if (!me.data?.user?.username) {
        throw new Error("USER_NOT_FOUND");
      }

      const user = me.data.user;

      // Ambil profil lengkap dengan retry mechanism
      const profile = await fetchProfileWithRetry(user.username);
      const data = profile.data?.data?.user;

      if (!data) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      // Format data dengan aman
      const profileInfo = {
        username: data.username || "-",
        fullName: data.full_name || "-",
        followers: formatNumber(data.edge_followed_by?.count),
        following: formatNumber(data.edge_follow?.count),
        posts: formatNumber(data.edge_owner_to_timeline_media?.count),
        bio: data.biography?.trim() || "-",
        isPrivate: data.is_private ? "🔒 Private" : "🔓 Public",
        isVerified: data.is_verified ? "✅ Verified" : "",
        externalUrl: data.external_url || null,
        profilePicUrl: data.profile_pic_url_hd || data.profile_pic_url
      };

      // Buat pesan yang lebih menarik
      const text = buildProfileMessage(profileInfo);

      // Hapus pesan loading dan kirim hasil
      if (loadingMsg?.key) {
        await sock.sendMessage(from, { delete: loadingMsg.key });
      }

      // Kirim dengan gambar profil jika tersedia
      if (profileInfo.profilePicUrl) {
        await sock.sendMessage(from, {
          image: { url: profileInfo.profilePicUrl },
          caption: text
        });
      } else {
        await sock.sendMessage(from, { text });
      }

    } catch (err) {
      console.error("[IGME ERROR]", {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      // Hapus pesan loading jika ada
      if (loadingMsg?.key) {
        await sock.sendMessage(from, { delete: loadingMsg.key });
      }

      // Kirim pesan error yang informatif
      const errorMessage = getErrorMessage(err);
      await sock.sendMessage(from, { text: errorMessage });
    }
  }
};

/**
 * Membuat header untuk request Instagram API
 */
function getIGHeaders() {
  return {
    "User-Agent": "Instagram 290.0.0.0.109 Android (33/13; 420dpi; 1080x2400; Samsung; SM-G991B; o1s; exynos2100; en_US; 468691771)",
    "X-IG-App-ID": "936619743392459",
    "X-IG-WWW-Claim": "0",
    "X-Requested-With": "XMLHttpRequest",
    "Cookie": cookie,
    "Accept": "application/json",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}

/**
 * Fetch dengan timeout untuk mencegah hanging
 */
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await axios.get(url, {
      ...options,
      signal: controller.signal,
      validateStatus: (status) => status < 500
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }

    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }

    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError" || err.code === "ECONNABORTED") {
      throw new Error("TIMEOUT");
    }
    throw err;
  }
}

/**
 * Fetch profil dengan retry mechanism
 */
async function fetchProfileWithRetry(username, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetchWithTimeout(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
        {
          headers: getIGHeaders(),
          timeout: 15000
        }
      );

      return response;
    } catch (err) {
      if (i === retries) throw err;
      
      // Tunggu sebelum retry dengan exponential backoff
      await sleep(1000 * Math.pow(2, i));
    }
  }
}

/**
 * Format angka menjadi format Indonesia dengan pemisah ribuan
 */
function formatNumber(num) {
  if (num === null || num === undefined) return "0";
  
  const number = parseInt(num, 10);
  
  if (isNaN(number)) return "0";
  
  // Format untuk angka besar
  if (number >= 1000000) {
    return `${(number / 1000000).toFixed(1)}M`;
  } else if (number >= 1000) {
    return `${(number / 1000).toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat("id-ID").format(number);
}

/**
 * Membuat pesan profil yang menarik
 */
function buildProfileMessage(info) {
  const lines = [
    "📸 *INSTAGRAM PROFILE*",
    "",
    `👤 *Username:* @${info.username}`,
    `✨ *Nama:* ${info.fullName}`,
  ];

  // Tambahkan verified badge jika ada
  if (info.isVerified) {
    lines.push(`${info.isVerified}`);
  }

  lines.push(`🔐 *Status:* ${info.isPrivate}`);
  lines.push("");
  lines.push("📊 *Statistik:*");
  lines.push(`   👥 Followers: ${info.followers}`);
  lines.push(`   💚 Following: ${info.following}`);
  lines.push(`   📷 Posts: ${info.posts}`);
  lines.push("");

  if (info.bio && info.bio !== "-") {
    lines.push("📝 *Bio:*");
    lines.push(`   ${info.bio.split('\n').join('\n   ')}`);
    lines.push("");
  }

  if (info.externalUrl) {
    lines.push(`🔗 *Link:* ${info.externalUrl}`);
    lines.push("");
  }

  lines.push("─────────────────────");
  lines.push(`⏰ _Diambil pada: ${new Date().toLocaleString('id-ID')}_`);

  return lines.filter(line => line !== undefined && !line.includes('undefined')).join("\n");
}

/**
 * Mendapatkan pesan error yang user-friendly
 */
function getErrorMessage(err) {
  const errorMessages = {
    COOKIE_MISSING: "❌ *Cookie Instagram tidak ditemukan*\n\nSilakan konfigurasi cookie di file config terlebih dahulu.",
    USER_NOT_FOUND: "❌ *User tidak ditemukan*\n\nPastikan cookie Instagram masih valid.",
    PROFILE_NOT_FOUND: "❌ *Profil tidak dapat diakses*\n\nAkun mungkin di-suspend atau cookie tidak valid.",
    UNAUTHORIZED: "❌ *Autentikasi gagal*\n\nCookie Instagram sudah kadaluarsa. Silakan perbarui cookie Anda.",
    RATE_LIMIT: "⏸️ *Rate limit tercapai*\n\nTerlalu banyak request. Coba lagi dalam beberapa menit.",
    TIMEOUT: "⏱️ *Request timeout*\n\nKoneksi ke Instagram terlalu lama. Silakan coba lagi.",
    ENOTFOUND: "🌐 *Tidak ada koneksi internet*\n\nPeriksa koneksi internet Anda.",
    ECONNREFUSED: "🚫 *Koneksi ditolak*\n\nServer Instagram tidak dapat dijangkau."
  };

  const errorType = err.message;
  
  if (errorMessages[errorType]) {
    return errorMessages[errorType];
  }

  // Error generik dengan detail untuk debugging
  return `❌ *Terjadi kesalahan*\n\n` +
         `Detail: ${err.message}\n\n` +
         `Silakan coba lagi atau hubungi administrator.`;
}

/**
 * Sleep helper untuk retry mechanism
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}