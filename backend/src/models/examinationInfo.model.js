const mongoose = require('mongoose');

const examinationInfoSchema = new mongoose.Schema({
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
  academicYearRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYearInfo',
    required: [true, 'Academic year reference is required']
  },
  examinationCode: {
    type: String,
    required: [true, 'Examination code is required'],
    trim: true,
    uppercase: true
  },
  examinationName: {
    type: String,
    required: [true, 'Examination name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'UPCOMING'
  }
}, {
  timestamps: true,
  collection: 'examination_info'
});

// Examination code must be unique within the same school and academic year
examinationInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, examinationCode: 1 },
  { unique: true }
);

// Lookup index
examinationInfoSchema.index({ schoolId: 1, academicYearRef: 1, status: 1 });

module.exports = mongoose.model('ExaminationInfo', examinationInfoSchema);
