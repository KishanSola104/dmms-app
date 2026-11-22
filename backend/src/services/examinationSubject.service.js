const mongoose = require('mongoose');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const ExaminationComponentInfo = require('../models/examinationComponentInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const ClassInfo = require('../models/classInfo.model');

class ExaminationSubjectService {
  /**
   * 1. Get all subjects allocated to a class for an examination, along with their marks configuration
   */
  static async getClassSubjectsForExam(schoolId, examinationId, classId) {
    if (!examinationId || !classId) {
      throw new Error('Examination ID and Class ID are required.');
    }

    // 1. Verify examination exists for school
    const examination = await ExaminationInfo.findOne({ _id: examinationId, schoolId })
      .populate('academicYearRef', 'yearName startDate endDate status isCurrent');
    if (!examination) {
      const err = new Error('Examination not found.');
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify class is assigned to this examination
    const examClass = await ExaminationClassInfo.findOne({
      schoolId,
      examinationRef: examinationId,
      classRef: classId,
      status: 'ACTIVE'
    });
    if (!examClass) {
      const err = new Error('The selected class is not assigned to this examination or is inactive.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Fetch Class details
    const classDoc = await ClassInfo.findOne({ _id: classId, schoolId });
    if (!classDoc) {
      const err = new Error('Class not found.');
      err.statusCode = 404;
      throw err;
    }

    // 4. Retrieve all subjects allocated to this class in this academic year
    const allocatedSubjects = await ClassSubjectInfo.find({
      schoolId,
      academicYearRef: examination.academicYearRef._id || examination.academicYearRef,
      classRef: classId,
      status: 'ACTIVE'
    }).sort({ subjectCode: 1 }).lean();

    // 5. Retrieve existing examination subject configurations for this exam & class
    const examSubjectConfigs = await ExaminationSubjectInfo.find({
      schoolId,
      examinationRef: examinationId,
      classRef: classId,
      status: 'ACTIVE'
    }).lean();

    const configMap = new Map();
    const configIds = [];
    for (const conf of examSubjectConfigs) {
      configMap.set(conf.subjectRef.toString(), conf);
      configIds.push(conf._id);
    }

    // 6. Retrieve components for all configured subjects
    const components = await ExaminationComponentInfo.find({
      examinationSubjectRef: { $in: configIds }
    }).sort({ sequence: 1 }).lean();

    const componentsMap = new Map();
    for (const comp of components) {
      const key = comp.examinationSubjectRef.toString();
      if (!componentsMap.has(key)) {
        componentsMap.set(key, []);
      }
      componentsMap.get(key).push({
        _id: comp._id,
        componentName: comp.componentName,
        maximumMarks: comp.maximumMarks,
        sequence: comp.sequence
      });
    }

    // 7. Merge allocated subjects with examination configuration
    const enrichedSubjects = allocatedSubjects.map((alloc) => {
      const existingConfig = configMap.get(alloc.subjectRef.toString());
      const subjectComponents = existingConfig
        ? (componentsMap.get(existingConfig._id.toString()) || [])
        : [];

      return {
        classSubjectRef: alloc._id,
        subjectRef: alloc.subjectRef,
        subjectCode: alloc.subjectCode,
        subjectName: alloc.subjectName,
        subjectType: alloc.subjectType,
        hasAdditionalComponents: alloc.hasAdditionalComponents || false,
        additionalComponents: alloc.additionalComponents || [],
        totalAdditionalMarks: alloc.totalAdditionalMarks || 0,
        isConfigured: !!existingConfig,
        examinationSubjectId: existingConfig ? existingConfig._id : null,
        totalMaximumMarks: existingConfig ? existingConfig.totalMaximumMarks : 0,
        components: subjectComponents
      };
    });

    const configuredCount = enrichedSubjects.filter((s) => s.isConfigured).length;

    return {
      examination: {
        _id: examination._id,
        examinationCode: examination.examinationCode,
        examinationName: examination.examinationName,
        status: examination.status,
        academicYear: examination.academicYearRef
      },
      classInfo: {
        _id: classDoc._id,
        classCode: classDoc.classCode,
        className: classDoc.className
      },
      subjects: enrichedSubjects,
      summary: {
        totalAllocatedSubjects: enrichedSubjects.length,
        configuredSubjects: configuredCount,
        unconfiguredSubjects: enrichedSubjects.length - configuredCount
      }
    };
  }

  /**
   * 2. Configure marks components for a subject in an examination-class combination
   */
  static async configureSubjectMarks(schoolId, schoolRef, { examinationId, classId, subjectId, components }) {
    if (!examinationId || !classId || !subjectId) {
      throw new Error('Examination ID, Class ID, and Subject ID are required.');
    }

    // 1. Verify Examination
    const examination = await ExaminationInfo.findOne({ _id: examinationId, schoolId });
    if (!examination) {
      const err = new Error('Examination not found.');
      err.statusCode = 404;
      throw err;
    }

    // 2. Verify Examination Class assignment
    const examClass = await ExaminationClassInfo.findOne({
      schoolId,
      examinationRef: examinationId,
      classRef: classId,
      status: 'ACTIVE'
    });
    if (!examClass) {
      const err = new Error('This class is not assigned to the examination.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Verify Subject Allocation to Class in this Academic Year
    const classSubject = await ClassSubjectInfo.findOne({
      schoolId,
      academicYearRef: examination.academicYearRef,
      classRef: classId,
      subjectRef: subjectId,
      status: 'ACTIVE'
    });
    if (!classSubject) {
      const err = new Error('This subject is not allocated to the selected class for this academic year.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate Components
    if (!Array.isArray(components) || components.length === 0) {
      const err = new Error('At least one examination marks component is required.');
      err.statusCode = 400;
      throw err;
    }

    const seenNames = new Set();
    const sanitizedComponents = [];

    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      if (!comp.componentName || typeof comp.componentName !== 'string' || !comp.componentName.trim()) {
        const err = new Error(`Component name is required for component #${i + 1}.`);
        err.statusCode = 400;
        throw err;
      }

      const trimmedName = comp.componentName.trim();
      const lowerName = trimmedName.toLowerCase();
      if (seenNames.has(lowerName)) {
        const err = new Error(`Duplicate component name "${trimmedName}" in configuration.`);
        err.statusCode = 400;
        throw err;
      }
      seenNames.add(lowerName);

      const maxMarks = Number(comp.maximumMarks);
      if (isNaN(maxMarks) || maxMarks <= 0 || !Number.isFinite(maxMarks)) {
        const err = new Error(`Maximum marks for "${trimmedName}" must be a positive number greater than 0.`);
        err.statusCode = 400;
        throw err;
      }

      sanitizedComponents.push({
        componentName: trimmedName,
        maximumMarks: maxMarks,
        sequence: comp.sequence || i + 1
      });
    }

    // 5. Automatic backend total calculation (Frontend is never trusted for totals)
    const totalMaximumMarks = sanitizedComponents.reduce((sum, c) => sum + c.maximumMarks, 0);

    // 6. Find or create ExaminationSubjectInfo
    let examSubject = await ExaminationSubjectInfo.findOne({
      schoolId,
      examinationRef: examinationId,
      classRef: classId,
      subjectRef: subjectId
    });

    if (!examSubject) {
      examSubject = new ExaminationSubjectInfo({
        schoolRef,
        schoolId,
        academicYearRef: examination.academicYearRef,
        examinationRef: examinationId,
        examinationClassRef: examClass._id,
        classRef: classId,
        classSubjectRef: classSubject._id,
        subjectRef: subjectId,
        subjectCode: classSubject.subjectCode,
        subjectName: classSubject.subjectName,
        subjectType: classSubject.subjectType,
        totalMaximumMarks,
        status: 'ACTIVE'
      });
      await examSubject.save();
    } else {
      examSubject.totalMaximumMarks = totalMaximumMarks;
      examSubject.examinationClassRef = examClass._id;
      examSubject.classSubjectRef = classSubject._id;
      examSubject.status = 'ACTIVE';
      await examSubject.save();
    }

    // 7. Replace components in ExaminationComponentInfo
    await ExaminationComponentInfo.deleteMany({ examinationSubjectRef: examSubject._id });

    const componentDocs = sanitizedComponents.map((c, index) => ({
      schoolRef,
      schoolId,
      academicYearRef: examination.academicYearRef,
      examinationSubjectRef: examSubject._id,
      componentName: c.componentName,
      maximumMarks: c.maximumMarks,
      sequence: c.sequence || index + 1
    }));

    const savedComponents = await ExaminationComponentInfo.insertMany(componentDocs);

    return {
      examinationSubject: examSubject,
      components: savedComponents,
      totalMaximumMarks
    };
  }

  /**
   * 3. Get single subject configuration
   */
  static async getSubjectConfiguration(schoolId, examinationId, classId, subjectId) {
    const examSubject = await ExaminationSubjectInfo.findOne({
      schoolId,
      examinationRef: examinationId,
      classRef: classId,
      subjectRef: subjectId
    }).lean();

    if (!examSubject) {
      return { isConfigured: false, components: [], totalMaximumMarks: 0 };
    }

    const components = await ExaminationComponentInfo.find({
      examinationSubjectRef: examSubject._id
    }).sort({ sequence: 1 }).lean();

    return {
      isConfigured: true,
      examinationSubject: examSubject,
      components,
      totalMaximumMarks: examSubject.totalMaximumMarks
    };
  }

  /**
   * 4. Remove / Reset subject marks configuration
   */
  static async removeSubjectConfiguration(schoolId, examinationSubjectId) {
    const examSubject = await ExaminationSubjectInfo.findOne({
      _id: examinationSubjectId,
      schoolId
    });

    if (!examSubject) {
      const err = new Error('Subject configuration not found.');
      err.statusCode = 404;
      throw err;
    }

    // Remove components
    await ExaminationComponentInfo.deleteMany({ examinationSubjectRef: examSubject._id });
    // Remove examination subject record
    await ExaminationSubjectInfo.deleteOne({ _id: examSubject._id });

    return { success: true, message: 'Subject marks configuration removed successfully.' };
  }

  /**
   * 5. Copy configuration from one class to another for the same examination
   */
  static async copyClassConfiguration(schoolId, schoolRef, examinationId, sourceClassId, targetClassId) {
    if (sourceClassId.toString() === targetClassId.toString()) {
      throw new Error('Source class and target class cannot be the same.');
    }

    // Verify target class is assigned to this exam
    const targetExamClass = await ExaminationClassInfo.findOne({
      schoolId,
      examinationRef: examinationId,
      classRef: targetClassId,
      status: 'ACTIVE'
    });
    if (!targetExamClass) {
      throw new Error('Target class is not assigned to this examination.');
    }

    // Get source configurations
    const sourceConfigs = await ExaminationSubjectInfo.find({
      schoolId,
      examinationRef: examinationId,
      classRef: sourceClassId,
      status: 'ACTIVE'
    }).lean();

    if (sourceConfigs.length === 0) {
      throw new Error('Source class has no configured subjects to copy.');
    }

    let copiedCount = 0;
    for (const src of sourceConfigs) {
      // Check if target class has this subject allocated
      const targetAllocation = await ClassSubjectInfo.findOne({
        schoolId,
        academicYearRef: src.academicYearRef,
        classRef: targetClassId,
        subjectRef: src.subjectRef,
        status: 'ACTIVE'
      });

      if (!targetAllocation) continue; // skip subjects not allocated to target class

      // Fetch source components
      const srcComponents = await ExaminationComponentInfo.find({
        examinationSubjectRef: src._id
      }).sort({ sequence: 1 }).lean();

      if (srcComponents.length === 0) continue;

      // Configure for target class independently
      await this.configureSubjectMarks(schoolId, schoolRef, {
        examinationId,
        classId: targetClassId,
        subjectId: src.subjectRef,
        components: srcComponents.map((c) => ({
          componentName: c.componentName,
          maximumMarks: c.maximumMarks,
          sequence: c.sequence
        }))
      });
      copiedCount++;
    }

    return {
      success: true,
      copiedCount,
      message: `Successfully copied configuration for ${copiedCount} subjects to target class.`
    };
  }
}

module.exports = ExaminationSubjectService;
