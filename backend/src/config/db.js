const mongoose = require('mongoose');

const connectDB = async ({ retryIntervalMs = 5000 } = {}) => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/DMMS';

  const attemptConnect = async () => {
    try {
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.error(`[MongoDB] Connection error: ${error.message}. Retrying in ${retryIntervalMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
      return attemptConnect();
    }
  };

  return attemptConnect();
};

module.exports = connectDB;
