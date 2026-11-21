const SubjectInfo = require('../models/subjectInfo.model');

class SubjectService {
  /**
   * List subjects with search, type filter, status filter, and pagination
   */
  static async listSubjects({ schoolId, search = '', type = '', status = '', page = 1, limit = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };
    if (type && type !== 'ALL') {
      query.subjectType = type.toUpperCase();
    }
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const subjects = await SubjectInfo.find(query).sort({ subjectName: 1 });

    const formatted = subjects.map(s => ({
      _id: s._id,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      subjectType: s.subjectType,
      subjectTypeLabel: s.subjectType === 'ACADEMIC' ? 'Academic (Scholastic)' : 'Co-curricular (Co-Scholastic)',
      status: s.status,
      createdAt: s.createdAt
    }));

    let filtered = formatted;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = formatted.filter(s =>
        s.subjectCode.toLowerCase().includes(q) || s.subjectName.toLowerCase().includes(q)
      );
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      subjects: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Create Subject
   */
  static async createSubject({ schoolId, schoolRef, subjectCode, subjectName, subjectType }) {
    if (!subjectCode || !subjectName || !subjectType) {
      throw new Error('Subject Code, Subject Name, and Subject Type are mandatory.');
    }

    const cleanCode = subjectCode.trim().toUpperCase();
    const cleanName = subjectName.trim();
    const typeUpper = subjectType.trim().toUpperCase();

    if (!['ACADEMIC', 'CO_CURRICULAR'].includes(typeUpper)) {
      throw new Error("Subject Type must be either 'Academic (Scholastic)' or 'Co-curricular (Co-Scholastic)'.");
    }

    // Check unique subjectCode within school
    const existing = await SubjectInfo.findOne({ schoolId, subjectCode: cleanCode });
    if (existing) {
      throw new Error(`Subject Code '${cleanCode}' already exists in this school.`);
    }

    const subject = new SubjectInfo({
      schoolRef,
      schoolId,
      subjectCode: cleanCode,
      subjectName: cleanName,
      subjectType: typeUpper,
      status: 'ACTIVE'
    });

    await subject.save();

    return {
      _id: subject._id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      subjectType: subject.subjectType,
      status: subject.status
    };
  }

  /**
   * Edit Subject
   */
  static async editSubject({ schoolId, subjectId, subjectCode, subjectName, subjectType }) {
    const subject = await SubjectInfo.findOne({ _id: subjectId, schoolId });
    if (!subject) {
      throw new Error('Subject not found.');
    }

    if (subjectCode) {
      const cleanCode = subjectCode.trim().toUpperCase();
      if (cleanCode !== subject.subjectCode) {
        const existing = await SubjectInfo.findOne({ schoolId, subjectCode: cleanCode, _id: { $ne: subjectId } });
        if (existing) {
          throw new Error(`Subject Code '${cleanCode}' already exists in this school.`);
        }
        subject.subjectCode = cleanCode;
      }
    }

    if (subjectName) {
      subject.subjectName = subjectName.trim();
    }

    if (subjectType) {
      const typeUpper = subjectType.trim().toUpperCase();
      if (!['ACADEMIC', 'CO_CURRICULAR'].includes(typeUpper)) {
        throw new Error("Subject Type must be either 'Academic (Scholastic)' or 'Co-curricular (Co-Scholastic)'.");
      }
      subject.subjectType = typeUpper;
    }

    await subject.save();

    return {
      _id: subject._id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      subjectType: subject.subjectType,
      status: subject.status
    };
  }

  /**
   * Toggle Subject Status
   */
  static async toggleSubjectStatus({ schoolId, subjectId, status }) {
    const subject = await SubjectInfo.findOne({ _id: subjectId, schoolId });
    if (!subject) {
      throw new Error('Subject not found.');
    }

    subject.status = status.toUpperCase();
    await subject.save();

    return {
      _id: subject._id,
      subjectName: subject.subjectName,
      status: subject.status
    };
  }
}

module.exports = SubjectService;
