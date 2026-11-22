const mongoose = require('mongoose');

const examinationComponentInfoSchema = new mongoose.Schema({
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
  examinationSubjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationSubjectInfo',
    required: [true, 'Examination subject reference is required']
  },
  componentName: {
    type: String,
    required: [true, 'Component name is required'],
    trim: true
  },
  maximumMarks: {
    type: Number,
    required: [true, 'Maximum marks is required'],
    min: [1, 'Maximum marks must be at least 1']
  },
  sequence: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  collection: 'examination_component_info'
});

// Lookup index
examinationComponentInfoSchema.index({ schoolId: 1, examinationSubjectRef: 1 });

// Prevent duplicate component names within the same subject configuration
examinationComponentInfoSchema.index(
  { examinationSubjectRef: 1, componentName: 1 },
  { unique: true }
);

module.exports = mongoose.model('ExaminationComponentInfo', examinationComponentInfoSchema);
