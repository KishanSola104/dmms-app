const mongoose = require('mongoose');

const userInfoSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
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
  employeeRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeInfo',
    required: true
  },
  roleRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoleInfo',
    required: true
  },
  roleCode: {
    type: String,
    required: true,
    enum: ['ADMIN', 'HEAD_TEACHER', 'TEACHER', 'OFFICE_STAFF'],
    uppercase: true
  },
  roleName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: [true, 'User email is required'],
    trim: true,
    lowercase: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  isFirstLogin: {
    type: Boolean,
    default: true
  },
  mustChangePassword: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'user_info'
});

module.exports = mongoose.model('UserInfo', userInfoSchema);
