import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  Search,
  RotateCcw,
  X,
  AlertCircle,
  BookOpen,
  Info
} from 'lucide-react';

const HeadTeacherSubjectConfigPage = () => {
  const { selectedYear } = useAcademicYear();

  const [configurations, setConfigurations] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    configuredCount: 0,
    unconfiguredCount: 0,
    zeroMarksConfiguredCount: 0
  });
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ examinations: [], classes: [], subjects: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [academicYearFilter, setAcademicYearFilter] = useState(selectedYear?._id || '');
  const [examinationFilter, setExaminationFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [configStatusFilter, setConfigStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Details Modal
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

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

  const fetchConfigurations = async (page = 1) => {
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
      if (configStatusFilter && configStatusFilter !== 'ALL') params.append('configStatus', configStatusFilter);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`/head-teacher/subject-configurations?${params.toString()}`);
      if (res.success) {
        setConfigurations(res.configurations || []);
        setSummary(res.summary || {
          totalRecords: 0,
          configuredCount: 0,
          unconfiguredCount: 0,
          zeroMarksConfiguredCount: 0
        });
        setAvailableAcademicYears(res.availableAcademicYears || []);
        setFilterOptions(res.filterOptions || { examinations: [], classes: [], subjects: [] });
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      console.error('[HeadTeacherSubjectConfig] Fetch error:', err);
      setError(err.message || 'Failed to load subject configurations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigurations(1);
  }, [academicYearFilter, examinationFilter, classFilter, subjectFilter, configStatusFilter, debouncedSearch]);

  const handleResetFilters = () => {
    setAcademicYearFilter(selectedYear?._id || '');
    setExaminationFilter('ALL');
    setClassFilter('ALL');
    setSubjectFilter('ALL');
    setConfigStatusFilter('ALL');
    setSearch('');
  };

  const handleOpenView = (row) => {
    setSelectedConfig(row);
    setDetailsModalOpen(true);
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
      header: 'Maximum Marks',
      accessor: 'totalMaximumMarks',
      align: 'center',
      render: (item) =>
        item.isConfigured ? (
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-900 rounded border border-slate-200">
            {item.totalMaximumMarks}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">—</span>
        )
    },
    {
      header: 'Passing Marks',
      accessor: 'passingMarks',
      align: 'center',
      render: (item) =>
        item.passingMarks !== null && item.passingMarks !== undefined ? (
          <span className="font-mono text-xs font-semibold text-slate-800">{item.passingMarks}</span>
        ) : (
          <span className="text-xs text-slate-400 italic">Not Configured</span>
        )
    },
    {
      header: 'Assessment Type',
      accessor: 'assessmentType',
      render: (item) => (
        <div className="space-y-1">
          <StatusBadge status={item.subjectType} />
          {item.isConfigured && item.components?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.components.map((c) => (
                <span
                  key={c._id}
                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px]"
                >
                  {c.componentName}: {c.maximumMarks}
                </span>
              ))}
            </div>
          )}
        </div>
      )
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
          onClick={() => handleOpenView(item)}
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded">
                Head Teacher Panel
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 rounded">
                Read-Only Review
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Subject Configuration Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review configured marks, assessment components, and verify whether all allocated class subjects are configured for examinations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchConfigurations(pagination.currentPage)}
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
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Allocated Pairs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalRecords}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Configured</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.configuredCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Missing Configuration</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{summary.unconfiguredCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Zero-Marks Configs</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{summary.zeroMarksConfiguredCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
              <Sliders className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Unconfigured Warning Banner if any */}
        {summary.unconfiguredCount > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center space-x-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{summary.unconfiguredCount}</strong> allocated class-subject pair{summary.unconfiguredCount === 1 ? '' : 's'} do not have examination marks configuration yet. Please coordinate with the School Administrator if needed.
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load subject configurations</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, class..."
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

            {/* Status + Reset */}
            <div className="flex items-center gap-2">
              <select
                value={configStatusFilter}
                onChange={(e) => setConfigStatusFilter(e.target.value)}
                aria-label="Configuration Status Filter"
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">All Config Status</option>
                <option value="CONFIGURED">Configured</option>
                <option value="NOT_CONFIGURED">Not Configured</option>
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

        {/* Configurations Table */}
        <AdminDataTable
          columns={columns}
          data={configurations}
          loading={loading}
          emptyMessage="No subject configuration records available for the selected filters."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(page) => fetchConfigurations(page)}
        />

        {/* Read-Only Configuration Details Modal */}
        <AdminModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={selectedConfig ? `${selectedConfig.subjectName} (${selectedConfig.subjectCode})` : 'Subject Configuration'}
          subtitle={
            selectedConfig
              ? `${selectedConfig.examinationName} • ${selectedConfig.className}`
              : ''
          }
          maxWidth="max-w-2xl"
        >
          {selectedConfig && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Examination</p>
                  <p className="text-xs font-bold text-slate-900 mt-1">{selectedConfig.examinationName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Class</p>
                  <p className="text-xs font-bold text-slate-900 mt-1">{selectedConfig.className}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Maximum Marks</p>
                  <p className="text-sm font-mono font-bold text-indigo-700 mt-0.5">
                    {selectedConfig.isConfigured ? selectedConfig.totalMaximumMarks : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedConfig.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Subject Classification</p>
                  <div className="mt-1.5">
                    <StatusBadge status={selectedConfig.subjectType} />
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase">Passing Marks</p>
                  <p className="mt-1.5 text-slate-700 font-medium">
                    {selectedConfig.passingMarks !== null && selectedConfig.passingMarks !== undefined
                      ? selectedConfig.passingMarks
                      : 'Not configured in current examination schema'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Configured Assessment Components
                </h4>
                {!selectedConfig.isConfigured ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    Subject marks configuration has not been saved yet in Admin Examination Management.
                  </div>
                ) : selectedConfig.components?.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    Configured with 0 sub-components (Total Maximum Marks: {selectedConfig.totalMaximumMarks}).
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Component Name</th>
                          <th className="py-2 px-3 text-right">Maximum Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedConfig.components.map((comp, idx) => (
                          <tr key={comp._id || idx}>
                            <td className="py-2 px-3 text-slate-400">{comp.sequence || idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{comp.componentName}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {comp.maximumMarks}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedConfig.hasAdditionalComponents && selectedConfig.additionalComponents?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Class-Level Additional Components (Total: {selectedConfig.totalAdditionalMarks})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedConfig.additionalComponents.map((ac) => (
                      <span
                        key={ac._id}
                        className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium"
                      >
                        {ac.componentName}: <strong>{ac.maximumMarks}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-[11px] text-slate-500">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Read-only overview. Modifications to subject marks can only be performed by the School Administrator.</span>
              </div>
            </div>
          )}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherSubjectConfigPage;
