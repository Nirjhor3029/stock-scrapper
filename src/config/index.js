require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dse_scraper',
  },
  dse: {
    url: process.env.DSE_URL || 'https://www.dsebd.org/latest_share_price_scroll_by_value.php',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
  cache: {
    durationMinutes: parseInt(process.env.CACHE_DURATION_MINUTES, 10) || 5,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;