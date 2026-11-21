const mongoose = require('mongoose');

const confirmationCodeSchema = new mongoose.Schema({
  adminUserId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  adminEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  schoolId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  action: {
    type: String,
    required: true,
    enum: ['DEACTIVATE_USER', 'DELETE_USER']
  },
  targetUserId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  codeHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Automatically removed after 10 minutes (TTL)
  }
}, {
  collection: 'confirmation_code_info'
});

module.exports = mongoose.model('ConfirmationCode', confirmationCodeSchema);
