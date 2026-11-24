import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import StatusBadge from '../../components/admin/StatusBadge';
import AdminPagination from '../../components/admin/AdminPagination';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  User,
  Users,
  Search,
  BookOpen,
  TrendingUp,
  Filter,
  RefreshCw,
  X,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Award
} from 'lucide-react';

const HeadTeacherStudentPerformancePage = () => {
  const { studentId: routeStudentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedYear } = useAcademicYear();

  const activeStudentId = routeStudentId || searchParams.get('studentId');

  // Search & Filter Drawer State:
  // If navigated with a studentId, start with drawer closed so the performance is immediately visible.
  // If no student is selected, start with drawer open.
  const [selectorOpen, setSelectorOpen] = useState(!activeStudentId);

  // Filter States
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState('ALL');
  const [selectedGender, setSelectedGender] = useState('ALL');
  const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Search Results & Pagination
  const [matchingStudents, setMatchingStudents] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 6
  });

  // Performance Data State
  const [performanceData, setPerformanceData] = useState(null);
  const [activeAyId, setActiveAyId] = useState('');
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [performanceError, setPerformanceError] = useState('');

  // Selected Examination for Detailed Subject/Component Inspection
  const [selectedExamId, setSelectedExamId] = useState(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 1. Fetch available classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/head-teacher/classes?limit=100');
        if (res.success && res.classes) {
          setClasses(res.classes);
        }
      } catch (err) {
        console.error('[StudentPerformance] Failed to fetch classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // 2. Fetch sections when a specific class is selected
  useEffect(() => {
    const fetchSections = async () => {
      if (!selectedClassId || selectedClassId === 'ALL') {
        setSections([]);
        setSelectedSectionId('ALL');
        return;
      }

      try {
        const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
        const res = await api.get(`/head-teacher/classes/${selectedClassId}${yearQuery}`);
        if (res.success && res.sections) {
          setSections(res.sections);
          if (selectedSectionId !== 'ALL' && !res.sections.some(s => s._id === selectedSectionId)) {
            setSelectedSectionId('ALL');
          }
        } else {
          setSections([]);
          setSelectedSectionId('ALL');
        }
      } catch (err) {
        console.error('[StudentPerformance] Failed to fetch sections for class:', err);
        setSections([]);
        setSelectedSectionId('ALL');
      }
    };

    fetchSections();
  }, [selectedClassId, selectedYear]);

  // 3. Search and filter students via backend API
  const fetchMatchingStudents = async (page = 1) => {
    setSearchingStudents(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', pagination.limit);

      if (selectedYear?._id) {
        params.append('academicYearId', selectedYear._id);
      }
      if (selectedClassId && selectedClassId !== 'ALL') {
        params.append('classId', selectedClassId);
      }
      if (selectedSectionId && selectedSectionId !== 'ALL') {
        params.append('sectionId', selectedSectionId);
      }
      if (selectedGender && selectedGender !== 'ALL') {
        params.append('gender', selectedGender);
      }
      if (selectedEnrollmentStatus && selectedEnrollmentStatus !== 'ALL') {
        params.append('enrollmentStatus', selectedEnrollmentStatus);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const res = await api.get(`/head-teacher/students?${params.toString()}`);
      if (res.success) {
        setMatchingStudents(res.students || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setMatchingStudents([]);
      }
    } catch (err) {
      console.error('[StudentPerformance] Search students error:', err);
      setMatchingStudents([]);
    } finally {
      setSearchingStudents(false);
    }
  };

  // Re-run student search when any filter, search query, or academic year changes
  useEffect(() => {
    fetchMatchingStudents(1);
  }, [
    selectedYear?._id,
    selectedClassId,
    selectedSectionId,
    selectedGender,
    selectedEnrollmentStatus,
    debouncedSearch
  ]);

  // 4. Fetch Performance Data when activeStudentId or activeAyId changes
  useEffect(() => {
    if (!activeStudentId) {
      setPerformanceData(null);
      return;
    }

    const fetchPerformance = async () => {
      setLoadingPerformance(true);
      setPerformanceError('');
      try {
        const yearParam = activeAyId
          ? `?academicYearId=${activeAyId}`
          : (selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '');
        const res = await api.get(`/head-teacher/students/${activeStudentId}/performance${yearParam}`);
        if (res.success) {
          setPerformanceData(res);
          if (res.examinations && res.examinations.length > 0) {
            setSelectedExamId(res.examinations[0]._id);
          } else {
            setSelectedExamId(null);
          }
        } else {
          setPerformanceError(res.message || 'Failed to retrieve performance data.');
        }
      } catch (err) {
        setPerformanceError(err.message || 'Student performance records not found.');
        setPerformanceData(null);
      } finally {
        setLoadingPerformance(false);
      }
    };

    fetchPerformance();
  }, [activeStudentId, activeAyId, selectedYear]);

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedClassId('ALL');
    setSelectedSectionId('ALL');
    setSelectedGender('ALL');
    setSelectedEnrollmentStatus('ALL');
    setSearchQuery('');
  };

  const isFilterActive =
    selectedClassId !== 'ALL' ||
    selectedSectionId !== 'ALL' ||
    selectedGender !== 'ALL' ||
    selectedEnrollmentStatus !== 'ALL' ||
    searchQuery.trim() !== '';

  const handleSelectStudent = (sId) => {
    navigate(`/head-teacher/student-performance?studentId=${sId}`);
    setSelectorOpen(false);
  };

  const student = performanceData?.student;
  const placement = performanceData?.academicPlacement;
  const availableYears = performanceData?.availableAcademicYears || [];
  const examinations = performanceData?.examinations || [];
  const selectedExam = examinations.find(e => e._id === selectedExamId) || examinations[0] || null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            {student ? (
              <button
                type="button"
                onClick={() => navigate(`/head-teacher/students/${student._id}`)}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Back to Profile</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/head-teacher/students')}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                <span>Back to Student List</span>
              </button>
            )}

            <span className="text-slate-300">|</span>

            <span className="text-xs font-semibold text-slate-700">
              Student Performance
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSelectorOpen(!selectorOpen)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 mr-1.5" />
              <span>{selectorOpen ? 'Close Search & Filters' : 'Find / Switch Student'}</span>
              {selectorOpen ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
              )}
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {performanceError && (
          <div className="p-4 rounded-xl flex items-center justify-between border bg-red-50 border-red-200 text-red-700 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{performanceError}</p>
            </div>
            <button
              onClick={() => navigate('/head-teacher/students')}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition-colors"
            >
              Return to Student List
            </button>
          </div>
        )}

        {/* Search & Filtering Section (Section 2) */}
        {selectorOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Search and Filter Students</span>
                {isFilterActive && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                    Active Filters
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Clear Filters</span>
                  </button>
                )}
                {activeStudentId && (
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search by Name or Admission Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Student Name / Adm No</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or adm no..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Class Filter */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.className} {cls.classCode ? `(${cls.classCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter (Dependent on Class) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  disabled={selectedClassId === 'ALL'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec._id} value={sec._id}>
                      {sec.sectionName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender Filter */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Gender</label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Genders</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Enrollment Status Filter */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Enrollment Status</label>
                <select
                  value={selectedEnrollmentStatus}
                  onChange={(e) => setSelectedEnrollmentStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="TRANSFERRED">Transferred</option>
                </select>
              </div>
            </div>

            {/* Matching Students Selection Grid */}
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Matching Students: <strong className="text-slate-800">{pagination.totalRecords}</strong> found for {selectedYear?.yearName || 'Academic Year'}
                </span>
                <span>Click a student to view their academic performance</span>
              </div>

              {searchingStudents ? (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                  <span>Searching student records...</span>
                </div>
              ) : matchingStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                  No student records found matching your filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {matchingStudents.map((s) => {
                    const isSelected = activeStudentId === s._id;
                    return (
                      <div
                        key={s.enrollmentId || s._id}
                        onClick={() => handleSelectStudent(s._id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs border border-slate-200">
                            {s.profilePhotoUrl ? (
                              <img
                                src={s.profilePhotoUrl}
                                alt={s.fullName}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <span>{s.firstName?.[0]}{s.lastName?.[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{s.fullName}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1.5">
                              <span>{s.admissionNumber}</span>
                              <span>&bull;</span>
                              <span>{s.className} {s.sectionName ? `(${s.sectionName})` : ''}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2">
                          <StatusBadge status={s.enrollmentStatus} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {pagination.totalRecords > pagination.limit && (
                <div className="pt-2">
                  <AdminPagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalRecords={pagination.totalRecords}
                    limit={pagination.limit}
                    onPageChange={(p) => fetchMatchingStudents(p)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* State: No Student Selected Banner (when drawer is closed) */}
        {!activeStudentId && !selectorOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">No Student Selected</h2>
              <p className="text-xs text-slate-500">
                Use the search &amp; filter section above to select a student and inspect their examinations and performance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Open Student Search
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loadingPerformance && (
          <div className="py-20 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading academic performance data...</p>
          </div>
        )}

        {/* Main Performance Content */}
        {student && !loadingPerformance && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xl flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                    {student.profilePhotoUrl ? (
                      <img
                        src={student.profilePhotoUrl}
                        alt={student.fullName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span>{student.firstName?.[0]}{student.lastName?.[0]}</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <span>{student.fullName}</span>
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold">
                        {student.admissionNumber}
                      </span>
                    </h1>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span>Class: <strong className="text-slate-800">{placement?.className || 'N/A'}</strong></span>
                      {placement?.sectionName && <span>• Section: <strong className="text-slate-800">{placement.sectionName}</strong></span>}
                      {placement?.rollNumber && placement.rollNumber !== '—' && (
                        <span>• Roll No: <strong className="font-mono text-slate-800">#{placement.rollNumber}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Academic Session Comparison Tabs */}
                {availableYears.length > 0 && (
                  <div className="space-y-1.5 shrink-0">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Academic Session
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableYears.map((ay) => {
                        const isCurrentActive = activeAyId
                          ? activeAyId === ay.academicYearId
                          : (placement?.academicYearId === ay.academicYearId);

                        return (
                          <button
                            key={ay.academicYearId}
                            type="button"
                            onClick={() => setActiveAyId(ay.academicYearId)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                              isCurrentActive
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span>{ay.academicYearName}</span>
                            <span className="text-[10px] opacity-75">({ay.className})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Performance KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Scheduled Examinations</div>
                <div className="text-2xl font-bold text-slate-900">{examinations.length}</div>
                <div className="text-[11px] text-slate-500">Configured for {placement?.className || 'Class'}</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Published Results</div>
                <div className="text-2xl font-bold text-blue-600">0</div>
                <div className="text-[11px] text-slate-500">Official approved results</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Academic Session</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{placement?.academicYearName || 'Current'}</div>
                <div className="text-[11px] text-slate-500">
                  {placement?.isCurrent ? 'Active Session' : 'Past Session'}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
                <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Enrollment Status</div>
                <div className="mt-1">
                  <StatusBadge status={placement?.enrollmentStatus} />
                </div>
                <div className="text-[11px] text-slate-500">Session enrollment record</div>
              </div>
            </div>

            {/* Examination Cards & Subject/Component Breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">
                      Examinations &amp; Subject Assessment Structure
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Scheduled examinations, scholastic/co-scholastic subject allocations, and evaluation components
                    </p>
                  </div>
                </div>

                <span className="text-xs font-semibold text-slate-500">
                  {examinations.length} {examinations.length === 1 ? 'Exam' : 'Exams'} in {placement?.academicYearName || 'Session'}
                </span>
              </div>

              {examinations.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-semibold text-xs text-slate-600">No examination results available.</p>
                  <p className="text-[11px]">No examinations are currently scheduled or recorded for {placement?.className || 'this class'} in this session.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {examinations.map((exam) => {
                    const isSelected = selectedExamId === exam._id;

                    return (
                      <div key={exam._id} className="p-4 space-y-4">
                        {/* Exam Header Row */}
                        <div
                          onClick={() => setSelectedExamId(isSelected ? null : exam._id)}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer group"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                <span>{exam.examinationName}</span>
                                <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                  {exam.examinationCode}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 flex items-center space-x-3 mt-0.5">
                                <span>Class: <strong>{exam.className}</strong></span>
                                {exam.startDate && (
                                  <span>
                                    &bull; Window: {new Date(exam.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    {exam.endDate ? ` - ${new Date(exam.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                                  </span>
                                )}
                                <span>&bull; {exam.totalSubjectsConfigured} Subjects</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {exam.status}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Results: Unpublished
                            </span>
                            {isSelected ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Subject & Component Breakdown when Expanded */}
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in fade-in duration-100">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                              <span>Subject-Wise Assessment Configuration</span>
                              <span className="text-[11px] text-slate-400 font-normal">
                                Assessment criteria defined in examination setup
                              </span>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    <th className="py-2.5 px-3">Subject Name</th>
                                    <th className="py-2.5 px-3">Type</th>
                                    <th className="py-2.5 px-3">Max Marks</th>
                                    <th className="py-2.5 px-3">Configured Components</th>
                                    <th className="py-2.5 px-3">Marks Obtained</th>
                                    <th className="py-2.5 px-3">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {exam.subjects.length === 0 ? (
                                    <tr>
                                      <td colSpan="6" className="py-4 text-center text-slate-400">
                                        No subjects configured for this examination.
                                      </td>
                                    </tr>
                                  ) : (
                                    exam.subjects.map((sub) => (
                                      <tr key={sub._id} className="hover:bg-slate-50/50">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                                          {sub.subjectName}
                                          <span className="ml-1.5 font-mono text-[10px] text-slate-400 font-normal">
                                            ({sub.subjectCode})
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                            sub.subjectType === 'ACADEMIC'
                                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                                              : 'bg-purple-50 text-purple-700 border-purple-200'
                                          }`}>
                                            {sub.subjectType}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                          {sub.totalMaximumMarks}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          {sub.components && sub.components.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {sub.components.map((c) => (
                                                <span
                                                  key={c._id}
                                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                                                >
                                                  {c.componentName}: <strong>{c.maximumMarks}M</strong>
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-slate-400 italic">No sub-components</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-400 italic">
                                          Pending publication
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                            Scheduled
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clean Graphical Analytics Placeholder */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center space-y-2">
              <BarChart3 className="w-8 h-8 text-indigo-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Performance Trends</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No performance data available. Visual score progression and subject comparison charts will appear automatically when published examination results are available.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherStudentPerformancePage;
