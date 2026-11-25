import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  TrendingUp,
  Award,
  BookOpen,
  Users,
  AlertCircle,
  RefreshCw,
  Loader2,
  BarChart3
} from 'lucide-react';

const TeacherResultPerformancePage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [examinationId, setExaminationId] = useState('ALL');
  const [classId, setClassId] = useState('ALL');
  const [sectionId, setSectionId] = useState('ALL');
  const [subjectId, setSubjectId] = useState('ALL');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('class'); // 'class' | 'subjects'

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const fetchPerformance = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (examinationId !== 'ALL') params.append('examinationId', examinationId);
      if (classId !== 'ALL') params.append('classId', classId);
      if (sectionId !== 'ALL') params.append('sectionId', sectionId);
      if (subjectId !== 'ALL') params.append('subjectId', subjectId);

      const res = await api.get(`/teacher/performance?${params.toString()}`);
      if (res.success) {
        setData(res);
        if (!res.isClassTeacher) {
          setActiveTab('subjects');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load performance analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [academicYearId, examinationId, classId, sectionId, subjectId]);

  const classOptions = useMemo(() => {
    const map = new Map();
    (data?.classTeacherSections || []).forEach(s => map.set(s.classRef, { id: s.classRef, name: s.className }));
    (data?.subjectAssignments || []).forEach(a => map.set(a.classRef, { id: a.classRef, name: a.className }));
    return Array.from(map.values());
  }, [data]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    (data?.classTeacherSections || []).forEach(s => {
      if (classId === 'ALL' || s.classRef === classId) {
        map.set(s._id, { id: s._id, name: `${s.className} - ${s.sectionName}` });
      }
    });
    (data?.subjectAssignments || []).forEach(a => {
      if (classId === 'ALL' || a.classRef === classId) {
        map.set(a.sectionRef, { id: a.sectionRef, name: `${a.className} - ${a.sectionName}` });
      }
    });
    return Array.from(map.values());
  }, [data, classId]);

  const subjectOptions = useMemo(() => {
    const map = new Map();
    (data?.subjectAssignments || []).forEach(a => map.set(a.subjectRef, { id: a.subjectRef, name: `${a.subjectName} (${a.subjectCode})` }));
    return Array.from(map.values());
  }, [data]);

  const cp = data?.classPerformance;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Result &amp; Performance</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data?.isClassTeacher
                ? 'Analyze complete class results, subject averages, and assigned subject performance.'
                : 'View student performance and examination trends for your assigned subjects.'}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPerformance}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg self-start"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            {(data?.availableAcademicYears || []).map((y) => (
              <option key={y._id} value={y._id}>
                {y.yearName || y.yearCode} {y.isCurrent ? '(Active)' : ''}
              </option>
            ))}
          </select>

          <select
            value={examinationId}
            onChange={(e) => setExaminationId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="ALL">All Examinations</option>
            {(data?.examinations || []).map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.examinationName}
              </option>
            ))}
          </select>

          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId('ALL');
            }}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="ALL">All Authorized Classes</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="ALL">All Authorized Sections</option>
            {sectionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="ALL">All Assigned Subjects</option>
            {subjectOptions.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* View Tabs when Class Teacher */}
        {data?.isClassTeacher && (
          <div className="border-b border-slate-200 flex space-x-4">
            <button
              type="button"
              onClick={() => setActiveTab('class')}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'class' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'
              }`}
            >
              Complete Class Performance (Class Teacher)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subjects')}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'subjects' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'
              }`}
            >
              My Assigned Subjects Performance
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading performance analytics...</p>
          </div>
        ) : activeTab === 'class' && cp ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Class Average</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{cp.classAverage}%</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {cp.section?.className} - {cp.section?.sectionName}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Highest Score</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{cp.highestPercentage}%</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Lowest Score</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">{cp.lowestPercentage}%</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Incomplete / Pending</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{cp.incompleteCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Out of {cp.enrolledCount} enrolled students</p>
              </div>
            </div>

            {/* Examination-Wise Summary */}
            {(cp.examinationWiseSummary || []).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                  <h3 className="text-sm font-bold text-slate-900">Examination-Wise Class Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                        <th className="py-2.5 px-4">Examination</th>
                        <th className="py-2.5 px-4 text-center">Students Graded</th>
                        <th className="py-2.5 px-4 text-center">Class Average %</th>
                        <th className="py-2.5 px-4 text-center">Highest %</th>
                        <th className="py-2.5 px-4 text-center">Lowest %</th>
                        <th className="py-2.5 px-4 text-center">Passed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cp.examinationWiseSummary.map((exSum) => (
                        <tr key={exSum.examinationId}>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {exSum.examinationName} ({exSum.examinationCode})
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono">{exSum.studentCount}</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-indigo-700">
                            {exSum.averagePercentage}%
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-emerald-700">
                            {exSum.highestPercentage}%
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-amber-700">
                            {exSum.lowestPercentage}%
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono">{exSum.passCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Subject-Wise Averages */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-indigo-600" />
                Subject-Wise Class Performance
              </h3>
              {(cp.subjectWiseSummary || []).length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No examination results generated yet for subject analytics.</p>
              ) : (
                <div className="space-y-2.5">
                  {cp.subjectWiseSummary.map((sub) => (
                    <div key={sub.subjectId} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-800">
                          {sub.subjectName} ({sub.subjectCode})
                        </span>
                        <span className="text-slate-600">
                          Avg: <strong>{sub.averagePercentage}%</strong> &bull; High: {sub.highestPercentage}% &bull; Low: {sub.lowestPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-indigo-600 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, sub.averagePercentage))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Student-Wise Results Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                <h3 className="text-sm font-bold text-slate-900">
                  {cp.finalResults?.length > 0 ? 'Student-Wise Final Results' : 'Student-Wise Examination Results'}
                </h3>
              </div>
              {(cp.finalResults?.length || cp.examResults?.length || 0) === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No generated results available yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                        <th className="py-2.5 px-4">Roll</th>
                        <th className="py-2.5 px-4">Student</th>
                        <th className="py-2.5 px-4">Exam / Scope</th>
                        <th className="py-2.5 px-4 text-center">Total</th>
                        <th className="py-2.5 px-4 text-center">%</th>
                        <th className="py-2.5 px-4 text-center">Grade</th>
                        <th className="py-2.5 px-4">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(cp.finalResults?.length > 0 ? cp.finalResults : cp.examResults).map((r) => (
                        <tr key={r._id}>
                          <td className="py-2.5 px-4 font-mono">{r.rollNumber || '—'}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{r.studentName}</td>
                          <td className="py-2.5 px-4">{r.examinationName || 'Final Academic Result'}</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold">
                            {r.overallTotalObtained ?? r.totalMarksObtained} / {r.overallMaxMarks ?? r.totalMaximumMarks}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-indigo-700 font-semibold">
                            {r.finalPercentage ?? r.percentage}%
                          </td>
                          <td className="py-2.5 px-4 text-center font-bold">{r.overallGrade}</td>
                          <td className="py-2.5 px-4">
                            <StatusBadge status={r.resultStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Subject Teacher Scoped Performance */
          <div className="space-y-4">
            {(data?.subjectPerformance || []).length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                No subject performance records available for the selected filters.
              </div>
            ) : (
              data.subjectPerformance.map((sp) => (
                <div key={sp.assignmentId} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {sp.subjectName} ({sp.subjectCode})
                      </h3>
                      <p className="text-xs text-slate-500">
                        {sp.className} - {sp.sectionName}
                      </p>
                    </div>
                    <StatusBadge status={sp.subjectType} />
                  </div>

                  {sp.examBreakdowns.length === 0 ? (
                    <p className="text-xs text-slate-500">No marks or grades entered yet for this assignment.</p>
                  ) : (
                    <div className="space-y-4">
                      {sp.examBreakdowns.map((eb) => (
                        <div key={eb.examinationId} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
                            <span className="font-bold text-slate-800">{eb.examinationName}</span>
                            {sp.subjectType === 'ACADEMIC' && (
                              <span className="text-slate-600">
                                Average: <strong>{eb.averagePercentage}%</strong> &bull; Highest: <strong>{eb.highestMarks}</strong> &bull; Lowest: <strong>{eb.lowestMarks}</strong>
                              </span>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                                  <th className="py-2 px-3">Roll</th>
                                  <th className="py-2 px-3">Student</th>
                                  <th className="py-2 px-3 text-right">Marks / Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {eb.students.map((st, idx) => (
                                  <tr key={idx}>
                                    <td className="py-2 px-3 font-mono text-slate-600">{st.rollNumber}</td>
                                    <td className="py-2 px-3 font-medium text-slate-900">{st.studentName}</td>
                                    <td className="py-2 px-3 text-right font-mono font-bold">
                                      {st.isAbsent ? (
                                        <span className="text-rose-600">Absent</span>
                                      ) : st.grade ? (
                                        st.grade
                                      ) : (
                                        `${st.totalMarksObtained ?? '—'} / ${st.totalMaximumMarks}`
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {sp.examBreakdowns.length > 1 && (() => {
                        const studentMap = new Map();
                        sp.examBreakdowns.forEach((eb) => {
                          (eb.students || []).forEach((st) => {
                            const key = String(st.studentId || st.studentName);
                            if (!studentMap.has(key)) {
                              studentMap.set(key, {
                                key,
                                rollNumber: st.rollNumber,
                                studentName: st.studentName,
                                scores: {}
                              });
                            }
                            studentMap.get(key).scores[String(eb.examinationId)] = st.isAbsent
                              ? 'AB'
                              : st.grade
                              ? st.grade
                              : `${st.totalMarksObtained ?? '—'} / ${st.totalMaximumMarks}`;
                          });
                        });
                        const comparisonRows = Array.from(studentMap.values());
                        return (
                          <div className="border border-indigo-200 rounded-xl overflow-hidden">
                            <div className="px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-200 text-xs font-bold text-indigo-900">
                              Cross-Examination Student Comparison
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                                    <th className="py-2 px-3">Roll</th>
                                    <th className="py-2 px-3">Student</th>
                                    {sp.examBreakdowns.map((eb) => (
                                      <th key={eb.examinationId} className="py-2 px-3 text-center">
                                        {eb.examinationCode || eb.examinationName}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {comparisonRows.map((row) => (
                                    <tr key={row.key}>
                                      <td className="py-2 px-3 font-mono text-slate-600">{row.rollNumber}</td>
                                      <td className="py-2 px-3 font-medium text-slate-900">{row.studentName}</td>
                                      {sp.examBreakdowns.map((eb) => (
                                        <td key={eb.examinationId} className="py-2 px-3 text-center font-mono font-semibold">
                                          {row.scores[String(eb.examinationId)] || '—'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherResultPerformancePage;
