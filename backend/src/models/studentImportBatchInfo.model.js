const mongoose = require('mongoose');

const studentImportBatchInfoSchema = new mongoose.Schema({
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
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  importType: {
    type: String,
    enum: ['NEW_ADMISSION', 'EXISTING_ENROLLMENT'],
    required: [true, 'Import type is required']
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  successfulRecords: {
    type: Number,
    default: 0
  },
  failedRecords: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PROCESSING'
  },
  errors: [{
    row: Number,
    admissionNumber: String,
    studentName: String,
    reason: String
  }],
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  importedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'student_import_batch_info'
});

// Lookup indexes
studentImportBatchInfoSchema.index({ schoolId: 1, academicYearRef: 1 });
studentImportBatchInfoSchema.index({ schoolId: 1, importedAt: -1 });

module.exports = mongoose.model('StudentImportBatchInfo', studentImportBatchInfoSchema);
