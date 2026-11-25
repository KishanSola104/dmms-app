import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../../context/UserAuthContext';
import { useSchoolAuth } from '../../context/SchoolAuthContext';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  BookOpen,
  Layers,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Building2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  ArrowRight
} from 'lucide-react';

const HeadTeacherDashboard = () => {
  const { currentUser } = useUserAuth();
  const { currentSchool } = useSchoolAuth();
  const { selectedYear } = useAcademicYear();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedClassId, setExpandedClassId] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
      const res = await api.get(`/head-teacher/dashboard${yearQuery}`);
      if (res.success) {
        setDashboardData(res);
      }
    } catch (err) {
      console.error('[HeadTeacherDashboard] Fetch error:', err);
      setError(err.message || 'Failed to load Head Teacher dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear]);

  const toggleClassExpand = (classId) => {
    setExpandedClassId(prev => (prev === classId ? null : classId));
  };

  // 6 Metric Cards definition
  const statCards = [
    {
      title: 'Total Students',
      value: dashboardData?.stats?.totalStudents ?? 0,
      description: 'Active enrollments in session',
      icon: Users,
      color: 'blue',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-600',
      ringClass: 'ring-blue-100'
    },
    {
      title: 'Total Teachers',
      value: dashboardData?.stats?.totalTeachers ?? 0,
      description: 'Active faculty members',
      icon: GraduationCap,
      color: 'purple',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-600',
      ringClass: 'ring-purple-100'
    },
    {
      title: 'Total Classes',
      value: dashboardData?.stats?.totalClasses ?? 0,
      description: 'Configured academic grades',
      icon: BookOpen,
      color: 'indigo',
      bgClass: 'bg-indigo-50',
      textClass: 'text-indigo-600',
      ringClass: 'ring-indigo-100'
    },
    {
      title: 'Total Sections',
      value: dashboardData?.stats?.totalSections ?? 0,
      description: 'Active classroom divisions',
      icon: Layers,
      color: 'emerald',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-600',
      ringClass: 'ring-emerald-100'
    },
    {
      title: 'Total Subjects',
      value: dashboardData?.stats?.totalSubjects ?? 0,
      description: 'Active curriculum subjects',
      icon: FileText,
      color: 'amber',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-600',
      ringClass: 'ring-amber-100'
    },
    {
      title: 'Active Assignments',
      value: dashboardData?.stats?.totalActiveTeacherAssignments ?? 0,
      description: 'Subject-teacher pairings',
      icon: CheckCircle2,
      color: 'teal',
      bgClass: 'bg-teal-50',
      textClass: 'text-teal-600',
      ringClass: 'ring-teal-100'
    }
  ];

  const gaps = dashboardData?.academicOverview?.assignmentGaps;
  const hasGaps =
    (gaps?.classesWithoutClassTeacherCount || 0) > 0 ||
    (gaps?.sectionsWithoutSectionTeacherCount || 0) > 0 ||
    (gaps?.subjectsWithoutAssignmentsCount || 0) > 0;

  const subjectDist = dashboardData?.academicOverview?.subjectDistribution;
  const totalSubCount = (subjectDist?.academic || 0) + (subjectDist?.coCurricular || 0);
  const academicPct = totalSubCount > 0 ? Math.round((subjectDist.academic / totalSubCount) * 100) : 0;
  const coCurrPct = totalSubCount > 0 ? 100 - academicPct : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 backdrop-blur-xs rounded-full text-xs font-medium text-purple-200 mb-3 border border-white/10">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Head Teacher Academic Portal &bull; Supervision &amp; Monitoring</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {currentUser?.fullName || currentUser?.userId}!
          </h1>

          <p className="text-sm sm:text-base text-slate-200 mt-1 max-w-2xl opacity-90">
            Academic structure, faculty oversight, and curriculum distribution for{' '}
            <span className="font-semibold">{currentSchool?.schoolName}</span> ({currentSchool?.schoolId})
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-purple-100">
            <div className="flex items-center space-x-1.5 bg-black/25 px-3 py-1.5 rounded-lg border border-white/10">
              <Calendar className="w-3.5 h-3.5 text-purple-300" />
              <span>
                Active Session:{' '}
                <strong>{dashboardData?.selectedAcademicYear?.yearCode || selectedYear?.yearCode || 'N/A'}</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1.5 bg-black/25 px-3 py-1.5 rounded-lg border border-white/10">
              <Building2 className="w-3.5 h-3.5 text-blue-300" />
              <span>
                Role: <strong>Head Teacher (Academic Supervisor)</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1.5 bg-black/25 px-3 py-1.5 rounded-lg border border-white/10">
              <Info className="w-3.5 h-3.5 text-emerald-300" />
              <span>Access Level: <strong>Read-Only Monitoring</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading Academic Overview &amp; Statistics...</p>
          <p className="text-xs text-slate-500 mt-1">Retrieving verified school records for session {selectedYear?.yearCode}</p>
        </div>
      ) : error ? (
        /* Error State */
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-900 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold">Failed to load academic records</h3>
              <p className="text-xs mt-1 text-rose-700">{error}</p>
              <button
                onClick={fetchDashboardData}
                className="mt-3 inline-flex items-center px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 2. Dashboard Statistics Cards (Section 3.1) */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Institutional Statistics &bull; Session {dashboardData?.selectedAcademicYear?.yearCode}
              </h2>
              <span className="text-[11px] text-slate-400">
                Updated in real-time from active records
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {statCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 truncate">{card.title}</span>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.bgClass} ${card.textClass} ring-4 ${card.ringClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{card.value}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{card.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Academic Attention & Assignment Summary Alert Banner (Section 3.2) */}
          {hasGaps ? (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-950">
                      Academic Assignment Attention Needed
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-md">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    The following responsibilities or allocations are unassigned for the active academic structure:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    {/* Classes without Class Teacher */}
                    <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs">
                      <p className="font-semibold text-slate-700">
                        Classes Without Class Teacher:{' '}
                        <strong className="text-amber-800">{gaps?.classesWithoutClassTeacherCount || 0}</strong>
                      </p>
                      {gaps?.classesWithoutClassTeacher?.length > 0 ? (
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {gaps.classesWithoutClassTeacher.map(c => c.className).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-600 mt-1 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> All classes assigned
                        </p>
                      )}
                    </div>

                    {/* Sections without Section Teacher */}
                    <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs">
                      <p className="font-semibold text-slate-700">
                        Sections Without Section Teacher:{' '}
                        <strong className="text-amber-800">{gaps?.sectionsWithoutSectionTeacherCount || 0}</strong>
                      </p>
                      {gaps?.sectionsWithoutSectionTeacher?.length > 0 ? (
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {gaps.sectionsWithoutSectionTeacher.map(s => `${s.className} (${s.sectionName})`).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-600 mt-1 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> All sections assigned
                        </p>
                      )}
                    </div>

                    {/* Subjects without Active Teacher Assignment */}
                    <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs">
                      <p className="font-semibold text-slate-700">
                        Subjects Lacking Teacher Assignment:{' '}
                        <strong className="text-amber-800">{gaps?.subjectsWithoutAssignmentsCount || 0}</strong>
                      </p>
                      {gaps?.subjectsWithoutAssignments?.length > 0 ? (
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          {gaps.subjectsWithoutAssignments.map(s => s.subjectName).join(', ')}
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-600 mt-1 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> All subjects assigned
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 shadow-xs flex items-center space-x-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Faculty Assignments Complete:</span> All active classes, sections, and subjects have designated faculty assigned for session {dashboardData?.selectedAcademicYear?.yearCode}.
              </div>
            </div>
          )}

          {/* 4. Academic Structure Summary Section (Section 3.2) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 4.1 Class-wise & Section-wise Student Strength */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Class &amp; Section Student Strength</h2>
                    <p className="text-xs text-slate-500">
                      Enrollment density and classroom capacity for session {dashboardData?.selectedAcademicYear?.yearCode}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                  {dashboardData?.academicOverview?.classStrength?.length || 0} Classes Active
                </span>
              </div>

              {/* Class listing with capacity bars */}
              <div className="space-y-4">
                {dashboardData?.academicOverview?.classStrength?.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No active classes found for this school.
                  </div>
                ) : (
                  dashboardData?.academicOverview?.classStrength?.map((cls) => {
                    const isExpanded = expandedClassId === cls._id;
                    const occupancy = cls.totalCapacity > 0 ? Math.min(100, Math.round((cls.studentCount / cls.totalCapacity) * 100)) : 0;

                    return (
                      <div
                        key={cls._id}
                        className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors"
                      >
                        {/* Class Summary Row */}
                        <div
                          onClick={() => toggleClassExpand(cls._id)}
                          className="p-4 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 p-1"
                              title="Toggle section details"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-sm font-bold text-slate-900">{cls.className}</h3>
                                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  {cls.classCode}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Class Teacher: <span className="font-medium text-slate-700">{cls.classTeacherName}</span> &bull; {cls.numberOfSections} Section(s)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 sm:justify-end">
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-900">
                                {cls.studentCount} / {cls.totalCapacity || '—'}
                              </p>
                              <p className="text-[10px] text-slate-400">Students / Capacity</p>
                            </div>

                            {/* Occupancy bar */}
                            <div className="w-24 sm:w-32">
                              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                <span>Occupancy</span>
                                <span>{occupancy}%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    occupancy > 90
                                      ? 'bg-rose-500'
                                      : occupancy > 70
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${occupancy}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Section Details */}
                        {isExpanded && (
                          <div className="p-4 bg-white border-t border-slate-200 space-y-2 animate-in fade-in duration-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                              Section-Wise Breakdown ({cls.sections?.length || 0} Sections)
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">Section</th>
                                    <th className="py-2 px-3">Section Teacher</th>
                                    <th className="py-2 px-3 text-center">Enrolled</th>
                                    <th className="py-2 px-3 text-center">Capacity</th>
                                    <th className="py-2 px-3 text-center">Available Seats</th>
                                    <th className="py-2 px-3 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {cls.sections?.length > 0 ? (
                                    cls.sections.map(sec => (
                                      <tr key={sec._id} className="hover:bg-slate-50/50">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                                          {sec.sectionName}{' '}
                                          <span className="font-mono text-[10px] text-slate-400">
                                            ({sec.sectionCode})
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {sec.sectionTeacherName}
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                                          {sec.studentCount}
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-slate-600">
                                          {sec.maxCapacity}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span
                                            className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                                              sec.availableCapacity > 5
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : sec.availableCapacity > 0
                                                ? 'bg-amber-50 text-amber-700'
                                                : 'bg-rose-50 text-rose-700'
                                            }`}
                                          >
                                            {sec.availableCapacity} seats
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                                            {sec.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="6" className="py-3 text-center text-slate-400">
                                        No sections configured for this class.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4.2 Subject Distribution & Academic Curriculum */}
            <div className="lg:col-span-4 space-y-6">
              {/* Subject Distribution Card */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Subject Distribution</h3>
                      <p className="text-xs text-slate-500">Curricular categorization</p>
                    </div>
                  </div>
                </div>

                {/* Proportion bar */}
                <div className="space-y-3">
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-indigo-600 h-full transition-all"
                      style={{ width: `${academicPct}%` }}
                      title={`Academic: ${academicPct}%`}
                    ></div>
                    <div
                      className="bg-purple-500 h-full transition-all"
                      style={{ width: `${coCurrPct}%` }}
                      title={`Co-curricular: ${coCurrPct}%`}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                      <div className="flex items-center space-x-1.5 text-indigo-700 text-xs font-semibold">
                        <span className="w-2.5 h-2.5 bg-indigo-600 rounded-sm"></span>
                        <span>Academic</span>
                      </div>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">
                        {subjectDist?.academic ?? 0}
                      </p>
                      <p className="text-[10px] text-slate-500">{academicPct}% of total</p>
                    </div>

                    <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl">
                      <div className="flex items-center space-x-1.5 text-purple-700 text-xs font-semibold">
                        <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm"></span>
                        <span>Co-curricular</span>
                      </div>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">
                        {subjectDist?.coCurricular ?? 0}
                      </p>
                      <p className="text-[10px] text-slate-500">{coCurrPct}% of total</p>
                    </div>
                  </div>
                </div>

                {/* Subject Pills */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                    Active Subject Directory ({subjectDist?.subjects?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {subjectDist?.subjects?.map(s => (
                      <span
                        key={s._id}
                        className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium border ${
                          s.subjectType === 'ACADEMIC'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                        title={`${s.subjectName} (${s.subjectCode})`}
                      >
                        <span className="font-semibold">{s.subjectName}</span>
                        <span className="ml-1 font-mono text-[9px] opacity-70">[{s.subjectCode}]</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Navigation Links */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Academic Overview Modules
                </h3>
                <div className="space-y-2">
                  <Link
                    to="/head-teacher/classes"
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span>Classes &amp; Sections</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>

                  <Link
                    to="/head-teacher/subjects"
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>Subject Overview</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>

                  <Link
                    to="/head-teacher/teachers"
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      <span>Teacher Overview</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>

                  <Link
                    to="/head-teacher/teacher-assignments"
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Teacher Assignments</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>

                  <Link
                    to="/head-teacher/result-approval"
                    className="flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-semibold text-purple-800 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      <span>Result Review &amp; Publish</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Recent Academic Information (Section 3.3) */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Recent Academic Activity &amp; Setup</h2>
                  <p className="text-xs text-slate-500">
                    Latest configured academic entities and faculty assignments
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Recent Classes */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  <span>Recent Classes Added</span>
                </h3>
                <div className="space-y-2">
                  {dashboardData?.recentActivity?.classes?.length > 0 ? (
                    dashboardData.recentActivity.classes.map(c => (
                      <div key={c._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900">{c.className}</p>
                          <span className="font-mono text-[10px] text-slate-500">{c.classCode}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Teacher: <span className="text-slate-700">{c.classTeacherName}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Added: {formatDate(c.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No recent classes recorded.</p>
                  )}
                </div>
              </div>

              {/* Recent Subjects */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                  <span>Recent Subjects Added</span>
                </h3>
                <div className="space-y-2">
                  {dashboardData?.recentActivity?.subjects?.length > 0 ? (
                    dashboardData.recentActivity.subjects.map(s => (
                      <div key={s._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900">{s.subjectName}</p>
                          <span className="font-mono text-[10px] text-slate-500">{s.subjectCode}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] font-medium text-slate-600">
                            Type: {s.subjectType}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(s.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No recent subjects recorded.</p>
                  )}
                </div>
              </div>

              {/* Recent Teacher Assignments */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  <span>Recent Teacher Assignments</span>
                </h3>
                <div className="space-y-2">
                  {dashboardData?.recentActivity?.teacherAssignments?.length > 0 ? (
                    dashboardData.recentActivity.teacherAssignments.map(a => (
                      <div key={a._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                        <p className="font-bold text-slate-900">{a.teacherName}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {a.subjectName} &bull; {a.className} ({a.sectionName})
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Assigned: {formatDate(a.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No assignments for this academic session yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeadTeacherDashboard;
