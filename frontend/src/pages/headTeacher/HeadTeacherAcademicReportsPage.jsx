import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import axios from 'axios';
import {
  FileBarChart2,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Award,
  BookOpen,
  Clock
} from 'lucide-react';

const REPORT_SECTIONS = [
  { key: 'CLASS_WISE', label: 'Class Performance' },
  { key: 'EXAM_WISE', label: 'Exam Performance' },
  { key: 'SUBJECT_WISE', label: 'Subject Analytics' },
  { key: 'STUDENT_WISE', label: 'Student Reports' },
  { key: 'FINAL_SUMMARY', label: 'Final Summaries' },
  { key: 'MARKS_COMPLETION', label: 'Marks & Completion' }
];

const HeadTeacherAcademicReportsPage = () => {
  const { selectedYear } = useAcademicYear();
  const [activeTab, setActiveTab] = useState('CLASS_WISE');
  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [examinationId, setExaminationId] = useState('ALL');
  const [classId, setClassId] = useState('ALL');
  const [sectionId, setSectionId] = useState('ALL');
  const [subjectId, setSubjectId] = useState('ALL');

  const [report, setReport] = useState({
    availableAcademicYears: [],
    classes: [],
    sections: [],
    subjects: [],
    examinations: [],
    overview: { totalExamResults: 0, totalFinalResults: 0, publishedCount: 0, pendingApprovalCount: 0, averagePercentage: 0, passRate: 0 },
    classWisePerformance: [],
    examWisePerformance: [],
    subjectWisePerformance: [],
    studentPerformanceList: [],
    finalResultSummaries: [],
    publishedAndPendingSummary: { exam: {}, final: {} },
    marksCompletionReport: []
  });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedYear?._id) setAcademicYearId(selectedYear._id);
  }, [selectedYear?._id]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (examinationId !== 'ALL') params.append('examinationId', examinationId);
      if (classId !== 'ALL') params.append('classId', classId);
      if (sectionId !== 'ALL') params.append('sectionId', sectionId);
      if (subjectId !== 'ALL') params.append('subjectId', subjectId);

      const res = await api.get(`/head-teacher/reports?${params.toString()}`);
      if (res.success) setReport(res);
    } catch (err) {
      setError(err.message || 'Unable to load academic reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [academicYearId, examinationId, classId, sectionId, subjectId]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError('');
    try {
      const params = new URLSearchParams({ reportSection: activeTab });
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (examinationId !== 'ALL') params.append('examinationId', examinationId);
      if (classId !== 'ALL') params.append('classId', classId);
      if (sectionId !== 'ALL') params.append('sectionId', sectionId);
      if (subjectId !== 'ALL') params.append('subjectId', subjectId);

      const userToken = localStorage.getItem('dmms_user_token');
      const schoolToken = localStorage.getItem('dmms_school_token');
      const response = await axios.get(`/api/head-teacher/reports/pdf?${params.toString()}`, {
        responseType: 'blob',
        headers: {
          ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          ...(schoolToken ? { 'x-school-token': schoolToken } : {})
        }
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HeadTeacher_${activeTab}_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export Head Teacher Academic Report PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const filteredSections = classId === 'ALL'
    ? report.sections || []
    : (report.sections || []).filter((s) => String(s.classRef) === String(classId));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-purple-950 to-slate-900 rounded-2xl text-white p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-purple-200 mb-2">
              <FileBarChart2 className="w-3.5 h-3.5" />
              <span>Head Teacher Module 6 Analytics</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Academic Reports</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Consolidated class, examination, subject, student, final result, and marks-completion analytics across your school.
            </p>
          </div>
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadPdf}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Exporting PDF...' : 'Export Current Report PDF'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-slate-500">Exam Results</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{report.overview?.totalExamResults ?? 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-slate-500">Final Results</p>
            <p className="text-xl font-extrabold text-indigo-700 mt-1">{report.overview?.totalFinalResults ?? 0}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-emerald-600">Published</p>
            <p className="text-xl font-extrabold text-emerald-700 mt-1 flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4" /><span>{report.overview?.publishedCount ?? 0}</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-amber-600">Pending Review</p>
            <p className="text-xl font-extrabold text-amber-700 mt-1 flex items-center space-x-1">
              <Clock className="w-4 h-4" /><span>{report.overview?.pendingApprovalCount ?? 0}</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-slate-500">Avg Percentage</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1 flex items-center space-x-1">
              <BookOpen className="w-4 h-4 text-blue-600" /><span>{report.overview?.averagePercentage ?? 0}%</span>
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[11px] font-bold uppercase text-slate-500">Pass Rate</p>
            <p className="text-xl font-extrabold text-emerald-700 mt-1 flex items-center space-x-1">
              <Award className="w-4 h-4 text-emerald-600" /><span>{report.overview?.passRate ?? 0}%</span>
            </p>
          </div>
        </div>

        {/* Filters & Section Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <select
              value={academicYearId}
              onChange={(e) => { setAcademicYearId(e.target.value); setExaminationId('ALL'); }}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {(report.availableAcademicYears || []).map((y) => (
                <option key={y._id} value={y._id}>{y.yearName || y.yearCode}</option>
              ))}
            </select>
            <select value={examinationId} onChange={(e) => setExaminationId(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Examinations</option>
              {(report.examinations || []).map((ex) => <option key={ex._id} value={ex._id}>{ex.examinationName}</option>)}
            </select>
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setSectionId('ALL'); }}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Classes</option>
              {(report.classes || []).map((c) => <option key={c._id} value={c._id}>{c.className}</option>)}
            </select>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Sections</option>
              {filteredSections.map((s) => <option key={s._id} value={s._id}>{s.sectionName}</option>)}
            </select>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="ALL">All Subjects</option>
              {(report.subjects || []).map((s) => <option key={s._id} value={s._id}>{s.subjectName}</option>)}
            </select>
            <button
              type="button"
              onClick={fetchReports}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
            {REPORT_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveTab(s.key)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === s.key ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report Body */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Compiling Head Teacher academic reports...</div>
            ) : activeTab === 'CLASS_WISE' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4 text-center">Students</th>
                    <th className="py-3 px-4 text-center">Passed</th>
                    <th className="py-3 px-4 text-center">Published</th>
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">Avg %</th>
                    <th className="py-3 px-4 text-center">Highest %</th>
                    <th className="py-3 px-4 text-center">Lowest %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.classWisePerformance || []).length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">No class performance records found.</td></tr>
                  ) : report.classWisePerformance.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.className} - {r.sectionName}</td>
                      <td className="py-3 px-4 text-center">{r.studentCount}</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.passCount}</td>
                      <td className="py-3 px-4 text-center">{r.publishedCount}</td>
                      <td className="py-3 px-4 text-center font-bold">{r.passRate}%</td>
                      <td className="py-3 px-4 text-center">{r.averagePercentage}%</td>
                      <td className="py-3 px-4 text-center text-blue-700">{r.highestPercentage}%</td>
                      <td className="py-3 px-4 text-center text-rose-700">{r.lowestPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'EXAM_WISE' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Examination</th>
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4 text-center">Students</th>
                    <th className="py-3 px-4 text-center">Passed</th>
                    <th className="py-3 px-4 text-center">Published</th>
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">Avg %</th>
                    <th className="py-3 px-4 text-center">Highest %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.examWisePerformance || []).length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">No examination performance records found.</td></tr>
                  ) : report.examWisePerformance.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.examinationName}</td>
                      <td className="py-3 px-4">{r.className} - {r.sectionName}</td>
                      <td className="py-3 px-4 text-center">{r.studentCount}</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.passCount}</td>
                      <td className="py-3 px-4 text-center">{r.publishedCount}</td>
                      <td className="py-3 px-4 text-center font-bold">{r.passRate}%</td>
                      <td className="py-3 px-4 text-center">{r.averagePercentage}%</td>
                      <td className="py-3 px-4 text-center text-blue-700">{r.highestPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'SUBJECT_WISE' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center">Entries</th>
                    <th className="py-3 px-4 text-center">Pass Count</th>
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">Avg %</th>
                    <th className="py-3 px-4 text-center">High / Low %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.subjectWisePerformance || []).length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">No subject analytics found.</td></tr>
                  ) : report.subjectWisePerformance.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.subjectName} ({r.subjectCode})</td>
                      <td className="py-3 px-4">{r.className}</td>
                      <td className="py-3 px-4 text-center">{r.entriesCount}</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.passCount}</td>
                      <td className="py-3 px-4 text-center font-bold">{r.passRate}%</td>
                      <td className="py-3 px-4 text-center">{r.averagePercentage}%</td>
                      <td className="py-3 px-4 text-center">{r.highestPercentage}% / {r.lowestPercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'STUDENT_WISE' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class &amp; Sec</th>
                    <th className="py-3 px-4 text-center">Roll / Adm</th>
                    <th className="py-3 px-4 text-center">Exams</th>
                    <th className="py-3 px-4 text-center">Exam Avg %</th>
                    <th className="py-3 px-4 text-center">Final % / Grade</th>
                    <th className="py-3 px-4 text-center">Result / State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.studentPerformanceList || []).length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">No student performance records found.</td></tr>
                  ) : report.studentPerformanceList.map((st, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{st.studentName}</td>
                      <td className="py-3 px-4">{st.className} - {st.sectionName}</td>
                      <td className="py-3 px-4 text-center">{st.rollNumber || '—'} / {st.admissionNumber || '—'}</td>
                      <td className="py-3 px-4 text-center">{st.examCount}</td>
                      <td className="py-3 px-4 text-center">{st.examAvgPercentage != null ? `${st.examAvgPercentage}%` : '—'}</td>
                      <td className="py-3 px-4 text-center font-bold">
                        {st.finalPercentage != null ? `${st.finalPercentage}%` : '—'} ({st.overallGrade || '—'})
                      </td>
                      <td className="py-3 px-4 text-center">{st.resultStatus || '—'} • {st.resultState}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'FINAL_SUMMARY' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4 text-center">Students</th>
                    <th className="py-3 px-4 text-center">Promoted / Retained</th>
                    <th className="py-3 px-4 text-center">Published</th>
                    <th className="py-3 px-4 text-center">Approved</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">Pass Rate / Avg %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.finalResultSummaries || []).length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">No final result summaries found.</td></tr>
                  ) : report.finalResultSummaries.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.className} - {r.sectionName}</td>
                      <td className="py-3 px-4 text-center">{r.studentCount}</td>
                      <td className="py-3 px-4 text-center">{r.promotedCount} / {r.retainedCount}</td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.publishedCount}</td>
                      <td className="py-3 px-4 text-center text-blue-700">{r.approvedCount}</td>
                      <td className="py-3 px-4 text-center text-amber-700">{r.pendingCount}</td>
                      <td className="py-3 px-4 text-center font-bold">{r.passRate}% / {r.averagePercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4 text-center">Expected Tasks</th>
                    <th className="py-3 px-4 text-center">Draft / Returned</th>
                    <th className="py-3 px-4 text-center">Submitted / Verified</th>
                    <th className="py-3 px-4 text-center">Locked</th>
                    <th className="py-3 px-4 text-center">Exam Res (Gen/Pub)</th>
                    <th className="py-3 px-4 text-center">Final Res (Gen/Pub)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(report.marksCompletionReport || []).length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">No completion records found.</td></tr>
                  ) : report.marksCompletionReport.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.className} - {r.sectionName}</td>
                      <td className="py-3 px-4 text-center">{r.expectedExamSubjectTasks}</td>
                      <td className="py-3 px-4 text-center">{r.draftCount} / <span className="text-rose-600">{r.returnedCount}</span></td>
                      <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.submittedCount} / {r.verifiedCount}</td>
                      <td className="py-3 px-4 text-center">{r.lockedCount}</td>
                      <td className="py-3 px-4 text-center">{r.examResultsGenerated} / {r.examResultsPublished}</td>
                      <td className="py-3 px-4 text-center">{r.finalResultsGenerated} / {r.finalResultsPublished}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherAcademicReportsPage;
