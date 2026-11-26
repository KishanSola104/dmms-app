import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { Send, Users, CheckCircle2, AlertCircle, RefreshCw, History } from 'lucide-react';

const HeadTeacherSendNotificationsPage = () => {
  const [recipients, setRecipients] = useState([]);
  const [history, setHistory] = useState([]);

  const [recipientMode, setRecipientMode] = useState('ROLE'); // 'ROLE' | 'USERS'
  const [targetRoleCode, setTargetRoleCode] = useState('TEACHER'); // 'TEACHER' | 'OFFICE_STAFF' | 'ALL_STAFF'
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');

  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, histRes] = await Promise.all([
        api.get('/head-teacher/notifications/recipients'),
        api.get('/head-teacher/notifications/sent?limit=15')
      ]);
      if (recRes.success) setRecipients(recRes.recipients || []);
      if (histRes.success) setHistory(histRes.history || []);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load recipients or history.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleUserSelection = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    if (!title.trim() || !message.trim()) {
      setFeedback({ type: 'error', message: 'Title and message are required.' });
      return;
    }
    if (recipientMode === 'USERS' && selectedUserIds.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one recipient.' });
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/head-teacher/notifications/send', {
        title: title.trim(),
        message: message.trim(),
        type,
        recipientMode,
        targetRoleCode,
        targetUserIds: recipientMode === 'USERS' ? selectedUserIds : []
      });
      setFeedback({ type: 'success', message: res.message || 'Notification sent successfully.' });
      setTitle('');
      setMessage('');
      setSelectedUserIds([]);
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send notification.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl text-white p-6 shadow-md">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-emerald-200 mb-2">
            <Send className="w-3.5 h-3.5" />
            <span>Head Teacher Broadcast &amp; Messaging</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Send Notifications</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Dispatch targeted notices to Teachers and Office Staff strictly within your school.
          </p>
        </div>

        {feedback.message && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Compose Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>Compose School Notification</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Mode</label>
                <select
                  value={recipientMode}
                  onChange={(e) => setRecipientMode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ROLE">By Role Group</option>
                  <option value="USERS">Specific Users</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority / Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="info">Information</option>
                  <option value="success">Success / Published</option>
                  <option value="warning">Warning / Deadline</option>
                  <option value="alert">Urgent Alert</option>
                </select>
              </div>
            </div>

            {recipientMode === 'ROLE' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Role</label>
                <select
                  value={targetRoleCode}
                  onChange={(e) => setTargetRoleCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="TEACHER">All Teachers</option>
                  <option value="OFFICE_STAFF">All Office Staff</option>
                  <option value="ALL_STAFF">All Teachers &amp; Office Staff</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select School Staff ({selectedUserIds.length} selected)
                </label>
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                  {recipients.map((u) => (
                    <label
                      key={u._id}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u._id)}
                          onChange={() => toggleUserSelection(u._id)}
                        />
                        <span className="font-semibold text-slate-900">{u.fullName}</span>
                        <span className="text-slate-400">({u.userId})</span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700">
                        {u.roleCode}
                      </span>
                    </label>
                  ))}
                  {recipients.length === 0 && (
                    <p className="text-xs text-slate-500 p-3 text-center">No active Teachers or Office Staff found.</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notification Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Marks Entry Deadline Reminder"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write clear instructions for your school staff..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Sending...' : 'Send Notification'}</span>
            </button>
          </form>

          {/* Sent History */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Sent Notifications History</span>
              </h2>
              <button
                type="button"
                onClick={loadData}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span>
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center bg-slate-50 rounded-xl">
                No notifications sent yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {history.map((h) => (
                  <div key={h.batchId} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{h.title}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                        {h.type}
                      </span>
                    </div>
                    <p className="text-slate-700">{h.message}</p>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>Recipients: {h.recipientCount} (Read: {h.readCount})</span>
                      </span>
                      <span>{h.sentAt ? new Date(h.sentAt).toLocaleString('en-GB') : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherSendNotificationsPage;
