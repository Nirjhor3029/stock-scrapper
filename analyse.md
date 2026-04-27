# scrapper-4 Project Analysis

## 1. Project Overview

**scrapper-4** is a professional DSE (Dhaka Stock Exchange) stock data scraper built with:
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Scraping**: axios + cheerio

### Core Functionality
- Scrapes ~400+ stocks from DSE website daily
- Stores daily stock price data in MongoDB
- Provides REST API for data retrieval
- Uses in-memory caching (5 minutes duration)

## 2. Database Structure

### Professional Schema (Recommended)

The project has TWO schemas:

#### A. StockMetadata Collection
Static stock information:
```javascript
{
  _id: ObjectId,
  code: "BRACBANK",        // Unique stock code
  name: "BRAC Bank PLC",   // Company name
  sector: "Bank",         // Sector classification
  lastUpdated: Date,
  createdAt: Date,
  updatedAt: Date
}
```
- Index: `{ code: 1 }` (unique)

#### B. StockPrice Collection
Daily price data (numerical types for analytics):
```javascript
{
  _id: ObjectId,
  stockId: ObjectId,    // Reference to StockMetadata
  date: Date,         // Trading date (Bangladesh timezone UTC+6)
  
  // Core price data (Number type - important!)
  ltp: 75.3,        // Last Traded Price
  high: 76.9,        // Day's high
  low: 74.9,        // Day's low
  close: 75.3,       // Closing price
  ycp: 75.6,         // Yesterday's Closing Price
  change: -0.3,       // Price change
  
  // Trading activity (Number type!)
  trade: 2332,        // Number of trades
  value: 132.085,    // Trading value in millions
  volume: 1753108,    // Trading volume
  dseIndex: 1,       // DSE index number
  
  // Metadata
  scrapedAt: Date,
  rawData: {},        // Original raw data
  createdAt: Date,
  updatedAt: Date
}
```
- Indexes:
  - `{ stockId: 1, date: 1 }` (unique) - One price per stock per day
  - `{ date: -1 }` - Date-based queries
  - `{ stockId: 1, date: -1 }` - Stock history queries

### Legacy Schema (Old - Not Recommended)

Single `stocks` collection with embedded data:
```javascript
{
  stockCode: "BRACBANK",
  date: Date,
  data: {
    LTP: "75.3",     // STRING - Problem!
    HIGH: "76.9",
    ...
  }
}
```
**Issues**:
- All values are strings (not numbers)
- Cannot do proper numeric calculations
- Cannot calculate technical indicators (RSI, Moving Averages)

## 3. Current Data Storage Pattern

### How Scraping Works
1. ScrapingService fetches data from DSE
2. Data saved to **BOTH** collections:
   - `stockService.js` → Legacy `stocks` collection
   - `professionalStockService.js` → Professional schema

### Storage Frequency
From `.env`:
```
CACHE_DURATION_MINUTES=5
```
- Data is cached for 5 minutes
- Actual scraping happens on API request

### Current Behavior
- On each API call, new scrape happens (if cache expired)
- Data is upserted (update or insert) per stock per day
- Each trading day gets ONE document per stock

## 4. Assessment: Is it Professional?

### ✅ Good
1. **Professional Schema Design**: Properly separated metadata and price data
2. **Numeric Types**: Price data stored as Numbers (not strings)
3. **Proper Indexes**: Optimized for queries
4. **Bangladesh Timezone**: Handles UTC+6 correctly
5. **Raw Data Storage**: Keeps original data for audit

### ⚠️ Issues
1. **No Automatic Scheduling**: No cron job for daily scraping
2. **Dual Storage**: Saves to both legacy AND professional schemas (redundant)
3. **No Trader Hours Check**: May scrape outside trading hours
4. **No Error Handling for Weekends**: DSE closed on Friday/Saturday

## 5. User Requirements Analysis

### Requested:
1. **Every 5 minutes**: Scrape data every 5 minutes �� (config supports this)
2. **Daily 1 record**: Store 1 data point per date ✓ (upsert handles this)
3. **Chart Indicators**: Want to use data for technical analysis ✓ (professional schema supports this)

### Need to Build:
1. Automatic scheduler (cron job) for 5-minute scraping
2. Skip weekends/closed days
3. Use ONLY professional schema (remove legacy redundancy)

## 6. Recommendations

### Changes Needed
1. Add scheduler (node-cron or node-schedule)
2. Configure for 5-minute intervals
3. Only save to professional schema collections
4. Add weekend/holiday check
5. Keep existing API for compatibility

### Database Summary
| Collection | Purpose | Docs per Day | Data Type |
|------------|---------|--------------|-----------|
| StockMetadata | Static info | 1 per stock | String |
| StockPrice | Daily prices | ~396 per day | Number |