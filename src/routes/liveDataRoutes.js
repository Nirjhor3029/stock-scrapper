const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const getLiveData = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stockprices = db.collection('stockprices');
    const stockmetadatas = db.collection('stockmetadatas');
    
    // Get latest prices
    const prices = await stockprices
      .find()
      .sort({ date: -1 })
      .limit(100)
      .toArray();
    
    // Get metadata for codes - match by _id in stockId field
    const stockIds = prices.map(p => p.stockId).filter(Boolean);
    
    // Get metadata where _id is in our stockId list
    const metadatas = await stockmetadatas
      .find({ _id: { $in: stockIds } })
      .toArray();
    
    // Create map from metadata ObjectId string to code
    const metaMap = new Map();
    for (const m of metadatas) {
      metaMap.set(m._id.toString(), m.code);
    }
    
    // Map prices to response with codes
    const result = prices.map(p => {
      const stockIdStr = p.stockId?.toString();
      return {
        code: metaMap.get(stockIdStr) || stockIdStr?.slice(-6) || 'N/A',
        ltp: p.ltp,
        high: p.high,
        low: p.low,
        close: p.close,
        ycp: p.ycp,
        change: p.change,
        trade: p.trade,
        value: p.value,
        volume: p.volume,
        dseIndex: p.dseIndex,
      };
    }).sort((a, b) => a.dseIndex - b.dseIndex);
    
    res.json({
      success: true,
      data: result,
      count: result.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/', getLiveData);

module.exports = router;