const axios = require("axios")
const https = require("https")

// Custom HTTPS agent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})
// Rest Code...