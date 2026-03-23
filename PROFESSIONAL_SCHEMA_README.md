# Professional MongoDB Schema for DSE Stock Scraper

## Overview

This document describes the professional MongoDB schema implementation for the DSE Stock Scraper. The new schema separates stock metadata from price data, uses proper numeric data types, and implements optimal indexing strategies.

## Schema Design

### 1. StockMetadata Collection

**Purpose**: Store static stock information (metadata)

**Document Structure**:
```javascript
{
  _id: ObjectId,
  code: "BRACBANK",           // Unique stock code (uppercase)
  name: "BRAC Bank PLC",      // Full company name
  sector: "Bank",             // Sector classification
  isNew: false,               // Flag for new stocks
  lastUpdated: ISODate,       // Last price update timestamp
  createdAt: ISODate,         // Document creation timestamp
  updatedAt: ISODate          // Document update timestamp
}
```

**Indexes**:
- `{ code: 1 }` (unique) - Primary lookup by stock code

### 2. StockPrice Collection

**Purpose**: Store time-series price data (professional format)

**Document Structure**:
```javascript
{
  _id: ObjectId,
  stockId: ObjectId,          // Reference to StockMetadata
  date: ISODate,              // Trading date (Bangladesh timezone)
  
  // Core price data (numeric types for analysis)
  ltp: 75.3,                  // Last Traded Price
  high: 76.9,                 // Day's high
  low: 74.9,                  // Day's low
  close: 75.3,                // Closing price
  ycp: 75.6,                  // Yesterday's Closing Price
  change: -0.3,               // Price change
  
  // Trading activity
  trade: 2332,                // Number of trades
  value: 132.085,             // Trading value in millions
  volume: 1753108,            // Trading volume
  dseIndex: 1,                // DSE index number
  
  // Metadata
  rowNumber: 0,               // Row number in DSE table
  scrapedAt: ISODate,         // When data was scraped
  rawData: {},                // Original raw data for audit
  
  createdAt: ISODate,         // Document creation timestamp
  updatedAt: ISODate          // Document update timestamp
}
```

**Indexes**:
- `{ stockId: 1, date: 1 }` (unique) - One price per stock per day
- `{ date: -1 }` - Date-based queries
- `{ stockId: 1, date: -1 }` - Stock history queries

## Key Improvements

### 1. Data Type Correctness
- **Before**: `"LTP": "75.3"` (String)
- **After**: `ltp: 75.3` (Number)

**Benefits**:
- Fast aggregations (average, sum, etc.)
- Correct sorting (numeric vs lexicographic)
- Easy technical indicator calculations (RSI, Moving Averages)

### 2. Separation of Concerns
- **Static Data**: StockMetadata (name, sector)
- **Dynamic Data**: StockPrice (daily prices)

### 3. Scalability
- 400 stocks × 365 days = 146,000 documents/year
- 5 years ≈ 700K+ documents
- MongoDB handles this easily with proper indexing

### 4. Query Efficiency
```javascript
// Last 30 days for a stock
db.stockprices.find({
  stockId: ObjectId("..."),
  date: { $gte: last30Days }
}).sort({ date: -1 })

// Latest price for all stocks
db.stockprices.aggregate([
  { $sort: { date: -1, scrapedAt: -1 } },
  { $group: { _id: "$stockId", latest: { $first: "$$ROOT" } } }
])
```

## Usage

### Installation
```bash
npm install
```

### Migration
If you have existing data in the old schema:
```bash
# Run migration script
npm run migrate

# Test migration
npm run migrate:check
```

### Testing
```bash
# Test the professional schema
node test-professional-schema.js
```

### API Compatibility
The professional schema maintains full API compatibility. All existing endpoints work exactly the same:

- `GET /api/stocks` - Get current data (cached or fresh)
- `GET /api/stocks/live` - Get live data (always fresh scrape)
- `GET /api/stocks/scrape` - Trigger manual scraping and save to DB
- `GET /api/stocks/:code/history?days=30` - Get historical data
- `GET /api/stocks/download/json` - Download data as JSON
- `GET /api/stocks/download/csv` - Download data as CSV

### Professional Data Access
For advanced analytics, you can access the professional format directly:

```javascript
const professionalStockService = require('./src/services/professionalStockService');

// Get professional format data
const professionalData = await professionalStockService.getProfessionalData();

// Example: Calculate moving average
const movingAverage = await StockPrice.aggregate([
  { $match: { stockId: stockId } },
  { $sort: { date: -1 } },
  { $limit: 20 },
  { $group: { _id: null, avgLtp: { $avg: "$ltp" } } }
]);
```

## Migration Benefits

### Before (Old Schema)
```javascript
{
  stockCode: "BRACBANK",
  date: ISODate,
  data: {
    LTP: "75.3",           // String
    HIGH: "76.9",          // String
    LOW: "74.9",           // String
    CLOSEP: "75.3",        // String
    YCP: "75.6",           // String
    CHANGE: "-0.3",        // String
    TRADE: "2332",         // String
    VALUE: "132.0850",     // String
    VOLUME: "1753108",     // String
    TRADING_CODE: "BRACBANK" // Duplicate
  }
}
```

### After (Professional Schema)
```javascript
// StockMetadata
{
  code: "BRACBANK",
  name: "BRAC Bank PLC",
  sector: "Bank"
}

// StockPrice
{
  stockId: ObjectId("..."),
  date: ISODate,
  ltp: 75.3,              // Number
  high: 76.9,             // Number
  low: 74.9,              // Number
  close: 75.3,            // Number
  ycp: 75.6,              // Number
  change: -0.3,           // Number
  trade: 2332,            // Number
  value: 132.085,         // Number
  volume: 1753108,        // Number
  dseIndex: 1             // Number
}
```

## Performance Considerations

### Index Strategy
1. **Compound Index**: `{ stockId: 1, date: 1 }` - Most important for queries
2. **Date Index**: `{ date: -1 }` - For date-range queries
3. **Stock Index**: `{ stockId: 1, date: -1 }` - For stock history

### Query Optimization
```javascript
// Use projection to limit fields
db.stockprices.find(
  { stockId: stockId, date: { $gte: startDate } },
  { ltp: 1, high: 1, low: 1, date: 1 }  // Only needed fields
)

// Use aggregation for complex queries
db.stockprices.aggregate([
  { $match: { date: { $gte: startDate } } },
  { $group: { 
    _id: "$stockId",
    avgPrice: { $avg: "$ltp" },
    maxHigh: { $max: "$high" },
    minLow: { $min: "$low" }
  }}
])
```

## Future Enhancements

### 1. Technical Indicators
With numeric data, you can easily calculate:
- Moving Averages (SMA, EMA)
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands

### 2. Sector Analysis
With proper sector metadata:
- Sector-wise performance
- Sector rotation analysis
- Industry comparison

### 3. Real-time Analytics
- Intraday price movements
- Volume analysis
- Order flow analysis

## Troubleshooting

### Common Issues

1. **Migration Fails**
   - Check MongoDB connection
   - Ensure old data exists in `stocks` collection
   - Check logs for specific errors

2. **Indexes Not Created**
   - Run `npm run migrate` to create indexes
   - Check MongoDB permissions

3. **API Returns Old Format**
   - This is expected - API maintains backward compatibility
   - Use professional service directly for new format

### Support
For issues or questions, check the logs in the `logs/` directory.