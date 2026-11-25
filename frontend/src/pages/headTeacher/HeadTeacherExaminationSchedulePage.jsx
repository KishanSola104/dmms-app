import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Clock,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Eye,
  RefreshCw,
  Search,
  RotateCcw,
  X,
  Info,
  Loader2,
  Layers
} from 'lucide-react';

const HeadTeacherExaminationSchedulePage = () => {
  const { selectedYear } = useAcademicYear();

  const [schedule, setSchedule] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [sameDateExaminations, setSameDateExaminations] = useState([]);
  const [summary, setSummary] = useState({
    totalEntries: 0,
    uniqueExaminations: 0,
    missingDatesCount: 0,
    conflictCount: 0
  });
  const [scheduleSchemaInfo, setScheduleSchemaInfo] = useState(null);
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ examinations: [], classes: [], subjects: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [academicYearFilter, setAcademicYearFilter] = useState(selectedYear?._id || '');
  const [examinationFilter, setExaminationFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedExamDetails, setSelectedExamDetails] = useState(null);

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

  const fetchSchedule = async (page = 1) => {
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
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`/head-teacher/examination-schedule?${params.toString()}`);
      if (res.success) {
        setSchedule(res.schedule || []);
        setConflicts(res.conflicts || []);
        setSameDateExaminations(res.sameDateExaminations || []);
        setSummary(res.summary || { totalEntries: 0, uniqueExaminations: 0, missingDatesCount: 0, conflictCount: 0 });
        setScheduleSchemaInfo(res.scheduleSchemaInfo || null);
        setAvailableAcademicYears(res.availableAcademicYears || []);
        setFilterOptions(res.filterOptions || { examinations: [], classes: [], subjects: [] });
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      console.error('[HeadTeacherSchedule] Fetch error:', err);
      setError(err.message || 'Failed to load examination schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule(1);
  }, [academicYearFilter, examinationFilter, classFilter, subjectFilter, dateFrom, dateTo, debouncedSearch]);

  const handleResetFilters = () => {
    setAcademicYearFilter(selectedYear?._id || '');
    setExaminationFilter('ALL');
    setClassFilter('ALL');
    setSubjectFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const handleViewExamDetails = async (examinationId) => {
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setSelectedExamDetails(null);
    try {
      const res = await api.get(`/head-teacher/examinations/${examinationId}`);
      if (res.success) {
        setSelectedExamDetails(res);
      }
    } catch (err) {
      console.error('[HeadTeacherSchedule] Details error:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const columns = [
    {
      header: 'Examination Name',
      accessor: 'examinationName',
      render: (item) => (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{item.examinationName}</span>
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
              {item.examinationCode}
            </span>
          </div>
          <div className="mt-1">
            <StatusBadge status={item.examinationStatus} />
          </div>
        </div>
      )
    },
    {
      header: 'Class',
      accessor: 'className',
      render: (item) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          {item.className}
        </span>
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
      header: 'Examination Date',
      accessor: 'examinationDate',
      render: (item) => {
        const s = formatDate(item.startDate);
        const e = formatDate(item.endDate);
        if (!s && !e) {
          return <span className="text-xs text-amber-600 italic">Dates incomplete / not set</span>;
        }
        return (
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-800 whitespace-nowrap">
              {s || 'N/A'} {e && e !== s ? `– ${e}` : ''}
            </div>
            {item.isSameDateShared && (
              <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                Shared Exam Date
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Start Time',
      accessor: 'startTime',
      render: (item) =>
        item.startTime ? (
          <span className="text-xs font-mono text-slate-700">{item.startTime}</span>
        ) : (
          <span className="text-xs text-slate-400 italic">Not Specified</span>
        )
    },
    {
      header: 'End Time',
      accessor: 'endTime',
      render: (item) =>
        item.endTime ? (
          <span className="text-xs font-mono text-slate-700">{item.endTime}</span>
        ) : (
          <span className="text-xs text-slate-400 italic">Not Specified</span>
        )
    },
    {
      header: 'Max Marks',
      accessor: 'totalMaximumMarks',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
          {item.totalMaximumMarks ?? 0}
        </span>
      )
    },
    {
      header: 'Action',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          onClick={() => handleViewExamDetails(item.examinationId)}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Details
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
                Read-Only Timetable
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Examination Schedule
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              View examination timetables class-wise and subject-wise, track overlapping dates, and inspect schedule conflicts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchSchedule(pagination.currentPage)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        {/* Conflict Warning Banner */}
        {conflicts.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Schedule Conflicts Detected ({conflicts.length})</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 text-amber-900">
              {conflicts.map((c, idx) => (
                <li key={idx}>{c.message}</li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-700">
              Monitoring view only — schedule entries are not automatically modified or deleted.
            </p>
          </div>
        )}

        {/* Same-Date Examinations Notice */}
        {sameDateExaminations.length > 0 && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
            <div className="flex items-center space-x-2 font-bold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Examinations Scheduled on the Same Start Date</span>
            </div>
            {sameDateExaminations.map((grp) => (
              <p key={grp.date} className="pl-6">
                <strong>{formatDate(grp.date)}</strong>:{' '}
                {grp.examinations.map((e) => e.examinationName).join(', ')}
              </p>
            ))}
          </div>
        )}

        {/* Schema Info Notice */}
        {scheduleSchemaInfo && !scheduleSchemaInfo.hasSubjectLevelTimetable && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{scheduleSchemaInfo.note}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to load schedule</p>
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
                placeholder="Search exam, class, subject..."
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
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

            {/* Date From */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-500 shrink-0">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Date From"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-500 shrink-0">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Date To"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Summary pill + Reset */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Showing <strong>{summary.totalEntries}</strong> schedule {summary.totalEntries === 1 ? 'entry' : 'entries'}
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset Filters"
                className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Table */}
        <AdminDataTable
          columns={columns}
          data={schedule}
          loading={loading}
          emptyMessage="No examination schedule available for the selected filters."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(page) => fetchSchedule(page)}
        />

        {/* Examination Details Modal */}
        <AdminModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={selectedExamDetails?.examination?.examinationName || 'Examination Details'}
          subtitle={
            selectedExamDetails?.examination
              ? `${selectedExamDetails.examination.examinationCode} • ${selectedExamDetails.examination.academicYearName}`
              : ''
          }
          maxWidth="max-w-3xl"
        >
          {detailsLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading examination details...</p>
            </div>
          ) : selectedExamDetails ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Academic Year</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedExamDetails.examination.academicYearName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Exam Window</p>
                  <p className="text-xs font-semibold text-slate-800 mt-1">
                    {formatDate(selectedExamDetails.examination.startDate) || 'Not Set'}
                    {' → '}
                    {formatDate(selectedExamDetails.examination.endDate) || 'Not Set'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedExamDetails.examination.status} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center">
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Assigned Classes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedExamDetails.examination.assignedClasses || []).map((c) => (
                    <span
                      key={c._id || c.classRef}
                      className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      {c.className}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Max Marks</th>
                      <th className="py-2.5 px-3">Components</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedExamDetails.configuredSubjects || []).map((sub) => (
                      <tr key={sub._id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{sub.className}</td>
                        <td className="py-2.5 px-3">{sub.subjectName} ({sub.subjectCode})</td>
                        <td className="py-2.5 px-3 font-mono font-bold">{sub.totalMaximumMarks}</td>
                        <td className="py-2.5 px-3">
                          {sub.components?.length > 0
                            ? sub.components.map((c) => `${c.componentName}: ${c.maximumMarks}`).join(', ')
                            : 'No sub-components'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">Examination details unavailable.</p>
          )}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherExaminationSchedulePage;
