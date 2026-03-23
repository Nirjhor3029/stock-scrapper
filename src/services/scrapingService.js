const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');

class ScrapingService {
  constructor() {
    this.url = config.dse.url;
    this.userAgent = config.dse.userAgent;
  }

  // Convert string values to appropriate types
  convertValue(value, header) {
    if (!value || value === '') return null;
    
    // Handle numeric fields (remove commas, convert to number)
    const numericFields = ['LTP*', 'HIGH', 'LOW', 'CLOSEP*', 'YCP*', 'CHANGE', 
                          'TRADE', 'VALUE (mn)', 'VOLUME', '#'];
    
    if (numericFields.includes(header)) {
      // Remove commas and convert to number
      const cleaned = value.replace(/,/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? value : num;
    }
    
    // TRADING CODE and other text fields stay as strings
    return value;
  }

  async scrapeDSEData() {
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