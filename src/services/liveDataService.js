const StockMetadata = require('../models/StockMetadata');
const StockPrice = require('../models/StockPrice');
const logger = require('../utils/logger');

class LiveDataService {
  async getLatestFromDB() {
    try {
      const latestPrices = await StockPrice.findLatestPrices();
      
      return latestPrices.map(item => ({
        code: item.stockCode,
        name: item.stockName || item.stockCode,
        ltp: item.ltp,
        high: item.high,
        low: item.low,
        close: item.close,
        ycp: item.ycp,
        change: item.change,
        trade: item.trade,
        value: item.value,
        volume: item.volume,
        dseIndex: item.dseIndex,
        date: item.date,
      }));
    } catch (error) {
      logger.error('Error getting live data from DB:', error.message);
      throw error;
    }
  }
}

module.exports = new LiveDataService();