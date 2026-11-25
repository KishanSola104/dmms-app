import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  RotateCcw,
  X,
  AlertCircle,
  Users,
  UserCheck,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';

const HeadTeacherMarksMonitoringPage = () => {
  const { selectedYear } = useAcademicYear();

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    totalEntries: 0,
    pendingCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    submittedCount: 0,
    totalStudentsSum: 0,
    totalMarksEnteredSum: 0,
    overallProgressPercentage: 0
  });
  const [marksModuleStatus, setMarksModuleStatus] = useState(null);
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    examinations: [],
    classes: [],
    subjects: [],
    teachers: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [academicYearFilter, setAcademicYearFilter] = useState(selectedYear?._id || '');
  const [examinationFilter, setExaminationFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [teacherFilter, setTeacherFilter] = useState('ALL');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // View Progress Modal
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [selectedProgressDetails, setSelectedProgressDetails] = useState(null);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearFilter(selectedYear._id);
      setExaminationFilter('ALL');
    }
  }, [selectedYear?._id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchMarksMonitoring = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pagination.limit.toString());
      if (academicYearFilter) params.append('academicYearId', academicYearFilter);
      if (examinationFilter && examinationFilter !== 'ALL') params.append('examinationId', examinationFilter);
      if (classFilter && classFilter !== 'ALL') params.append('classId', classFilter);
      if (subjectFilter && subjectFilter !== 'ALL') params.append('subjectId', subjectFilter);
      if (teacherFilter && teacherFilter !== 'ALL') params.append('teacherId', teacherFilter);
      if (submissionStatusFilter && submissionStatusFilter !== 'ALL') {
        params.append('submissionStatus', submissionStatusFilter);
      }
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`/head-teacher/marks-entry-monitoring?${params.toString()}`);
      if (res.success) {
        setEntries(res.entries || []);
        setSummary(res.summary || {
          totalEntries: 0,
          pendingCount: 0,
          inProgressCount: 0,
          completedCount: 0,
          submittedCount: 0,
          totalStudentsSum: 0,
          totalMarksEnteredSum: 0,
          overallProgressPercentage: 0
        });
        setMarksModuleStatus(res.marksModuleStatus || null);
        setAvailableAcademicYears(res.availableAcademicYears || []);
        setFilterOptions(res.filterOptions || { examinations: [], classes: [], subjects: [], teachers: [] });
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      console.error('[HeadTeacherMarksMonitoring] Fetch error:', err);
      setError(err.message || 'Failed to load marks entry monitoring data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarksMonitoring(1);
  }, [
    academicYearFilter,
    examinationFilter,
    classFilter,
    subjectFilter,
    teacherFilter,
    submissionStatusFilter,
    debouncedSearch
  ]);

  const handleResetFilters = () => {
    setAcademicYearFilter(selectedYear?._id || '');
    setExaminationFilter('ALL');
    setClassFilter('ALL');
    setSubjectFilter('ALL');
    setTeacherFilter('ALL');
    setSubmissionStatusFilter('ALL');
    setSearch('');
  };

  const handleOpenViewProgress = async (row) => {
    setProgressModalOpen(true);
    setProgressLoading(true);
    setProgressError('');
    setSelectedProgressDetails(null);
    try {
      const params = new URLSearchParams({
        examinationId: row.examinationId,
        classId: row.classId,
        subjectId: row.subjectId
      });
      if (row.sectionId) {
        params.append('sectionId', row.sectionId);
      }

      const res = await api.get(`/head-teacher/marks-entry-monitoring/details?${params.toString()}`);
      if (res.success) {
        setSelectedProgressDetails(res);
      }
    } catch (err) {
      setProgressError(err.message || 'Failed to load detailed marks-entry progress.');
    } finally {
      setProgressLoading(false);
    }
  };

  const columns = [
    {
      header: 'Examination',
      accessor: 'examinationName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900">{item.examinationName}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
              {item.examinationCode}
            </span>
            <span className="text-[11px] text-slate-400">{item.academicYearName}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Class',
      accessor: 'className',
      render: (item) => (
        <div className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {item.className}
          </span>
          {item.sectionName && (
            <span className="text-[11px] font-medium text-slate-500">
              {item.sectionName}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Subject',
      accessor: 'subjectName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-800">{item.subjectName}</span>
          <span className="ml-1.5 font-mono text-[11px] text-slate-400">({item.subjectCode})</span>
        </div>
      )
    },
    {
      header: 'Assigned Teacher',
      accessor: 'assignedTeacherName',
      render: (item) =>
        item.hasAssignedTeacher && item.assignedTeacherName ? (
          <div>
            <p className="text-xs font-semibold text-slate-800">{item.assignedTeacherName}</p>
            {item.assignedTeacherUserId && (
              <p className="text-[10px] font-mono text-slate-400">{item.assignedTeacherUserId}</p>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Not Assigned
          </span>
        )
    },
    {
      header: 'Total Students',
      accessor: 'totalStudents',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {item.totalStudents}
        </span>
      )
    },
    {
      header: 'Marks Entered',
      accessor: 'marksEntered',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-emerald-700">
          {item.marksEntered}
        </span>
      )
    },
    {
      header: 'Pending',
      accessor: 'pending',
      align: 'center',
      render: (item) => (
        <div className="flex flex-col items-center">
          <span className={`font-mono text-xs font-bold ${item.pending > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
            {item.pending}
          </span>
          <span className="text-[10px] text-slate-400">{item.progressPercentage}%</span>
        </div>
      )
    },
    {
      header: 'Submission Status',
      accessor: 'submissionStatus',
      render: (item) => <StatusBadge status={item.submissionStatus} />
    },
    {
      header: 'Action',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          onClick={() => handleOpenViewProgress(item)}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          View Progress
        </button>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded">
                Head Teacher Panel
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded">
                Read-Only Monitoring
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Marks Entry Monitoring
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor marks-entry progress class-wise and subject-wise, identify pending teacher submissions, and inspect pending student rosters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchMarksMonitoring(pagination.currentPage)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Subject Entries</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalEntries}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Class-subject pairs tracked</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Pending Submissions</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{summary.pendingCount}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">In Progress: {summary.inProgressCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Completed / Submitted</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {summary.completedCount + summary.submittedCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Submitted: {summary.submittedCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Overall Progress</p>
              <span className="text-sm font-bold text-blue-700">{summary.overallProgressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, summary.overallProgressPercentage))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {summary.totalMarksEnteredSum} / {summary.totalStudentsSum} student marks entered
            </p>
          </div>
        </div>

        {/* Marks Module Info Notice */}
        {marksModuleStatus && !marksModuleStatus.isMarksCollectionAvailable && (
          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center space-x-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{marksModuleStatus.message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load marks monitoring data</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exam, class, subject, teacher..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Academic Year */}
            <select
              value={academicYearFilter}
              onChange={(e) => {
                setAcademicYearFilter(e.target.value);
                setExaminationFilter('ALL');
              }}
              aria-label="Academic Year Filter"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Academic Years</option>
              {availableAcademicYears.map((y) => (
                <option key={y._id} value={y._id}>
                  {y.yearName || y.yearCode} {y.isCurrent ? '(Active)' : ''}
                </option>
              ))}
            </select>

            {/* Examination */}
            <select
              value={examinationFilter}
              onChange={(e) => setExaminationFilter(e.target.value)}
              aria-label="Examination Filter"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Examinations</option>
              {(filterOptions.examinations || []).map((ex) => (
                <option key={ex._id} value={ex._id}>
                  {ex.examinationName} ({ex.examinationCode})
                </option>
              ))}
            </select>

            {/* Class */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Class Filter"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Classes</option>
              {(filterOptions.classes || []).map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.className} ({cls.classCode})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Subject */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Subject Filter"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Subjects</option>
              {(filterOptions.subjects || []).map((sub) => (
                <option key={sub._id} value={sub._id}>
                  {sub.subjectName} ({sub.subjectCode})
                </option>
              ))}
            </select>

            {/* Teacher */}
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              aria-label="Teacher Filter"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">All Teachers</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {(filterOptions.teachers || []).map((t) => (
                <option key={t._id} value={t._id}>
                  {t.fullName} ({t.userId})
                </option>
              ))}
            </select>

            {/* Submission Status + Reset */}
            <div className="flex items-center gap-2">
              <select
                value={submissionStatusFilter}
                onChange={(e) => setSubmissionStatusFilter(e.target.value)}
                aria-label="Submission Status Filter"
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">All Submission Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="SUBMITTED">Submitted</option>
              </select>
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset Filters"
                className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Monitoring Table */}
        <AdminDataTable
          columns={columns}
          data={entries}
          loading={loading}
          emptyMessage="No marks-entry records available for the selected filters."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(page) => fetchMarksMonitoring(page)}
        />

        {/* View Progress Details Modal */}
        <AdminModal
          isOpen={progressModalOpen}
          onClose={() => setProgressModalOpen(false)}
          title="Marks Entry Progress Details"
          subtitle={
            selectedProgressDetails
              ? `${selectedProgressDetails.examination?.examinationName} • ${selectedProgressDetails.classInfo?.className}${
                  selectedProgressDetails.sectionInfo ? ` (${selectedProgressDetails.sectionInfo.sectionName})` : ''
                } • ${selectedProgressDetails.subjectInfo?.subjectName}`
              : 'Read-only submission monitoring'
          }
          maxWidth="max-w-3xl"
        >
          {progressLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading marks entry progress...</p>
            </div>
          ) : progressError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {progressError}
            </div>
          ) : selectedProgressDetails ? (
            <div className="space-y-5">
              {/* Overview Grid */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Examination</p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {selectedProgressDetails.examination?.examinationName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {selectedProgressDetails.examination?.academicYearName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Class &amp; Section</p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {selectedProgressDetails.classInfo?.className}
                    {selectedProgressDetails.sectionInfo
                      ? ` - ${selectedProgressDetails.sectionInfo.sectionName}`
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Subject</p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {selectedProgressDetails.subjectInfo?.subjectName} ({selectedProgressDetails.subjectInfo?.subjectCode})
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Max Marks: {selectedProgressDetails.subjectInfo?.totalMaximumMarks ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Assigned Teacher</p>
                  {selectedProgressDetails.assignedTeacher?.isAssigned ? (
                    <div className="mt-1">
                      <p className="text-xs font-bold text-slate-900 flex items-center">
                        <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        {selectedProgressDetails.assignedTeacher.teacherName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {selectedProgressDetails.assignedTeacher.teacherUserId}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-amber-700 mt-1 flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      Not Assigned
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Metrics */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-slate-700">Submission Status:</span>
                    <StatusBadge status={selectedProgressDetails.progress?.submissionStatus} />
                  </div>
                  <span className="text-sm font-bold text-blue-700">
                    {selectedProgressDetails.progress?.progressPercentage ?? 0}% Completed
                  </span>
                </div>

                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, selectedProgressDetails.progress?.progressPercentage ?? 0))}%`
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Eligible</p>
                    <p className="text-lg font-bold text-slate-900">
                      {selectedProgressDetails.progress?.totalStudents ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-[10px] font-semibold text-emerald-700 uppercase">Marks Entered</p>
                    <p className="text-lg font-bold text-emerald-800">
                      {selectedProgressDetails.progress?.marksEntered ?? 0}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase">Marks Pending</p>
                    <p className="text-lg font-bold text-amber-800">
                      {selectedProgressDetails.progress?.pending ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pending Students Roster */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Students Pending Marks Entry ({selectedProgressDetails.pendingStudents?.length || 0})
                </h4>

                {selectedProgressDetails.pendingStudents?.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    {selectedProgressDetails.progress?.totalStudents === 0
                      ? 'No students are currently enrolled in this class/section.'
                      : 'All enrolled students have marks entered.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Roll No</th>
                          <th className="py-2 px-3">Admission No</th>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Section</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedProgressDetails.pendingStudents.map((st) => (
                          <tr key={st.studentId} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-mono text-slate-600">{st.rollNumber}</td>
                            <td className="py-2 px-3 font-mono font-semibold text-slate-800">{st.admissionNumber}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{st.fullName}</td>
                            <td className="py-2 px-3 text-slate-600">{st.sectionName}</td>
                            <td className="py-2 px-3">
                              <StatusBadge status={st.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-[11px] text-slate-500">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Read-only monitoring view. Head Teachers cannot enter, edit, or approve marks from this page.</span>
              </div>
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherMarksMonitoringPage;
