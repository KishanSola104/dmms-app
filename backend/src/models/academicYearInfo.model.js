const mongoose = require('mongoose');

const academicYearInfoSchema = new mongoose.Schema({
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
  yearCode: {
    type: String,
    required: [true, 'Year code is required'],
    trim: true
  },
  yearName: {
    type: String,
    required: [true, 'Year name is required'],
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'UPCOMING'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'academic_year_info'
});

module.exports = mongoose.model('AcademicYearInfo', academicYearInfoSchema);
