const mongoose = require('mongoose');
const MarksAuditLogInfo = require('../models/marksAuditLogInfo.model');
const UserInfo = require('../models/userInfo.model');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'confirmpassword',
  'currentpassword',
  'newpassword',
  'token',
  'schooltoken',
  'usertoken',
  'jwt',
  'secret',
  'codehash',
  'confirmationcode',
  'otp'
]);

class AuditLogService {
  /**
   * Recursively strip passwords, tokens, and sensitive credentials before persisting audit metadata
   */
  static sanitizeValue(value, depth = 0) {
    if (value === null || value === undefined || depth > 4) return value ?? null;
    if (Array.isArray(value)) {
      return value.slice(0, 25).map(item => this.sanitizeValue(item, depth + 1));
    }
    if (value instanceof Date) return value;
    if (mongoose.Types.ObjectId.isValid(value) && typeof value !== 'string') {
      return value.toString();
    }
    if (typeof value === 'object') {
      const cleaned = {};
      for (const [k, v] of Object.entries(value)) {
        if (SENSITIVE_KEYS.has(String(k).toLowerCase())) continue;
        cleaned[k] = this.sanitizeValue(v, depth + 1);
      }
      return cleaned;
    }
    return value;
  }

  /**
   * Write a centralized audit record into marks_audit_log_info
   */
  static async log({
    schoolRef,
    schoolId,
    academicYearRef = null,
    examinationRef = null,
    classRef = null,
    sectionRef = null,
    subjectRef = null,
    submissionRef = null,
    resultRef = null,
    module = 'SYSTEM',
    entityType = '',
    entityId = '',
    action,
    details = '',
    previousValue = null,
    newValue = null,
    user
  }) {
    try {
      if (!user || !user._id || !schoolId || !action) return null;

      return await MarksAuditLogInfo.create({
        schoolRef: schoolRef || user.schoolRef,
        schoolId: String(schoolId).toUpperCase(),
        academicYearRef: academicYearRef || null,
        examinationRef: examinationRef || null,
        classRef: classRef || null,
        sectionRef: sectionRef || null,
        subjectRef: subjectRef || null,
        submissionRef: submissionRef || null,
        resultRef: resultRef || null,
        module: String(module || 'SYSTEM').toUpperCase(),
        entityType: String(entityType || ''),
        entityId: entityId ? String(entityId) : '',
        action: String(action).toUpperCase().trim(),
        details: String(details || '').trim(),
        previousValue: previousValue !== undefined ? this.sanitizeValue(previousValue) : null,
        newValue: newValue !== undefined ? this.sanitizeValue(newValue) : null,
        performedByUserRef: user._id,
        performedByName: user.employeeRef?.fullName || user.fullName || user.userId || 'User',
        performedByRole: (user.roleCode || '').toUpperCase(),
        performedAt: new Date()
      });
    } catch (err) {
      console.warn('[AuditLogService] Failed to write audit log:', err.message);
      return null;
    }
  }

  /**
   * Query audit logs with strict Role-Based & School-Based Isolation:
   * - ADMIN: views all logs in their own school (including ADMIN, HEAD_TEACHER, TEACHER, OFFICE_STAFF)
   * - HEAD_TEACHER: views logs in their own school ONLY for TEACHER, HEAD_TEACHER, OFFICE_STAFF (NEVER ADMIN)
   * - TEACHER / OFFICE_STAFF: forbidden (403)
   */
  static async queryLogs({
    viewer,
    userId = 'ALL',
    role = 'ALL',
    module = 'ALL',
    action = 'ALL',
    startDate = '',
    endDate = '',
    search = '',
    page = 1,
    limit = 20
  }) {
    if (!viewer || !['ADMIN', 'HEAD_TEACHER'].includes(viewer.roleCode)) {
      const err = new Error('Access denied. Only School Administrators and Head Teachers can access Audit Logs.');
      err.statusCode = 403;
      throw err;
    }

    const schoolId = viewer.schoolId.toUpperCase();
    const isAdmin = viewer.roleCode === 'ADMIN';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const allowedRoles = isAdmin
      ? ['ADMIN', 'HEAD_TEACHER', 'TEACHER', 'OFFICE_STAFF']
      : ['HEAD_TEACHER', 'TEACHER', 'OFFICE_STAFF'];

    const query = {
      schoolId,
      performedByRole: { $in: allowedRoles }
    };

    if (role && role !== 'ALL') {
      const cleanRole = role.toUpperCase();
      if (!allowedRoles.includes(cleanRole)) {
        return {
          logs: [],
          filterOptions: { users: [], roles: allowedRoles, modules: [], actions: [] },
          pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
        };
      }
      query.performedByRole = cleanRole;
    }

    if (userId && userId !== 'ALL' && mongoose.Types.ObjectId.isValid(userId)) {
      query.performedByUserRef = new mongoose.Types.ObjectId(userId);
    }

    if (module && module !== 'ALL') {
      query.module = module.toUpperCase();
    }

    if (action && action !== 'ALL') {
      query.action = action.toUpperCase();
    }

    if (startDate || endDate) {
      query.performedAt = {};
      if (startDate) {
        const sd = new Date(startDate);
        if (!isNaN(sd.getTime())) {
          sd.setHours(0, 0, 0, 0);
          query.performedAt.$gte = sd;
        }
      }
      if (endDate) {
        const ed = new Date(endDate);
        if (!isNaN(ed.getTime())) {
          ed.setHours(23, 59, 59, 999);
          query.performedAt.$lte = ed;
        }
      }
      if (Object.keys(query.performedAt).length === 0) {
        delete query.performedAt;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { details: regex },
        { action: regex },
        { module: regex },
        { performedByName: regex },
        { entityId: regex }
      ];
    }

    const [totalRecords, logs, schoolUsers, distinctModules, distinctActions] = await Promise.all([
      MarksAuditLogInfo.countDocuments(query),
      MarksAuditLogInfo.find(query)
        .populate('performedByUserRef', 'userId roleCode roleName')
        .populate('academicYearRef', 'yearCode yearName')
        .populate('examinationRef', 'examinationCode examinationName')
        .populate('classRef', 'classCode className')
        .populate('sectionRef', 'sectionCode sectionName')
        .populate('subjectRef', 'subjectCode subjectName')
        .sort({ performedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      UserInfo.find({ schoolId, roleCode: { $in: allowedRoles } })
        .populate('employeeRef', 'fullName')
        .select('_id userId roleCode roleName employeeRef')
        .sort({ roleCode: 1 })
        .lean(),
      MarksAuditLogInfo.distinct('module', { schoolId, performedByRole: { $in: allowedRoles } }),
      MarksAuditLogInfo.distinct('action', { schoolId, performedByRole: { $in: allowedRoles } })
    ]);

    return {
      logs: logs.map(l => ({
        _id: l._id,
        schoolId: l.schoolId,
        module: l.module || 'MARKS_ENTRY',
        action: l.action,
        entityType: l.entityType || '',
        entityId: l.entityId || l.submissionRef?.toString() || l.resultRef?.toString() || '',
        details: l.details,
        previousValue: l.previousValue ?? null,
        newValue: l.newValue ?? null,
        performedByUserRef: l.performedByUserRef?._id || l.performedByUserRef,
        performedByUserId: l.performedByUserRef?.userId || '',
        performedByName: l.performedByName,
        performedByRole: l.performedByRole,
        academicYearName: l.academicYearRef?.yearName || l.academicYearRef?.yearCode || '',
        examinationName: l.examinationRef?.examinationName || '',
        className: l.classRef?.className || '',
        sectionName: l.sectionRef?.sectionName || '',
        subjectName: l.subjectRef?.subjectName || '',
        performedAt: l.performedAt
      })),
      filterOptions: {
        users: schoolUsers.map(u => ({
          _id: u._id,
          userId: u.userId,
          fullName: u.employeeRef?.fullName || u.userId,
          roleCode: u.roleCode
        })),
        roles: allowedRoles,
        modules: distinctModules.filter(Boolean).sort(),
        actions: distinctActions.filter(Boolean).sort()
      },
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }
}

module.exports = AuditLogService;
