const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Target URL
const DSE_URL = 'https://www.dsebd.org/latest_share_price_scroll_by_value.php';

// Cache for storing scraped data
let cachedData = null;
let lastScrapedTime = null;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dse_scraper';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Stock schema for daily data
const stockSchema = new mongoose.Schema({
    stockCode: { type: String, required: true },
    date: { type: Date, required: true }, // date only (no time)
    data: {
        LTP: String,
        HIGH: String,
        LOW: String,
        CLOSEP: String,
        YCP: String,
        CHANGE: String,
        TRADE: String,
        VALUE: String,
        VOLUME: String,
        TRADING_CODE: String,
        // other fields as needed
    },
    scrapedAt: { type: Date, default: Date.now }
});

// Compound index for stockCode and date to ensure uniqueness per day
stockSchema.index({ stockCode: 1, date: 1 }, { unique: true });

const StockDaily = mongoose.model('StockDaily', stockSchema);

// Helper to get Bangladesh date (UTC+6)
function getBangladeshDate() {
    const now = new Date();
    // Bangladesh is UTC+6
    const offset = 6 * 60 * 60 * 1000;
    const bangladeshNow = new Date(now.getTime() + offset);
    const year = bangladeshNow.getUTCFullYear();
    const month = bangladeshNow.getUTCMonth();
    const day = bangladeshNow.getUTCDate();
    return new Date(Date.UTC(year, month, day)); // date at 00:00:00 UTC
}

// Save stock data to MongoDB (upsert per day)
async function saveStockToDB(stockDataArray) {
    const bangladeshDate = getBangladeshDate();
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
                // include all fields dynamically
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
            await StockDaily.findOneAndUpdate(
                { stockCode, date: bangladeshDate },
                doc,
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
        } catch (err) {
            console.error(`Error saving stock ${stockCode} to DB:`, err.message);
        }
    });
    
    await Promise.allSettled(savePromises);
    console.log(`Saved ${stockDataArray.length} stocks to MongoDB for date ${bangladeshDate.toISOString().split('T')[0]}`);
}

// Function to scrape data
async function scrapeDSEData() {
    try {
        console.log('Scraping DSE data...');
        
        const response = await axios.get(DSE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const stockData = [];

        // Find the main data table
        $('table').each((tableIndex, table) => {
            const headers = [];
            const rows = [];
            
            // Get headers
            $(table).find('th').each((i, th) => {
                headers.push($(th).text().trim());
            });
            
            // Only process tables with our expected headers
            if (headers.includes('LTP*') && headers.includes('HIGH') && headers.includes('LOW')) {
                console.log('Found data table with headers:', headers);
                
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

        console.log(`Scraped ${stockData.length} stocks`);
        
        // Update cache
        cachedData = stockData;
        lastScrapedTime = new Date();
        
        // Save to MongoDB
        try {
            await saveStockToDB(stockData);
        } catch (err) {
            console.error('Failed to save to MongoDB:', err.message);
        }
        
        return stockData;
        
    } catch (error) {
        console.error('Error scraping DSE data:', error.message);
        throw error;
    }
}

// Function to save data to file
function saveDataToFile(data, format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = '';
    let content = '';
    
    if (format === 'json') {
        filename = `dse_data_${timestamp}.json`;
        content = JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
        filename = `dse_data_${timestamp}.csv`;
        
        if (data.length === 0) {
            content = '';
        } else {
            // Create CSV header
            const headers = Object.keys(data[0]);
            content = headers.join(',') + '\n';
            
            // Add rows
            data.forEach(row => {
                const values = headers.map(header => {
                    let value = row[header] || '';
                    // Escape commas and quotes in CSV
                    value = value.toString().replace(/"/g, '""');
                    return `"${value}"`;
                });
                content += values.join(',') + '\n';
            });
        }
    }
    
    fs.writeFileSync(filename, content);
    console.log(`Data saved to ${filename}`);
    return filename;
}

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'DSE Stock Data Scraper API',
        endpoints: {
            '/scrape': 'Scrape fresh data from DSE website',
            '/scrape/stream': 'Stream real-time scraping progress (SSE)',
            '/data': 'Get cached data (scrape if not available)',
            '/data/live': 'Always scrape fresh data',
            '/data/json': 'Get data in JSON format',
            '/data/csv': 'Get data in CSV format',
            '/download/json': 'Download data as JSON file',
            '/download/csv': 'Download data as CSV file',
            '/status': 'Check scraping status',
            '/stock/:code/history': 'Get historical data for a stock (optional query ?days=30)'
        }
    });
});

// Scrape data endpoint
app.get('/scrape', async (req, res) => {
    try {
        const data = await scrapeDSEData();
        res.json({
            success: true,
            message: `Successfully scraped ${data.length} stocks`,
            data: data,
            timestamp: new Date().toISOString(),
            count: data.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to scrape data',
            error: error.message
        });
    }
});

// Get data (cached or fresh)
app.get('/data', async (req, res) => {
    try {
        if (!cachedData || !lastScrapedTime || 
            (new Date() - lastScrapedTime) > 5 * 60 * 1000) { // 5 minutes cache
            await scrapeDSEData();
        }
        
        res.json({
            success: true,
            data: cachedData,
            timestamp: lastScrapedTime ? lastScrapedTime.toISOString() : null,
            count: cachedData ? cachedData.length : 0,
            cached: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get data',
            error: error.message
        });
    }
});

// Get live data (always scrape fresh)
app.get('/data/live', async (req, res) => {
    try {
        const data = await scrapeDSEData();
        res.json({
            success: true,
            data: data,
            timestamp: new Date().toISOString(),
            count: data.length,
            cached: false
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get live data',
            error: error.message
        });
    }
});

// Get data in JSON format
app.get('/data/json', async (req, res) => {
    try {
        if (!cachedData) {
            await scrapeDSEData();
        }
        res.json(cachedData);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get JSON data',
            error: error.message
        });
    }
});

// Get data in CSV format
app.get('/data/csv', async (req, res) => {
    try {
        if (!cachedData) {
            await scrapeDSEData();
        }
        
        if (!cachedData || cachedData.length === 0) {
            return res.send('');
        }
        
        // Create CSV header
        const headers = Object.keys(cachedData[0]);
        let csv = headers.join(',') + '\n';
        
        // Add rows
        cachedData.forEach(row => {
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
        res.status(500).json({
            success: false,
            message: 'Failed to get CSV data',
            error: error.message
        });
    }
});

// Get historical data for a stock
app.get('/stock/:code/history', async (req, res) => {
    try {
        const stockCode = req.params.code.toUpperCase();
        const days = parseInt(req.query.days) || 30; // default 30 days
        const data = await StockDaily.find({ stockCode })
            .sort({ date: -1 })
            .limit(days)
            .lean();
        res.json({
            success: true,
            stockCode,
            count: data.length,
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get historical data',
            error: error.message
        });
    }
});

// Download as JSON file
app.get('/download/json', async (req, res) => {
    try {
        if (!cachedData) {
            await scrapeDSEData();
        }
        
        const filename = saveDataToFile(cachedData, 'json');
        res.download(filename, (err) => {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to download file',
                    error: err.message
                });
            }
            
            // Delete the file after download
            setTimeout(() => {
                try {
                    fs.unlinkSync(filename);
                } catch (e) {
                    console.log('Could not delete file:', e.message);
                }
            }, 5000);
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to prepare download',
            error: error.message
        });
    }
});

// Download as CSV file
app.get('/download/csv', async (req, res) => {
    try {
        if (!cachedData) {
            await scrapeDSEData();
        }
        
        const filename = saveDataToFile(cachedData, 'csv');
        res.download(filename, (err) => {
            if (err) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to download file',
                    error: err.message
                });
            }
            
            // Delete the file after download
            setTimeout(() => {
                try {
                    fs.unlinkSync(filename);
                } catch (e) {
                    console.log('Could not delete file:', e.message);
                }
            }, 5000);
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to prepare download',
            error: error.message
        });
    }
});

// Async generator function for streaming scrape
async function* scrapeDSEDataStream() {
    try {
        console.log('Starting streaming scrape of DSE data...');
        
        const response = await axios.get(DSE_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
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
        
        const totalStocks = stocks.length;
        let processedStocks = 0;
        
        // Yield initial progress
        yield { 
            type: 'progress', 
            data: { 
                total: totalStocks, 
                processed: 0, 
                message: 'Starting to stream stocks...' 
            } 
        };
        
        // Stream each stock with small delay to allow UI to update
        for (const stock of stocks) {
            processedStocks++;
            
            // Yield progress update every 10 stocks or first/last
            if (processedStocks % 10 === 0 || processedStocks === 1 || processedStocks === totalStocks) {
                yield { 
                    type: 'progress', 
                    data: { 
                        total: totalStocks, 
                        processed: processedStocks,
                        message: `Streaming ${processedStocks} of ${totalStocks} stocks...`
                    } 
                };
            }
            
            // Yield the stock data
            yield { type: 'stock', data: stock };
            
            // Small delay to allow UI to update and show streaming effect
            // This also prevents overwhelming the client
            if (processedStocks < totalStocks) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        // Yield final progress
        yield { 
            type: 'progress', 
            data: { 
                total: totalStocks, 
                processed: processedStocks,
                message: `Completed! Streamed ${processedStocks} stocks.`
            } 
        };
        
    } catch (error) {
        console.error('Error in streaming scrape:', error.message);
        yield { type: 'error', data: { message: error.message } };
    }
}

// Streaming endpoint for real-time scraping
app.get('/scrape/stream', async (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Disable Nagle's algorithm for faster streaming
    res.socket.setNoDelay(true);
    
    const startTime = Date.now();
    let stockCount = 0;
    let firstStock = null;
    
    try {
        // Start streaming
        for await (const event of scrapeDSEDataStream()) {
            if (event.type === 'stock') {
                stockCount++;
                if (!firstStock) firstStock = event.data;
                
                // Send stock data as SSE
                const sseData = `event: stock\ndata: ${JSON.stringify(event.data)}\n\n`;
                res.write(sseData);
            } else if (event.type === 'progress') {
                // Send progress update
                const sseData = `event: progress\ndata: ${JSON.stringify(event.data)}\n\n`;
                res.write(sseData);
            } else if (event.type === 'error') {
                // Send error
                const sseData = `event: error\ndata: ${JSON.stringify(event.data)}\n\n`;
                res.write(sseData);
            }
        }
        
        // Calculate summary
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        const summary = {
            totalStocks: stockCount,
            durationSeconds: duration.toFixed(2),
            firstStock: firstStock ? {
                tradingCode: firstStock['TRADING CODE'],
                ltp: firstStock['LTP*']
            } : null,
            timestamp: new Date().toISOString(),
            message: `Successfully scraped ${stockCount} stocks in ${duration.toFixed(2)} seconds`
        };
        
        // Send summary
        const summaryData = `event: summary\ndata: ${JSON.stringify(summary)}\n\n`;
        res.write(summaryData);
        
        // End the response
        res.end();
        
    } catch (error) {
        console.error('Error in streaming endpoint:', error);
        const errorData = `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`;
        res.write(errorData);
        res.end();
    }
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        cache: {
            hasData: !!cachedData,
            lastScraped: lastScrapedTime ? lastScrapedTime.toISOString() : null,
            dataCount: cachedData ? cachedData.length : 0
        },
        endpoints: {
            scrape: '/scrape',
            getData: '/data',
            getLiveData: '/data/live',
            downloadJson: '/download/json',
            downloadCsv: '/download/csv'
        }
    });
});

// Start the server
app.listen(PORT, async () => {
    console.log(`DSE Scraper API running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET / - API information');
    console.log('  GET /scrape - Scrape fresh data');
    console.log('  GET /scrape/stream - Stream real-time scraping progress (SSE)');
    console.log('  GET /data - Get cached data');
    console.log('  GET /data/live - Get live data');
    console.log('  GET /data/json - Get JSON data');
    console.log('  GET /data/csv - Get CSV data');
    console.log('  GET /download/json - Download JSON file');
    console.log('  GET /download/csv - Download CSV file');
    console.log('  GET /status - Check status');
    
    // Initial scrape
    try {
        await scrapeDSEData();
        console.log('Initial data loaded successfully');
    } catch (error) {
        console.log('Initial data load failed, will try on first request');
    }
});