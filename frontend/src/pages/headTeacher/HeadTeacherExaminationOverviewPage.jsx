import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle2,
  Eye,
  AlertCircle,
  RefreshCw,
  Search,
  RotateCcw,
  X,
  BookOpen,
  Layers,
  BarChart3,
  Loader2,
  Info
} from 'lucide-react';

const HeadTeacherExaminationOverviewPage = () => {
  const { selectedYear } = useAcademicYear();

  const [examinations, setExaminations] = useState([]);
  const [summary, setSummary] = useState({
    totalExaminations: 0,
    upcomingExaminations: 0,
    ongoingExaminations: 0,
    completedExaminations: 0
  });
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ examinations: [], classes: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [academicYearFilter, setAcademicYearFilter] = useState(selectedYear?._id || '');
  const [examinationFilter, setExaminationFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
  const [detailsError, setDetailsError] = useState('');
  const [selectedExamDetails, setSelectedExamDetails] = useState(null);
  const [detailsTab, setDetailsTab] = useState('subjects'); // 'subjects' | 'schedule' | 'progress'

  // Sync page academic year filter when header dropdown changes
  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearFilter(selectedYear._id);
      setExaminationFilter('ALL');
    }
  }, [selectedYear?._id]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchExaminations = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pagination.limit.toString());
      if (academicYearFilter) params.append('academicYearId', academicYearFilter);
      if (examinationFilter && examinationFilter !== 'ALL') params.append('examinationId', examinationFilter);
      if (classFilter && classFilter !== 'ALL') params.append('classId', classFilter);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`/head-teacher/examinations?${params.toString()}`);
      if (res.success) {
        setExaminations(res.examinations || []);
        setSummary(res.summary || {
          totalExaminations: 0,
          upcomingExaminations: 0,
          ongoingExaminations: 0,
          completedExaminations: 0
        });
        setAvailableAcademicYears(res.availableAcademicYears || []);
        setFilterOptions(res.filterOptions || { examinations: [], classes: [] });
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      console.error('[HeadTeacherExamOverview] Fetch error:', err);
      setError(err.message || 'Failed to load examination overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExaminations(1);
  }, [academicYearFilter, examinationFilter, classFilter, statusFilter, debouncedSearch]);

  const handleResetFilters = () => {
    setAcademicYearFilter(selectedYear?._id || '');
    setExaminationFilter('ALL');
    setClassFilter('ALL');
    setStatusFilter('ALL');
    setSearch('');
  };

  const handleOpenViewDetails = async (exam) => {
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    setDetailsError('');
    setDetailsTab('subjects');
    setSelectedExamDetails(null);
    try {
      const res = await api.get(`/head-teacher/examinations/${exam._id}`);
      if (res.success) {
        setSelectedExamDetails(res);
      }
    } catch (err) {
      setDetailsError(err.message || 'Failed to load examination details.');
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

  const summaryCards = [
    {
      title: 'Total Examinations',
      value: summary.totalExaminations ?? 0,
      subtitle: 'All examinations in selected session',
      icon: ClipboardList,
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      ring: 'ring-indigo-100'
    },
    {
      title: 'Upcoming Examinations',
      value: summary.upcomingExaminations ?? 0,
      subtitle: 'Scheduled to commence',
      icon: Calendar,
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      ring: 'ring-blue-100'
    },
    {
      title: 'Ongoing Examinations',
      value: summary.ongoingExaminations ?? 0,
      subtitle: 'Currently active assessments',
      icon: Clock,
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      ring: 'ring-amber-100'
    },
    {
      title: 'Completed Examinations',
      value: summary.completedExaminations ?? 0,
      subtitle: 'Concluded examination cycles',
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      ring: 'ring-emerald-100'
    }
  ];

  const columns = [
    {
      header: 'Examination Name',
      accessor: 'examinationName',
      render: (item) => (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{item.examinationName}</span>
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
              {item.examinationCode}
            </span>
          </div>
          {item.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
      )
    },
    {
      header: 'Academic Year',
      accessor: 'academicYearName',
      render: (item) => (
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          {item.academicYearName || item.academicYearCode || 'N/A'}
        </span>
      )
    },
    {
      header: 'Classes',
      accessor: 'assignedClasses',
      render: (item) => {
        const list = item.assignedClasses || [];
        if (list.length === 0) {
          return <span className="text-xs text-slate-400 italic">No classes assigned</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5 max-w-xs">
            {list.slice(0, 3).map((c) => (
              <span
                key={c._id || c.classRef}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
              >
                {c.className}
              </span>
            ))}
            {list.length > 3 && (
              <span className="text-[11px] font-semibold text-slate-500 self-center">
                +{list.length - 3} more
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Start Date',
      accessor: 'startDate',
      render: (item) => {
        const formatted = formatDate(item.startDate);
        return formatted ? (
          <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{formatted}</span>
        ) : (
          <span className="text-xs text-amber-600 italic">Not set</span>
        );
      }
    },
    {
      header: 'End Date',
      accessor: 'endDate',
      render: (item) => {
        const formatted = formatDate(item.endDate);
        return formatted ? (
          <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{formatted}</span>
        ) : (
          <span className="text-xs text-amber-600 italic">Not set</span>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      header: 'Action',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          onClick={() => handleOpenViewDetails(item)}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          View
        </button>
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
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded">
                Head Teacher Panel
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded">
                Read-Only Supervision
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Examination Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor school examinations, active timelines, assigned classes, and readiness across academic years.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchExaminations(pagination.currentPage)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{card.subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg} ${card.text} ring-4 ${card.ring}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load examinations</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exam or class..."
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

            {/* Academic Year Filter */}
            <div>
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
            </div>

            {/* Examination Filter */}
            <div>
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
            </div>

            {/* Class Filter */}
            <div>
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

            {/* Status Filter + Reset */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Examination Status Filter"
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset Filters"
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Examination List Table */}
        <AdminDataTable
          columns={columns}
          data={examinations}
          loading={loading}
          emptyMessage="No examinations available for the selected academic year and filters."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(page) => fetchExaminations(page)}
        />

        {/* Read-Only Examination Details Modal */}
        <AdminModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={selectedExamDetails?.examination?.examinationName || 'Examination Details'}
          subtitle={
            selectedExamDetails?.examination
              ? `${selectedExamDetails.examination.examinationCode} • ${selectedExamDetails.examination.academicYearName}`
              : 'Read-only examination monitoring view'
          }
          maxWidth="max-w-4xl"
        >
          {detailsLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading examination details...</p>
            </div>
          ) : detailsError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {detailsError}
            </div>
          ) : selectedExamDetails ? (
            <div className="space-y-5">
              {/* Top Overview Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Academic Year</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {selectedExamDetails.examination.academicYearName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Examination Dates</p>
                  <p className="text-xs font-semibold text-slate-800 mt-1">
                    {formatDate(selectedExamDetails.examination.startDate) || 'Start Not Set'}
                    {' → '}
                    {formatDate(selectedExamDetails.examination.endDate) || 'End Not Set'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedExamDetails.examination.status} />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Configured Subjects</p>
                  <p className="text-sm font-bold text-indigo-700 mt-0.5">
                    {selectedExamDetails.configuredSubjects?.length || 0} Subject Configs
                  </p>
                </div>
              </div>

              {/* Classes Included */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center">
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Classes Included ({selectedExamDetails.examination.assignedClasses?.length || 0})
                </p>
                {selectedExamDetails.examination.assignedClasses?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedExamDetails.examination.assignedClasses.map((c) => (
                      <span
                        key={c._id || c.classRef}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                      >
                        {c.className} ({c.classCode})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No classes assigned to this examination.</p>
                )}
              </div>

              {/* Tabs inside Details Modal */}
              <div className="border-b border-slate-200 flex space-x-4">
                <button
                  type="button"
                  onClick={() => setDetailsTab('subjects')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center ${
                    detailsTab === 'subjects'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  Configured Subjects ({selectedExamDetails.configuredSubjects?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsTab('schedule')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center ${
                    detailsTab === 'schedule'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Examination Schedule ({selectedExamDetails.schedule?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsTab('progress')}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center ${
                    detailsTab === 'progress'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  Marks Entry Progress ({selectedExamDetails.marksEntryProgress?.overallProgressPercentage ?? 0}%)
                </button>
              </div>

              {/* Tab 1: Configured Subjects */}
              {detailsTab === 'subjects' && (
                <div>
                  {selectedExamDetails.configuredSubjects?.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      No subject configurations available for this examination yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                            <th className="py-2.5 px-3">Class</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Max Marks</th>
                            <th className="py-2.5 px-3">Components</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedExamDetails.configuredSubjects.map((sub) => (
                            <tr key={sub._id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{sub.className}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {sub.subjectName}{' '}
                                <span className="font-mono text-[10px] text-slate-400">({sub.subjectCode})</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <StatusBadge status={sub.subjectType} />
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {sub.totalMaximumMarks}
                              </td>
                              <td className="py-2.5 px-3">
                                {sub.components && sub.components.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {sub.components.map((c) => (
                                      <span
                                        key={c._id}
                                        className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]"
                                      >
                                        {c.componentName}: <strong>{c.maximumMarks}</strong>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">No sub-components</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Schedule */}
              {detailsTab === 'schedule' && (
                <div>
                  {selectedExamDetails.schedule?.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      No examination schedule entries available.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                            <th className="py-2.5 px-3">Class</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Exam Window</th>
                            <th className="py-2.5 px-3">Time</th>
                            <th className="py-2.5 px-3">Max Marks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedExamDetails.schedule.map((row) => (
                            <tr key={row._id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{row.className}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {row.subjectName} ({row.subjectCode})
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {formatDate(row.startDate) || 'Not Set'}
                                {row.endDate ? ` – ${formatDate(row.endDate)}` : ''}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 italic">
                                {row.startTime && row.endTime ? `${row.startTime} - ${row.endTime}` : 'Not Specified'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {row.totalMaximumMarks}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Marks Entry Progress */}
              {detailsTab === 'progress' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start space-x-2 text-xs text-blue-800">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Overall Progress: <strong>{selectedExamDetails.marksEntryProgress?.totalMarksEntered ?? 0}</strong> /{' '}
                      <strong>{selectedExamDetails.marksEntryProgress?.totalEligibleStudents ?? 0}</strong> student marks entered (
                      <strong>{selectedExamDetails.marksEntryProgress?.overallProgressPercentage ?? 0}%</strong>).
                    </span>
                  </div>
                  {selectedExamDetails.marksEntryProgress?.rows?.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      No class-subject marks-entry tracking records available yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                            <th className="py-2.5 px-3">Class / Section</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Assigned Teacher</th>
                            <th className="py-2.5 px-3">Entered / Total</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedExamDetails.marksEntryProgress.rows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {r.className}
                                {r.sectionName ? ` - ${r.sectionName}` : ''}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{r.subjectName}</td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {r.assignedTeacherName || <span className="text-amber-600 italic">Not Assigned</span>}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                {r.marksEntered} / {r.totalStudents} ({r.progressPercentage}%)
                              </td>
                              <td className="py-2.5 px-3">
                                <StatusBadge status={r.submissionStatus} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherExaminationOverviewPage;
