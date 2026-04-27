const cron = require('node-cron');
const scrapingService = require('./scrapingService');
const professionalStockService = require('./professionalStockService');
const logger = require('../utils/logger');

class LocalScheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.intervalMinutes = 5;
  }

  start(intervalMinutes = 5) {
    if (this.task) {
      logger.warn('Scheduler already running');
      return { success: false, message: 'Scheduler already running' };
    }

    this.intervalMinutes = intervalMinutes;
    
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    this.task = cron.schedule(cronExpression, async () => {
      await this.runScrape();
    });

    logger.info(`Local scheduler started: every ${intervalMinutes} minutes`);
    
    return { 
      success: true, 
      message: `Scheduler started: every ${intervalMinutes} minutes` 
    };
  }

  stop() {
    if (!this.task) {
      logger.warn('Scheduler not running');
      return { success: false, message: 'Scheduler not running' };
    }

    this.task.stop();
    this.task = null;
    this.isRunning = false;

    logger.info('Local scheduler stopped');
    
    return { success: true, message: 'Scheduler stopped' };
  }

  getStatus() {
    return {
      isRunning: !!this.task,
      intervalMinutes: this.intervalMinutes,
      lastRun: this.lastRunTime || null,
      lastSuccess: this.lastSuccess || null,
      lastError: this.lastError || null
    };
  }

  async runScrape() {
    if (this.isRunning) {
      logger.info('Scheduler: Previous scrape still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      if (!scrapingService.canScrape()) {
        logger.info('Scheduler: Skipping - market is closed');
        this.isRunning = false;
        return;
      }

      logger.info('Scheduler: Starting scrape...');
      
      const data = await scrapingService.scrapeDSEData();
      
      if (!data || data.length === 0) {
        logger.warn('Scheduler: No data scraped');
        this.isRunning = false;
        return;
      }

      await professionalStockService.saveStockToDB(data);
      professionalStockService.updateCache(data);

      this.lastSuccess = new Date();
      logger.info(`Scheduler: Successfully scraped ${data.length} stocks`);
      
    } catch (error) {
      this.lastError = {
        message: error.message,
        timestamp: new Date()
      };
      logger.error('Scheduler error:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  async runOnce() {
    return await this.runScrape();
  }
}

module.exports = new LocalScheduler();