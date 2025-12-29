const axios = require("axios")
const https = require("https")

// Custom HTTPS agent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

module.exports = {
  name: "instagram",
  description: "Download video/foto dari Instagram",
  usage: "!instagram <link>",
  
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid
    
    // Validasi input
    if (args.length === 0) {
      await sock.sendMessage(from, {
        text: `❌ Link Instagram tidak ditemukan!

*Usage:*
!instagram <link>

*Example:*
!instagram https://www.instagram.com/p/xxxxx/
!instagram https://www.instagram.com/reel/xxxxx/`
      })
      return
    }

    let url = args[0]
    
    // Clean URL
    url = url.split("?")[0].trim()
    
    // Validasi URL Instagram
    if (!url.includes("instagram.com")) {
      await sock.sendMessage(from, {
        text: "❌ Link tidak valid!\n\nPastikan link dari instagram.com"
      })
      return
    }

    // Extract shortcode
    const shortcodeMatch = url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
    if (!shortcodeMatch) {
      await sock.sendMessage(from, {
        text: "❌ Format URL tidak valid!\n\nContoh yang benar:\n• https://www.instagram.com/p/xxxxx/\n• https://www.instagram.com/reel/xxxxx/"
      })
      return
    }
    
    const shortcode = shortcodeMatch[1]
    console.log(`   📷 Shortcode: ${shortcode}`)

    // Kirim loading message
    await sock.sendMessage(from, {
      text: "⏳ Sedang mengunduh dari Instagram...\n\nMohon tunggu 10-20 detik ⏰"
    })

    try {
      // Method 1: Direct Instagram GraphQL (Most reliable)
      console.log("   🔄 Method 1: Instagram Direct...")
      
      try {
        const graphqlUrl = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(JSON.stringify({
          shortcode: shortcode,
          child_comment_count: 0,
          fetch_comment_count: 0,
          parent_comment_count: 0,
          has_threaded_comments: false
        }))}`
        
        const response = await axios.get(graphqlUrl, {
          headers: {
            "User-Agent": "Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)",
            "Accept": "*/*",
            "Accept-Language": "en-US",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive"
          },
          httpsAgent,
          timeout: 30000
        })

        const media = response.data?.data?.shortcode_media
        
        if (media) {
          let mediaUrl, mediaType
          
          if (media.is_video) {
            mediaUrl = media.video_url
            mediaType = "video"
          } else {
            mediaUrl = media.display_url
            mediaType = "image"
          }
          
          if (mediaUrl) {
            console.log(`   ✅ Found ${mediaType}: ${mediaUrl.substring(0, 50)}...`)
            
            // Download
            const mediaResponse = await axios.get(mediaUrl, {
              responseType: "arraybuffer",
              timeout: 90000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
              },
              httpsAgent
            })
            
            const mediaBuffer = Buffer.from(mediaResponse.data)
            
            if (mediaBuffer.length < 1000) {
              throw new Error("Invalid media data")
            }
            
            const sizeMB = (mediaBuffer.length / (1024 * 1024)).toFixed(2)
            
            if (mediaBuffer.length > 100 * 1024 * 1024) {
              throw new Error(`Media terlalu besar (${sizeMB}MB, max 100MB)`)
            }
            
            // Get caption
            const caption = media.edge_media_to_caption?.edges[0]?.node?.text || ""
            const captionText = caption 
              ? `\n\n📄 ${caption.substring(0, 100)}${caption.length > 100 ? "..." : ""}`
              : ""
            
            // Send
            if (mediaType === "video") {
              await sock.sendMessage(from, {
                video: mediaBuffer,
                caption: `✅ *Instagram Downloader*\n\n📹 Video\n💾 ${sizeMB}MB${captionText}\n\n_Downloaded from Instagram_`,
                mimetype: "video/mp4"
              })
            } else {
              await sock.sendMessage(from, {
                image: mediaBuffer,
                caption: `✅ *Instagram Downloader*\n\n🖼️ Photo\n💾 ${sizeMB}MB${captionText}\n\n_Downloaded from Instagram_`
              })
            }
            
            console.log(`   ✅ Success! Sent ${sizeMB}MB ${mediaType}`)
            return
          }
        }
      } catch (err) {
        console.log(`   ❌ Method 1 failed: ${err.message}`)
      }

      // Method 2: Alternative scraping
      console.log("   🔄 Method 2: Alternative scraping...")
      
      try {
        const postUrl = `https://www.instagram.com/p/${shortcode}/`
        
        const response = await axios.get(postUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate"
          },
          httpsAgent,
          timeout: 30000
        })
        
        const html = response.data
        
        // Extract JSON data from HTML
        const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[1])
          
          let mediaUrl, mediaType
          
          if (jsonData.video && jsonData.video.contentUrl) {
            mediaUrl = jsonData.video.contentUrl
            mediaType = "video"
          } else if (jsonData.image) {
            mediaUrl = jsonData.image
            mediaType = "image"
          }
          
          if (mediaUrl) {
            console.log(`   ✅ Found ${mediaType} from HTML`)
            
            // Download
            const mediaResponse = await axios.get(mediaUrl, {
              responseType: "arraybuffer",
              timeout: 90000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.instagram.com/"
              },
              httpsAgent
            })
            
            const mediaBuffer = Buffer.from(mediaResponse.data)
            
            if (mediaBuffer.length < 1000) {
              throw new Error("Invalid media data")
            }
            
            const sizeMB = (mediaBuffer.length / (1024 * 1024)).toFixed(2)
            
            if (mediaBuffer.length > 100 * 1024 * 1024) {
              throw new Error(`Media terlalu besar (${sizeMB}MB, max 100MB)`)
            }
            
            // Send
            if (mediaType === "video") {
              await sock.sendMessage(from, {
                video: mediaBuffer,
                caption: `✅ *Instagram Downloader*\n\n📹 Video\n💾 ${sizeMB}MB\n\n_Downloaded from Instagram_`,
                mimetype: "video/mp4"
              })
            } else {
              await sock.sendMessage(from, {
                image: mediaBuffer,
                caption: `✅ *Instagram Downloader*\n\n🖼️ Photo\n💾 ${sizeMB}MB\n\n_Downloaded from Instagram_`
              })
            }
            
            console.log(`   ✅ Success! Sent ${sizeMB}MB ${mediaType}`)
            return
          }
        }
      } catch (err) {
        console.log(`   ❌ Method 2 failed: ${err.message}`)
      }

      // All methods failed
      throw new Error("Cannot extract media from Instagram")

    } catch (err) {
      console.error("   ❌ Instagram download error:", err.message)

      let errorMsg = "❌ Gagal mengunduh dari Instagram!\n\n"

      if (err.message.includes("Cannot extract") || err.message.includes("not found")) {
        errorMsg += "Post tidak ditemukan atau Instagram memblokir akses.\n\n💡 Solusi:\n• Pastikan post public (bukan private)\n• Tunggu 5-10 menit\n• Coba link yang berbeda"
      } else if (err.message.includes("Invalid media data")) {
        errorMsg += "Data media tidak valid atau Instagram sedang memblokir bot.\n\nCoba lagi dalam 5-10 menit."
      } else if (err.message.includes("timeout") || err.message.includes("ENOTFOUND") || err.message.includes("EAI_AGAIN")) {
        errorMsg += "⚠️ *Koneksi Bermasalah*\n\nKemungkinan:\n• Koneksi internet tidak stabil\n• DNS tidak bisa resolve domain\n• Server Instagram memblokir IP\n\n💡 Solusi:\n1. Cek koneksi internet\n2. Ganti DNS (gunakan 8.8.8.8)\n3. Restart router\n4. Tunggu 5-10 menit\n5. Coba lagi"
      } else if (err.message.includes("terlalu besar")) {
        errorMsg += err.message
      } else {
        errorMsg += `Instagram sedang membatasi akses.\n\nError: ${err.message}\n\n⏰ Coba lagi dalam 10-15 menit.\n\nKetik *!menu* untuk bantuan.`
      }

      await sock.sendMessage(from, { text: errorMsg })
    }
  }
}