const mongoose = require('mongoose');

const sectionInfoSchema = new mongoose.Schema({
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
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: [true, 'Class reference is required']
  },
  classCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  className: {
    type: String,
    required: true,
    trim: true
  },
  sectionCode: {
    type: String,
    required: [true, 'Section code is required'],
    trim: true,
    uppercase: true
  },
  sectionName: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true
  },
  sectionTeacherRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeInfo',
    default: null
  },
  sectionTeacherName: {
    type: String,
    trim: true,
    default: ''
  },
  maxCapacity: {
    type: Number,
    required: [true, 'Maximum capacity is required'],
    min: [1, 'Maximum capacity must be at least 1']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'section_info'
});

// Unique section code per class in a school
sectionInfoSchema.index({ schoolId: 1, classRef: 1, sectionCode: 1 }, { unique: true });

module.exports = mongoose.model('SectionInfo', sectionInfoSchema);
