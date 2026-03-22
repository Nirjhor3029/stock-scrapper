const express = require('express');
const stockRoutes = require('./src/routes/stockRoutes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/stocks', stockRoutes);

app.listen(3000, () => {
  console.log('Test app running on port 3000');
});