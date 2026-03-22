const Stock = require('../models/Stock');
const logger = require('../utils/logger');

class StockService {
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

  async saveStockToDB(stockDataArray) {
    try {
      const bangladeshDate = this.getBangladeshDate();
      
      const savePromises = stockDataArray.map(async (stock) => {
        const stockCode = stock['TRADING CODE'];
        if (!stockCode) return;
        
        const doc = {
          stockCode,
          date: bangladeshDate,
          data: {
            LTP: stock['LTP*'] || '',
            HIGH: stock['HIGH'] || '',
            LOW: stock['LOW'] || '',
            CLOSEP: stock['CLOSEP*'] || '',
            YCP: stock['YCP*'] || '',
            CHANGE: stock['CHANGE'] || '',
            TRADE: stock['TRADE'] || '',
            VALUE: stock['VALUE (mn)'] || '',
            VOLUME: stock['VOLUME'] || '',
            TRADING_CODE: stock['TRADING CODE'] || '',
          },
          scrapedAt: new Date()
        };
        
        // Add any extra fields that appear in stock object
        Object.keys(stock).forEach(key => {
          if (!doc.data.hasOwnProperty(key)) {
            doc.data[key] = stock[key];
          }
        });
        
        try {
          await Stock.findOneAndUpdate(
            { stockCode, date: bangladeshDate },
            doc,
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
          );
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

  updateCache(stockData) {
    this.cachedData = stockData;
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
    return {
      data: this.cachedData,
      lastScraped: this.lastScrapedTime,
      count: this.cachedData ? this.cachedData.length : 0,
    };
  }

  async getHistoricalData(stockCode, days = 30) {
    try {
      const data = await Stock.findByStockCode(stockCode, days);
      return data;
    } catch (error) {
      logger.error(`Error getting historical data for ${stockCode}:`, error.message);
      throw error;
    }
  }

  async getLatestData() {
    try {
      const data = await Stock.findLatest();
      return data;
    } catch (error) {
      logger.error('Error getting latest data:', error.message);
      throw error;
    }
  }
}

module.exports = new StockService();