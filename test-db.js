const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dse_scraper';

mongoose.connect(MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const stockprices = db.collection('stockprices');
  const stockmetadatas = db.collection('stockmetadatas');
  
  // Get first 3 metadatas
  const metas = await stockmetadatas.find().limit(3).toArray();
  console.log('Metadatas:');
  for (const m of metas) {
    console.log('  ', m._id.toString(), '->', m.code);
  }
  
  // Get first 3 prices
  const prices = await stockprices.find().limit(3).toArray();
  console.log('\nPrices:');
  for (const p of prices) {
    console.log('  stockId:', p.stockId?.toString(), '-> ltp:', p.ltp);
  }
  
  // Find matching prices (where stockId exists in metadata)
  console.log('\nLooking for matches...');
  for (const m of metas) {
    const matchingPrice = await stockprices.findOne({ stockId: m._id });
    if (matchingPrice) {
      console.log('MATCH:', m.code, '-> ltp:', matchingPrice.ltp);
    }
  }
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});