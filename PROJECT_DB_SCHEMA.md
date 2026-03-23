# DSE Stock Scraper - Database Schema & Project Overview

## 1. Project Overview

**DSE Stock Scraper** is a professional Node.js application that scrapes daily stock price data from the Dhaka Stock Exchange (DSE) website, stores it in MongoDB, and provides a REST API for accessing historical and real-time data.

### Key Features:
- **Daily Scraping**: Scrapes ~400+ stocks from DSE website daily
- **Historical Storage**: Stores daily snapshots for historical analysis
- **REST API**: Multiple endpoints for data retrieval
- **Real-time Streaming**: Server-Sent Events for live data
- **Bangladesh Timezone**: Handles UTC+6 timezone correctly
- **Caching**: In-memory cache to reduce database/scraping load

### Core Functionality:
1. Scrape stock prices from `dsebd.org`
2. Store each stock's daily data in MongoDB
3. Provide historical data (up to 30+ days)
4. Export data in JSON/CSV formats
5. Real-time streaming via SSE

## 2. Database Schema (High-Level)

**Database**: MongoDB  
**Collection**: `stocks` (main and only collection)

### Schema Design Philosophy:
- **Denormalized**: Stock data embedded directly in each document
- **Daily Snapshots**: One document per stock per trading day
- **Flexible Schema**: Can accommodate additional fields from DSE website
- **Optimized for Queries**: Indexed for fast stock + date range queries

## 3. Key Collections & Fields

### `stocks` Collection

#### Core Fields:
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `stockCode` | String | Stock trading code (uppercase) | `"BRACBANK"` |
| `date` | Date | Trading date (Bangladesh timezone) | `ISODate("2026-03-22T00:00:00Z")` |
| `data` | Object | Embedded stock price data | See below |
| `scrapedAt` | Date | When data was scraped | `ISODate("2026-03-22T13:26:30.979Z")` |
| `createdAt` | Date | Auto-generated creation timestamp | Auto |
| `updatedAt` | Date | Auto-generated update timestamp | Auto |

#### Embedded `data` Object Fields:
| Field | Description | Example |
|-------|-------------|---------|
| `LTP` | Last Traded Price | `"75.3"` |
| `HIGH` | Day's High price | `"76.9"` |
| `LOW` | Day's Low price | `"74.9"` |
| `CLOSEP` | Closing Price | `"75.3"` |
| `YCP` | Yesterday's Closing Price | `"75.6"` |
| `CHANGE` | Price Change | `"-0.3"` |
| `TRADE` | Number of Trades | `"2,332"` |
| `VALUE` | Trading Value (millions) | `"132.0850"` |
| `VOLUME` | Trading Volume | `"1,753,108"` |
| `TRADING_CODE` | Duplicate of stockCode | `"BRACBANK"` |
| `#` | Row number from DSE | `"5"` |

*Note: Additional fields from DSE website are also stored (strict: false)*

## 4. Indexes

| Index | Type | Purpose |
|-------|------|---------|
| `{ stockCode: 1 }` | Single Field | Fast lookups by stock code |
| `{ date: 1 }` | Single Field | Fast date range queries |
| `{ scrapedAt: 1 }` | Single Field | Track scraping timestamps |
| `{ stockCode: 1, date: 1 }` | Compound Unique | **Primary Index**: Ensures one record per stock per day, enables fast historical queries |

## 5. Sample Documents

### Example 1: Single Stock Daily Record
```json
{
  "_id": ObjectId("69bfee07b6a2691b8200095a"),
  "stockCode": "BRACBANK",
  "date": ISODate("2026-03-22T00:00:00Z"),
  "data": {
    "LTP": "75.3",
    "HIGH": "76.9",
    "LOW": "74.9",
    "CLOSEP": "75.3",
    "YCP": "75.6",
    "CHANGE": "-0.3",
    "TRADE": "2,332",
    "VALUE": "132.0850",
    "VOLUME": "1,753,108",
    "TRADING_CODE": "BRACBANK",
    "#": "5"
  },
  "scrapedAt": ISODate("2026-03-22T13:26:30.979Z"),
  "createdAt": ISODate("2026-03-22T13:26:30.991Z"),
  "updatedAt": ISODate("2026-03-22T13:26:30.991Z")
}
```

### Example 2: Different Stock, Same Date
```json
{
  "_id": ObjectId("69bfee07b6a2691b8200095b"),
  "stockCode": "ORIONINFU",
  "date": ISODate("2026-03-22T00:00:00Z"),
  "data": {
    "LTP": "359.8",
    "HIGH": "361",
    "LOW": "353.3",
    "CLOSEP": "359.8",
    "YCP": "357.7",
    "CHANGE": "2.1",
    "TRADE": "2,659",
    "VALUE": "147.3420",
    "VOLUME": "410,937",
    "TRADING_CODE": "ORIONINFU",
    "#": "1"
  },
  "scrapedAt": ISODate("2026-03-22T13:26:30.979Z")
}
```

### Example 3: Same Stock, Previous Day
```json
{
  "_id": ObjectId("69bfee07b6a2691b8200095c"),
  "stockCode": "BRACBANK",
  "date": ISODate("2026-03-21T00:00:00Z"),
  "data": {
    "LTP": "76.1",
    "HIGH": "77.2",
    "LOW": "75.8",
    "CLOSEP": "76.1",
    "YCP": "75.9",
    "CHANGE": "0.2",
    "TRADE": "2,145",
    "VALUE": "138.4210",
    "VOLUME": "1,820,345",
    "TRADING_CODE": "BRACBANK",
    "#": "3"
  },
  "scrapedAt": ISODate("2026-03-21T13:25:15.123Z")
}
```

## 6. Sample Queries

### Get All Historical Data for a Stock
```javascript
// MongoDB Shell
db.stocks.find({ 
  stockCode: "BRACBANK" 
}).sort({ date: -1 });

// With date range (last 30 days)
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

db.stocks.find({
  stockCode: "BRACBANK",
  date: { $gte: thirtyDaysAgo }
}).sort({ date: -1 });
```

### Get Latest Data for All Stocks (Today)
```javascript
// Group by stockCode and get latest document for each
db.stocks.aggregate([
  { $sort: { date: -1, scrapedAt: -1 } },
  { 
    $group: {
      _id: "$stockCode",
      latestData: { $first: "$$ROOT" }
    }
  }
]);
```

### Check Data for Specific Date
```javascript
db.stocks.find({
  date: ISODate("2026-03-22T00:00:00Z")
}).count(); // Should be ~396 (one per stock)
```

## 7. Data Flow

```
DSE Website (dsebd.org)
       ↓
Scraping Service (axios + cheerio)
       ↓
Raw Stock Data Array (400+ objects)
       ↓
Stock Service (date handling, data mapping)
       ↓
MongoDB Upsert (findOneAndUpdate with upsert)
       ↓
Stocks Collection (daily snapshots)
       ↓
API Endpoints / Cache / Streaming
```

### Key Points:
1. **Daily Upserts**: Same `stockCode` + `date` updates existing record
2. **Bangladesh Time**: Dates stored in Bangladesh timezone (UTC+6)
3. **Flexible Storage**: Additional DSE fields automatically stored
4. **Historical Accumulation**: Each day's data persists indefinitely

## 8. Project Structure (Brief)

```
scrapper-4/
├── src/
│   ├── models/Stock.js          # Database schema
│   ├── services/
│   │   ├── scrapingService.js   # Web scraping logic
│   │   └── stockService.js      # Database operations
│   └── ...
├── simple-ui.html               # Frontend interface
└── PROJECT_DB_SCHEMA.md         # This document
```

## 9. Design Considerations

### Advantages of Current Design:
- **Simple Queries**: No joins needed
- **Read Performance**: Single collection queries
- **Natural Fit**: Stock data is self-contained
- **Easy Backup**: Single collection export/import

### Trade-offs:
- **Data Duplication**: `stockCode` repeated in each document
- **Update Complexity**: Changing stock metadata requires updating all documents
- **Storage**: Slightly more storage (negligible for text data)

### Suitable For:
- **Read-heavy workloads**: Historical data retrieval
- **Time-series analysis**: Daily stock price tracking
- **Small to medium datasets**: 396 stocks × 365 days = ~144K documents/year

---

**Last Updated**: 2026-03-22  
**Version**: 1.0  
**Database**: MongoDB  
**Primary Use Case**: Daily DSE stock price storage and retrieval