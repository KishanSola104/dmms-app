import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPagination from '../../components/admin/AdminPagination';
import api from '../../services/api';
import { Bell, CheckCheck, RefreshCw, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

const HeadTeacherNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        type: typeFilter,
        unreadOnly: unreadOnly ? 'true' : 'false'
      });
      const res = await api.get(`/head-teacher/notifications?${params.toString()}`);
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 20 });
      }
    } catch (err) {
      setError(err.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1);
  }, [typeFilter, unreadOnly]);

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/common/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err.message || 'Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/common/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || 'Failed to mark notifications as read.');
    }
  };

  const getTypeIcon = (type) => {
    if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    if (type === 'alert') return <AlertCircle className="w-4 h-4 text-rose-600" />;
    return <Info className="w-4 h-4 text-blue-600" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-sky-950 to-slate-900 rounded-2xl text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-sky-200 mb-2">
              <Bell className="w-3.5 h-3.5" />
              <span>Head Teacher Notifications Inbox</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Review result submission alerts, teacher updates, and school announcements.
            </p>
          </div>
          <span className="px-3.5 py-1.5 bg-white/10 rounded-xl text-xs font-bold self-start sm:self-auto">
            Unread: {unreadCount}
          </span>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Types</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="alert">Alert</option>
            </select>
            <button
              type="button"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                unreadOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {unreadOnly ? 'Showing Unread Only' : 'Show Unread Only'}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /><span>Mark All Read</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchNotifications(pagination.currentPage)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-xs text-slate-500">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-xs text-slate-500">No notifications found.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${
                  n.isRead ? 'bg-white border-slate-200' : 'bg-blue-50/60 border-blue-200 shadow-xs'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 shrink-0 mt-0.5">{getTypeIcon(n.type)}</div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
                      {!n.isRead && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-600 text-white rounded-full">New</span>
                      )}
                      {n.sentByName && (
                        <span className="text-[11px] text-slate-500">From: {n.sentByName} ({n.sentByRole || 'System'})</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                    <p className="text-[11px] text-slate-400">{n.createdAt ? new Date(n.createdAt).toLocaleString('en-GB') : ''}</p>
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n._id)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 rounded-lg shrink-0"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {pagination.totalPages > 1 && (
          <AdminPagination pagination={pagination} onPageChange={(p) => fetchNotifications(p)} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherNotificationsPage;
