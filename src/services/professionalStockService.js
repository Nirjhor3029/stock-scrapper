const StockMetadata = require('../models/StockMetadata');
const StockPrice = require('../models/StockPrice');
const logger = require('../utils/logger');

class ProfessionalStockService {
  constructor() {
    this.cachedData = null;
    this.lastScrapedTime = null;
  }

  // Helper to get Bangladesh date (UTC+6)
  getBangladeshDate() {
    const now = new Date();
    const offset = 6 * 60 * 60 * 1000;
    const bangladeshNow = new Date(now.getTime() + offset);
    const year = bangladeshNow.getUTCFullYear();
    const month = bangladeshNow.getUTCMonth();
    const day = bangladeshNow.getUTCDate();
    return new Date(Date.UTC(year, month, day));
  }

  // Convert string values to numbers, handling commas and special cases
  convertToNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    
    // Remove commas and convert to number
    const cleaned = value.toString().replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  async saveStockToDB(stockDataArray) {
    try {
      const bangladeshDate = this.getBangladeshDate();
      
      const savePromises = stockDataArray.map(async (stock) => {
        const stockCode = stock['TRADING CODE'];
        if (!stockCode) return;
        
        try {
          // 1. Find or create stock metadata
          let stockMetadata = await StockMetadata.findOne({ code: stockCode.toUpperCase() });
          
          if (!stockMetadata) {
            stockMetadata = await StockMetadata.create({
              code: stockCode.toUpperCase(),
              name: stockCode, // Use trading code as name initially
              sector: 'Unknown',
              isFirstTimeScraped: true,
            });
            logger.info(`Created new stock metadata for ${stockCode}`);
          }
          
          // 2. Prepare price data with numeric conversion
          const priceData = {
            stockId: stockMetadata._id,
            date: bangladeshDate,
            ltp: this.convertToNumber(stock['LTP*']),
            high: this.convertToNumber(stock['HIGH']),
            low: this.convertToNumber(stock['LOW']),
            close: this.convertToNumber(stock['CLOSEP*']),
            ycp: this.convertToNumber(stock['YCP*']),
            change: this.convertToNumber(stock['CHANGE']),
            trade: this.convertToNumber(stock['TRADE']),
            value: this.convertToNumber(stock['VALUE (mn)']),
            volume: this.convertToNumber(stock['VOLUME']),
            dseIndex: this.convertToNumber(stock['#']),
            scrapedAt: new Date(),
            rawData: stock, // Store original raw data for debugging
          };
          
          // 3. Upsert price data
          await StockPrice.findOneAndUpdate(
            { stockId: stockMetadata._id, date: bangladeshDate },
            priceData,
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
          );
          
          // 4. Update stock metadata timestamp
          stockMetadata.lastUpdated = new Date();
          await stockMetadata.save();
          
        } catch (err) {
          logger.error(`Error saving stock ${stockCode} to DB:`, err.message);
        }
      });
      
      await Promise.allSettled(savePromises);
      logger.info(`Saved ${stockDataArray.length} stocks to MongoDB for date ${bangladeshDate.toISOString().split('T')[0]}`);
      
    } catch (error) {
      logger.error('Error saving stocks to database:', error.message);
      throw error;
    }
  }

  // Convert professional format to legacy format for API compatibility
  convertToLegacyFormat(professionalData) {
    return professionalData.map(item => ({
      'TRADING CODE': item.stockCode,
      'LTP*': item.ltp.toString(),
      'HIGH': item.high.toString(),
      'LOW': item.low.toString(),
      'CLOSEP*': item.close.toString(),
      'YCP*': item.ycp.toString(),
      'CHANGE': item.change.toString(),
      'TRADE': item.trade.toString(),
      'VALUE (mn)': item.value.toString(),
      'VOLUME': item.volume.toString(),
      '#': item.dseIndex.toString(),
    }));
  }

  updateCache(stockData) {
    // Convert to professional format before caching
    const professionalData = stockData.map(stock => ({
      stockCode: stock['TRADING CODE'],
      ltp: this.convertToNumber(stock['LTP*']),
      high: this.convertToNumber(stock['HIGH']),
      low: this.convertToNumber(stock['LOW']),
      close: this.convertToNumber(stock['CLOSEP*']),
      ycp: this.convertToNumber(stock['YCP*']),
      change: this.convertToNumber(stock['CHANGE']),
      trade: this.convertToNumber(stock['TRADE']),
      value: this.convertToNumber(stock['VALUE (mn)']),
      volume: this.convertToNumber(stock['VOLUME']),
      dseIndex: this.convertToNumber(stock['#']),
    }));
    
    this.cachedData = professionalData;
    this.lastScrapedTime = new Date();
  }

  isCacheValid(cacheDurationMinutes) {
    if (!this.cachedData || !this.lastScrapedTime) {
      return false;
    }
    
    const now = new Date();
    const cacheExpirationTime = new Date(this.lastScrapedTime.getTime() + cacheDurationMinutes * 60 * 1000);
    return now < cacheExpirationTime;
  }

  getCachedData() {
    // Return legacy format for API compatibility
    const legacyData = this.cachedData ? this.convertToLegacyFormat(this.cachedData) : null;
    
    return {
      data: legacyData,
      lastScraped: this.lastScrapedTime,
      count: legacyData ? legacyData.length : 0,
    };
  }

  async getHistoricalData(stockCode, days = 30) {
    try {
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      // Find stock metadata
      const stockMetadata = await StockMetadata.findOne({ code: stockCode.toUpperCase() });
      if (!stockMetadata) {
        return [];
      }
      
      // Get price history
      const prices = await StockPrice.find({
        stockId: stockMetadata._id,
        date: { $gte: date }
      }).sort({ date: -1 });
      
      // Convert to legacy format for API compatibility
      return prices.map(price => ({
        stockCode: stockCode.toUpperCase(),
        date: price.date,
        data: {
          LTP: price.ltp.toString(),
          HIGH: price.high.toString(),
          LOW: price.low.toString(),
          CLOSEP: price.close.toString(),
          YCP: price.ycp.toString(),
          CHANGE: price.change.toString(),
          TRADE: price.trade.toString(),
          VALUE: price.value.toString(),
          VOLUME: price.volume.toString(),
          TRADING_CODE: stockCode.toUpperCase(),
          '#': price.dseIndex.toString(),
        },
        scrapedAt: price.scrapedAt,
        createdAt: price.createdAt,
        updatedAt: price.updatedAt,
      }));
    } catch (error) {
      logger.error(`Error getting historical data for ${stockCode}:`, error.message);
      throw error;
    }
  }

  async getLatestData() {
    try {
      // Get latest prices for all stocks
      const latestPrices = await StockPrice.findLatestPrices();
      
      // Convert to legacy format
      return latestPrices.map(item => ({
        'TRADING CODE': item.stockCode,
        'LTP*': item.ltp.toString(),
        'HIGH': item.high.toString(),
        'LOW': item.low.toString(),
        'CLOSEP*': item.close.toString(),
        'YCP*': item.ycp.toString(),
        'CHANGE': item.change.toString(),
        'TRADE': item.trade.toString(),
        'VALUE (mn)': item.value.toString(),
        'VOLUME': item.volume.toString(),
        '#': item.dseIndex.toString(),
      }));
    } catch (error) {
      logger.error('Error getting latest data:', error.message);
      throw error;
    }
  }

  // New method to get professional format data
  async getProfessionalData() {
    try {
      const latestPrices = await StockPrice.findLatestPrices();
      return latestPrices;
    } catch (error) {
      logger.error('Error getting professional data:', error.message);
      throw error;
    }
  }

  // Method to update stock metadata (name, sector)
  async updateStockMetadata(stockCode, updates) {
    try {
      const stockMetadata = await StockMetadata.findOneAndUpdate(
        { code: stockCode.toUpperCase() },
        { ...updates, lastUpdated: new Date() },
        { new: true }
      );
      return stockMetadata;
    } catch (error) {
      logger.error(`Error updating metadata for ${stockCode}:`, error.message);
      throw error;
    }
  }

  // Method to get all stock metadata
  async getAllStockMetadata() {
    try {
      return await StockMetadata.find().sort({ code: 1 });
    } catch (error) {
      logger.error('Error getting all stock metadata:', error.message);
      throw error;
    }
  }
}

module.exports = new ProfessionalStockService();