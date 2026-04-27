const express = require('express');
const router = express.Router();
const scrapingService = require('../services/scrapingService');
const professionalStockService = require('../services/professionalStockService');
const logger = require('../utils/logger');

// POST /api/cron/scrape - Vercel cron endpoint
// This endpoint is called by Vercel cron every 5 minutes
router.post('/scrape', async (req, res) => {
  try {
    // Check if market is open (trading day + trading hours)
    if (!scrapingService.canScrape()) {
      logger.info('Cron: Skipping scrape - market is closed');
      return res.json({
        success: true,
        message: 'Skipped - market is closed',
        scraped: false,
        reason: 'outside trading hours or weekend',
        timestamp: new Date().toISOString(),
      });
    }

    // Scrape data
    logger.info('Cron: Starting scheduled scrape...');
    const data = await scrapingService.scrapeDSEData();

    if (!data || data.length === 0) {
      logger.warn('Cron: No data scraped');
      return res.json({
        success: false,
        message: 'No data scraped',
        scraped: false,
        timestamp: new Date().toISOString(),
      });
    }

    // Save to database
    await professionalStockService.saveStockToDB(data);
    professionalStockService.updateCache(data);

    logger.info(`Cron: Successfully scraped and saved ${data.length} stocks`);

    res.json({
      success: true,
      message: `Successfully scraped ${data.length} stocks`,
      scraped: true,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cron scrape error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      scraped: false,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;