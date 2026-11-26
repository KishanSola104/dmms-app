import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../../context/UserAuthContext';
import { useSchoolAuth } from '../../context/SchoolAuthContext';
import { useAcademicYear } from '../../context/AcademicYearContext';
import StatusBadge from '../admin/StatusBadge';
import api from '../../services/api';
import {
  Layers,
  BookOpen,
  Clock,
  CheckCircle2,
  ListChecks,
  FileCheck2,
  Calendar,
  RefreshCw,
  AlertCircle,
  Edit3,
  Award,
  Activity,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

const TeacherDashboard = () => {
  const { currentUser } = useUserAuth();
  const { currentSchool } = useSchoolAuth();
  const { selectedYear } = useAcademicYear();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const q = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
      const res = await api.get(`/teacher/dashboard${q}`);
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load teacher dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedYear?._id]);

  const cards = data?.summaryCards || {};
  const isClassTeacher = !!data?.access?.hasClassTeacherAssignments;

  const summaryCardList = [
    {
      title: 'Assigned Classes/Sections',
      value: cards.totalAssignedClassesSections ?? 0,
      icon: Layers,
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      ring: 'ring-blue-100'
    },
    {
      title: 'Assigned Subjects',
      value: cards.totalAssignedSubjects ?? 0,
      icon: BookOpen,
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      ring: 'ring-emerald-100'
    },
    {
      title: 'Pending Marks Entry',
      value: cards.pendingMarksEntry ?? 0,
      icon: Clock,
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      ring: 'ring-amber-100'
    },
    {
      title: 'Submitted Marks',
      value: cards.submittedMarks ?? 0,
      icon: CheckCircle2,
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      ring: 'ring-indigo-100'
    },
    ...(isClassTeacher
      ? [
          {
            title: 'Pending Verification',
            value: cards.pendingMarksVerification ?? 0,
            icon: ListChecks,
            bg: 'bg-purple-50',
            text: 'text-purple-600',
            ring: 'ring-purple-100'
          },
          {
            title: 'Generated Exam Results',
            value: cards.generatedExaminationResults ?? 0,
            icon: FileCheck2,
            bg: 'bg-teal-50',
            text: 'text-teal-600',
            ring: 'ring-teal-100'
          }
        ]
      : [])
  ];

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-linear-to-r from-emerald-700 via-teal-700 to-slate-900 rounded-2xl text-white p-6 sm:p-7 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-emerald-100 mb-2 border border-white/10">
            <span>
              {currentUser?.roleCode === 'HEAD_TEACHER'
                ? 'Head Teacher • Teaching Responsibilities'
                : 'Teacher Teaching & Assessment Portal'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {currentUser?.fullName || currentUser?.userId}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 mt-1">
            {currentSchool?.schoolName} ({currentSchool?.schoolId}) &bull; Session:{' '}
            <strong>{selectedYear?.yearName || selectedYear?.yearCode || 'N/A'}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isClassTeacher && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-amber-300" />
              Class Teacher Assigned ({data?.classTeacherSections?.length})
            </span>
          )}
          <button
            type="button"
            onClick={fetchDashboard}
            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to load dashboard</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCardList.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{card.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '—' : card.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${card.bg} ${card.text} ring-4 ${card.ring}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Work Overview Banner & Clickable Tasks */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span>Pending Marks-Entry Work</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any pending, draft, or returned task below to open its exact marks-entry sheet immediately.
            </p>
          </div>
          {data?.pendingWorkSummary && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
                Assigned: {data.pendingWorkSummary.totalAssignedTasks ?? 0}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                Submitted: {data.pendingWorkSummary.submittedTasks ?? 0}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                Pending: {data.pendingWorkSummary.pendingTasks ?? 0}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                Returned: {data.pendingWorkSummary.returnedTasks ?? 0}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 font-semibold">
                Locked: {data.pendingWorkSummary.lockedTasks ?? 0}
              </span>
            </div>
          )}
        </div>

        {(data?.pendingTasks || []).length === 0 ? (
          <div className="p-5 text-center bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800">
            All open assigned marks-entry tasks are currently submitted or completed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {data.pendingTasks.map((task, idx) => (
              <Link
                key={`${task.examinationId || 'EXTRA'}_${task.classId}_${task.sectionId}_${task.subjectId}_${idx}`}
                to={task.targetRoute || '/teacher/marks-entry'}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-3 text-xs bg-slate-50/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 truncate">{task.subjectName}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-200 text-slate-700 rounded">
                      {task.marksEntryType}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5 truncate">
                    {task.examinationName} &bull; {task.className} - {task.sectionName}
                  </p>
                  <p className="text-[11px] font-semibold text-blue-700 mt-1">{task.pendingAction}</p>
                </div>
                <div className="flex flex-col items-end space-y-1 shrink-0">
                  <StatusBadge status={task.submissionStatus || 'PENDING'} />
                  <span className="text-[10px] text-slate-500">
                    {task.enteredCount}/{task.totalStudents} entered
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* A. My Teaching Assignments */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">My Teaching Assignments</h2>
            </div>
            <Link
              to="/teacher/my-classes"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center"
            >
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-6 text-center">Loading assignments...</p>
          ) : (data?.teachingAssignments || []).length === 0 && (data?.classTeacherSections || []).length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              No teaching or class-teacher assignments found for the selected academic year.
            </div>
          ) : (
            <div className="space-y-2.5">
              {(data?.classTeacherSections || []).map((sec) => (
                <div
                  key={`ct-${sec._id}`}
                  className="p-3 rounded-xl bg-purple-50/60 border border-purple-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {sec.className} - {sec.sectionName}
                    </p>
                    <p className="text-purple-700 font-medium mt-0.5">Class Teacher Responsibility</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    CLASS TEACHER
                  </span>
                </div>
              ))}

              {(data?.teachingAssignments || []).map((a) => (
                <div
                  key={a._id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {a.subjectName}{' '}
                      <span className="font-mono text-[10px] text-slate-500">({a.subjectCode})</span>
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      {a.className} - {a.sectionName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.subjectType} />
                    <Link
                      to={a.subjectType === 'CO_CURRICULAR' ? '/teacher/co-curricular-grades' : '/teacher/marks-entry'}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold border border-blue-200"
                    >
                      Enter
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* B. Upcoming Examinations */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Upcoming &amp; Active Examinations</h2>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-6 text-center">Loading examinations...</p>
          ) : (data?.upcomingExaminations || []).length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              No upcoming or ongoing examinations for your assigned classes.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.upcomingExaminations.map((ex) => (
                <div
                  key={ex._id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{ex.examinationName}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                        {ex.examinationCode}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-1">
                      {formatDate(ex.startDate)} &rarr; {formatDate(ex.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={ex.status} />
                </div>
              ))}
            </div>
          )}

          {/* Quick Links */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
            <Link
              to="/teacher/marks-entry"
              className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-center"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Marks Entry
            </Link>
            <Link
              to={isClassTeacher ? '/teacher/marks-verification' : '/teacher/submitted-marks'}
              className="p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-800 flex items-center justify-center"
            >
              <Award className="w-3.5 h-3.5 mr-1.5" /> {isClassTeacher ? 'Verify Marks' : 'Submitted Marks'}
            </Link>
          </div>
        </div>
      </div>

      {/* C. Marks Entry Progress & D. Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Marks Entry Progress</h2>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                Pending: {data?.marksEntryProgress?.pending ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                Draft: {data?.marksEntryProgress?.draft ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">
                Returned: {data?.marksEntryProgress?.returned ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                Completed: {(data?.marksEntryProgress?.submitted ?? 0) + (data?.marksEntryProgress?.verified ?? 0)}
              </span>
            </div>
          </div>

          {(data?.marksEntryProgress?.items || []).length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              No examination marks-entry tasks scheduled yet for your assigned subjects.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {data.marksEntryProgress.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.examinationName} &bull; {item.subjectName}
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      {item.className} - {item.sectionName}
                    </p>
                    {item.returnReason && (
                      <p className="text-rose-600 text-[11px] mt-0.5">Reason: {item.returnReason}</p>
                    )}
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Recent Activities</h2>
          </div>

          {(data?.recentActivities || []).length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              No marks submission, verification, or result activities recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {data.recentActivities.map((act) => (
                <div key={act._id} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{act.action.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.performedAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-slate-600">{act.details}</p>
                  <p className="text-[11px] text-slate-400">By: {act.performedByName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
