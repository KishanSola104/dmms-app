const mongoose = require('mongoose');

const roleInfoSchema = new mongoose.Schema({
  roleCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  roleName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'role_info'
});

module.exports = mongoose.model('RoleInfo', roleInfoSchema);
