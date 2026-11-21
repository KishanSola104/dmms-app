const mongoose = require('mongoose');

const classInfoSchema = new mongoose.Schema({
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
  classCode: {
    type: String,
    required: [true, 'Class code is required'],
    trim: true,
    uppercase: true
  },
  className: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },
  classTeacherRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeInfo',
    default: null
  },
  classTeacherName: {
    type: String,
    trim: true,
    default: ''
  },
  numberOfSections: {
    type: Number,
    required: [true, 'Number of sections is required'],
    min: [0, 'Number of sections cannot be negative'],
    default: 1
  },
  totalCapacity: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'class_info'
});

// Ensure classCode is unique within the same school
classInfoSchema.index({ schoolId: 1, classCode: 1 }, { unique: true });

module.exports = mongoose.model('ClassInfo', classInfoSchema);
