const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const { perfLogger } = require('./middleware/perfLogger');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(perfLogger({ slowMs: Number(process.env.SLOW_API_MS || 800) }));

// Serve static files (images)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/obs', require('./routes/obRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));

app.get('/', (req, res) => {
  res.send('Backend Admin + Product đang chạy');
});

module.exports = app;
