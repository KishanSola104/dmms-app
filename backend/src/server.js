const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config(); // Fallback
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const seedRoles = require('./seed/seedRoles');
const errorHandler = require('./middlewares/error.middleware');

// Import Route handlers
const schoolRoutes = require('./routes/school.routes');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const commonRoutes = require('./routes/common.routes');

const app = express();
const PORT = process.env.PORT || 8000;

// Connect to Database
connectDB().then(async () => {
  // Seed predefined roles
  await seedRoles();
});

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded profile images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Digital Marksheet Management System (DMMS)',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/school', schoolRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/common', commonRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`[DMMS Backend] Server running on http://localhost:${PORT}`);
});
