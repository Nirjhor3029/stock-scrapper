const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const scrapingService = require('../services/scrapingService');
const stockService = require('../services/professionalStockService');
const logger = require('../utils/logger');

console.log('Loading stock routes...');

// GET /api/stocks/scrape
router.get('/scrape', stockController.scrapeData);

// GET /api/stocks/live
router.get('/live', stockController.getLiveData);

// GET /api/stocks/json
router.get('/json', stockController.getDataJson);

// GET /api/stocks/csv
router.get('/csv', stockController.getDataCsv);

// GET /api/stocks/status
router.get('/status', stockController.getStatus);

// GET /api/stocks/:code/history
router.get('/:code/history', stockController.getHistoricalData);

// GET /api/stocks (must be last to avoid conflicts with other routes)
router.get('/', stockController.getData);

// GET /api/stocks/scrape/stream - SSE endpoint
router.get('/scrape/stream', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Disable Nagle's algorithm for faster streaming
  res.socket.setNoDelay(true);
  
  const startTime = Date.now();
  
  try {
    const stocks = await scrapingService.scrapeWithStream();
    const totalStocks = stocks.length;
    let processedStocks = 0;
    const firstStock = stocks[0] || null;
    
    // Save to database (fire and forget, catch errors)
    stockService.saveStockToDB(stocks)
      .then(() => logger.info(`Streaming: Saved ${totalStocks} stocks to MongoDB`))
      .catch(err => logger.error('Streaming: Failed to save to DB:', err));
    
    // Yield initial progress
    const progressData = `event: progress\ndata: ${JSON.stringify({ 
      type: 'progress', 
      data: { 
        total: totalStocks, 
        processed: 0, 
        message: 'Starting to stream stocks...' 
      } 
    })}\n\n`;
    res.write(progressData);
    
    // Stream each stock with small delay to allow UI to update
    for (const stock of stocks) {
      processedStocks++;
      
      // Yield progress update every 10 stocks or first/last
      if (processedStocks % 10 === 0 || processedStocks === 1 || processedStocks === totalStocks) {
        const progressData = `event: progress\ndata: ${JSON.stringify({ 
          type: 'progress', 
          data: { 
            total: totalStocks, 
            processed: processedStocks,
            message: `Streaming ${processedStocks} of ${totalStocks} stocks...`
          } 
        })}\n\n`;
        res.write(progressData);
      }
      
      // Yield the stock data
      const stockData = `event: stock\ndata: ${JSON.stringify({ type: 'stock', data: stock })}\n\n`;
      res.write(stockData);
      
      // Small delay to allow UI to update and show streaming effect
      if (processedStocks < totalStocks) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    // Calculate summary
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    const summary = {
      totalStocks: totalStocks,
      durationSeconds: duration.toFixed(2),
      firstStock: firstStock ? {
        tradingCode: firstStock['TRADING CODE'],
        ltp: firstStock['LTP*']
      } : null,
      timestamp: new Date().toISOString(),
      message: `Successfully scraped ${totalStocks} stocks in ${duration.toFixed(2)} seconds`
    };
    
    // Send summary
    const summaryData = `event: summary\ndata: ${JSON.stringify(summary)}\n\n`;
    res.write(summaryData);
    
    // End the response
    res.end();
    
  } catch (error) {
    logger.error('Error in streaming endpoint:', error);
    const errorData = `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`;
    res.write(errorData);
    res.end();
  }
});

module.exports = router;