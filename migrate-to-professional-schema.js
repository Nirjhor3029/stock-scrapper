const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');
const StockMetadata = require('./src/models/StockMetadata');
const StockPrice = require('./src/models/StockPrice');
const logger = require('./src/utils/logger');

// Migration script to convert old schema to professional schema
async function migrateToProfessionalSchema() {
  try {
    logger.info('Starting migration to professional schema...');
    
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dse_scraper';
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
    
    // Get all old stock data
    const oldStocks = await Stock.find({}).sort({ date: 1 });
    logger.info(`Found ${oldStocks.length} old stock records to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each old stock record
    for (const oldStock of oldStocks) {
      try {
        const stockCode = oldStock.stockCode;
        const date = oldStock.date;
        const data = oldStock.data;
        
        // Skip if no data
        if (!data) {
          skippedCount++;
          continue;
        }
        
        // 1. Find or create stock metadata
        let stockMetadata = await StockMetadata.findOne({ code: stockCode.toUpperCase() });
        
        if (!stockMetadata) {
          stockMetadata = await StockMetadata.create({
            code: stockCode.toUpperCase(),
            name: stockCode, // Use trading code as name initially
            sector: 'Unknown',
            isFirstTimeScraped: false, // Already exists in old schema
            createdAt: oldStock.createdAt,
            updatedAt: new Date(),
          });
        }
        
        // 2. Check if price data already exists for this date
        const existingPrice = await StockPrice.findOne({
          stockId: stockMetadata._id,
          date: date
        });
        
        if (existingPrice) {
          skippedCount++;
          continue;
        }
        
        // 3. Convert string data to numbers
        const convertToNumber = (value) => {
          if (value === null || value === undefined || value === '') return 0;
          if (typeof value === 'number') return value;
          const cleaned = value.toString().replace(/,/g, '');
          const num = parseFloat(cleaned);
          return isNaN(num) ? 0 : num;
        };
        
        // 4. Create price record
        await StockPrice.create({
          stockId: stockMetadata._id,
          date: date,
          ltp: convertToNumber(data.LTP),
          high: convertToNumber(data.HIGH),
          low: convertToNumber(data.LOW),
          close: convertToNumber(data.CLOSEP),
          ycp: convertToNumber(data.YCP),
          change: convertToNumber(data.CHANGE),
          trade: convertToNumber(data.TRADE),
          value: convertToNumber(data.VALUE),
          volume: convertToNumber(data.VOLUME),
          dseIndex: convertToNumber(data['#']),
          scrapedAt: oldStock.scrapedAt || oldStock.createdAt,
          rawData: data,
          createdAt: oldStock.createdAt,
          updatedAt: oldStock.updatedAt,
        });
        
        // 5. Update stock metadata timestamp
        stockMetadata.lastUpdated = new Date();
        await stockMetadata.save();
        
        migratedCount++;
        
        // Log progress every 100 records
        if (migratedCount % 100 === 0) {
          logger.info(`Migrated ${migratedCount} records...`);
        }
        
      } catch (error) {
        errorCount++;
        logger.error(`Error migrating stock ${oldStock.stockCode} (${oldStock.date}):`, error.message);
      }
    }
    
    logger.info('Migration completed!');
    logger.info(`Total records: ${oldStocks.length}`);
    logger.info(`Migrated: ${migratedCount}`);
    logger.info(`Skipped: ${skippedCount}`);
    logger.info(`Errors: ${errorCount}`);
    
    // Create indexes
    logger.info('Creating indexes...');
    await StockMetadata.createIndexes();
    await StockPrice.createIndexes();
    logger.info('Indexes created');
    
    // Disconnect
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateToProfessionalSchema();
}

module.exports = migrateToProfessionalSchema;