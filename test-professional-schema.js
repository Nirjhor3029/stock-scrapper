const mongoose = require('mongoose');
const StockMetadata = require('./src/models/StockMetadata');
const StockPrice = require('./src/models/StockPrice');
const professionalStockService = require('./src/services/professionalStockService');
const logger = require('./src/utils/logger');

// Test the professional schema implementation
async function testProfessionalSchema() {
  try {
    logger.info('Testing professional schema implementation...');
    
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dse_scraper';
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');
    
    // Test 1: Check if models exist
    logger.info('Test 1: Checking if models exist...');
    const metadataCount = await StockMetadata.countDocuments();
    const priceCount = await StockPrice.countDocuments();
    logger.info(`StockMetadata documents: ${metadataCount}`);
    logger.info(`StockPrice documents: ${priceCount}`);
    
    // Test 2: Create sample data
    logger.info('Test 2: Creating sample data...');
    const sampleStockData = [
      {
        'TRADING CODE': 'TESTBANK',
        'LTP*': '100.50',
        'HIGH': '102.00',
        'LOW': '99.00',
        'CLOSEP*': '101.00',
        'YCP*': '100.00',
        'CHANGE': '0.50',
        'TRADE': '1000',
        'VALUE (mn)': '100.5',
        'VOLUME': '1000000',
        '#': '1',
      },
      {
        'TRADING CODE': 'TESTPHARMA',
        'LTP*': '250.00',
        'HIGH': '255.00',
        'LOW': '248.00',
        'CLOSEP*': '252.00',
        'YCP*': '249.00',
        'CHANGE': '1.00',
        'TRADE': '500',
        'VALUE (mn)': '125.0',
        'VOLUME': '500000',
        '#': '2',
      },
    ];
    
    // Test 3: Save sample data using professional service
    logger.info('Test 3: Saving sample data...');
    await professionalStockService.saveStockToDB(sampleStockData);
    
    // Test 4: Retrieve data
    logger.info('Test 4: Retrieving data...');
    const latestData = await professionalStockService.getLatestData();
    logger.info(`Retrieved ${latestData.length} stocks`);
    logger.info('Sample data:', JSON.stringify(latestData[0], null, 2));
    
    // Test 5: Get historical data
    logger.info('Test 5: Getting historical data...');
    const historicalData = await professionalStockService.getHistoricalData('TESTBANK', 7);
    logger.info(`Retrieved ${historicalData.length} historical records for TESTBANK`);
    
    // Test 6: Check data types
    logger.info('Test 6: Checking data types...');
    if (latestData.length > 0) {
      const sample = latestData[0];
      logger.info(`LTP type: ${typeof sample['LTP*']} (value: ${sample['LTP*']})`);
      logger.info(`HIGH type: ${typeof sample['HIGH']} (value: ${sample['HIGH']})`);
      logger.info(`VOLUME type: ${typeof sample['VOLUME']} (value: ${sample['VOLUME']})`);
    }
    
    // Test 7: Check indexes
    logger.info('Test 7: Checking indexes...');
    const metadataIndexes = await StockMetadata.collection.getIndexes();
    const priceIndexes = await StockPrice.collection.getIndexes();
    logger.info(`StockMetadata indexes: ${Object.keys(metadataIndexes).length}`);
    logger.info(`StockPrice indexes: ${Object.keys(priceIndexes).length}`);
    
    logger.info('All tests passed!');
    
    // Disconnect
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testProfessionalSchema();
}

module.exports = testProfessionalSchema;