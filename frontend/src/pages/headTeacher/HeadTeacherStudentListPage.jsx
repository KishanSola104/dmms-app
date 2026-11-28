import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Users,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Loader2,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  RefreshCw,
  X,
  Layers,
  ArrowRight,
  UserCheck,
  Shield,
  Info,
  Download
} from 'lucide-react';

const HeadTeacherStudentListPage = () => {
  const navigate = useNavigate();
  const { selectedYear, academicYears, loading: academicYearLoading } = useAcademicYear();

  // Filter States
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState('ALL');
  const [selectedGender, setSelectedGender] = useState('ALL');
  const [selectedEnrollmentStatus, setSelectedEnrollmentStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Data & Pagination States
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Modal State for Read-Only Quick View
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 1. Fetch available classes for the school
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/head-teacher/classes?limit=100');
        if (res.success && res.classes) {
          setClasses(res.classes);
        }
      } catch (err) {
        console.error('[HeadTeacherStudentList] Failed to fetch classes:', err);
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
          // If previous section selection is not in the new sections list, reset it
          if (selectedSectionId !== 'ALL' && !res.sections.some(s => s._id === selectedSectionId)) {
            setSelectedSectionId('ALL');
          }
        } else {
          setSections([]);
          setSelectedSectionId('ALL');
        }
      } catch (err) {
        console.error('[HeadTeacherStudentList] Failed to fetch sections for class:', err);
        setSections([]);
        setSelectedSectionId('ALL');
      }
    };

    fetchSections();
  }, [selectedClassId, selectedYear]);

  // 3. Fetch Students from Backend API
  const fetchStudents = async (page = 1) => {
    setLoading(true);
    setError('');
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
        setStudents(res.students || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setError(res.message || 'Failed to retrieve enrolled students.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while loading student records.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters, debounced search, or academic year changes
  useEffect(() => {
    fetchStudents(1);
  }, [
    selectedYear?._id,
    selectedClassId,
    selectedSectionId,
    selectedGender,
    selectedEnrollmentStatus,
    debouncedSearch
  ]);

  // Page change handler
  const handlePageChange = (newPage) => {
    fetchStudents(newPage);
  };

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

  // Open Quick View Modal
  const handleOpenViewModal = (student) => {
    setSelectedStudent(student);
    setViewModalOpen(true);
  };

  // Export Students to Excel (respecting active filters)
  const handleExportExcel = async () => {
    if (students.length === 0 || pagination.totalRecords === 0) {
      setError('No student records match the selected filters to export.');
      return;
    }
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedYear?._id) params.append('academicYearRef', selectedYear._id);
      if (selectedClassId && selectedClassId !== 'ALL') params.append('classRef', selectedClassId);
      if (selectedSectionId && selectedSectionId !== 'ALL') params.append('sectionRef', selectedSectionId);
      if (selectedGender && selectedGender !== 'ALL') params.append('gender', selectedGender);
      if (selectedEnrollmentStatus && selectedEnrollmentStatus !== 'ALL') {
        params.append('enrollmentStatus', selectedEnrollmentStatus);
      }
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await fetch(`/api/admin/students/export/excel?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('dmms_user_token') || ''}`,
          'x-school-token': localStorage.getItem('dmms_school_token') || ''
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to export students to Excel.');
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = match ? match[1] : `DMMS_Students_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed.');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 uppercase tracking-wider">
                  Student Overview
                </span>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Directory
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                <span>Student List</span>
              </h1>
              <p className="text-xs text-slate-500">
                Monitor and inspect student enrollment details, academic placement, and guardian contacts for the selected academic year.
              </p>
            </div>

            {/* Academic Year Notice & Export Excel Action */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center justify-center px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 mr-1.5 text-slate-600" />
                <span>Export Excel</span>
              </button>

              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 shrink-0">
                <Calendar className="w-5 h-5 text-blue-600 mr-3 shrink-0" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Active Academic Year
                  </div>
                  <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>{selectedYear?.yearName || selectedYear?.yearCode || 'Loading...'}</span>
                    {selectedYear?.isCurrent && (
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[10px] font-medium border border-emerald-200">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Switch year using header selector
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="p-4 rounded-xl flex items-center justify-between border bg-red-50 border-red-200 text-red-700 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => fetchStudents(pagination.currentPage)}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Filters Card (Section 4.4) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-slate-700 font-semibold text-sm">
              <Filter className="w-4 h-4 text-blue-600" />
              <span>Filter &amp; Search Enrolled Students</span>
              {isFilterActive && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  Filters Active
                </span>
              )}
            </div>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input (Section 4.3) */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold text-slate-600">Search</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Student name or Adm No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
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
        </div>

        {/* Student Table Card (Section 4.1, 4.5, 4.6) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="text-sm font-bold text-slate-800">
                Enrolled Students
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({pagination.totalRecords} {pagination.totalRecords === 1 ? 'student' : 'students'} found for {selectedYear?.yearName || 'Academic Year'})
                </span>
              </h2>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">Photo</th>
                  <th className="py-3.5 px-4">Adm No</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Gender</th>
                  <th className="py-3.5 px-4">Date of Birth</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Section</th>
                  <th className="py-3.5 px-4">Father's Name</th>
                  <th className="py-3.5 px-4">Parent / Contact</th>
                  <th className="py-3.5 px-4">Enrollment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                        <span className="font-semibold text-xs text-slate-700">Loading student records...</span>
                        <span className="text-[11px] text-slate-400">Fetching enrollment records for {selectedYear?.yearName || 'selected year'}</span>
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-700 text-sm">No students found</p>
                          <p className="text-xs text-slate-400">
                            {isFilterActive
                              ? 'No students match your active search filters for this academic year.'
                              : `No students are enrolled in ${selectedYear?.yearName || 'the selected academic year'}.`}
                          </p>
                        </div>
                        {isFilterActive && (
                          <button
                            type="button"
                            onClick={handleClearFilters}
                            className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                          >
                            Reset Active Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr
                      key={student.enrollmentId || student._id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Student Photo */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="w-9 h-9 mx-auto rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {student.profilePhotoUrl ? (
                            <img
                              src={student.profilePhotoUrl}
                              alt={student.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-xs">
                              {student.firstName?.[0]}
                              {student.lastName?.[0]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Admission Number */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {student.admissionNumber}
                        </span>
                      </td>

                      {/* 3. Student Name */}
                      <td className="py-3.5 px-4">
                        <div
                          className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer"
                          onClick={() => handleOpenViewModal(student)}
                          title="Click to view student details"
                        >
                          {student.fullName}
                        </div>
                        {student.rollNumber && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Roll No: #{student.rollNumber}
                          </div>
                        )}
                      </td>

                      {/* 4. Gender */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block capitalize text-[11px] font-medium px-2 py-0.5 rounded border ${
                          student.gender === 'MALE'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : student.gender === 'FEMALE'
                            ? 'bg-pink-50 text-pink-700 border-pink-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {student.gender ? student.gender.toLowerCase() : 'N/A'}
                        </span>
                      </td>

                      {/* 5. Date of Birth */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {student.dateOfBirth ? (
                          new Date(student.dateOfBirth).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* 6. Class */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {student.className || 'Not Assigned'}
                      </td>

                      {/* 7. Section */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {student.sectionName ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            Sec {student.sectionName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* 8. Father's Name */}
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {student.fatherName || '—'}
                      </td>

                      {/* 9. Parent / Contact Number */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {student.parentContactNumber && student.parentContactNumber !== '—' ? (
                          <div className="flex items-center space-x-1.5 text-slate-700">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-mono">{student.parentContactNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* 10. Enrollment Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={student.enrollmentStatus} />
                      </td>

                      {/* 11. Actions (Strictly Read-Only: ONLY "View") */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenViewModal(student)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 rounded-lg transition-colors shadow-2xs"
                          title="View student overview (read-only)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination (Section 4.5) */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/30">
            <AdminPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalRecords={pagination.totalRecords}
              limit={pagination.limit}
              onPageChange={handlePageChange}
            />
          </div>
        </div>

        {/* Read-Only Student Details Modal */}
        <AdminModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Student Information (Read-Only)"
          subtitle={`Admission No: ${selectedStudent?.admissionNumber || 'N/A'}`}
          maxWidth="max-w-2xl"
        >
          {selectedStudent && (
            <div className="space-y-6">
              {/* Profile Card Header */}
              <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                  {selectedStudent.profilePhotoUrl ? (
                    <img
                      src={selectedStudent.profilePhotoUrl}
                      alt={selectedStudent.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>
                      {selectedStudent.firstName?.[0]}
                      {selectedStudent.lastName?.[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {selectedStudent.fullName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                      Adm: {selectedStudent.admissionNumber}
                    </span>
                    <StatusBadge status={selectedStudent.enrollmentStatus} />
                    {selectedStudent.rollNumber && (
                      <span className="text-xs font-mono font-medium text-slate-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        Roll: #{selectedStudent.rollNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Academic Placement */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center space-x-2 font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <GraduationCap className="w-4 h-4 text-blue-600" />
                    <span>Academic Placement</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Academic Year:</span>
                    <span className="font-semibold text-slate-800">{selectedStudent.academicYearName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Class:</span>
                    <span className="font-semibold text-slate-800">{selectedStudent.className}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Section:</span>
                    <span className="font-semibold text-slate-800">{selectedStudent.sectionName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Enrollment Date:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedStudent.enrollmentDate
                        ? new Date(selectedStudent.enrollmentDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center space-x-2 font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <UserCheck className="w-4 h-4 text-purple-600" />
                    <span>Personal Details</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Gender:</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedStudent.gender ? selectedStudent.gender.toLowerCase() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Date of Birth:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedStudent.dateOfBirth
                        ? new Date(selectedStudent.dateOfBirth).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Master Status:</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {selectedStudent.studentStatus ? selectedStudent.studentStatus.toLowerCase() : 'Active'}
                    </span>
                  </div>
                </div>

                {/* Guardian & Contact Information */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2.5 md:col-span-2">
                  <div className="flex items-center space-x-2 font-bold text-slate-800 border-b border-slate-100 pb-2">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Guardian &amp; Contact Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-slate-500">Father's Name:</span>
                      <div className="font-semibold text-slate-800">{selectedStudent.fatherName}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500">Primary Contact / Guardian:</span>
                      <div className="font-semibold text-slate-800">
                        {selectedStudent.guardianName}{' '}
                        {selectedStudent.guardianRelationship && selectedStudent.guardianRelationship !== '—' && (
                          <span className="text-[11px] text-slate-500 font-normal">
                            ({selectedStudent.guardianRelationship})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500">Contact Number:</span>
                      <div className="font-semibold text-slate-800 font-mono">
                        {selectedStudent.parentContactNumber}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice & Full Profile Action */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Complete Student Profile</p>
                  <p className="text-[11px] text-blue-800">
                    View complete personal details, guardian contacts, class/section faculty assignments, and historical enrollment records.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewModalOpen(false);
                    navigate(`/head-teacher/students/${selectedStudent._id}`);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <span>Open Full Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherStudentListPage;
