const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet'); 

dotenv.config();

const app = express();
const { perfLogger } = require('./middleware/perfLogger');

// Security Headers với Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Cho phép upload images
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Cho phép serve static files
}));

// CORS Configuration - Cho phép tất cả origins
const corsOptions = {
  origin: '*', // Cho phép tất cả origins
  credentials: false, // Phải false khi origin là '*'
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Body parser với giới hạn hợp lý
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance logger
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
app.use('/api/contact', require('./routes/contactRoutes'));

app.get('/', (req, res) => {
  res.send('Backend Admin + Product đang chạy');
});

// Error handling middleware (phải đặt cuối cùng)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint không tồn tại',
  });
});

module.exports = app;
