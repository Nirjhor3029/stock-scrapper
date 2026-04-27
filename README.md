# DSE Stock Scraper

A professional Node.js application that scrapes daily stock price data from the Dhaka Stock Exchange (DSE), stores it in MongoDB, and provides a REST API for accessing historical and real-time data.

## Features

- **Daily Scraping**: Scrapes ~400+ stocks from DSE website daily
- **MongoDB Storage**: Professional schema with proper data types
- **REST API**: Multiple endpoints for data retrieval
- **Caching**: In-memory cache (5 minutes)
- **Bangladesh Timezone**: Correct UTC+6 handling
- **Trading Hours Check**: Only scrape during trading hours
- **Weekend Handling**: Skip Friday and Saturday

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start
```

Server runs at `http://localhost:3000`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stocks` | Get cached data |
| `GET /api/stocks/live` | Get freshly scraped data |
| `GET /api/stocks/scrape` | Trigger manual scraping |
| `GET /api/stocks/:code/history?days=30` | Get historical data |
| `GET /api/stocks/json` | Download as JSON |
| `GET /api/stocks/csv` | Download as CSV |
| `GET /api/stocks/status` | Server status |
| `GET /api/stocks/scrape/stream` | SSE streaming endpoint |

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
│   ├── services/        # Business logic
│   └── utils/           # Utilities
├── .env                 # Environment variables
├── package.json         # Node.js package
└── server.js           # Entry point
```

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Scraping**: axios + cheerio
- **Logging**: Winston

## License

MIT