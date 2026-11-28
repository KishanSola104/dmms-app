import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  GraduationCap,
  Users,
  ArrowRightLeft,
  Edit2,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Search,
  Hash,
  X,
  RefreshCw,
  Building2,
  Calendar,
  Download
} from 'lucide-react';

const StudentEnrollmentPage = () => {
  const { academicYears, selectedYear } = useAcademicYear();

  // Top Filters
  const [academicYearId, setAcademicYearId] = useState('');
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [activeTab, setActiveTab] = useState('ENROLLMENT'); // 'ENROLLMENT' | 'TRANSFERS'
  const [transferSectionFilter, setTransferSectionFilter] = useState('SELECTED'); // 'SELECTED' | 'ALL'

  // Data
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Enroll Unenrolled Student Modal State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [unenrolledStudents, setUnenrolledStudents] = useState([]);
  const [unenrolledSearch, setUnenrolledSearch] = useState('');
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState(null);
  const [newRollNumber, setNewRollNumber] = useState('');
  const [enrollRemarks, setEnrollRemarks] = useState('');
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  // Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedEnrollmentForTransfer, setSelectedEnrollmentForTransfer] = useState(null);
  const [destClassId, setDestClassId] = useState('');
  const [destSections, setDestSections] = useState([]);
  const [destSectionId, setDestSectionId] = useState('');
  const [destRollNumber, setDestRollNumber] = useState('');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Edit Roll Number Modal State
  const [rollModalOpen, setRollModalOpen] = useState(false);
  const [enrollmentToEditRoll, setEnrollmentToEditRoll] = useState(null);
  const [rollNumberInput, setRollNumberInput] = useState('');
  const [rollSubmitting, setRollSubmitting] = useState(false);
  const [rollError, setRollError] = useState('');

  // Auto-select academic year
  useEffect(() => {
    if (selectedYear?._id && !academicYearId) {
      setAcademicYearId(selectedYear._id);
    } else if (academicYears.length > 0 && !academicYearId) {
      const current = academicYears.find((y) => y.isCurrent) || academicYears[0];
      setAcademicYearId(current._id);
    }
  }, [selectedYear, academicYears]);

  // Load Classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/admin/classes?status=ACTIVE&limit=100');
        if (res.success && res.classes.length > 0) {
          setClasses(res.classes);
          if (!selectedClassId) {
            setSelectedClassId(res.classes[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Load Sections when Class changes
  useEffect(() => {
    if (selectedClassId) {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/admin/sections?classId=${selectedClassId}&status=ACTIVE&limit=100`);
          if (res.success && res.sections) {
            setSections(res.sections);
            if (res.sections.length > 0) {
              setSelectedSectionId(res.sections[0]._id);
            } else {
              setSelectedSectionId('');
            }
          }
        } catch (err) {
          console.error('Failed to load sections:', err);
        }
      };
      fetchSections();
    } else {
      setSections([]);
      setSelectedSectionId('');
    }
  }, [selectedClassId]);

  // Fetch Section Enrollment Summary
  useEffect(() => {
    if (academicYearId && selectedClassId && selectedSectionId) {
      fetchSectionSummary();
    } else {
      setSummaryData(null);
    }
  }, [academicYearId, selectedClassId, selectedSectionId]);

  // Fetch Section Transfer Records when on Transfers tab or filters change
  useEffect(() => {
    if (academicYearId) {
      fetchSectionTransfers();
    } else {
      setTransfers([]);
    }
  }, [academicYearId, selectedClassId, selectedSectionId, transferSectionFilter]);

  const fetchSectionSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/admin/enrollments?academicYearRef=${academicYearId}&classRef=${selectedClassId}&sectionRef=${selectedSectionId}`
      );
      if (res.success) {
        setSummaryData(res);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load enrollment summary.' });
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectionTransfers = async () => {
    if (!academicYearId) return;
    setTransfersLoading(true);
    try {
      const params = new URLSearchParams({ academicYearRef: academicYearId });
      if (selectedClassId) params.append('classRef', selectedClassId);
      if (transferSectionFilter === 'SELECTED' && selectedSectionId) {
        params.append('sectionRef', selectedSectionId);
      } else {
        params.append('sectionRef', 'ALL');
      }
      const res = await api.get(`/admin/enrollments/transfers?${params.toString()}`);
      if (res.success) {
        setTransfers(res.transfers || []);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load section transfer records.' });
      setTransfers([]);
    } finally {
      setTransfersLoading(false);
    }
  };

  // Open Enroll Modal
  const handleOpenEnrollModal = async () => {
    setEnrollError('');
    setSelectedStudentToEnroll(null);
    setNewRollNumber('');
    setEnrollRemarks('');
    setEnrollModalOpen(true);
    await fetchUnenrolledStudents('');
  };

  const fetchUnenrolledStudents = async (search = '') => {
    try {
      const res = await api.get(
        `/admin/enrollments/unenrolled?academicYearRef=${academicYearId}&search=${encodeURIComponent(search)}`
      );
      if (res.success) {
        setUnenrolledStudents(res.students || []);
      }
    } catch (err) {
      setEnrollError(err.message || 'Failed to load eligible students.');
    }
  };

  // Submit Enroll
  const handleSubmitEnroll = async (e) => {
    e.preventDefault();
    if (!selectedStudentToEnroll) {
      setEnrollError('Please select a student to enroll.');
      return;
    }

    setEnrollSubmitting(true);
    setEnrollError('');

    try {
      const res = await api.post('/admin/enrollments', {
        studentId: selectedStudentToEnroll._id,
        academicYearRef: academicYearId,
        classRef: selectedClassId,
        sectionRef: selectedSectionId,
        rollNumber: newRollNumber.trim(),
        remarks: enrollRemarks.trim()
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: `Student '${selectedStudentToEnroll.fullName}' enrolled successfully.`
        });
        setEnrollModalOpen(false);
        fetchSectionSummary();
      }
    } catch (err) {
      setEnrollError(err.message || 'Failed to enroll student.');
    } finally {
      setEnrollSubmitting(false);
    }
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (enrollment) => {
    setSelectedEnrollmentForTransfer(enrollment);
    setDestClassId(selectedClassId);
    setDestRollNumber('');
    setTransferRemarks('');
    setTransferError('');
    setTransferModalOpen(true);
    loadDestSections(selectedClassId);
  };

  const loadDestSections = async (classId) => {
    try {
      const res = await api.get(`/admin/sections?classId=${classId}&status=ACTIVE&limit=100`);
      if (res.success) {
        setDestSections(res.sections || []);
        // Pick first section that is NOT the current section
        const eligible = (res.sections || []).filter((s) => s._id !== selectedSectionId);
        if (eligible.length > 0) {
          setDestSectionId(eligible[0]._id);
        } else {
          setDestSectionId('');
        }
      }
    } catch (err) {
      console.error('Failed to load dest sections:', err);
    }
  };

  const handleDestClassChange = (newClassId) => {
    setDestClassId(newClassId);
    loadDestSections(newClassId);
  };

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!destSectionId) {
      setTransferError('Please select a valid destination section.');
      return;
    }

    setTransferSubmitting(true);
    setTransferError('');

    try {
      const res = await api.post(
        `/admin/enrollments/${selectedEnrollmentForTransfer._id}/transfer`,
        {
          newClassRef: destClassId,
          newSectionRef: destSectionId,
          newRollNumber: destRollNumber.trim(),
          remarks: transferRemarks.trim()
        }
      );

      if (res.success) {
        setAlert({
          type: 'success',
          message: res.message || 'Student transferred successfully.'
        });
        setTransferModalOpen(false);
        fetchSectionSummary();
        fetchSectionTransfers();
      }
    } catch (err) {
      setTransferError(err.message || 'Failed to transfer student.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Edit Roll Number Modal
  const handleOpenRollModal = (enrollment) => {
    setEnrollmentToEditRoll(enrollment);
    setRollNumberInput(enrollment.rollNumber || '');
    setRollError('');
    setRollModalOpen(true);
  };

  const handleSubmitRoll = async (e) => {
    e.preventDefault();
    setRollSubmitting(true);
    setRollError('');

    try {
      const res = await api.put(`/admin/enrollments/${enrollmentToEditRoll._id}`, {
        rollNumber: rollNumberInput.trim()
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: `Roll number updated to #${rollNumberInput.trim() || 'None'}.`
        });
        setRollModalOpen(false);
        fetchSectionSummary();
      }
    } catch (err) {
      setRollError(err.message || 'Failed to update roll number.');
    } finally {
      setRollSubmitting(false);
    }
  };

  const downloadPdfResponse = async (url, fallbackFilename) => {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('dmms_user_token') || ''}`,
        'x-school-token': localStorage.getItem('dmms_school_token') || ''
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || 'Failed to generate roster PDF.');
    }

    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fileName = match ? match[1] : fallbackFilename;

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  };

  const handleExportRosterPDF = async () => {
    if (!selectedClassId || !selectedSectionId) {
      setAlert({ type: 'error', message: 'Please select a class and section first.' });
      return;
    }
    if (!summaryData || !summaryData.enrollments || summaryData.enrollments.length === 0) {
      setAlert({ type: 'error', message: 'No enrolled students found in this section to export.' });
      return;
    }
    try {
      await downloadPdfResponse(
        `/api/admin/classes/${selectedClassId}/sections/${selectedSectionId}/export/pdf?academicYearRef=${academicYearId}`,
        `Enrollment_Roster_${summaryData.class?.className || 'Class'}_${summaryData.section?.sectionName || 'Section'}.pdf`
      );
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'PDF roster export failed.' });
    }
  };

  const handleExportTransferRosterPDF = async () => {
    if (!academicYearId) {
      setAlert({ type: 'error', message: 'Please select an academic year first.' });
      return;
    }
    if (transfers.length === 0) {
      setAlert({ type: 'error', message: 'No section transfer records match the selected filters to export.' });
      return;
    }
    try {
      const params = new URLSearchParams({ academicYearRef: academicYearId });
      if (selectedClassId) params.append('classRef', selectedClassId);
      if (transferSectionFilter === 'SELECTED' && selectedSectionId) {
        params.append('sectionRef', selectedSectionId);
      } else {
        params.append('sectionRef', 'ALL');
      }
      await downloadPdfResponse(
        `/api/admin/enrollments/transfers/export/pdf?${params.toString()}`,
        `Section_Transfer_Roster.pdf`
      );
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Section transfer PDF export failed.' });
    }
  };

  const capacity = summaryData?.capacity;
  const occupancyPercent = capacity
    ? Math.min(100, Math.round((capacity.activeEnrolled / capacity.maxCapacity) * 100))
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enrollment &amp; Section Transfers</h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Manage academic-year placements, section capacities, student assignments, and same-year transfers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {activeTab === 'ENROLLMENT' ? (
              <button
                type="button"
                onClick={handleExportRosterPDF}
                disabled={!summaryData || summaryData.enrollments?.length === 0}
                className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <span>Export Roster PDF</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportTransferRosterPDF}
                disabled={transfers.length === 0}
                className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                <span>Export Transfer Roster PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenEnrollModal}
              disabled={!selectedSectionId || capacity?.isFull}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Enroll Student</span>
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
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
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

        {/* Section Selector Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-slate-700 font-semibold text-sm">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Select Placement Target</span>
            </div>
            <button
              onClick={fetchSectionSummary}
              disabled={loading || !selectedSectionId}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Academic Year */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Academic Year</label>
              <select
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {academicYears.map((ay) => (
                  <option key={ay._id} value={ay._id}>
                    {ay.yearName} {ay.isCurrent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.className}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                disabled={sections.length === 0}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 disabled:opacity-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sections.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.sectionName} ({s.sectionCode}) - Cap: {s.maxCapacity}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs: Enrollment Roster vs Section Transfer Records */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-2 shadow-2xs">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('ENROLLMENT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'ENROLLMENT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Enrollment Roster ({summaryData?.enrollments?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TRANSFERS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'TRANSFERS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Section Transfer Records ({transfers.length})
            </button>
          </div>

          {activeTab === 'TRANSFERS' && (
            <div className="flex items-center space-x-2 pr-2">
              <span className="text-xs font-semibold text-slate-500">Scope:</span>
              <select
                value={transferSectionFilter}
                onChange={(e) => setTransferSectionFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 font-semibold text-slate-800"
              >
                <option value="SELECTED">Selected Section Only</option>
                <option value="ALL">All Sections in Class</option>
              </select>
            </div>
          )}
        </div>

        {activeTab === 'ENROLLMENT' ? (
        <>
        {/* Capacity & Statistics Banner */}
        {capacity && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {summaryData.class?.className} - {summaryData.section?.sectionName}
                  </h3>
                  {capacity.isFull ? (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded text-[11px] border border-red-200">
                      Section Full
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] border border-emerald-200">
                      {capacity.remainingCapacity} Seats Available
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Total Capacity: <strong>{capacity.maxCapacity}</strong> students | Active Enrolled:{' '}
                  <strong>{capacity.activeEnrolled}</strong>
                </p>
              </div>

              {/* Occupancy Progress Bar */}
              <div className="w-full sm:w-64 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Occupancy</span>
                  <span className="text-slate-900">{occupancyPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      occupancyPercent >= 100
                        ? 'bg-red-500'
                        : occupancyPercent >= 80
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enrolled Students Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Enrolled Students
                {summaryData && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({summaryData.enrollments?.length || 0} enrolled)
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Roll No</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Adm No</th>
                  <th className="py-3.5 px-4">Enrollment Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="font-medium text-xs">Loading section students...</span>
                      </div>
                    </td>
                  </tr>
                ) : !summaryData || summaryData.enrollments?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-700 text-sm">No students enrolled</p>
                          <p className="text-xs text-slate-400">
                            There are currently no students placed in this class and section.
                          </p>
                        </div>
                        <button
                          onClick={handleOpenEnrollModal}
                          disabled={capacity?.isFull}
                          className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-xs disabled:opacity-50"
                        >
                          Enroll Student
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  summaryData.enrollments.map((enr) => (
                    <tr key={enr._id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Roll Number */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          {enr.rollNumber ? (
                            <span className="font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs">
                              #{enr.rollNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                          <button
                            onClick={() => handleOpenRollModal(enr)}
                            title="Edit Roll Number"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Student Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center overflow-hidden border border-slate-200 flex-shrink-0">
                            {enr.profilePhotoUrl ? (
                              <img src={enr.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{enr.firstName?.[0]}{enr.lastName?.[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{enr.fullName}</div>
                            <div className="text-[11px] text-slate-500 capitalize">{enr.gender?.toLowerCase()}</div>
                          </div>
                        </div>
                      </td>

                      {/* Admission Number */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2 py-1 rounded text-[11px] border border-slate-200">
                          {enr.admissionNumber}
                        </span>
                      </td>

                      {/* Enrollment Date */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {enr.enrollmentDate
                          ? new Date(enr.enrollmentDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={enr.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenTransferModal(enr)}
                          className="px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 font-semibold flex items-center space-x-1.5 ml-auto"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Transfer Section</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        ) : (
        /* Section Transfer Records Table */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Section Transfer Records
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({transfers.length} transfer{transfers.length === 1 ? '' : 's'})
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={handleExportTransferRosterPDF}
              disabled={transfers.length === 0}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Export Transfer Roster PDF</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Adm No</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">From (Class - Sec)</th>
                  <th className="py-3.5 px-4">To (Class - Sec)</th>
                  <th className="py-3.5 px-4">Transfer Date</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transfersLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <span>Loading section transfer records...</span>
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      No section transfer records found for the selected academic year, class, and section.
                    </td>
                  </tr>
                ) : (
                  transfers.map((tr) => (
                    <tr key={tr._id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {tr.admissionNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{tr.fullName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {tr.fromClassName} - {tr.fromSectionName}
                      </td>
                      <td className="py-3 px-4 font-semibold text-blue-700">
                        {tr.toClassName} - {tr.toSectionName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {tr.changedAt ? new Date(tr.changedAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{tr.remarks || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* ENROLL UNENROLLED STUDENT MODAL */}
        <AdminModal
          isOpen={enrollModalOpen}
          onClose={() => setEnrollModalOpen(false)}
          title={`Enroll Student into ${summaryData?.class?.className} - ${summaryData?.section?.sectionName}`}
          size="lg"
        >
          <form onSubmit={handleSubmitEnroll} className="space-y-4">
            {enrollError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{enrollError}</span>
              </div>
            )}

            {/* Search Unenrolled Students */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Select Active Student (Not yet enrolled in {summaryData?.academicYear?.yearName})
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by student name or admission number..."
                  value={unenrolledSearch}
                  onChange={(e) => {
                    setUnenrolledSearch(e.target.value);
                    fetchUnenrolledStudents(e.target.value);
                  }}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Select List */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {unenrolledStudents.length === 0 ? (
                  <p className="p-4 text-xs text-slate-400 text-center italic">
                    No eligible unenrolled students found.
                  </p>
                ) : (
                  unenrolledStudents.map((s) => (
                    <div
                      key={s._id}
                      onClick={() => setSelectedStudentToEnroll(s)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        selectedStudentToEnroll?._id === s._id
                          ? 'bg-blue-50 border-l-4 border-blue-600'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900">{s.fullName}</div>
                        <div className="text-[11px] text-slate-500">
                          Adm: {s.admissionNumber} • {s.gender}
                        </div>
                      </div>
                      {selectedStudentToEnroll?._id === s._id && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Roll Number & Remarks */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700">Roll Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 1"
                  value={newRollNumber}
                  onChange={(e) => setNewRollNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Admitted mid-term"
                  value={enrollRemarks}
                  onChange={(e) => setEnrollRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEnrollModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={enrollSubmitting || !selectedStudentToEnroll}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {enrollSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enrolling...</span>
                  </>
                ) : (
                  <span>Confirm Enrollment</span>
                )}
              </button>
            </div>
          </form>
        </AdminModal>

        {/* SAME-YEAR SECTION TRANSFER MODAL */}
        <AdminModal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title={`Transfer Section: ${selectedEnrollmentForTransfer?.fullName}`}
          size="lg"
        >
          <form onSubmit={handleSubmitTransfer} className="space-y-4">
            {transferError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-500 block font-medium">Current Placement</span>
              <p className="font-bold text-slate-800">
                {summaryData?.class?.className} - {summaryData?.section?.sectionName}{' '}
                {selectedEnrollmentForTransfer?.rollNumber
                  ? `(Roll #${selectedEnrollmentForTransfer.rollNumber})`
                  : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Destination Class */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Destination Class *</label>
                <select
                  value={destClassId}
                  onChange={(e) => handleDestClassChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {classes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Section */}
              <div>
                <label className="text-xs font-semibold text-slate-700">Destination Section *</label>
                <select
                  value={destSectionId}
                  onChange={(e) => setDestSectionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {destSections.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.sectionName} (Cap: {s.maxCapacity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  New Roll Number in Destination (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Keep blank to retain or reassign"
                  value={destRollNumber}
                  onChange={(e) => setDestRollNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Transfer Reason / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Parental request, section balancing"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transferSubmitting || !destSectionId}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {transferSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transferring...</span>
                  </>
                ) : (
                  <span>Confirm Transfer</span>
                )}
              </button>
            </div>
          </form>
        </AdminModal>

        {/* EDIT ROLL NUMBER MODAL */}
        <AdminModal
          isOpen={rollModalOpen}
          onClose={() => setRollModalOpen(false)}
          title={`Assign / Edit Roll Number: ${enrollmentToEditRoll?.fullName}`}
          size="sm"
        >
          <form onSubmit={handleSubmitRoll} className="space-y-4">
            {rollError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{rollError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700">Roll Number</label>
              <input
                type="text"
                placeholder="e.g. 5"
                value={rollNumberInput}
                onChange={(e) => setRollNumberInput(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Must be unique within this section.</p>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRollModalOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rollSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {rollSubmitting ? 'Saving...' : 'Save Roll Number'}
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default StudentEnrollmentPage;
