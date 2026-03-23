const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dse_scraper';
    
    await mongoose.connect(MONGODB_URI);
    
    logger.info('MongoDB connected successfully');
    
    // Ensure indexes are created
    await ensureIndexes();
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

// Ensure all indexes are created for professional schema
const ensureIndexes = async () => {
  try {
    // Import models to ensure they're registered
    require('../models/StockMetadata');
    require('../models/StockPrice');
    
    // Create indexes for StockMetadata
    const StockMetadata = mongoose.model('StockMetadata');
    await StockMetadata.createIndexes();
    logger.info('StockMetadata indexes created');
    
    // Create indexes for StockPrice
    const StockPrice = mongoose.model('StockPrice');
    await StockPrice.createIndexes();
    logger.info('StockPrice indexes created');
    
  } catch (error) {
    logger.warn('Error ensuring indexes:', error.message);
    // Don't throw error, as indexes might already exist
  }
};

module.exports = connectDB;