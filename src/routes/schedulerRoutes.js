const express = require('express');
const router = express.Router();
const localScheduler = require('../services/localScheduler');
const logger = require('../utils/logger');

console.log('Loading local scheduler routes...');

router.get('/start', async (req, res) => {
  const interval = parseInt(req.query.minutes, 10) || 5;
  const result = localScheduler.start(interval);
  res.json(result);
});

router.get('/stop', async (req, res) => {
  const result = localScheduler.stop();
  res.json(result);
});

router.get('/status', async (req, res) => {
  const status = localScheduler.getStatus();
  res.json(status);
});

router.get('/run', async (req, res) => {
  try {
    await localScheduler.runOnce();
    res.json({ success: true, message: 'Scrape triggered manually' });
  } catch (error) {
    logger.error('Manual scrape error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;