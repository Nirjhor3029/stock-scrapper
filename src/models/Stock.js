const mongoose = require('mongoose');

const stockDataSchema = new mongoose.Schema({
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
}, { 
  _id: false,
  strict: false // Allow additional fields
});

const stockSchema = new mongoose.Schema({
  stockCode: {
    type: String,
    required: [true, 'Stock code is required'],
    uppercase: true,
    trim: true,
    index: true,
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true,
  },
  data: {
    type: stockDataSchema,
    required: [true, 'Stock data is required'],
  },
  scrapedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound index for stockCode and date to ensure uniqueness per day
stockSchema.index({ stockCode: 1, date: 1 }, { unique: true });

// Static method to find by stock code and date range
stockSchema.statics.findByStockCode = function(stockCode, days = 30) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  return this.find({
    stockCode: stockCode.toUpperCase(),
    date: { $gte: date }
  }).sort({ date: -1 });
};

// Static method to find latest data for all stocks
stockSchema.statics.findLatest = function() {
  return this.find()
    .sort({ date: -1, scrapedAt: -1 })
    .limit(1);
};

// Instance method to get formatted date
stockSchema.methods.getFormattedDate = function() {
  return this.date.toISOString().split('T')[0];
};

const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;