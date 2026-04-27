const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const { isTradingDay, isTradingHours, isTradingOpen } = require('../utils/tradingHours');

class ScrapingService {
  constructor() {
    this.url = config.dse.url;
    this.userAgent = config.dse.userAgent;
  }

  canScrape() {
    if (!isTradingDay()) {
      logger.info('Skipping scrape: Today is not a trading day');
      return false;
    }
    if (!isTradingHours()) {
      logger.info('Skipping scrape: Outside trading hours');
      return false;
    }
    return true;
  }

  async scrapeDSEData() {
    if (!this.canScrape()) {
      logger.info('Skipping scrape: Market is closed');
      return [];
    }
    
    try {
      logger.info('Starting to scrape DSE data...');
      
      const response = await axios.get(this.url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const stockData = [];

      // Find the main data table
      $('table').each((tableIndex, table) => {
        const headers = [];
        
        // Get headers
        $(table).find('th').each((i, th) => {
          headers.push($(th).text().trim());
        });
        
        // Only process tables with our expected headers
        if (headers.includes('LTP*') && headers.includes('HIGH') && headers.includes('LOW')) {
          logger.debug('Found data table with headers:', headers);
          
          // Get data rows
          $(table).find('tr').each((rowIndex, row) => {
            if (rowIndex > 0) { // Skip header row
              const cells = $(row).find('td');
              if (cells.length >= headers.length) {
                const rowData = {};
                cells.each((cellIndex, cell) => {
                  if (cellIndex < headers.length) {
                    const header = headers[cellIndex];
                    let value = $(cell).text().trim();
                    
                    // Clean up value - remove extra spaces and newlines
                    value = value.replace(/\s+/g, ' ').trim();
                    
                    // If it's a link (trading code), extract the text
                    const link = $(cell).find('a');
                    if (link.length) {
                      value = link.text().trim();
                    }
                    
                    rowData[header] = value;
                  }
                });
                
                // Only add if we have a trading code (first column)
                if (rowData['TRADING CODE'] && rowData['TRADING CODE'] !== '') {
                  stockData.push(rowData);
                }
              }
            }
          });
        }
      });

      logger.info(`Successfully scraped ${stockData.length} stocks`);
      return stockData;
      
    } catch (error) {
      logger.error('Error scraping DSE data:', error.message);
      throw error;
    }
  }

  async scrapeWithStream() {
    if (!this.canScrape()) {
      logger.info('Streaming scrape skipped: Market is closed');
      return [];
    }
    
    try {
      logger.info('Starting streaming scrape of DSE data...');
      
      const response = await axios.get(this.url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const stocks = [];
      
      // Extract all stocks first
      $('table').each((tableIndex, table) => {
        const headers = [];
        $(table).find('th').each((i, th) => {
          headers.push($(th).text().trim());
        });
        
        if (headers.includes('LTP*') && headers.includes('HIGH') && headers.includes('LOW')) {
          $(table).find('tr').each((rowIndex, row) => {
            if (rowIndex > 0) { // Skip header row
              const cells = $(row).find('td');
              if (cells.length >= headers.length) {
                const rowData = {};
                cells.each((cellIndex, cell) => {
                  if (cellIndex < headers.length) {
                    const header = headers[cellIndex];
                    let value = $(cell).text().trim();
                    
                    // Clean up value - remove extra spaces and newlines
                    value = value.replace(/\s+/g, ' ').trim();
                    
                    // If it's a link (trading code), extract the text
                    const link = $(cell).find('a');
                    if (link.length) {
                      value = link.text().trim();
                    }
                    
                    rowData[header] = value;
                  }
                });
                
                // Only add if we have a trading code (first column)
                if (rowData['TRADING CODE'] && rowData['TRADING CODE'] !== '') {
                  stocks.push(rowData);
                }
              }
            }
          });
        }
      });
      
      return stocks;
      
    } catch (error) {
      logger.error('Error in streaming scrape:', error.message);
      throw error;
    }
  }
}

module.exports = new ScrapingService();