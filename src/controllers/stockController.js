const scrapingService = require('../services/scrapingService');
const stockService = require('../services/professionalStockService');
const config = require('../config');
const logger = require('../utils/logger');

class StockController {
  async scrapeData(req, res, next) {
    try {
      const data = await scrapingService.scrapeDSEData();
      await stockService.saveStockToDB(data);
      stockService.updateCache(data);
      
      res.json({
        success: true,
        message: `Successfully scraped ${data.length} stocks`,
        data: data,
        timestamp: new Date().toISOString(),
        count: data.length,
      });
    } catch (error) {
      logger.error('Error in scrapeData controller:', error.message);
      next(error);
    }
  }

  async getData(req, res, next) {
    try {
      // Check if cache is valid
      if (!stockService.isCacheValid(config.cache.durationMinutes)) {
        const data = await scrapingService.scrapeDSEData();
        await stockService.saveStockToDB(data);
        stockService.updateCache(data);
      }
      
      const cached = stockService.getCachedData();
      
      res.json({
        success: true,
        data: cached.data,
        timestamp: cached.lastScraped ? cached.lastScraped.toISOString() : null,
        count: cached.count,
        cached: true,
      });
    } catch (error) {
      logger.error('Error in getData controller:', error.message);
      next(error);
    }
  }

  async getLiveData(req, res, next) {
    try {
      const data = await scrapingService.scrapeDSEData();
      await stockService.saveStockToDB(data);
      stockService.updateCache(data);
      
      res.json({
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
        count: data.length,
        cached: false,
      });
    } catch (error) {
      logger.error('Error in getLiveData controller:', error.message);
      next(error);
    }
  }

  async getDataJson(req, res, next) {
    try {
      if (!stockService.isCacheValid(config.cache.durationMinutes)) {
        const data = await scrapingService.scrapeDSEData();
        await stockService.saveStockToDB(data);
        stockService.updateCache(data);
      }
      
      const cached = stockService.getCachedData();
      res.json(cached.data);
    } catch (error) {
      logger.error('Error in getDataJson controller:', error.message);
      next(error);
    }
  }

  async getDataCsv(req, res, next) {
    try {
      if (!stockService.isCacheValid(config.cache.durationMinutes)) {
        const data = await scrapingService.scrapeDSEData();
        await stockService.saveStockToDB(data);
        stockService.updateCache(data);
      }
      
      const cached = stockService.getCachedData();
      
      if (!cached.data || cached.data.length === 0) {
        return res.send('');
      }
      
      // Create CSV header
      const headers = Object.keys(cached.data[0]);
      let csv = headers.join(',') + '\n';
      
      // Add rows
      cached.data.forEach(row => {
        const values = headers.map(header => {
          let value = row[header] || '';
          value = value.toString().replace(/"/g, '""');
          return `"${value}"`;
        });
        csv += values.join(',') + '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="dse_data.csv"');
      res.send(csv);
    } catch (error) {
      logger.error('Error in getDataCsv controller:', error.message);
      next(error);
    }
  }

  async getHistoricalData(req, res, next) {
    try {
      const { code } = req.params;
      const days = parseInt(req.query.days, 10) || 30;
      
      const data = await stockService.getHistoricalData(code, days);
      
      res.json({
        success: true,
        stockCode: code.toUpperCase(),
        count: data.length,
        data,
      });
    } catch (error) {
      logger.error('Error in getHistoricalData controller:', error.message);
      next(error);
    }
  }

  async getStatus(req, res, next) {
    try {
      const cached = stockService.getCachedData();
      
      res.json({
        status: 'running',
        cache: {
          hasData: !!cached.data,
          lastScraped: cached.lastScraped ? cached.lastScraped.toISOString() : null,
          dataCount: cached.count,
        },
        endpoints: {
          scrape: '/api/stocks/scrape',
          getData: '/api/stocks',
          getLiveData: '/api/stocks/live',
          downloadJson: '/api/stocks/download/json',
          downloadCsv: '/api/stocks/download/csv',
          historicalData: '/api/stocks/:code/history',
        },
      });
    } catch (error) {
      logger.error('Error in getStatus controller:', error.message);
      next(error);
    }
  }
}

module.exports = new StockController();