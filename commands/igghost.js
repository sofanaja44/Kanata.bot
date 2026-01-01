const axios = require("axios");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { cookie } = require("../config/instagram.cookie");

module.exports = {
  name: "igghost",
  description: "Analisis lengkap followers & following Instagram dengan export ke file TXT",

  async execute(sock, msg) {
    const from = msg.key.remoteJid;
    let progressMsg = null;

    try {
      // Validasi cookie
      if (!cookie || cookie.trim() === "") {
        throw new Error("COOKIE_MISSING");
      }

      // Pastikan folder temp ada
      const tempDir = path.join(__dirname, "../temp");
      await ensureDir(tempDir);

      // Kirim pesan progress awal
      progressMsg = await sock.sendMessage(from, {
        text: "🔍 *Memulai Analisis Instagram*\n\n⏳ Mengambil data akun..."
      });

      const headers = getIGHeaders();

      // Ambil informasi user
      const me = await fetchWithTimeout(
        "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
        { headers, timeout: 10000 }
      );

      const user = me.data?.user;
      if (!user?.pk || !user?.username) {
        throw new Error("USER_NOT_FOUND");
      }

      // Update progress - ambil followers
      await updateProgress(sock, from, progressMsg, 
        "🔍 *Memulai Analisis Instagram*\n\n⏳ Mengambil data followers...\n_Mohon tunggu, ini bisa memakan waktu_"
      );

      const followers = await fetchAllWithProgress(
        `https://www.instagram.com/api/v1/friendships/${user.pk}/followers/`,
        headers,
        sock,
        from,
        progressMsg,
        "Followers"
      );

      // Update progress - ambil following
      await updateProgress(sock, from, progressMsg,
        `🔍 *Memulai Analisis Instagram*\n\n✅ Followers: ${followers.length}\n⏳ Mengambil data following...\n_Mohon tunggu sebentar lagi_`
      );

      const following = await fetchAllWithProgress(
        `https://www.instagram.com/api/v1/friendships/${user.pk}/following/`,
        headers,
        sock,
        from,
        progressMsg,
        "Following"
      );

      // Update progress - analisis data
      await updateProgress(sock, from, progressMsg,
        `🔍 *Memulai Analisis Instagram*\n\n✅ Followers: ${followers.length}\n✅ Following: ${following.length}\n⏳ Menganalisis data...\n_Hampir selesai!_`
      );

      // Proses data dengan Set untuk performa optimal
      const followersSet = new Set(followers.map(u => u.username));
      const followingSet = new Set(following.map(u => u.username));

      // Analisis relationship
      const notFollowBack = [...followingSet].filter(u => !followersSet.has(u));
      const ghostFollowers = [...followersSet].filter(u => !followingSet.has(u));
      const mutualFollows = [...followingSet].filter(u => followersSet.has(u));

      // Hitung rasio
      const followerRatio = following.length > 0 
        ? (followers.length / following.length).toFixed(2) 
        : "0";

      // Buat konten file dengan format yang lebih menarik
      const fileContent = buildReportContent({
        username: user.username,
        followers,
        following,
        notFollowBack,
        ghostFollowers,
        mutualFollows,
        followerRatio
      });

      // Simpan file dengan nama yang informatif
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      const fileName = `ig-analysis-${user.username}-${timestamp}.txt`;
      const filePath = path.join(tempDir, fileName);

      await fs.writeFile(filePath, fileContent, "utf8");

      // Hapus pesan progress
      if (progressMsg?.key) {
        await sock.sendMessage(from, { delete: progressMsg.key });
      }

      // Kirim ringkasan dengan emoji dan format menarik
      const summaryText = buildSummaryMessage({
        username: user.username,
        followersCount: followers.length,
        followingCount: following.length,
        notFollowBackCount: notFollowBack.length,
        ghostFollowersCount: ghostFollowers.length,
        mutualFollowsCount: mutualFollows.length,
        followerRatio
      });

      await sock.sendMessage(from, { text: summaryText });

      // Kirim file laporan
      await sock.sendMessage(from, {
        document: fsSync.readFileSync(filePath),
        fileName,
        mimetype: "text/plain",
        caption: "📎 Laporan lengkap analisis Instagram Anda"
      });

      // Cleanup: hapus file setelah 5 menit
      setTimeout(async () => {
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.error("[CLEANUP ERROR]", err.message);
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      console.error("[IGGHOST ERROR]", {
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      // Hapus pesan progress jika ada
      if (progressMsg?.key) {
        await sock.sendMessage(from, { delete: progressMsg.key });
      }

      // Kirim pesan error yang informatif
      const errorMessage = getErrorMessage(err);
      await sock.sendMessage(from, { text: errorMessage });
    }
  }
};

// ================= HELPER FUNCTIONS =================

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
 * Fetch dengan timeout protection
 */
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 15000;
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
 * Fetch semua data dengan pagination dan progress update
 */
async function fetchAllWithProgress(baseUrl, headers, sock, from, progressMsg, type) {
  let results = [];
  let max_id = null;
  let pageCount = 0;

  try {
    do {
      pageCount++;
      
      const response = await fetchWithTimeout(baseUrl, {
        headers,
        params: { count: 200, max_id },
        timeout: 20000
      });

      const users = response.data?.users || [];
      results.push(...users);
      
      max_id = response.data?.next_max_id || null;

      // Update progress setiap 3 halaman
      if (pageCount % 3 === 0 && max_id) {
        await updateProgress(sock, from, progressMsg,
          `🔍 *Memulai Analisis Instagram*\n\n⏳ Mengambil ${type}...\n📊 Ditemukan: ${results.length}\n_Masih ada lagi, tunggu sebentar..._`
        );
      }

      // Delay untuk menghindari rate limit
      if (max_id) {
        await sleep(1000);
      }

    } while (max_id);

    return results;

  } catch (err) {
    // Jika ada error di tengah, tetap return data yang sudah didapat
    if (results.length > 0) {
      console.warn(`[FETCH WARNING] Partial data returned: ${results.length} items`);
      return results;
    }
    throw err;
  }
}

/**
 * Update pesan progress
 */
async function updateProgress(sock, from, progressMsg, newText) {
  if (!progressMsg?.key) return;

  try {
    await sock.sendMessage(from, {
      text: newText,
      edit: progressMsg.key
    });
  } catch (err) {
    // Jika edit gagal, kirim pesan baru
    console.warn("[PROGRESS UPDATE FAILED]", err.message);
  }
}

/**
 * Membuat konten laporan
 */
function buildReportContent(data) {
  const now = new Date();
  const lines = [
    "═══════════════════════════════════════════════════",
    "        📊 INSTAGRAM RELATIONSHIP ANALYSIS          ",
    "═══════════════════════════════════════════════════",
    "",
    `👤 Username      : @${data.username}`,
    `📅 Tanggal       : ${now.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`,
    `⏰ Waktu         : ${now.toLocaleTimeString("id-ID")}`,
    "",
    "───────────────────────────────────────────────────",
    "                    📈 STATISTIK                    ",
    "───────────────────────────────────────────────────",
    "",
    `👥 Total Followers  : ${formatNumber(data.followers.length)}`,
    `💚 Total Following  : ${formatNumber(data.following.length)}`,
    `🤝 Mutual Follows   : ${formatNumber(data.mutualFollows.length)}`,
    `📊 Follower Ratio   : ${data.followerRatio}x`,
    "",
    "═══════════════════════════════════════════════════",
    `        ❌ TIDAK FOLLOW BACK (${data.notFollowBack.length})        `,
    "═══════════════════════════════════════════════════",
    "",
    data.notFollowBack.length > 0 
      ? data.notFollowBack.map((u, i) => `${(i + 1).toString().padStart(4, ' ')}. @${u}`).join("\n")
      : "✨ Semua orang yang Anda follow, follow back! 🎉",
    "",
    "",
    "═══════════════════════════════════════════════════",
    `        👻 GHOST FOLLOWERS (${data.ghostFollowers.length})          `,
    "═══════════════════════════════════════════════════",
    "",
    data.ghostFollowers.length > 0
      ? data.ghostFollowers.map((u, i) => `${(i + 1).toString().padStart(4, ' ')}. @${u}`).join("\n")
      : "✨ Tidak ada ghost followers!",
    "",
    "",
    "═══════════════════════════════════════════════════",
    "                      📝 CATATAN                    ",
    "═══════════════════════════════════════════════════",
    "",
    "• Ghost Followers: Akun yang follow Anda tetapi Anda",
    "  tidak follow mereka kembali.",
    "",
    "• Tidak Follow Back: Akun yang Anda follow tetapi",
    "  mereka tidak follow Anda kembali.",
    "",
    "• Mutual Follows: Akun yang saling follow dengan Anda.",
    "",
    "═══════════════════════════════════════════════════",
    "           Generated by Instagram Bot 🤖           ",
    "═══════════════════════════════════════════════════"
  ];

  return lines.join("\n");
}

/**
 * Membuat pesan ringkasan
 */
function buildSummaryMessage(data) {
  const lines = [
    "📊 *INSTAGRAM RELATIONSHIP ANALYSIS*",
    "",
    `👤 *Username*`,
    `   @${data.username}`,
    "",
    "📈 *Statistik*",
    `   👥 Followers   : ${formatNumber(data.followersCount)}`,
    `   💚 Following   : ${formatNumber(data.followingCount)}`,
    `   🤝 Mutual      : ${formatNumber(data.mutualFollowsCount)}`,
    `   📊 Ratio       : ${data.followerRatio}x`,
    "",
    "🔍 *Analisis*",
    `   ❌ Tidak Follback : ${formatNumber(data.notFollowBackCount)} orang`,
    `   👻 Ghost Follower : ${formatNumber(data.ghostFollowersCount)} orang`,
    "",
  ];

  // Tambahkan insight
  if (data.notFollowBackCount > 0) {
    lines.push(`💡 _${data.notFollowBackCount} orang tidak follow back Anda_`);
  }

  if (data.ghostFollowersCount > data.followingCount * 0.3) {
    lines.push(`💡 _Banyak ghost followers! Pertimbangkan untuk membersihkan_`);
  }

  lines.push("");
  lines.push("📎 File laporan lengkap dikirim!");
  lines.push(`⏰ ${new Date().toLocaleString("id-ID")}`);

  return lines.join("\n");
}

/**
 * Format angka dengan pemisah ribuan
 */
function formatNumber(num) {
  return new Intl.NumberFormat("id-ID").format(num || 0);
}

/**
 * Pastikan direktori ada
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mendapatkan pesan error yang user-friendly
 */
function getErrorMessage(err) {
  const errorMessages = {
    COOKIE_MISSING: "❌ *Cookie Instagram tidak ditemukan*\n\nSilakan konfigurasi cookie di file config terlebih dahulu.",
    USER_NOT_FOUND: "❌ *User tidak ditemukan*\n\nPastikan cookie Instagram masih valid.",
    UNAUTHORIZED: "❌ *Autentikasi gagal*\n\nCookie Instagram sudah kadaluarsa. Silakan perbarui cookie Anda.",
    RATE_LIMIT: "⏸️ *Rate limit tercapai*\n\nTerlalu banyak request. Tunggu 10-15 menit sebelum mencoba lagi.",
    TIMEOUT: "⏱️ *Request timeout*\n\nProses memakan waktu terlalu lama. Coba lagi atau pastikan koneksi internet stabil.",
    ENOTFOUND: "🌐 *Tidak ada koneksi internet*\n\nPeriksa koneksi internet Anda.",
    ECONNREFUSED: "🚫 *Koneksi ditolak*\n\nServer Instagram tidak dapat dijangkau."
  };

  const errorType = err.message;

  if (errorMessages[errorType]) {
    return errorMessages[errorType];
  }

  return `❌ *Terjadi kesalahan*\n\n` +
         `Detail: ${err.message}\n\n` +
         `Silakan coba lagi dalam beberapa menit.`;
}