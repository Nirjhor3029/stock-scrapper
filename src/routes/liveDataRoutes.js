const express = require('express');
const router = express.Router();
const liveDataService = require('../services/liveDataService');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  try {
    const data = await liveDataService.getLatestFromDB();
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in live data endpoint:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;