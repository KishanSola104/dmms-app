import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import { useUserAuth } from '../../context/UserAuthContext';
import api from '../../services/api';
import { ScrollText, Search, RefreshCw, Eye, AlertCircle, Shield } from 'lucide-react';

const AuditLogPage = () => {
  const { currentUser } = useUserAuth();
  const basePath = currentUser?.roleCode === 'HEAD_TEACHER' ? '/head-teacher/audit-logs' : '/admin/audit-logs';

  const [logs, setLogs] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ users: [], roles: [], modules: [], actions: [] });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 });

  const [userId, setUserId] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (userId !== 'ALL') params.append('userId', userId);
      if (role !== 'ALL') params.append('role', role);
      if (moduleFilter !== 'ALL') params.append('module', moduleFilter);
      if (action !== 'ALL') params.append('action', action);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (debouncedSearch) params.append('search', debouncedSearch);

      const res = await api.get(`${basePath}?${params.toString()}`);
      if (res.success) {
        setLogs(res.logs || []);
        setFilterOptions(res.filterOptions || { users: [], roles: [], modules: [], actions: [] });
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 });
      }
    } catch (err) {
      setError(err.message || 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [userId, role, moduleFilter, action, startDate, endDate, debouncedSearch]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white p-6 shadow-md">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-indigo-200 mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>
              {currentUser?.roleCode === 'ADMIN'
                ? 'Full Institutional Governance Audit Trail'
                : 'Faculty & Office Activity Audit Trail'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center space-x-2">
            <ScrollText className="w-6 h-6 text-indigo-400" />
            <span>Audit Log</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {currentUser?.roleCode === 'ADMIN'
              ? 'View chronological activity across all school users including Administrators, Head Teachers, Teachers, and Office Staff.'
              : 'View chronological activity performed by Head Teachers, Teachers, and Office Staff within your school.'}
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action, details, user..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Users</option>
              {(filterOptions.users || []).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullName} ({u.roleCode})
                </option>
              ))}
            </select>

            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Roles</option>
              {(filterOptions.roles || []).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Modules</option>
              {(filterOptions.modules || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Actions</option>
              {(filterOptions.actions || []).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              title="From Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
              title="To Date"
            />
            <button
              type="button"
              onClick={() => fetchLogs(pagination.currentPage)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User &amp; Role</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-500">Loading audit logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-500">No audit records match the selected filters.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {l.performedAt ? new Date(l.performedAt).toLocaleString('en-GB') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{l.performedByName}</div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                          {l.performedByRole}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                          {l.module}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-800">{l.action}</td>
                      <td className="py-3 px-4 text-slate-700 max-w-md">{l.details}</td>
                      <td className="py-3 px-4 text-right">
                        {(l.previousValue || l.newValue) ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLog(l)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" /><span>Inspect</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100">
              <AdminPagination pagination={pagination} onPageChange={(p) => fetchLogs(p)} />
            </div>
          )}
        </div>

        <AdminModal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={selectedLog ? `Audit Detail: ${selectedLog.action}` : ''}
        >
          {selectedLog && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p><strong>Performed By:</strong> {selectedLog.performedByName} ({selectedLog.performedByRole})</p>
                <p><strong>Module / Entity:</strong> {selectedLog.module} {selectedLog.entityType ? `• ${selectedLog.entityType}` : ''}</p>
                <p><strong>Details:</strong> {selectedLog.details}</p>
              </div>
              {selectedLog.previousValue && (
                <div>
                  <p className="font-bold text-slate-700 mb-1">Previous Value</p>
                  <pre className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl overflow-x-auto text-[11px] text-rose-900">
                    {JSON.stringify(selectedLog.previousValue, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.newValue && (
                <div>
                  <p className="font-bold text-slate-700 mb-1">New Value</p>
                  <pre className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl overflow-x-auto text-[11px] text-emerald-900">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogPage;
