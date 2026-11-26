const mongoose = require('mongoose');

const notificationInfoSchema = new mongoose.Schema({
  schoolRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SchoolInfo',
    required: true
  },
  schoolId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  targetUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  targetUserId: {
    type: String,
    default: null
  },
  targetRoleCode: {
    type: String,
    enum: ['ADMIN', 'HEAD_TEACHER', 'TEACHER', 'OFFICE_STAFF', 'ALL'],
    default: 'ALL'
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'alert'],
    default: 'info'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  sentByUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  sentByName: {
    type: String,
    trim: true,
    default: 'System'
  },
  sentByRole: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'SYSTEM'
  },
  batchId: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  collection: 'notification_info'
});

module.exports = mongoose.model('NotificationInfo', notificationInfoSchema);
