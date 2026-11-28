import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  AlertCircle,
  Loader2,
  GraduationCap,
  Calendar,
  Phone,
  Mail,
  RefreshCw,
  Camera,
  X,
  Plus,
  Download,
  Upload
} from 'lucide-react';

const StudentListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { academicYears, selectedYear } = useAcademicYear();

  // Filter States
  const [academicYearId, setAcademicYearId] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Listing Data & Pagination
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  const [alert, setAlert] = useState({ type: '', message: '' });

  // Quick Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    profilePhotoUrl: '',
    phone: '',
    email: '',
    guardianDetails: []
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  // Status Change Confirmation Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [studentToToggle, setStudentToToggle] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Set default academic year from context once available
  useEffect(() => {
    if (selectedYear?._id && !academicYearId) {
      setAcademicYearId(selectedYear._id);
    } else if (academicYears.length > 0 && !academicYearId) {
      const current = academicYears.find((y) => y.isCurrent) || academicYears[0];
      setAcademicYearId(current._id);
    }
  }, [selectedYear, academicYears]);

  // Load Classes for the school
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/admin/classes?status=ACTIVE&limit=100');
        if (res.success) {
          setClasses(res.classes || []);
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Load Sections when Class changes
  useEffect(() => {
    if (selectedClassId && selectedClassId !== 'ALL') {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/admin/sections?classId=${selectedClassId}&status=ACTIVE&limit=100`);
          if (res.success) {
            setSections(res.sections || []);
          }
        } catch (err) {
          console.error('Failed to load sections:', err);
        }
      };
      fetchSections();
    } else {
      setSections([]);
      setSelectedSectionId('ALL');
    }
  }, [selectedClassId]);

  // Fetch Students whenever filters or pagination change
  useEffect(() => {
    fetchStudents(pagination.currentPage);
  }, [academicYearId, selectedClassId, selectedSectionId, statusFilter, genderFilter, searchQuery]);

  const fetchStudents = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (academicYearId && academicYearId !== 'ALL') {
        params.append('academicYearRef', academicYearId);
      }
      if (selectedClassId && selectedClassId !== 'ALL') {
        params.append('classRef', selectedClassId);
      }
      if (selectedSectionId && selectedSectionId !== 'ALL') {
        params.append('sectionRef', selectedSectionId);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (genderFilter && genderFilter !== 'ALL') {
        params.append('gender', genderFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await api.get(`/admin/students?${params.toString()}`);
      if (res.success) {
        setStudents(res.students || []);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load students.' });
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = async (student) => {
    try {
      setEditError('');
      // Fetch full details of student to ensure complete guardian details
      const res = await api.get(`/admin/students/${student._id}`);
      if (res.success) {
        const s = res.student;
        setEditingStudent(s);
        setEditForm({
          firstName: s.firstName || '',
          middleName: s.middleName || '',
          lastName: s.lastName || '',
          dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().split('T')[0] : '',
          gender: s.gender || 'MALE',
          profilePhotoUrl: s.profilePhotoUrl || '',
          phone: s.contact?.phone || '',
          email: s.contact?.email || '',
          guardianDetails: (s.guardianDetails && s.guardianDetails.length > 0)
            ? s.guardianDetails.map(g => ({ ...g }))
            : [{ fullName: '', relationship: 'FATHER', mobileNumber: '', email: '', isPrimaryContact: true }]
        });
        setEditModalOpen(true);
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to fetch student details for editing.' });
    }
  };

  // Handle Photo Upload in Edit Modal
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError('Please upload a valid image file (JPEG, PNG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setEditError('Image file size must be less than 2MB.');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setPhotoUploading(true);
    setEditError('');

    try {
      const res = await api.post('/admin/students/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setEditForm((prev) => ({ ...prev, profilePhotoUrl: res.photoUrl }));
      }
    } catch (err) {
      setEditError(err.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  // Guardian Helpers in Edit Modal
  const handleAddGuardian = () => {
    setEditForm((prev) => ({
      ...prev,
      guardianDetails: [
        ...prev.guardianDetails,
        {
          fullName: '',
          relationship: 'MOTHER',
          mobileNumber: '',
          email: '',
          isPrimaryContact: prev.guardianDetails.length === 0
        }
      ]
    }));
  };

  const handleRemoveGuardian = (index) => {
    if (editForm.guardianDetails.length === 1) {
      setEditError('At least one guardian detail must be retained.');
      return;
    }
    const updated = editForm.guardianDetails.filter((_, i) => i !== index);
    if (!updated.some((g) => g.isPrimaryContact) && updated.length > 0) {
      updated[0].isPrimaryContact = true;
    }
    setEditForm((prev) => ({ ...prev, guardianDetails: updated }));
  };

  const handleGuardianChange = (index, field, value) => {
    const updated = [...editForm.guardianDetails];
    if (field === 'isPrimaryContact') {
      updated.forEach((g, i) => {
        g.isPrimaryContact = i === index;
      });
    } else {
      updated[index][field] = value;
    }
    setEditForm((prev) => ({ ...prev, guardianDetails: updated }));
  };

  // Submit Edit Form
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError('');

    try {
      const payload = {
        firstName: editForm.firstName,
        middleName: editForm.middleName,
        lastName: editForm.lastName,
        dateOfBirth: editForm.dateOfBirth,
        gender: editForm.gender,
        profilePhotoUrl: editForm.profilePhotoUrl,
        contact: {
          phone: editForm.phone,
          email: editForm.email
        },
        guardianDetails: editForm.guardianDetails
      };

      const res = await api.put(`/admin/students/${editingStudent._id}`, payload);
      if (res.success) {
        setAlert({
          type: 'success',
          message: `Student '${res.student.firstName} ${res.student.lastName}' updated successfully.`
        });
        setEditModalOpen(false);
        fetchStudents(pagination.currentPage);
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update student details.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Toggle Status Modal
  const handleOpenStatusModal = (student) => {
    setStudentToToggle(student);
    setStatusModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!studentToToggle) return;
    setStatusSubmitting(true);

    try {
      const targetStatus = studentToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await api.patch(`/admin/students/${studentToToggle._id}/status`, {
        status: targetStatus
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: `Student '${studentToToggle.fullName}' marked as ${targetStatus}.`
        });
        setStatusModalOpen(false);
        setStudentToToggle(null);
        fetchStudents(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to update status.' });
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (students.length === 0 || pagination.totalRecords === 0) {
      setAlert({ type: 'error', message: 'No student records match the selected filters to export.' });
      return;
    }
    try {
      const params = new URLSearchParams();
      if (academicYearId && academicYearId !== 'ALL') params.append('academicYearRef', academicYearId);
      if (selectedClassId && selectedClassId !== 'ALL') params.append('classRef', selectedClassId);
      if (selectedSectionId && selectedSectionId !== 'ALL') params.append('sectionRef', selectedSectionId);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (genderFilter && genderFilter !== 'ALL') params.append('gender', genderFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

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
      setAlert({ type: 'error', message: err.message || 'Export failed.' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header with Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Directory</h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Manage student admissions, academic placements, and permanent records across academic years.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-all"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/students/import')}
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-all"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Import Excel</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/students/admission')}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              <span>Admit Student</span>
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert.message && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border shadow-sm animate-in fade-in duration-200 ${
              alert.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
            <button
              onClick={() => setAlert({ type: '', message: '' })}
              className="p-1 hover:bg-black/5 rounded-lg text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filters Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-slate-700 font-semibold text-sm">
              <Filter className="w-4 h-4 text-blue-600" />
              <span>Filters &amp; Search</span>
            </div>
            <button
              onClick={() => {
                setSelectedClassId('ALL');
                setSelectedSectionId('ALL');
                setStatusFilter('ALL');
                setGenderFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Academic Year Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Academic Year</label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Academic Years</option>
                {academicYears.map((ay) => (
                  <option key={ay._id} value={ay._id}>
                    {ay.yearName} {ay.isCurrent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
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
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.className}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                disabled={selectedClassId === 'ALL'}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 disabled:opacity-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Sections</option>
                {sections.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.sectionName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TRANSFERRED">Transferred</option>
                <option value="ALUMNI">Alumni</option>
              </select>
            </div>

            {/* Gender Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Genders</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Search</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name / Adm No / Roll No"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Students Table Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Enrolled Students
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({pagination.totalRecords} {pagination.totalRecords === 1 ? 'student' : 'students'} found)
                </span>
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Adm No</th>
                  <th className="py-3.5 px-4">Class &amp; Section</th>
                  <th className="py-3.5 px-4">Roll No</th>
                  <th className="py-3.5 px-4">Primary Contact</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="font-medium text-xs">Loading student records...</span>
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-700 text-sm">No students found</p>
                          <p className="text-xs text-slate-400">
                            Try adjusting your filters or admit a new student into this academic year.
                          </p>
                        </div>
                        <button
                          onClick={() => navigate('/admin/students/admission')}
                          className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs"
                        >
                          Admit Student
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student._id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Student Photo & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center overflow-hidden border border-slate-200 flex-shrink-0">
                            {student.profilePhotoUrl ? (
                              <img
                                src={student.profilePhotoUrl}
                                alt={student.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>
                                {student.firstName?.[0]}
                                {student.lastName?.[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer" onClick={() => navigate(`/admin/students/${student._id}`)}>
                              {student.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                              <span className="capitalize">{student.gender?.toLowerCase()}</span>
                              {student.dateOfBirth && (
                                <>
                                  <span>•</span>
                                  <span>
                                    {new Date(student.dateOfBirth).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2 py-1 rounded text-[11px] border border-slate-200">
                          {student.admissionNumber}
                        </span>
                      </td>

                      {/* Class & Section */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {student.className || 'Not Enrolled'}
                        </div>
                        {student.sectionName && (
                          <div className="text-[11px] text-slate-500">
                            Section: {student.sectionName}
                          </div>
                        )}
                      </td>

                      {/* Roll Number */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {student.rollNumber ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-bold">
                            #{student.rollNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Primary Contact */}
                      <td className="py-3.5 px-4">
                        {student.primaryGuardian ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-800">
                              {student.primaryGuardian.fullName}{' '}
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({student.primaryGuardian.relationship})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <a
                                href={`tel:${student.primaryGuardian.mobileNumber}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {student.primaryGuardian.mobileNumber}
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={student.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* View Profile */}
                          <button
                            onClick={() => navigate(`/admin/students/${student._id}`)}
                            title="View Full Profile"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quick Edit */}
                          <button
                            onClick={() => handleOpenEdit(student)}
                            title="Edit Student Master"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Deactivate / Reactivate */}
                          <button
                            onClick={() => handleOpenStatusModal(student)}
                            title={student.status === 'ACTIVE' ? 'Deactivate Student' : 'Reactivate Student'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              student.status === 'ACTIVE'
                                ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {student.status === 'ACTIVE' ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {students.length > 0 && (
            <AdminPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalRecords={pagination.totalRecords}
              limit={pagination.limit}
              onPageChange={(page) => fetchStudents(page)}
            />
          )}
        </div>

        {/* EDIT STUDENT MODAL */}
        <AdminModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Student Details: ${editingStudent?.admissionNumber}`}
          size="2xl"
        >
          <form onSubmit={handleSubmitEdit} className="space-y-6">
            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Profile Photo & Basic Names */}
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="relative group w-20 h-20 rounded-full border-2 border-slate-300 overflow-hidden bg-white shadow-xs flex-shrink-0 flex items-center justify-center">
                {editForm.profilePhotoUrl ? (
                  <img
                    src={editForm.profilePhotoUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-slate-400">
                    {editForm.firstName?.[0] || 'S'}
                  </span>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <label className="text-xs font-semibold text-slate-700">Change Profile Photo</label>
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Upload New Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {editForm.profilePhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, profilePhotoUrl: '' }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">Max size 2MB. JPG, PNG formats supported.</p>
              </div>
            </div>

            {/* Personal Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Personal Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Middle Name</label>
                  <input
                    type="text"
                    value={editForm.middleName}
                    onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Student Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Student Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Guardian Information */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Guardian Information
                </h4>
                <button
                  type="button"
                  onClick={handleAddGuardian}
                  className="px-2.5 py-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Guardian</span>
                </button>
              </div>

              {editForm.guardianDetails.map((guardian, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Guardian #{index + 1}</span>
                    {editForm.guardianDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGuardian(index)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-medium text-slate-600">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={guardian.fullName}
                        onChange={(e) => handleGuardianChange(index, 'fullName', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">Relationship *</label>
                      <select
                        value={guardian.relationship}
                        onChange={(e) => handleGuardianChange(index, 'relationship', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="FATHER">Father</option>
                        <option value="MOTHER">Mother</option>
                        <option value="GUARDIAN">Guardian</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600">Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        value={guardian.mobileNumber}
                        onChange={(e) => handleGuardianChange(index, 'mobileNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex-1 mr-4">
                      <label className="text-[11px] font-medium text-slate-600">Email (Optional)</label>
                      <input
                        type="email"
                        value={guardian.email || ''}
                        onChange={(e) => handleGuardianChange(index, 'email', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg mt-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <label className="flex items-center space-x-1.5 cursor-pointer mt-4">
                      <input
                        type="radio"
                        name="primaryGuardian"
                        checked={guardian.isPrimaryContact}
                        onChange={() => handleGuardianChange(index, 'isPrimaryContact', true)}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-xs font-semibold text-slate-700">Primary Contact</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {editSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </AdminModal>

        {/* TOGGLE STATUS CONFIRMATION MODAL */}
        <AdminModal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title={studentToToggle?.status === 'ACTIVE' ? 'Deactivate Student' : 'Reactivate Student'}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  studentToToggle?.status === 'ACTIVE'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {studentToToggle?.status === 'ACTIVE' ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  Are you sure you want to {studentToToggle?.status === 'ACTIVE' ? 'deactivate' : 'reactivate'}{' '}
                  <span className="font-bold">{studentToToggle?.fullName}</span>?
                </p>
                <p className="text-xs text-slate-500">
                  {studentToToggle?.status === 'ACTIVE'
                    ? 'Deactivating this student will change their status to INACTIVE. All historical enrollments, attendance, and exam records are strictly preserved.'
                    : 'Reactivating this student will restore their status to ACTIVE and make them eligible for academic operations.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusSubmitting}
                onClick={handleConfirmToggleStatus}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-xs disabled:opacity-50 flex items-center space-x-2 ${
                  studentToToggle?.status === 'ACTIVE'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    Confirm {studentToToggle?.status === 'ACTIVE' ? 'Deactivation' : 'Reactivation'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default StudentListPage;
