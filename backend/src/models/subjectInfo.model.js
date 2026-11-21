const mongoose = require('mongoose');

const subjectInfoSchema = new mongoose.Schema({
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
  subjectCode: {
    type: String,
    required: [true, 'Subject code is required'],
    trim: true,
    uppercase: true
  },
  subjectName: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  subjectType: {
    type: String,
    required: [true, 'Subject type is required'],
    enum: ['ACADEMIC', 'CO_CURRICULAR']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'subject_info'
});

// Subject code unique within school
subjectInfoSchema.index({ schoolId: 1, subjectCode: 1 }, { unique: true });

module.exports = mongoose.model('SubjectInfo', subjectInfoSchema);
