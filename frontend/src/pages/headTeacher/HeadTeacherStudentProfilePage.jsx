import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  Phone,
  Mail,
  Users,
  Clock,
  History,
  AlertCircle,
  Loader2,
  TrendingUp,
  MapPin,
  Heart,
  Search,
  Filter,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';

const HeadTeacherStudentProfilePage = () => {
  const { studentId: routeStudentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedYear } = useAcademicYear();

  // Active student ID from route param or query param
  const activeStudentId = routeStudentId || searchParams.get('studentId');

  // Search & Filter Drawer State
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

  // Profile Data State
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

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
        console.error('[StudentProfile] Failed to fetch classes:', err);
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
        console.error('[StudentProfile] Failed to fetch sections for class:', err);
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
      console.error('[StudentProfile] Search students error:', err);
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

  // 4. Fetch selected student's profile
  useEffect(() => {
    if (!activeStudentId) {
      setProfileData(null);
      return;
    }

    const fetchProfile = async () => {
      setLoadingProfile(true);
      setProfileError('');
      try {
        const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
        const res = await api.get(`/head-teacher/students/${activeStudentId}${yearQuery}`);
        if (res.success) {
          setProfileData(res);
        } else {
          setProfileError(res.message || 'Failed to load student profile.');
        }
      } catch (err) {
        setProfileError(err.message || 'Student record not found or inaccessible.');
        setProfileData(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [activeStudentId, selectedYear]);

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
    navigate(`/head-teacher/students/${sId}`);
    setSelectorOpen(false);
  };

  const student = profileData?.student;
  const placement = profileData?.academicPlacement;
  const parentInfo = profileData?.parentGuardianInfo;
  const enrollmentHistory = profileData?.enrollmentHistory || [];
  const changeLogs = profileData?.changeLogs || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate('/head-teacher/students')}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Back to Student List</span>
            </button>

            <span className="text-slate-300">|</span>

            <span className="text-xs font-semibold text-slate-700">
              Student Profile
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Find / Switch Student Button */}
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

            {student && (
              <button
                type="button"
                onClick={() => navigate(`/head-teacher/student-performance?studentId=${student._id}`)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                title="View academic performance and marks"
              >
                <TrendingUp className="w-4 h-4 mr-1.5" />
                <span>View Student Performance</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {profileError && (
          <div className="p-4 rounded-xl flex items-center justify-between border bg-red-50 border-red-200 text-red-700 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{profileError}</p>
            </div>
            <button
              onClick={() => navigate('/head-teacher/students')}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition-colors"
            >
              Return to Student List
            </button>
          </div>
        )}

        {/* Search & Filtering Section (Section 1) */}
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
                <span>Click a student to view their profile</span>
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
                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs border border-slate-200">
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

        {/* State: No Student Selected Banner (when selector is closed) */}
        {!activeStudentId && !selectorOpen && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <User className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">No Student Selected</h2>
              <p className="text-xs text-slate-500">
                Use the search &amp; filter section above to find and view an individual student profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Open Student Search
            </button>
          </div>
        )}

        {/* Loading Profile Spinner */}
        {loadingProfile && (
          <div className="py-20 text-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Loading student profile...</p>
          </div>
        )}

        {/* Profile Content when student data is loaded */}
        {student && !loadingProfile && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center space-x-5">
                  {/* Photograph */}
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 font-bold text-2xl flex items-center justify-center overflow-hidden border-2 border-slate-200 shadow-xs shrink-0">
                    {student.profilePhotoUrl ? (
                      <img
                        src={student.profilePhotoUrl}
                        alt={student.fullName}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span>
                        {student.firstName?.[0]}
                        {student.lastName?.[0]}
                      </span>
                    )}
                  </div>

                  {/* Identity & Placement */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {student.fullName}
                      </h1>
                      <StatusBadge status={placement?.enrollmentStatus || student.masterStatus} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                        Adm No: {student.admissionNumber}
                      </span>
                      <span>&bull;</span>
                      <span className="font-semibold text-slate-800">
                        {placement ? `Class: ${placement.className}` : 'Class: Not Enrolled'}
                      </span>
                      {placement?.sectionName && placement.sectionName !== 'N/A' && (
                        <>
                          <span>&bull;</span>
                          <span className="font-semibold text-slate-800">
                            Section: {placement.sectionName}
                          </span>
                        </>
                      )}
                      {placement?.rollNumber && placement.rollNumber !== '—' && (
                        <>
                          <span>&bull;</span>
                          <span className="font-mono font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                            Roll No: #{placement.rollNumber}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Pill */}
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Academic Session
                    </div>
                    <div className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                      <span>{placement?.academicYearName || selectedYear?.yearName || 'Academic Year'}</span>
                      {placement?.isCurrentAcademicYear && (
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-medium border border-emerald-200">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid Information */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Personal Information Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Personal Information</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Full Name</span>
                    <span className="font-semibold text-slate-800">{student.fullName}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Admission Number</span>
                    <span className="font-mono font-semibold text-slate-800">{student.admissionNumber}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Date of Birth</span>
                    <span className="font-semibold text-slate-800">
                      {student.dateOfBirth
                        ? new Date(student.dateOfBirth).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Gender</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {student.gender ? student.gender.toLowerCase() : '—'}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Blood Group</span>
                    <span className="font-semibold text-slate-800">{student.bloodGroup}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Religion</span>
                    <span className="font-semibold text-slate-800">{student.religion}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Category</span>
                    <span className="font-semibold text-slate-800">{student.category}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Nationality</span>
                    <span className="font-semibold text-slate-800">{student.nationality}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Student Mobile</span>
                    <span className="font-mono font-semibold text-slate-800">{student.studentMobile}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Email Address</span>
                    <span className="font-semibold text-slate-800">{student.email}</span>
                  </div>
                  <div className="py-2 flex justify-between items-start">
                    <span className="text-slate-500">Residential Address</span>
                    <span className="font-semibold text-slate-800 text-right max-w-[200px]">{student.address}</span>
                  </div>
                </div>
              </div>

              {/* Parent / Guardian Information Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Parent / Guardian Details</span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Father Details */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Father</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Primary</span>
                    </div>
                    <div className="text-slate-700 font-medium">{parentInfo?.father?.fullName || '—'}</div>
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span className="font-mono">{parentInfo?.father?.mobileNumber || '—'}</span>
                    </div>
                    {parentInfo?.father?.email && parentInfo.father.email !== '—' && (
                      <div className="flex items-center space-x-2 text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{parentInfo.father.email}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      Occupation: <span className="font-semibold text-slate-700">{parentInfo?.father?.occupation || '—'}</span>
                    </div>
                  </div>

                  {/* Mother Details */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Mother</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Guardian</span>
                    </div>
                    <div className="text-slate-700 font-medium">{parentInfo?.mother?.fullName || '—'}</div>
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span className="font-mono">{parentInfo?.mother?.mobileNumber || '—'}</span>
                    </div>
                    {parentInfo?.mother?.email && parentInfo.mother.email !== '—' && (
                      <div className="flex items-center space-x-2 text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{parentInfo.mother.email}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      Occupation: <span className="font-semibold text-slate-700">{parentInfo?.mother?.occupation || '—'}</span>
                    </div>
                  </div>

                  {/* Other Guardian (if applicable) */}
                  {parentInfo?.guardian && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>Legal Guardian</span>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {parentInfo.guardian.relationship}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium">{parentInfo.guardian.fullName}</div>
                      <div className="flex items-center space-x-2 text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{parentInfo.guardian.mobileNumber}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Academic Placement & Faculty Assignment */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  <span>Academic Placement</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Admission Date</span>
                    <span className="font-semibold text-slate-800">
                      {student.admissionDate
                        ? new Date(student.admissionDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Admission Session</span>
                    <span className="font-semibold text-slate-800">{student.admissionAcademicYear}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Initial Class</span>
                    <span className="font-semibold text-slate-800">{student.admissionClass}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Current Class</span>
                    <span className="font-semibold text-slate-800">{placement?.className || 'N/A'}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Current Section</span>
                    <span className="font-semibold text-slate-800">{placement?.sectionName || 'N/A'}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Roll Number</span>
                    <span className="font-mono font-semibold text-slate-800">{placement?.rollNumber || '—'}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-500">Enrollment Status</span>
                    <StatusBadge status={placement?.enrollmentStatus} />
                  </div>
                </div>

                {/* Faculty Supervision */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-800">Faculty Supervisory Assignment</div>
                  <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-blue-700">Class Teacher</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{placement?.classTeacherName || 'Not Assigned'}</div>
                    </div>
                    {placement?.classTeacherMobile && placement.classTeacherMobile !== '—' && (
                      <span className="font-mono text-[11px] text-slate-600">{placement.classTeacherMobile}</span>
                    )}
                  </div>

                  <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-purple-700">Section Teacher</div>
                      <div className="font-semibold text-slate-900 mt-0.5">{placement?.sectionTeacherName || 'Not Assigned'}</div>
                    </div>
                    {placement?.sectionTeacherMobile && placement.sectionTeacherMobile !== '—' && (
                      <span className="font-mono text-[11px] text-slate-600">{placement.sectionTeacherMobile}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Enrollment History Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Academic Enrollment Journey</h2>
                    <p className="text-[11px] text-slate-500">Session-wise enrollment, promotion, repetition, and status changes</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {enrollmentHistory.length} {enrollmentHistory.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Academic Session</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Enrollment Date</th>
                      <th className="py-3 px-4">Enrollment Status</th>
                      <th className="py-3 px-4">Outcome / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {enrollmentHistory.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-400">
                          No enrollment history available.
                        </td>
                      </tr>
                    ) : (
                      enrollmentHistory.map((history) => (
                        <tr key={history._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-800 flex items-center space-x-1.5">
                            <span>{history.academicYearName}</span>
                            {history.isCurrentYear && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Current
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">{history.className}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {history.sectionName ? `Sec ${history.sectionName}` : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            {history.rollNumber !== '—' ? `#${history.rollNumber}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {history.enrollmentDate
                              ? new Date(history.enrollmentDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={history.enrollmentStatus} />
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {history.promotionOutcome ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {history.promotionOutcome}
                              </span>
                            ) : (
                              <span>{history.remarks || '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Change Logs Section */}
            {changeLogs.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Recorded Transfer / Change Timeline</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {changeLogs.map((log) => (
                    <div key={log._id} className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {log.changeType}
                        </span>
                        <span className="text-slate-800 font-medium">
                          {log.previousClass ? `${log.previousClass} → ` : ''}{log.newClass}
                          {log.newSection ? ` (${log.newSection})` : ''}
                        </span>
                        {log.remarks && log.remarks !== '—' && (
                          <span className="text-slate-500 italic">— {log.remarks}</span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {new Date(log.changedAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherStudentProfilePage;
