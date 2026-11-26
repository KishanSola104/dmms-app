import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPagination from '../../components/admin/AdminPagination';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import { History, Search, FileText, RefreshCw, Calendar, Filter, AlertCircle } from 'lucide-react';

const DOC_TYPE_LABELS = {
  ALL: 'All Document Types',
  EXAMINATION_MARKSHEET: 'Examination Marksheet',
  FINAL_MARKSHEET: 'Final Marksheet',
  CLASS_EXAM_REPORT: 'Class Exam Register',
  CLASS_FINAL_REPORT: 'Class Final Register',
  ACADEMIC_REPORT: 'Academic Summary Report'
};

const OfficeDownloadHistoryPage = () => {
  const { selectedYear } = useAcademicYear();

  const [downloads, setDownloads] = useState([]);
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [academicYearFilter, setAcademicYearFilter] = useState('ALL');
  const [documentType, setDocumentType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 15
  });

  useEffect(() => {
    if (selectedYear?._id && academicYearFilter === 'ALL') {
      setAcademicYearFilter(selectedYear._id);
    }
  }, [selectedYear?._id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      if (academicYearFilter && academicYearFilter !== 'ALL') params.append('academicYearId', academicYearFilter);
      if (documentType && documentType !== 'ALL') params.append('documentType', documentType);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`/office/download-history?${params.toString()}`);
      if (res.success) {
        setDownloads(res.downloads || []);
        setAvailableAcademicYears(res.availableAcademicYears || []);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 15 });
      }
    } catch (err) {
      setError(err.message || 'Failed to load download history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, [academicYearFilter, documentType, debouncedSearch]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl text-white p-6 shadow-md">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-emerald-200 mb-2">
            <History className="w-3.5 h-3.5" />
            <span>Personal Audit Trail</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Download History</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Track published marksheets, class registers, and official academic reports downloaded by your Office account.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search document name, class, section..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Academic Years</option>
              {availableAcademicYears.map((y) => (
                <option key={y._id} value={y._id}>{y.yearName || y.yearCode}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {Object.entries(DOC_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchHistory(pagination.currentPage)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Document Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Class / Section</th>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4">Downloaded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">Loading download history...</td>
                  </tr>
                ) : downloads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No download records match the selected filters yet.
                    </td>
                  </tr>
                ) : (
                  downloads.map((d) => (
                    <tr key={d._id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate max-w-xs" title={d.documentName}>{d.documentName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {DOC_TYPE_LABELS[d.documentType] || d.documentType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {d.className ? `${d.className}${d.sectionName ? ` - ${d.sectionName}` : ''}` : 'All Classes'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{d.academicYearName || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {d.downloadedAt ? new Date(d.downloadedAt).toLocaleString('en-GB') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100">
              <AdminPagination pagination={pagination} onPageChange={(p) => fetchHistory(p)} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OfficeDownloadHistoryPage;
