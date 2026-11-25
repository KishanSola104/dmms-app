const mongoose = require('mongoose');

const componentMarkSchema = new mongoose.Schema({
  componentRef: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  componentName: {
    type: String,
    required: true,
    trim: true
  },
  maximumMarks: {
    type: Number,
    required: true,
    min: 0
  },
  marksObtained: {
    type: Number,
    default: null,
    min: 0
  }
}, { _id: false });

const marksEntryInfoSchema = new mongoose.Schema({
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
  submissionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarksSubmissionInfo',
    required: true
  },
  academicYearRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYearInfo',
    required: true
  },
  examinationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationInfo',
    default: null
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: true
  },
  sectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    required: true
  },
  subjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectInfo',
    required: true
  },
  studentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentInfo',
    required: true
  },
  enrollmentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentEnrollmentInfo',
    required: true
  },
  entryType: {
    type: String,
    enum: ['EXAM_ACADEMIC', 'EXTRA_COMPONENT', 'CO_CURRICULAR_TERM', 'CO_CURRICULAR_FINAL'],
    required: true
  },
  // Numerical marks (for EXAM_ACADEMIC & EXTRA_COMPONENT)
  componentMarks: {
    type: [componentMarkSchema],
    default: []
  },
  totalMaximumMarks: {
    type: Number,
    default: 0,
    min: 0
  },
  totalMarksObtained: {
    type: Number,
    default: null,
    min: 0
  },
  // Co-curricular grade (for CO_CURRICULAR_TERM & CO_CURRICULAR_FINAL)
  grade: {
    type: String,
    trim: true,
    uppercase: true,
    default: null
  },
  gradePoint: {
    type: Number,
    default: null
  },
  isAbsent: {
    type: Boolean,
    default: false
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  }
}, {
  timestamps: true,
  collection: 'marks_entry_info'
});

marksEntryInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, examinationRef: 1, classRef: 1, sectionRef: 1, subjectRef: 1, studentRef: 1, entryType: 1 },
  { unique: true }
);
marksEntryInfoSchema.index({ submissionRef: 1 });
marksEntryInfoSchema.index({ schoolId: 1, studentRef: 1, academicYearRef: 1 });

module.exports = mongoose.model('MarksEntryInfo', marksEntryInfoSchema);
