# DSE Stock Scraper

A professional Node.js application that scrapes daily stock price data from the Dhaka Stock Exchange (DSE), stores it in MongoDB, and provides a REST API for accessing historical and real-time data.

## Features

- **Automatic Scraping**: Runs every 5 minutes via Vercel cron
- **MongoDB Storage**: Professional schema with proper data types
- **REST API**: Multiple endpoints for data retrieval
- **Caching**: In-memory cache (5 minutes)
- **Bangladesh Timezone**: Correct UTC+6 handling
- **Trading Hours Check**: Only scrape during trading hours (10:00-14:45 BST)
- **Weekend Handling**: Skip Friday and Saturday
- **Vercel Ready**: Built-in cron job support

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start server
npm start
```

Server runs at `http://localhost:3000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/stocks` | GET | Get cached data |
| `GET /api/stocks/live` | GET | Get freshly scraped data |
| `GET /api/stocks/scrape` | GET | Trigger manual scraping |
| `GET /api/stocks/:code/history` | GET | Get historical data |
| `GET /api/stocks/json` | GET | Download as JSON |
| `GET /api/stocks/csv` | GET | Download as CSV |
| `GET /api/stocks/status` | GET | Server status |
| `GET /api/stocks/scrape/stream` | GET | SSE streaming endpoint |
| `POST /api/cron/scrape` | POST | Vercel cron endpoint (automatic scraping) |
| `GET /api/scheduler/start` | GET | Start local scheduler (every 5 min) |
| `GET /api/scheduler/stop` | GET | Stop local scheduler |
| `GET /api/scheduler/status` | GET | Get scheduler status |
| `GET /api/scheduler/run` | GET | Run scrape once manually |

## Automatic 5-Minute Scraping

### How It Works

```
Every 5 minutes:
    ↓
Vercel calls POST /api/cron/scrape
    ↓
Check: Is it a trading day? (Sun-Thu)
Check: Is it trading hours? (10:00-14:45 BST)
    ↓
If NO → Skip, return { scraped: false }
If YES → Scrape DSE → Save to MongoDB
```

### Trading Hours Configuration

The scraper automatically skips when:
- **Day**: Not Sunday, Monday, Tuesday, Wednesday, or Thursday
- **Time**: Outside 10:00 AM - 2:45 PM Bangladesh Time (UTC+6)

This prevents unnecessary API calls on closed market days.

## Local Testing

### Test Manual Scraping

```bash
# Test manual scrape
curl http://localhost:3000/api/stocks/scrape
```

### Test Cron Endpoint

```bash
# Test cron endpoint (POST)
curl -X POST http://localhost:3000/api/cron/scrape
```

### Expected Response

```json
{
  "success": true,
  "message": "Successfully scraped 396 stocks",
  "scraped": true,
  "count": 396,
  "timestamp": "2026-04-27T10:30:00.000Z"
}
```

### If Market Closed

```json
{
  "success": true,
  "message": "Skipped - market is closed",
  "scraped": false,
  "reason": "outside trading hours or weekend",
  "timestamp": "2026-04-27T15:00:00.000Z"
}
```

## Local Scheduler (Optional)

For local development, you can use the built-in scheduler instead of Vercel cron:

### Start Scheduler

```bash
# Start with default 5 minutes
curl http://localhost:3000/api/scheduler/start

# Or with custom interval
curl "http://localhost:3000/api/scheduler/start?minutes=3"
```

Response:
```json
{
  "success": true,
  "message": "Scheduler started: every 5 minutes"
}
```

### Check Status

```bash
curl http://localhost:3000/api/scheduler/status
```

Response:
```json
{
  "isRunning": true,
  "intervalMinutes": 5,
  "lastRun": "2026-04-27T10:30:00.000Z",
  "lastSuccess": "2026-04-27T10:30:00.000Z",
  "lastError": null
}
```

### Run Once Manually

```bash
curl http://localhost:3000/api/scheduler/run
```

### Stop Scheduler

```bash
curl http://localhost:3000/api/scheduler/stop
```

**Note**: Use either Vercel cron OR local scheduler, not both. Vercel cron is recommended for production.

## Deployment to Vercel

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Add Vercel cron support"
git push origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository

### Step 3: Configure Environment Variables

In Vercel dashboard, go to Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|------------|
| `NODE_ENV` | `production` | Production |
| `PORT` | `3000` | Production |
| `MONGODB_URI` | Your MongoDB Atlas connection string | Production |
| `CACHE_DURATION_MINUTES` | `5` | Production |
| `LOG_LEVEL` | `info` | Production |
| `DSE_URL` | `https://www.dsebd.org/latest_share_price_scroll_by_value.php` | Production |
| `TRADING_START_HOUR` | `10` | Production |
| `TRADING_START_MINUTE` | `0` | Production |
| `TRADING_END_HOUR` | `14` | Production |
| `TRADING_END_MINUTE` | `45` | Production |
| `TRADING_DAYS` | `0,1,2,3,4` | Production |

### Step 4: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Your app is live at `https://your-project.vercel.app`

### Step 5: Verify Cron is Running

After deployment, Vercel cron will automatically:
1. Hit `POST /api/cron/scrape` every 5 minutes
2. Trigger scraping during trading hours only

Check Vercel dashboard → Functions → Cron to monitor execution.

## MongoDB Setup

### Local MongoDB

```env
MONGODB_URI=mongodb://localhost:27017/dse_scraper
```

### MongoDB Atlas (For Vercel)

1. Create free account at [atlas.mongodb.com](https://atlas.mongodb.com)
2. Create cluster (free tier)
3. Create database user
4. Get connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/dse_scraper?retryWrites=true&w=majority
   ```
5. Use this as `MONGODB_URI` in Vercel

## Database Schema

### StockMetadata Collection
Static stock information:

```javascript
{
  code: "BRACBANK",        // Unique stock code
  name: "BRAC Bank PLC",  // Company name
  sector: "Bank",          // Sector classification
  lastUpdated: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:
- `{ code: 1 }` (unique)

### StockPrice Collection
Daily price data (numeric types for analysis):

```javascript
{
  stockId: ObjectId,    // Reference to StockMetadata
  date: Date,         // Trading date (Bangladesh timezone)
  
  // Core price data (Number type!)
  ltp: 75.3,        // Last Traded Price
  high: 76.9,        // Day's high
  low: 74.9,         // Day's low
  close: 75.3,       // Closing price
  ycp: 75.6,         // Yesterday's Closing Price
  change: -0.3,       // Price change
  
  // Trading activity (Number type!)
  trade: 2332,       // Number of trades
  value: 132.085,    // Trading value in millions
  volume: 1753108,    // Trading volume
  dseIndex: 1,       // DSE index number
  
  // Metadata
  scrapedAt: Date,
  rawData: {},       // Original raw data for audit
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:
- `{ stockId: 1, date: 1 }` (unique) - One price per stock per day
- `{ date: -1 }` - Date-based queries
- `{ stockId: 1, date: -1 }` - Stock history queries

## Configuration

Edit the `.env` file:

```env
# Server
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/dse_scraper

# DSE Website URL
DSE_URL=https://www.dsebd.org/latest_share_price_scroll_by_value.php

# Cache Duration (minutes)
CACHE_DURATION_MINUTES=5

# Trading Hours (Bangladesh Time UTC+6)
TRADING_START_HOUR=10
TRADING_START_MINUTE=0
TRADING_END_HOUR=14
TRADING_END_MINUTE=45
TRADING_DAYS=0,1,2,3,4  # Sun-Thu (Bangladesh work week)

# Logging
LOG_LEVEL=info
```

## Technical Indicators

With numeric data types, you can easily calculate:
- Moving Averages (SMA, EMA)
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands

## Project Structure

```
scrapper-4/
├── src/
│   ├── config/           # Configuration
│   ├── controllers/     # Route controllers
│   ├── models/           # MongoDB models
│   ├── routes/          # API routes
│   │   ├── stockRoutes.js
│   │   ├── cronRoutes.js     # Vercel cron endpoints
│   │   └── schedulerRoutes.js  # Local scheduler endpoints
│   ├── services/        # Business logic
│   │   ├── scrapingService.js
│   │   ├── professionalStockService.js
│   │   └── localScheduler.js   # Local scheduler
│   └── utils/           # Utilities
│       ├── tradingHours.js   # Trading hours helper
│       └── logger.js
├── .env                 # Environment variables
├── .env.example         # Environment template
├── vercel.json          # Vercel cron configuration
├── package.json         # Node.js package
└── server.js           # Entry point
```
scrapper-4/
├── src/
│   ├── config/           # Configuration
│   ├── controllers/     # Route controllers
│   ├── models/           # MongoDB models
│   ├── routes/          # API routes
│   │   ├── stockRoutes.js
│   │   └── cronRoutes.js    # Vercel cron endpoints
│   ├── services/        # Business logic
│   └── utils/           # Utilities
│   │   └── tradingHours.js   # Trading hours helper
├── .env                 # Environment variables
├── .env.example         # Environment template
├── vercel.json          # Vercel cron configuration
├── package.json         # Node.js package
└── server.js           # Entry point
```

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Scraping**: axios + cheerio
- **Scheduler**: node-cron (for local)
- **Logging**: Winston
- **Deployment**: Vercel

## License

MIT