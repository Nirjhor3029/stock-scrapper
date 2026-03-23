const mongoose = require('mongoose');

const stockMetadataSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Stock code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  sector: {
    type: String,
    trim: true,
    default: 'Unknown',
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  // Track if this is a new stock (for updating metadata later)
  isFirstTimeScraped: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true, // adds createdAt and updatedAt
});

// Static method to find or create stock metadata
stockMetadataSchema.statics.findOrCreate = async function(stockCode, name = '', sector = '') {
  let stock = await this.findOne({ code: stockCode.toUpperCase() });
  if (!stock) {
    stock = await this.create({
      code: stockCode.toUpperCase(),
      name: name || stockCode,
      sector: sector || 'Unknown',
    });
  }
  return stock;
};

// Instance method to update lastUpdated timestamp
stockMetadataSchema.methods.touch = function() {
  this.lastUpdated = new Date();
  return this.save();
};

const StockMetadata = mongoose.model('StockMetadata', stockMetadataSchema);

module.exports = StockMetadata;