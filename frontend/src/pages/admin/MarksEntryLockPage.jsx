import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useUserAuth } from '../../context/UserAuthContext';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Lock,
  Unlock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';

const MarksEntryLockPage = () => {
  const { currentUser } = useUserAuth();
  const { selectedYear } = useAcademicYear();
  const basePath = currentUser?.roleCode === 'HEAD_TEACHER' ? '/head-teacher/marks-lock' : '/admin/marks-lock';

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [examinationId, setExaminationId] = useState('ALL');
  const [classId, setClassId] = useState('ALL');
  const [sectionId, setSectionId] = useState('ALL');
  const [subjectId, setSubjectId] = useState('ALL');
  const [lockStatus, setLockStatus] = useState('ALL');

  const [overview, setOverview] = useState({
    availableAcademicYears: [],
    classes: [],
    sections: [],
    examinations: [],
    subjects: [],
    summary: { totalTasks: 0, openCount: 0, lockedCount: 0, submittedCount: 0, verifiedCount: 0 },
    items: []
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
      setExaminationId('ALL');
    }
  }, [selectedYear?._id]);

  const fetchOverview = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (examinationId !== 'ALL') params.append('examinationId', examinationId);
      if (classId !== 'ALL') params.append('classId', classId);
      if (sectionId !== 'ALL') params.append('sectionId', sectionId);
      if (subjectId !== 'ALL') params.append('subjectId', subjectId);
      if (lockStatus !== 'ALL') params.append('lockStatus', lockStatus);

      const res = await api.get(`${basePath}?${params.toString()}`);
      if (res.success) {
        setOverview(res);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load marks lock overview.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [academicYearId, examinationId, classId, sectionId, subjectId, lockStatus]);

  const executeLockAction = async ({ action, scopeItem = null }) => {
    setUpdating(true);
    setFeedback({ type: '', message: '' });
    try {
      const payload = scopeItem
        ? {
            action,
            academicYearId: scopeItem.academicYearId || academicYearId,
            examinationId: scopeItem.examinationId ? String(scopeItem.examinationId) : 'NONE',
            classId: String(scopeItem.classId),
            sectionId: String(scopeItem.sectionId),
            subjectId: String(scopeItem.subjectId),
            entryType: scopeItem.entryType,
            reason: reason.trim()
          }
        : {
            action,
            academicYearId,
            examinationId,
            classId,
            sectionId,
            subjectId,
            entryType: 'ALL',
            reason: reason.trim()
          };

      const res = await api.post(`${basePath}/update`, payload);
      setFeedback({
        type: 'success',
        message: res.message || `Marks entry ${action === 'LOCK' ? 'locked' : 'opened'} successfully.`
      });
      setReason('');
      await fetchOverview();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update marks entry lock state.' });
    } finally {
      setUpdating(false);
    }
  };

  const filteredSections = classId === 'ALL'
    ? overview.sections || []
    : (overview.sections || []).filter((s) => String(s.classRef) === String(classId));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-amber-950 to-slate-900 rounded-2xl text-white p-6 shadow-md">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-amber-200 mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Marks Governance &amp; Lock Controls</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Marks Entry Lock Controls</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Open, reopen, or lock marks entry at Examination, Class, Section, or Subject scope.
            {currentUser?.roleCode === 'HEAD_TEACHER' &&
              ' Note: Records locked by a School Administrator can only be reopened by an Administrator.'}
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-slate-500">Total Scopes</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{overview.summary?.totalTasks ?? 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-emerald-600">Open (Editable)</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">{overview.summary?.openCount ?? 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-rose-600">Locked</p>
            <p className="text-2xl font-extrabold text-rose-700 mt-1">{overview.summary?.lockedCount ?? 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-blue-600">Submitted</p>
            <p className="text-2xl font-extrabold text-blue-700 mt-1">{overview.summary?.submittedCount ?? 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-indigo-600">Verified</p>
            <p className="text-2xl font-extrabold text-indigo-700 mt-1">{overview.summary?.verifiedCount ?? 0}</p>
          </div>
        </div>

        {/* Scope Filters & Bulk Controls */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <select
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setExaminationId('ALL');
              }}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {(overview.availableAcademicYears || []).map((y) => (
                <option key={y._id} value={y._id}>{y.yearName || y.yearCode}</option>
              ))}
            </select>

            <select
              value={examinationId}
              onChange={(e) => setExaminationId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Examinations</option>
              <option value="NONE">Extra / Project Components</option>
              {(overview.examinations || []).map((ex) => (
                <option key={ex._id} value={ex._id}>{ex.examinationName}</option>
              ))}
            </select>

            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId('ALL');
              }}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Classes</option>
              {(overview.classes || []).map((c) => (
                <option key={c._id} value={c._id}>{c.className}</option>
              ))}
            </select>

            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Sections</option>
              {filteredSections.map((s) => (
                <option key={s._id} value={s._id}>{s.sectionName}</option>
              ))}
            </select>

            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Subjects</option>
              {(overview.subjects || []).map((s) => (
                <option key={s._id} value={s._id}>{s.subjectName}</option>
              ))}
            </select>

            <select
              value={lockStatus}
              onChange={(e) => setLockStatus(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Lock States</option>
              <option value="OPEN">Open Only</option>
              <option value="LOCKED">Locked Only</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional lock/reopen reason (recorded in audit log & teacher alert)..."
              className="flex-1 min-w-60 px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              disabled={updating || loading || (overview.items || []).length === 0}
              onClick={() => executeLockAction({ action: 'LOCK' })}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg flex items-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Filtered Scope</span>
            </button>
            <button
              type="button"
              disabled={updating || loading || (overview.items || []).length === 0}
              onClick={() => executeLockAction({ action: 'OPEN' })}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg flex items-center space-x-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Open Filtered Scope</span>
            </button>
            <button
              type="button"
              onClick={fetchOverview}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Scope Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-3 px-4">Examination / Scope</th>
                  <th className="py-3 px-4">Class &amp; Section</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Assigned Teacher</th>
                  <th className="py-3 px-4 text-center">Submission Status</th>
                  <th className="py-3 px-4 text-center">Lock State</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-500">Loading marks entry targets...</td></tr>
                ) : (overview.items || []).length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-500">No marks entry targets match the selected filters.</td></tr>
                ) : (
                  overview.items.map((item) => {
                    const blockedForHT =
                      currentUser?.roleCode === 'HEAD_TEACHER' && item.isLocked && item.lockedByRole === 'ADMIN';
                    return (
                      <tr key={item.key} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div>{item.examinationName}</div>
                          <span className="text-[10px] font-mono text-slate-500">{item.entryType}</span>
                        </td>
                        <td className="py-3 px-4">{item.className} - {item.sectionName}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{item.subjectName}</td>
                        <td className="py-3 px-4 text-slate-600">{item.assignedTeacherName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {item.submissionStatus}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {item.enteredCount}/{item.totalStudents} entered
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.isLocked ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center space-x-1">
                                <Lock className="w-3 h-3" /><span>LOCKED</span>
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5">By {item.lockedByRole || 'Authority'}</span>
                            </div>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                              <Unlock className="w-3 h-3" /><span>OPEN</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.isLocked ? (
                            blockedForHT ? (
                              <span
                                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
                                title="Locked by Admin. Only School Administrator can reopen."
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Admin Locked</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={updating}
                                onClick={() => executeLockAction({ action: 'OPEN', scopeItem: item })}
                                className="px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center space-x-1"
                              >
                                <Unlock className="w-3 h-3" /><span>Reopen</span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              disabled={updating}
                              onClick={() => executeLockAction({ action: 'LOCK', scopeItem: item })}
                              className="px-3 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg inline-flex items-center space-x-1"
                            >
                              <Lock className="w-3 h-3" /><span>Lock</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MarksEntryLockPage;
