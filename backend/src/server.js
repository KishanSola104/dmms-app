const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config(); // Fallback
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const seedRoles = require('./seed/seedRoles');
const errorHandler = require('./middlewares/error.middleware');

// Import Route handlers
const schoolRoutes = require('./routes/school.routes');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const commonRoutes = require('./routes/common.routes');
const adminRoutes = require('./routes/admin.routes');
const headTeacherRoutes = require('./routes/headTeacher.routes');
const teacherRoutes = require('./routes/teacher.routes');
const officeRoutes = require('./routes/office.routes');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';

// Connect to Database
connectDB().then(async () => {
  // Seed predefined roles
  await seedRoles();
});
const { createTransporter } = require('./config/mailer');

const testEmailConnection = async () => {
    try {
        const transporter = createTransporter();

        await transporter.verify();

        console.log('Gmail SMTP connection successful!');
    } catch (error) {
        console.error('Gmail SMTP connection failed:', error.message);
    }
};

testEmailConnection();
// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded profile images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (verifies backend & MongoDB availability)
app.get('/api/health', async (req, res) => {
  const readyState = mongoose.connection.readyState;
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  let dbHealthy = false;
  if (readyState === 1 && mongoose.connection.db) {
    try {
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB ping timeout')), 2000))
      ]);
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }
  }

  if (!dbHealthy) {
    return res.status(503).json({
      success: false,
      status: 'degraded',
      database: stateMap[readyState] || 'disconnected',
      system: 'Digital Marksheet Management System (DMMS)',
      version: '1.0.0',
      message: 'DMMS is temporarily unavailable. Please wait while the system reconnects.',
      timestamp: new Date().toISOString()
    });
  }

  return res.json({
    success: true,
    status: 'online',
    database: 'connected',
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
app.use('/api/admin', adminRoutes);
app.use('/api/head-teacher', headTeacherRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/office', officeRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`[DMMS Backend] Server running on http://${HOST}:${PORT}`);
});
