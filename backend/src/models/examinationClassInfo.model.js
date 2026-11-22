const mongoose = require('mongoose');

const examinationClassInfoSchema = new mongoose.Schema({
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
  examinationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationInfo',
    required: [true, 'Examination reference is required']
  },
  academicYearRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYearInfo',
    required: [true, 'Academic year reference is required']
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
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'examination_class_info'
});

// Prevent duplicate class assignments to the same examination
examinationClassInfoSchema.index(
  { schoolId: 1, examinationRef: 1, classRef: 1 },
  { unique: true }
);

// Lookup index
examinationClassInfoSchema.index({ schoolId: 1, academicYearRef: 1, classRef: 1 });

module.exports = mongoose.model('ExaminationClassInfo', examinationClassInfoSchema);
