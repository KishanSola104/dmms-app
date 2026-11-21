const AcademicYearInfo = require('../models/academicYearInfo.model');

class AcademicYearService {
  /**
   * Helper to compute status based on dates and isCurrent flag
   */
  static getComputedStatus(year) {
    const now = new Date();
    const start = new Date(year.startDate);
    const end = new Date(year.endDate);

    if (now > end) {
      return 'FINISHED'; // Past / Finished
    }
    if (now < start) {
      return 'UPCOMING';
    }
    if (year.isCurrent) {
      return 'CURRENT';
    }
    return 'ACTIVE';
  }

  /**
   * List academic years with search, status filter, and pagination
   */
  static async listAcademicYears({ schoolId, search = '', status = '', page = 1, limit = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const years = await AcademicYearInfo.find({ schoolId }).sort({ isCurrent: -1, startDate: -1 });

    // Map computed status
    let formatted = years.map(y => {
      const computedStatus = this.getComputedStatus(y);
      return {
        _id: y._id,
        yearCode: y.yearCode,
        yearName: y.yearName,
        startDate: y.startDate,
        endDate: y.endDate,
        isCurrent: y.isCurrent,
        rawStatus: y.status,
        status: computedStatus,
        createdAt: y.createdAt
      };
    });

    // Search filter (Year Name, Year Code)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      formatted = formatted.filter(y =>
        y.yearName.toLowerCase().includes(q) || y.yearCode.toLowerCase().includes(q)
      );
    }

    // Status filter (CURRENT, UPCOMING, FINISHED)
    if (status && status !== 'ALL') {
      const s = status.toUpperCase();
      formatted = formatted.filter(y => y.status === s);
    }

    const totalRecords = formatted.length;
    const paginated = formatted.slice(skip, skip + limitNum);

    return {
      academicYears: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Validate dates, future restrictions, duplicates, and overlaps
   */
  static async validateAcademicYearRules({ schoolId, yearName, startDate, endDate, excludeId = null }) {
    if (!yearName || !yearName.trim()) {
      throw new Error('Academic Year Name is mandatory.');
    }
    if (!startDate || !endDate) {
      throw new Error('Both Start Date and End Date are required.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Please provide valid Start and End dates.');
    }

    if (start >= end) {
      throw new Error('Start Date must be earlier than End Date.');
    }

    const now = new Date();
    const currentCalendarYear = now.getFullYear();
    const startYear = start.getFullYear();

    // 1. Past academic years must not be created (startYear >= currentCalendarYear and end date not in the past)
    if (startYear < currentCalendarYear) {
      throw new Error(`Past academic years cannot be created. The start year cannot be earlier than the current calendar year (${currentCalendarYear}).`);
    }

    if (end < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      throw new Error('Cannot create an academic year that has already ended in the past.');
    }

    // 2. Starting year must not be more than three calendar years ahead
    const maxStartYear = currentCalendarYear + 3;
    if (startYear > maxStartYear) {
      throw new Error(`The starting year cannot be more than three calendar years ahead (Max allowed start year: ${maxStartYear}).`);
    }

    // 3. Prevent duplicate academic year names or year codes in the same school
    const duplicateQuery = {
      schoolId,
      yearName: { $regex: new RegExp(`^${yearName.trim()}$`, 'i') }
    };
    if (excludeId) {
      duplicateQuery._id = { $ne: excludeId };
    }
    const duplicate = await AcademicYearInfo.findOne(duplicateQuery);
    if (duplicate) {
      throw new Error(`An academic year named '${yearName.trim()}' already exists for this school.`);
    }

    // 4. Prevent overlapping academic-year date ranges within the same school
    const overlapQuery = {
      schoolId,
      startDate: { $lte: end },
      endDate: { $gte: start }
    };
    if (excludeId) {
      overlapQuery._id = { $ne: excludeId };
    }

    const overlapping = await AcademicYearInfo.findOne(overlapQuery);
    if (overlapping) {
      const overlapStart = new Date(overlapping.startDate).toLocaleDateString('en-GB');
      const overlapEnd = new Date(overlapping.endDate).toLocaleDateString('en-GB');
      throw new Error(`The date range overlaps with existing academic year '${overlapping.yearName}' (${overlapStart} - ${overlapEnd}).`);
    }

    return { start, end };
  }

  /**
   * Create Academic Year
   */
  static async createAcademicYear({ schoolId, schoolRef, yearName, startDate, endDate, isCurrent = false }) {
    const { start, end } = await this.validateAcademicYearRules({
      schoolId,
      yearName,
      startDate,
      endDate
    });

    const now = new Date();
    // Derive yearCode from start and end dates (e.g., 2026-2027)
    const yearCode = `${start.getFullYear()}-${end.getFullYear()}`;

    // If isCurrent requested, verify current date is within date range
    let shouldBeCurrent = false;
    if (isCurrent) {
      if (now < start || now > end) {
        throw new Error('An academic year can only be set as Current if today falls within its Start and End date range.');
      }
      shouldBeCurrent = true;
      // Demote existing current year
      await AcademicYearInfo.updateMany({ schoolId }, { $set: { isCurrent: false } });
    } else {
      // If no current academic year exists for school and today is in range, make this current
      const hasCurrent = await AcademicYearInfo.findOne({ schoolId, isCurrent: true });
      if (!hasCurrent && now >= start && now <= end) {
        shouldBeCurrent = true;
      }
    }

    const academicYear = new AcademicYearInfo({
      schoolRef,
      schoolId,
      yearCode,
      yearName: yearName.trim(),
      startDate: start,
      endDate: end,
      isCurrent: shouldBeCurrent,
      status: now > end ? 'COMPLETED' : (now < start ? 'UPCOMING' : 'ACTIVE')
    });

    await academicYear.save();

    return {
      _id: academicYear._id,
      yearCode: academicYear.yearCode,
      yearName: academicYear.yearName,
      startDate: academicYear.startDate,
      endDate: academicYear.endDate,
      isCurrent: academicYear.isCurrent,
      status: this.getComputedStatus(academicYear)
    };
  }

  /**
   * Edit Academic Year
   */
  static async editAcademicYear({ schoolId, yearId, yearName, startDate, endDate, isCurrent }) {
    const academicYear = await AcademicYearInfo.findOne({ _id: yearId, schoolId });
    if (!academicYear) {
      throw new Error('Academic year not found.');
    }

    const { start, end } = await this.validateAcademicYearRules({
      schoolId,
      yearName,
      startDate,
      endDate,
      excludeId: yearId
    });

    const now = new Date();
    academicYear.yearName = yearName.trim();
    academicYear.yearCode = `${start.getFullYear()}-${end.getFullYear()}`;
    academicYear.startDate = start;
    academicYear.endDate = end;

    if (isCurrent !== undefined) {
      if (isCurrent) {
        if (now < start || now > end) {
          throw new Error('Cannot set academic year as Current because today does not fall within its date range.');
        }
        await AcademicYearInfo.updateMany({ schoolId }, { $set: { isCurrent: false } });
        academicYear.isCurrent = true;
      } else {
        // Prevent unsetting if it is the only current year and no other year is active
        academicYear.isCurrent = false;
      }
    }

    academicYear.status = now > end ? 'COMPLETED' : (now < start ? 'UPCOMING' : 'ACTIVE');
    await academicYear.save();

    return {
      _id: academicYear._id,
      yearCode: academicYear.yearCode,
      yearName: academicYear.yearName,
      startDate: academicYear.startDate,
      endDate: academicYear.endDate,
      isCurrent: academicYear.isCurrent,
      status: this.getComputedStatus(academicYear)
    };
  }

  /**
   * Set an Academic Year as Current
   */
  static async setAsCurrent({ schoolId, yearId }) {
    const year = await AcademicYearInfo.findOne({ _id: yearId, schoolId });
    if (!year) {
      throw new Error('Academic year not found.');
    }

    const now = new Date();
    const start = new Date(year.startDate);
    const end = new Date(year.endDate);

    if (now < start) {
      throw new Error('Cannot set a future (Upcoming) academic year as Current.');
    }
    if (now > end) {
      throw new Error('Cannot set a past (Finished) academic year as Current.');
    }

    await AcademicYearInfo.updateMany({ schoolId }, { $set: { isCurrent: false } });
    year.isCurrent = true;
    year.status = 'ACTIVE';
    await year.save();

    return {
      _id: year._id,
      yearCode: year.yearCode,
      yearName: year.yearName,
      isCurrent: true,
      status: 'CURRENT'
    };
  }
}

module.exports = AcademicYearService;
