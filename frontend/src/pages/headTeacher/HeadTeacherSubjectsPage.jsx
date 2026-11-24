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
  BookOpen,
  FileText,
  Calendar,
  Layers,
  Eye,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';

const HeadTeacherSubjectsPage = () => {
  const { selectedYear } = useAcademicYear();

  // Active view tab: 'directory' (all subjects) | 'allocations' (class-wise allocations)
  const [activeTab, setActiveTab] = useState('directory');

  // Directory Tab State
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Subject Details Modal State
  const [selectedSubjectData, setSelectedSubjectData] = useState(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Allocations Tab State
  const [classesList, setClassesList] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [allocations, setAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const fetchSubjects = async (page = 1) => {
    setLoadingSubjects(true);
    try {
      const res = await api.get(
        `/head-teacher/subjects?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(search)}&type=${typeFilter}&status=${statusFilter}`
      );
      if (res.success) {
        setSubjects(res.subjects);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('[HeadTeacherSubjects] Fetch error:', err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchClassesForFilter = async () => {
    try {
      const res = await api.get('/head-teacher/classes?limit=100');
      if (res.success) {
        setClassesList(res.classes || []);
      }
    } catch (err) {
      console.error('[HeadTeacherSubjects] Classes error:', err);
    }
  };

  const fetchClassAllocations = async () => {
    setLoadingAllocations(true);
    try {
      const yearQuery = selectedYear?._id ? `&academicYearId=${selectedYear._id}` : '';
      const res = await api.get(
        `/head-teacher/subject-allocations?classId=${selectedClassId}${yearQuery}`
      );
      if (res.success) {
        setAllocations(res.allocations || []);
      }
    } catch (err) {
      console.error('[HeadTeacherSubjects] Allocations error:', err);
    } finally {
      setLoadingAllocations(false);
    }
  };

  useEffect(() => {
    fetchSubjects(1);
    fetchClassesForFilter();
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'allocations') {
      fetchClassAllocations();
    }
  }, [activeTab, selectedClassId, selectedYear]);

  // Open Subject Details
  const handleOpenSubjectView = async (sub) => {
    setSubjectModalOpen(true);
    setModalLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
      const res = await api.get(`/head-teacher/subjects/${sub._id}${yearQuery}`);
      if (res.success) {
        setSelectedSubjectData(res);
      }
    } catch (err) {
      console.error('[HeadTeacherSubjects] Details error:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const columns = [
    {
      header: 'Subject Code',
      accessor: 'subjectCode',
      render: (s) => <span className="font-mono text-xs font-bold text-slate-800">{s.subjectCode}</span>
    },
    {
      header: 'Subject Name',
      accessor: 'subjectName',
      render: (s) => (
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="font-semibold text-slate-900">{s.subjectName}</span>
        </div>
      )
    },
    {
      header: 'Subject Type',
      accessor: 'subjectType',
      render: (s) => <StatusBadge status={s.subjectType} />
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (s) => <StatusBadge status={s.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleOpenSubjectView(s)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 shadow-2xs"
            title="View Subject Details & Allocations"
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
              Subject Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Understand subjects configured by Admin, curriculum distribution, and class-wise allocation structures.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-600 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Active Session: <strong>{selectedYear?.yearCode || 'N/A'}</strong></span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex space-x-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'directory'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Subject Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('allocations')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'allocations'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Class-Wise Subject Allocation (Section 6.3)
          </button>
        </div>

        {/* TAB 1: SUBJECT DIRECTORY */}
        {activeTab === 'directory' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="w-full md:w-80">
                <AdminSearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by subject name or code..."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 font-medium">Type:</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">All Types</option>
                    <option value="ACADEMIC">Academic</option>
                    <option value="CO_CURRICULAR">Co-Curricular</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Subjects Table */}
            <AdminDataTable
              columns={columns}
              data={subjects}
              loading={loadingSubjects}
              emptyMessage="No subjects found matching the criteria."
            />

            {/* Pagination */}
            <AdminPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalRecords={pagination.totalRecords}
              limit={pagination.limit}
              onPageChange={(p) => fetchSubjects(p)}
            />
          </div>
        )}

        {/* TAB 2: CLASS-WISE SUBJECT ALLOCATIONS (SECTION 6.3) */}
        {activeTab === 'allocations' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-700">Filter by Class:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-3 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Configured Classes</option>
                  {classesList.map(c => (
                    <option key={c._id} value={c._id}>{c.className} ({c.classCode})</option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500">
                Displaying curriculum allocation for session <strong>{selectedYear?.yearCode}</strong>
              </div>
            </div>

            {loadingAllocations ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Loading class allocations...</p>
              </div>
            ) : allocations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
                <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No subjects allocated to this class for session {selectedYear?.yearCode}.</p>
                <p className="text-xs text-slate-400 mt-1">Subjects can be allocated to classes by the Administrator in Academic Management.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Subject Code</th>
                        <th className="py-3 px-4">Subject Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Additional / Project Components</th>
                        <th className="py-3 px-4 text-center">Max Component Marks</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allocations.map((al) => (
                        <tr key={al._id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {al.className} <span className="font-mono text-[10px] text-slate-500 font-normal">({al.classCode})</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {al.subjectCode}
                          </td>
                          <td className="py-3 px-4 font-semibold text-purple-950">
                            {al.subjectName}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={al.subjectType} />
                          </td>
                          <td className="py-3 px-4">
                            {al.hasAdditionalComponents && al.additionalComponents?.length > 0 ? (
                              <div className="space-y-1">
                                {al.additionalComponents.map((cmp, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-block bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-semibold mr-1 border border-purple-200"
                                  >
                                    {cmp.componentName} ({cmp.maximumMarks}M)
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None Configured</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">
                            {al.totalAdditionalMarks > 0 ? `${al.totalAdditionalMarks} Marks` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <StatusBadge status={al.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6.2 SUBJECT DETAILS MODAL (READ-ONLY) */}
        <AdminModal
          isOpen={subjectModalOpen}
          onClose={() => setSubjectModalOpen(false)}
          title={selectedSubjectData?.subject?.subjectName || 'Subject Details'}
          subtitle={`Subject Code: ${selectedSubjectData?.subject?.subjectCode || ''}`}
          maxWidth="max-w-3xl"
        >
          {modalLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
              Loading subject allocation parameters...
            </div>
          ) : selectedSubjectData?.subject ? (
            <div className="space-y-5">
              {/* Subject Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Subject Code</p>
                  <p className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                    {selectedSubjectData.subject.subjectCode}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Subject Name</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                    {selectedSubjectData.subject.subjectName}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Curriculum Type</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSubjectData.subject.subjectType} />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-medium">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSubjectData.subject.status} />
                  </div>
                </div>
              </div>

              {/* Class Allocations Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
                  Class Allocations ({selectedSubjectData.allocations?.length || 0})
                </h4>
                {selectedSubjectData.allocations?.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Academic Session</th>
                          <th className="py-2.5 px-3">Class</th>
                          <th className="py-2.5 px-3">Components Configured</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSubjectData.allocations.map(a => (
                          <tr key={a.allocationId} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {a.academicYearCode} {a.isCurrentYear ? '(Active)' : ''}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {a.className} <span className="font-mono text-slate-400 font-normal">({a.classCode})</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {a.hasAdditionalComponents && a.additionalComponents?.length > 0 ? (
                                <div className="space-y-0.5">
                                  {a.additionalComponents.map((c, i) => (
                                    <span key={i} className="inline-block bg-purple-50 text-purple-700 text-[10px] font-semibold px-2 py-0.5 rounded mr-1">
                                      {c.componentName} ({c.maximumMarks}M)
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <StatusBadge status={a.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                    This subject has not been allocated to any classes yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherSubjectsPage;
