const mongoose = require('mongoose');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const UserInfo = require('../models/userInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');
const TeacherService = require('./teacher.service');
const TeacherMarksService = require('./teacherMarks.service');

class HeadTeacherResultService {
  /**
   * Helper: Ensure target Head Teacher or Admin cannot accidentally publish/approve non-matching state
   */
  static getModelByType(type) {
    return (type || 'FINAL').toUpperCase() === 'EXAMINATION'
      ? ExaminationResultInfo
      : FinalAcademicResultInfo;
  }

  /**
   * Helper: Notify active OFFICE_STAFF users when results are officially published
   */
  static async notifyOfficeStaffOnPublish({ schoolRef, schoolId, title, message }) {
    const staffUsers = await UserInfo.find({
      schoolId: schoolId.toUpperCase(),
      roleCode: 'OFFICE_STAFF',
      status: 'ACTIVE'
    }).lean();

    for (const staff of staffUsers) {
      await TeacherMarksService.notifyUser({
        schoolRef,
        schoolId,
        targetUser: staff,
        title,
        message,
        type: 'success'
      });
    }
  }

  /**
   * 1. List class-section result batches for Head Teacher Review & Publishing
   */
  static async listClassResultBatches({
    schoolId,
    academicYearId,
    type = 'FINAL',
    examinationId,
    classId,
    status
  }) {
    const sId = schoolId.toUpperCase();
    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(sId, academicYearId);

    const classes = await ClassInfo.find({ schoolId: sId, status: 'ACTIVE' })
      .sort({ classCode: 1 })
      .lean();

    const examinations = selectedYear
      ? await ExaminationInfo.find({
          schoolId: sId,
          academicYearRef: selectedYear._id,
          status: { $ne: 'CANCELLED' }
        })
          .sort({ startDate: 1, createdAt: 1 })
          .lean()
      : [];

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classes,
        examinations,
        batches: []
      };
    }

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const query = {
      schoolId: sId,
      academicYearRef: selectedYear._id
    };
    if (normType === 'EXAMINATION' && examinationId && mongoose.Types.ObjectId.isValid(examinationId)) {
      query.examinationRef = examinationId;
    }
    if (classId && classId !== 'ALL' && mongoose.Types.ObjectId.isValid(classId)) {
      query.classRef = classId;
    }
    if (status && status !== 'ALL') {
      query.status = status;
    } else {
      // Show submitted, under review, returned, approved, published (and optionally generated)
      query.status = {
        $in: ['GENERATED', 'SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'PUBLISHED']
      };
    }

    const docs = await Model.find(query)
      .sort({ className: 1, sectionName: 1, rollNumber: 1 })
      .lean();

    // Resolve Class Teacher / Section Teacher names cleanly
    const sectionIds = Array.from(new Set(docs.map(d => d.sectionRef.toString())));
    const classIds = Array.from(new Set(docs.map(d => d.classRef.toString())));
    const [secDocs, clsDocs] = await Promise.all([
      SectionInfo.find({ _id: { $in: sectionIds }, schoolId: sId }).lean(),
      ClassInfo.find({ _id: { $in: classIds }, schoolId: sId }).lean()
    ]);

    const secMap = new Map(secDocs.map(s => [s._id.toString(), s]));
    const clsMap = new Map(clsDocs.map(c => [c._id.toString(), c]));
    const empIds = Array.from(
      new Set(
        [
          ...secDocs.map(s => s.sectionTeacherRef?.toString()),
          ...clsDocs.map(c => c.classTeacherRef?.toString())
        ].filter(Boolean)
      )
    );
    const empDocs = empIds.length
      ? await EmployeeInfo.find({ _id: { $in: empIds } }).select('fullName').lean()
      : [];
    const empMap = new Map(empDocs.map(e => [e._id.toString(), e.fullName]));

    const batchMap = new Map();
    for (const d of docs) {
      const exKey = normType === 'EXAMINATION' ? String(d.examinationRef || '') : 'FINAL';
      const key = `${d.classRef.toString()}_${d.sectionRef.toString()}_${exKey}`;

      if (!batchMap.has(key)) {
        const sec = secMap.get(d.sectionRef.toString());
        const cls = clsMap.get(d.classRef.toString());
        const ctEmpId = (sec?.sectionTeacherRef || cls?.classTeacherRef || '').toString();

        batchMap.set(key, {
          batchKey: key,
          type: normType,
          academicYearId: selectedYear._id,
          academicYearName: selectedYear.yearName || selectedYear.yearCode,
          examinationId: normType === 'EXAMINATION' ? d.examinationRef : null,
          examinationName: normType === 'EXAMINATION' ? d.examinationName : 'Comprehensive Final Academic Result',
          examinationCode: normType === 'EXAMINATION' ? d.examinationCode : 'FINAL',
          classId: d.classRef,
          className: d.className,
          sectionId: d.sectionRef,
          sectionName: d.sectionName,
          classTeacherName: empMap.get(ctEmpId) || sec?.sectionTeacherName || cls?.classTeacherName || 'Assigned Class Teacher',
          studentCount: 0,
          passCount: 0,
          pctSum: 0,
          statuses: new Set(),
          submittedAt: d.submittedAt || null,
          reviewedAt: d.reviewedAt || null,
          approvedAt: d.approvedAt || null,
          publishedAt: d.publishedAt || null,
          returnedAt: d.returnedAt || null,
          returnReason: d.returnReason || ''
        });
      }

      const b = batchMap.get(key);
      b.studentCount += 1;
      if (d.resultStatus === 'PASS') b.passCount += 1;
      b.pctSum += Number(normType === 'EXAMINATION' ? d.percentage : d.finalPercentage) || 0;
      b.statuses.add(d.status);
      if (d.submittedAt && (!b.submittedAt || new Date(d.submittedAt) > new Date(b.submittedAt))) {
        b.submittedAt = d.submittedAt;
      }
      if (d.publishedAt && (!b.publishedAt || new Date(d.publishedAt) > new Date(b.publishedAt))) {
        b.publishedAt = d.publishedAt;
      }
      if (d.returnReason && !b.returnReason) {
        b.returnReason = d.returnReason;
      }
    }

    const priorityOrder = ['PUBLISHED', 'APPROVED', 'RETURNED', 'UNDER_REVIEW', 'SUBMITTED_TO_HEAD_TEACHER', 'GENERATED'];
    const batches = Array.from(batchMap.values()).map(b => {
      const statusList = Array.from(b.statuses);
      const batchStatus =
        priorityOrder.find(s => statusList.includes(s)) || statusList[0] || 'GENERATED';
      return {
        ...b,
        statuses: statusList,
        batchStatus,
        averagePercentage: b.studentCount > 0 ? Math.round((b.pctSum / b.studentCount) * 100) / 100 : 0
      };
    });

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classes,
      examinations,
      batches
    };
  }

  /**
   * 2. Get detailed student results for a Class-Section batch
   */
  static async getClassResultDetails({
    schoolId,
    academicYearId,
    type = 'FINAL',
    examinationId,
    classId,
    sectionId
  }) {
    const sId = schoolId.toUpperCase();
    const { selectedYear } = await TeacherService.resolveAcademicYear(sId, academicYearId);
    if (!selectedYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const query = {
      schoolId: sId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId
    };
    if (normType === 'EXAMINATION') {
      if (!examinationId) {
        const err = new Error('examinationId is required for examination result details.');
        err.statusCode = 400;
        throw err;
      }
      query.examinationRef = examinationId;
    }

    const results = await Model.find(query)
      .sort({ rollNumber: 1, studentName: 1 })
      .lean();

    return {
      type: normType,
      academicYear: selectedYear,
      results
    };
  }

  /**
   * 3. Mark Submitted Results as Under Review
   */
  static async markUnderReview({ user, type = 'FINAL', academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) throw new Error('Academic year not found.');

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const filter = {
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId,
      status: 'SUBMITTED_TO_HEAD_TEACHER'
    };
    if (normType === 'EXAMINATION') {
      filter.examinationRef = examinationId;
    }

    const updated = await Model.updateMany(filter, {
      $set: {
        status: 'UNDER_REVIEW',
        reviewedByUserRef: user._id,
        reviewedAt: new Date()
      }
    });

    if (updated.modifiedCount === 0) {
      const err = new Error('No submitted results found to mark as Under Review.');
      err.statusCode = 400;
      throw err;
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: selectedYear._id,
      examinationRef: normType === 'EXAMINATION' ? examinationId : null,
      classRef: classId,
      sectionRef: sectionId,
      action: normType === 'EXAMINATION' ? 'EXAM_RESULT_UNDER_REVIEW' : 'FINAL_RESULT_UNDER_REVIEW',
      details: `Head Teacher opened ${normType} results for review (${updated.modifiedCount} students).`,
      user
    });

    return {
      success: true,
      modifiedCount: updated.modifiedCount,
      message: `Marked ${updated.modifiedCount} result(s) as Under Review.`
    };
  }

  /**
   * 4. Verify and Approve Submitted / Under-Review Results
   */
  static async approveResults({ user, type = 'FINAL', academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) throw new Error('Academic year not found.');

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const baseFilter = {
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId
    };
    if (normType === 'EXAMINATION') baseFilter.examinationRef = examinationId;

    const existing = await Model.find(baseFilter).lean();
    if (existing.length === 0) {
      const err = new Error('No result records found for this class and section.');
      err.statusCode = 404;
      throw err;
    }

    if (existing.every(r => r.status === 'PUBLISHED')) {
      const err = new Error('These results are already published.');
      err.statusCode = 400;
      throw err;
    }

    const reviewable = existing.filter(r =>
      ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW'].includes(r.status)
    );
    if (reviewable.length === 0) {
      const err = new Error(
        'Results must be submitted by the Class Teacher before Head Teacher approval.'
      );
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const upd = await Model.updateMany(
      {
        ...baseFilter,
        status: { $in: ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW'] }
      },
      {
        $set: {
          status: 'APPROVED',
          approvedByUserRef: user._id,
          approvedAt: now,
          reviewedByUserRef: user._id,
          reviewedAt: now,
          returnReason: '',
          returnedByUserRef: null,
          returnedAt: null
        }
      }
    );

    const [sec, ctUsers] = await Promise.all([
      SectionInfo.findById(sectionId).lean(),
      TeacherMarksService.findClassTeacherUsers(schoolId, classId, sectionId)
    ]);

    const scopeLabel =
      normType === 'EXAMINATION'
        ? `${existing[0].examinationName} (${sec?.className || ''} - ${sec?.sectionName || ''})`
        : `Final Academic Result (${sec?.className || ''} - ${sec?.sectionName || ''})`;

    for (const ct of ctUsers) {
      await TeacherMarksService.notifyUser({
        schoolRef,
        schoolId,
        targetUser: ct,
        title: `${normType === 'EXAMINATION' ? 'Examination' : 'Final'} Results Approved`,
        message: `Head Teacher approved ${scopeLabel}. Ready for official publication.`,
        type: 'success'
      });
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: selectedYear._id,
      examinationRef: normType === 'EXAMINATION' ? examinationId : null,
      classRef: classId,
      sectionRef: sectionId,
      action: normType === 'EXAMINATION' ? 'EXAM_RESULT_APPROVED' : 'FINAL_RESULT_APPROVED',
      details: `Head Teacher approved ${scopeLabel} (${upd.modifiedCount} students).`,
      user
    });

    return {
      success: true,
      approvedCount: upd.modifiedCount,
      message: `${scopeLabel} verified and approved successfully.`
    };
  }

  /**
   * 5. Return Submitted / Under-Review Results to Class Teacher with Mandatory Reason
   */
  static async returnResults({
    user,
    type = 'FINAL',
    academicYearId,
    examinationId,
    classId,
    sectionId,
    reason
  }) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      const err = new Error('A correction reason is mandatory when returning results to the Class Teacher.');
      err.statusCode = 400;
      throw err;
    }

    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) throw new Error('Academic year not found.');

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const baseFilter = {
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId
    };
    if (normType === 'EXAMINATION') baseFilter.examinationRef = examinationId;

    const existing = await Model.find(baseFilter).lean();
    if (existing.length === 0) {
      const err = new Error('No result records found.');
      err.statusCode = 404;
      throw err;
    }

    if (existing.some(r => ['APPROVED', 'PUBLISHED'].includes(r.status))) {
      const err = new Error('Approved or published results cannot be returned.');
      err.statusCode = 403;
      throw err;
    }

    const returnable = existing.filter(r =>
      ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW'].includes(r.status)
    );
    if (returnable.length === 0) {
      const err = new Error('Only submitted or under-review results can be returned for correction.');
      err.statusCode = 400;
      throw err;
    }

    const trimmedReason = reason.trim();
    const now = new Date();

    const upd = await Model.updateMany(
      {
        ...baseFilter,
        status: { $in: ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW'] }
      },
      {
        $set: {
          status: 'RETURNED',
          returnedByUserRef: user._id,
          returnedAt: now,
          returnReason: trimmedReason
        }
      }
    );

    const [sec, ctUsers] = await Promise.all([
      SectionInfo.findById(sectionId).lean(),
      TeacherMarksService.findClassTeacherUsers(schoolId, classId, sectionId)
    ]);

    const scopeLabel =
      normType === 'EXAMINATION'
        ? `${existing[0].examinationName} (${sec?.className || ''} - ${sec?.sectionName || ''})`
        : `Final Academic Result (${sec?.className || ''} - ${sec?.sectionName || ''})`;

    for (const ct of ctUsers) {
      await TeacherMarksService.notifyUser({
        schoolRef,
        schoolId,
        targetUser: ct,
        title: `${normType === 'EXAMINATION' ? 'Examination' : 'Final'} Results Returned for Correction`,
        message: `Head Teacher returned ${scopeLabel}. Reason: ${trimmedReason}`,
        type: 'warning'
      });
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: selectedYear._id,
      examinationRef: normType === 'EXAMINATION' ? examinationId : null,
      classRef: classId,
      sectionRef: sectionId,
      action: normType === 'EXAMINATION' ? 'EXAM_RESULT_RETURNED' : 'FINAL_RESULT_RETURNED',
      details: `Head Teacher returned ${scopeLabel}. Reason: ${trimmedReason}`,
      user
    });

    return {
      success: true,
      returnedCount: upd.modifiedCount,
      message: `${scopeLabel} returned to Class Teacher for correction.`
    };
  }

  /**
   * 6. Officially Publish Approved Results (makes them accessible to Office Staff)
   */
  static async publishResults({ user, type = 'FINAL', academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) throw new Error('Academic year not found.');

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const baseFilter = {
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId
    };
    if (normType === 'EXAMINATION') baseFilter.examinationRef = examinationId;

    const existing = await Model.find(baseFilter).lean();
    if (existing.length === 0) {
      const err = new Error('No result records found.');
      err.statusCode = 404;
      throw err;
    }

    const approvedRows = existing.filter(r => r.status === 'APPROVED');
    if (approvedRows.length === 0) {
      const err = new Error(
        'Results must be verified and approved by the Head Teacher before official publication.'
      );
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const upd = await Model.updateMany(
      {
        ...baseFilter,
        status: 'APPROVED'
      },
      {
        $set: {
          status: 'PUBLISHED',
          publishedByUserRef: user._id,
          publishedAt: now
        }
      }
    );

    const [sec, ctUsers] = await Promise.all([
      SectionInfo.findById(sectionId).lean(),
      TeacherMarksService.findClassTeacherUsers(schoolId, classId, sectionId)
    ]);

    const scopeLabel =
      normType === 'EXAMINATION'
        ? `${existing[0].examinationName} (${sec?.className || ''} - ${sec?.sectionName || ''})`
        : `Final Academic Result (${sec?.className || ''} - ${sec?.sectionName || ''})`;

    for (const ct of ctUsers) {
      await TeacherMarksService.notifyUser({
        schoolRef,
        schoolId,
        targetUser: ct,
        title: `${normType === 'EXAMINATION' ? 'Examination' : 'Final'} Results Published`,
        message: `Head Teacher published ${scopeLabel}.`,
        type: 'success'
      });
    }

    await this.notifyOfficeStaffOnPublish({
      schoolRef,
      schoolId,
      title: `New ${normType === 'EXAMINATION' ? 'Examination' : 'Final'} Results Published`,
      message: `${scopeLabel} (${upd.modifiedCount} students) is now officially published and available for download.`
    });

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: selectedYear._id,
      examinationRef: normType === 'EXAMINATION' ? examinationId : null,
      classRef: classId,
      sectionRef: sectionId,
      action: normType === 'EXAMINATION' ? 'EXAM_RESULT_PUBLISHED' : 'FINAL_RESULT_PUBLISHED',
      details: `Head Teacher published ${scopeLabel} (${upd.modifiedCount} students).`,
      user
    });

    return {
      success: true,
      publishedCount: upd.modifiedCount,
      message: `${scopeLabel} officially published and released to Office Staff.`
    };
  }
}

module.exports = HeadTeacherResultService;
