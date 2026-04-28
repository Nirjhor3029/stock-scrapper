const mongoose = require('mongoose');

const stockPriceSchema = new mongoose.Schema({
  stockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StockMetadata',
    required: [true, 'Stock ID is required'],
    index: true,
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true,
  },
  // Core price data (numeric for analysis)
  open: {
    type: Number,
    default: 0,
  },
  ltp: {
    type: Number,
    default: 0,
  },
  high: {
    type: Number,
    default: 0,
  },
  low: {
    type: Number,
    default: 0,
  },
  close: {
    type: Number,
    default: 0,
  },
  ycp: { // Yesterday's closing price
    type: Number,
    default: 0,
  },
  change: {
    type: Number,
    default: 0,
  },
  // Trading activity
  trade: {
    type: Number,
    default: 0,
  },
  value: { // Trading value in millions
    type: Number,
    default: 0,
  },
  volume: {
    type: Number,
    default: 0,
  },
  // DSE specific fields
  dseIndex: { // # field from DSE
    type: Number,
    default: 0,
  },
  // Additional fields
  rowNumber: {
    type: Number,
    default: 0,
  },
  scrapedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  // Store original raw data for debugging/audit
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true, // adds createdAt and updatedAt
});

// Compound unique index: one price record per stock per day
stockPriceSchema.index({ stockId: 1, date: 1 }, { unique: true });

// Index for date-based queries
stockPriceSchema.index({ date: -1 });

// Index for stock-based queries (sorted by date descending)
stockPriceSchema.index({ stockId: 1, date: -1 });

// Virtual for formatted date (YYYY-MM-DD)
stockPriceSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Instance method to get price change percentage
stockPriceSchema.virtual('changePercent').get(function() {
  if (this.ycp && this.ycp !== 0) {
    return ((this.change / this.ycp) * 100).toFixed(2);
  }
  return 0;
});

// Static method to find by stock ID and date range
stockPriceSchema.statics.findByStockId = function(stockId, days = 30) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  return this.find({
    stockId: stockId,
    date: { $gte: date }
  }).sort({ date: -1 });
};

// Static method to find by stock code (requires population)
stockPriceSchema.statics.findByStockCode = function(stockCode, days = 30) {
  const StockMetadata = mongoose.model('StockMetadata');
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  return StockMetadata.findOne({ code: stockCode.toUpperCase() })
    .then(stock => {
      if (!stock) return [];
      return this.find({
        stockId: stock._id,
        date: { $gte: date }
      }).sort({ date: -1 });
    });
};

// Static method to find latest price for each stock
stockPriceSchema.statics.findLatestPrices = function() {
  return this.aggregate([
    { $sort: { date: -1, scrapedAt: -1 } },
    { 
      $group: {
        _id: '$stockId',
        latestPrice: { $first: '$$ROOT' }
      }
    },
    {
      $lookup: {
        from: 'stockmetadata',
        localField: '_id',
        foreignField: '_id',
        as: 'stock'
      }
    },
    { $unwind: '$stock' },
    {
      $project: {
        stockId: '$_id',
        stockCode: '$stock.code',
        stockName: '$stock.name',
        date: '$latestPrice.date',
        ltp: '$latestPrice.ltp',
        high: '$latestPrice.high',
        low: '$latestPrice.low',
        close: '$latestPrice.close',
        ycp: '$latestPrice.ycp',
        change: '$latestPrice.change',
        trade: '$latestPrice.trade',
        value: '$latestPrice.value',
        volume: '$latestPrice.volume',
        dseIndex: '$latestPrice.dseIndex'
      }
    }
  ]);
};

const StockPrice = mongoose.model('StockPrice', stockPriceSchema);

module.exports = StockPrice;