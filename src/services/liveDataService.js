const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Ensure models are registered
require('../models/StockMetadata');
require('../models/StockPrice');

const StockPrice = mongoose.model('StockPrice');

class LiveDataService {
  async getLatestFromDB() {
    try {
      // Simple: just find latest documents 
      const prices = await StockPrice.find()
        .sort({ date: -1 })
        .limit(100)
        .lean();
      
      logger.info(`Found ${prices.length} prices`);
      
      return prices.map(p => ({
        code: p.stockId ? p.stockId.toString().slice(-6) : 'N/A',
        name: '',
        ltp: p.ltp,
        high: p.high,
        low: p.low,
        close: p.close,
        ycp: p.ycp,
        change: p.change,
        trade: p.trade,
        value: p.value,
        volume: p.volume,
        dseIndex: p.dseIndex,
        date: p.date
      }));
    } catch (error) {
      logger.error('Error getting live data:', error.message);
      throw error;
    }
  }
}

module.exports = new LiveDataService();