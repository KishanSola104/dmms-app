import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  GraduationCap,
  Layers,
  Users,
  Eye,
  AlertCircle,
  RefreshCw,
  Calendar,
  Building,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Download
} from 'lucide-react';

const HeadTeacherClassesPage = () => {
  const { selectedYear } = useAcademicYear();

  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Modal states
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [classModalLoading, setClassModalLoading] = useState(false);

  const [selectedSectionData, setSelectedSectionData] = useState(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionModalLoading, setSectionModalLoading] = useState(false);
  const [rosterExportError, setRosterExportError] = useState('');

  const handleExportSectionRosterPdf = async () => {
    const sec = selectedSectionData?.sectionDetails;
    const ayId = selectedSectionData?.selectedAcademicYear?._id || selectedYear?._id;
    if (!sec?.parentClassId || !sec?._id || !ayId) return;
    setRosterExportError('');
    try {
      const res = await fetch(
        `/api/admin/classes/${sec.parentClassId}/sections/${sec._id}/export/pdf?academicYearRef=${ayId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('dmms_user_token') || ''}`,
            'x-school-token': localStorage.getItem('dmms_school_token') || ''
          }
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to export section roster PDF.');
      }
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = match ? match[1] : `Enrollment_Roster_${sec.sectionCode || 'Section'}.pdf`;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setRosterExportError(err.message || 'Failed to export section roster PDF.');
    }
  };

  const fetchClasses = async (page = 1) => {
    setLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `&academicYearId=${selectedYear._id}` : '';
      const res = await api.get(
        `/head-teacher/classes?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(search)}&status=${statusFilter}${yearQuery}`
      );
      if (res.success) {
        setClasses(res.classes);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('[HeadTeacherClasses] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses(1);
  }, [search, statusFilter, selectedYear]);

  // Open Class Details Modal
  const handleOpenClassView = async (cls) => {
    setClassModalOpen(true);
    setClassModalLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
      const res = await api.get(`/head-teacher/classes/${cls._id}${yearQuery}`);
      if (res.success) {
        setSelectedClassData(res);
      }
    } catch (err) {
      console.error('[HeadTeacherClasses] Class details error:', err);
    } finally {
      setClassModalLoading(false);
    }
  };

  // Open Section Details Modal
  const handleOpenSectionView = async (classId, sectionId) => {
    setSectionModalOpen(true);
    setSectionModalLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
      const res = await api.get(`/head-teacher/classes/${classId}/sections/${sectionId}${yearQuery}`);
      if (res.success) {
        setSelectedSectionData(res);
      }
    } catch (err) {
      console.error('[HeadTeacherClasses] Section details error:', err);
    } finally {
      setSectionModalLoading(false);
    }
  };

  const columns = [
    {
      header: 'Class Code',
      accessor: 'classCode',
      render: (c) => <span className="font-mono text-xs font-bold text-slate-800">{c.classCode}</span>
    },
    {
      header: 'Class Name',
      accessor: 'className',
      render: (c) => (
        <div className="flex items-center space-x-2">
          <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="font-semibold text-slate-900">{c.className}</span>
        </div>
      )
    },
    {
      header: 'Class Teacher',
      accessor: 'classTeacherName',
      render: (c) => (
        <div className="text-xs text-slate-700">
          {c.classTeacherName && c.classTeacherName !== 'Not Assigned' ? (
            <span className="font-medium text-slate-800">{c.classTeacherName}</span>
          ) : (
            <span className="text-slate-400 italic">Not Assigned</span>
          )}
        </div>
      )
    },
    {
      header: 'Sections',
      accessor: 'numberOfSections',
      render: (c) => (
        <div className="text-xs text-slate-700">
          <span className="font-bold text-blue-700">{c.numberOfSections}</span>
          <span className="text-slate-400"> sections</span>
        </div>
      )
    },
    {
      header: 'Total Students',
      accessor: 'totalStudentCount',
      render: (c) => (
        <div className="flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-900">{c.totalStudentCount}</span>
        </div>
      )
    },
    {
      header: 'Total Capacity',
      accessor: 'totalCapacity',
      render: (c) => (
        <span className="text-xs text-slate-600 font-semibold">{c.totalCapacity} seats</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (c) => <StatusBadge status={c.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleOpenClassView(c)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 shadow-2xs"
            title="View Class Details & Sections"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            <span>View</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Module 1 &bull; Academic Overview
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Classes &amp; Sections Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Supervise classes, section distributions, classroom capacities, and enrolled student rosters.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-600 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Active Session: <strong>{selectedYear?.yearCode || 'N/A'}</strong></span>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full md:w-80">
            <AdminSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by class name or code..."
            />
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Classes</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Classes Data Table */}
        <AdminDataTable
          columns={columns}
          data={classes}
          loading={loading}
          emptyMessage="No classes found matching the criteria."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchClasses(p)}
        />

        {/* 5.2 CLASS DETAILS MODAL (READ-ONLY) */}
        <AdminModal
          isOpen={classModalOpen}
          onClose={() => setClassModalOpen(false)}
          title={selectedClassData?.classDetails?.className || 'Class Details'}
          subtitle={`Class Code: ${selectedClassData?.classDetails?.classCode || ''} • Academic Session: ${selectedClassData?.selectedAcademicYear?.yearCode || selectedYear?.yearCode || ''}`}
          maxWidth="max-w-4xl"
        >
          {classModalLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
              Loading class parameters...
            </div>
          ) : selectedClassData?.classDetails ? (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Assigned Class Teacher</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                    {selectedClassData.classDetails.classTeacherName}
                  </p>
                  {selectedClassData.classDetails.classTeacherEmail && (
                    <p className="text-[10px] text-slate-400 truncate">{selectedClassData.classDetails.classTeacherEmail}</p>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Total Sections</p>
                  <p className="text-sm font-extrabold text-blue-700 mt-0.5">
                    {selectedClassData.classDetails.numberOfSections}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Enrolled Students</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {selectedClassData.classDetails.totalStudentCount}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Total Capacity</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {selectedClassData.classDetails.totalCapacity} seats
                  </p>
                </div>
              </div>

              {/* 5.3 Section Listing Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Configured Sections ({selectedClassData.sections?.length || 0})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Click View to inspect student enrollment list
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Section Code</th>
                        <th className="py-2.5 px-3">Section Name</th>
                        <th className="py-2.5 px-3">Section Teacher</th>
                        <th className="py-2.5 px-3 text-center">Enrolled</th>
                        <th className="py-2.5 px-3 text-center">Max Capacity</th>
                        <th className="py-2.5 px-3 text-center">Available Capacity</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedClassData.sections?.length > 0 ? (
                        selectedClassData.sections.map((s) => (
                          <tr key={s._id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                              {s.sectionCode}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {s.sectionName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {s.sectionTeacherName}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                              {s.studentCount}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600">
                              {s.maxCapacity}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                                  s.availableCapacity > 5
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : s.availableCapacity > 0
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {s.availableCapacity} seats
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenSectionView(selectedClassData.classDetails._id, s._id)}
                                className="inline-flex items-center px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="py-4 text-center text-slate-400">
                            No sections configured for this class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </AdminModal>

        {/* 5.4 SECTION DETAILS & ROSTER MODAL (READ-ONLY) */}
        <AdminModal
          isOpen={sectionModalOpen}
          onClose={() => setSectionModalOpen(false)}
          title={`Section ${selectedSectionData?.sectionDetails?.sectionName || ''} (${selectedSectionData?.sectionDetails?.sectionCode || ''})`}
          subtitle={`Parent Class: ${selectedSectionData?.sectionDetails?.parentClassName || ''} • Session: ${selectedSectionData?.selectedAcademicYear?.yearCode || selectedYear?.yearCode || ''}`}
          maxWidth="max-w-4xl"
        >
          {sectionModalLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              Loading section details &amp; student roster...
            </div>
          ) : selectedSectionData?.sectionDetails ? (
            <div className="space-y-6">
              {/* Section Details Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Section Teacher</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                    {selectedSectionData.sectionDetails.sectionTeacherName}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Current Enrollment</p>
                  <p className="text-sm font-extrabold text-blue-700 mt-0.5">
                    {selectedSectionData.sectionDetails.studentCount} students
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Max Capacity</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                    {selectedSectionData.sectionDetails.maxCapacity} seats
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Available Capacity</p>
                  <p className="text-sm font-extrabold text-emerald-700 mt-0.5">
                    {selectedSectionData.sectionDetails.availableCapacity} seats
                  </p>
                </div>
              </div>

              {/* Enrolled Students Table */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Enrolled Student Roster ({selectedSectionData.students?.length || 0})
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Session {selectedSectionData.selectedAcademicYear?.yearCode} Active Roster
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportSectionRosterPdf}
                    disabled={!selectedSectionData.students || selectedSectionData.students.length === 0}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    <span>Export Roster PDF</span>
                  </button>
                </div>
                {rosterExportError && (
                  <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {rosterExportError}
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Roll No</th>
                        <th className="py-2.5 px-3">Admission No</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Gender</th>
                        <th className="py-2.5 px-3 text-center">Enrollment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSectionData.students?.length > 0 ? (
                        selectedSectionData.students.map((st) => (
                          <tr key={st.enrollmentId} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 font-mono font-bold text-slate-700">
                              {st.rollNumber}
                            </td>
                            <td className="py-2 px-3 font-mono text-blue-700">
                              {st.admissionNumber}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {st.fullName}
                            </td>
                            <td className="py-2 px-3 text-slate-600 capitalize">
                              {st.gender}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                                {st.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-6 text-center text-slate-400">
                            No active student enrollments found in this section for session {selectedSectionData.selectedAcademicYear?.yearCode}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherClassesPage;
