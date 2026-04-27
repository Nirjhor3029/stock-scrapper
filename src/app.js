const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');
const stockRoutes = require('./routes/stockRoutes');
const cronRoutes = require('./routes/cronRoutes');
const schedulerRoutes = require('./routes/schedulerRoutes');
const liveDataRoutes = require('./routes/liveDataRoutes');

const path = require('path');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

app.use((req, res, next) => {
  req.requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'DSE Stock Data Scraper API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      stocks: {
        scrape: 'GET /api/stocks/scrape',
        getData: 'GET /api/stocks',
        getLiveData: 'GET /api/stocks/live',
        json: 'GET /api/stocks/json',
        csv: 'GET /api/stocks/csv',
        historicalData: 'GET /api/stocks/:code/history',
        status: 'GET /api/stocks/status',
        stream: 'GET /api/stocks/scrape/stream',
      },
      scheduler: {
        start: 'GET /api/scheduler/start?minutes=5',
        stop: 'GET /api/scheduler/stop',
        status: 'GET /api/scheduler/status',
        runOnce: 'GET /api/scheduler/run',
      },
      cron: {
        scrape: 'POST /api/cron/scrape',
      },
      live: {
        data: 'GET /api/live',
      },
    },
  });
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.use('/api/stocks', stockRoutes);
console.log('Stock routes registered at /api/stocks');

app.use('/api/cron', cronRoutes);
console.log('Cron routes registered at /api/cron');

app.use('/api/scheduler', schedulerRoutes);
console.log('Scheduler routes registered at /api/scheduler');

app.use('/api/live', liveDataRoutes);
console.log('Live data routes registered at /api/live');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;