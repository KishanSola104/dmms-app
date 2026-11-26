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
  Award,
  BookOpen,
  Users,
  CheckCircle2
} from 'lucide-react';

const REPORT_TABS = [
  { key: 'CLASS_WISE', label: 'Class-Wise Published Reports' },
  { key: 'EXAM_WISE', label: 'Examination-Wise Reports' },
  { key: 'FINAL_RESULT', label: 'Final Result Summaries' },
  { key: 'STUDENT_REPORTS', label: 'Student Academic Reports' }
];

const OfficeAcademicReportsPage = () => {
  const { selectedYear } = useAcademicYear();

  const [activeTab, setActiveTab] = useState('CLASS_WISE');
  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [examinationId, setExaminationId] = useState('ALL');
  const [classId, setClassId] = useState('ALL');
  const [sectionId, setSectionId] = useState('ALL');

  const [data, setData] = useState({
    availableAcademicYears: [],
    classes: [],
    sections: [],
    examinations: [],
    overview: { totalPublishedFinal: 0, totalPublishedExam: 0, overallPassRate: 0, overallAveragePercentage: 0 },
    classWiseReports: [],
    examWiseReports: [],
    finalResultReports: [],
    studentReports: []
  });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
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

      const res = await api.get(`/office/academic-reports?${params.toString()}`);
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load published academic reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [academicYearId, examinationId, classId, sectionId]);

  const fetchPdfAndDownload = async (url, filename) => {
    setDownloading(true);
    setError('');
    try {
      const userToken = localStorage.getItem('dmms_user_token');
      const schoolToken = localStorage.getItem('dmms_school_token');
      const response = await axios.get(url, {
        responseType: 'blob',
        headers: {
          ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          ...(schoolToken ? { 'x-school-token': schoolToken } : {})
        }
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError('Unable to download PDF report.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSummaryPdf = () => {
    const params = new URLSearchParams({ reportType: activeTab });
    if (academicYearId) params.append('academicYearId', academicYearId);
    if (examinationId !== 'ALL') params.append('examinationId', examinationId);
    if (classId !== 'ALL') params.append('classId', classId);
    if (sectionId !== 'ALL') params.append('sectionId', sectionId);
    fetchPdfAndDownload(`/api/office/academic-reports/pdf?${params.toString()}`, `Office_${activeTab}_Report.pdf`);
  };

  const filteredSections = classId === 'ALL'
    ? data.sections
    : (data.sections || []).filter((s) => String(s.classRef) === String(classId));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl text-white p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-indigo-200 mb-2">
              <FileBarChart2 className="w-3.5 h-3.5" />
              <span>Published Academic Reports Only</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Office Academic Reports</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Class-wise, examination-wise, final, and student academic performance compiled strictly from officially published records.
            </p>
          </div>
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadSummaryPdf}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-2 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Generating PDF...' : 'Download Report PDF'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Overview KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><Award className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Published Final</p>
              <p className="text-xl font-extrabold text-slate-900">{data.overview?.totalPublishedFinal ?? 0}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><BookOpen className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Published Exam</p>
              <p className="text-xl font-extrabold text-slate-900">{data.overview?.totalPublishedExam ?? 0}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Overall Pass Rate</p>
              <p className="text-xl font-extrabold text-emerald-700">{data.overview?.overallPassRate ?? 0}%</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Average Percentage</p>
              <p className="text-xl font-extrabold text-slate-900">{data.overview?.overallAveragePercentage ?? 0}%</p>
            </div>
          </div>
        </div>

        {/* Filters + Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setExaminationId('ALL');
              }}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {(data.availableAcademicYears || []).map((y) => (
                <option key={y._id} value={y._id}>{y.yearName || y.yearCode}</option>
              ))}
            </select>
            <select
              value={examinationId}
              onChange={(e) => setExaminationId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Examinations</option>
              {(data.examinations || []).map((ex) => (
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
              {(data.classes || []).map((c) => (
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
            <button
              type="button"
              onClick={fetchReports}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Reports</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {REPORT_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === t.key
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading published report data...</div>
            ) : activeTab === 'CLASS_WISE' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4 text-center">Source</th>
                    <th className="py-3 px-4 text-center">Students</th>
                    <th className="py-3 px-4 text-center">Passed</th>
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">Avg %</th>
                    <th className="py-3 px-4 text-center">Highest %</th>
                    <th className="py-3 px-4 text-right">Register PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.classWiseReports || []).length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">No published class-wise reports found.</td></tr>
                  ) : (
                    data.classWiseReports.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{r.className} - {r.sectionName}</td>
                        <td className="py-3 px-4 text-center">{r.sourceType}</td>
                        <td className="py-3 px-4 text-center">{r.studentCount}</td>
                        <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.passCount}</td>
                        <td className="py-3 px-4 text-center font-bold">{r.passRate}%</td>
                        <td className="py-3 px-4 text-center">{r.averagePercentage}%</td>
                        <td className="py-3 px-4 text-center">{r.highestPercentage}%</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => fetchPdfAndDownload(
                              `/api/office/published-results/class-report/pdf?type=${r.sourceType}&academicYearId=${academicYearId}&classId=${r.classId}&sectionId=${r.sectionId}`,
                              `Class_Report_${r.className}_${r.sectionName}.pdf`.replace(/\s+/g, '_')
                            )}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 inline-flex items-center space-x-1"
                          >
                            <Download className="w-3 h-3" /><span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">Avg %</th>
                    <th className="py-3 px-4 text-center">Highest %</th>
                    <th className="py-3 px-4 text-right">Register PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.examWiseReports || []).length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">No published examination-wise reports found.</td></tr>
                  ) : (
                    data.examWiseReports.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{r.examinationName}</td>
                        <td className="py-3 px-4">{r.className} - {r.sectionName}</td>
                        <td className="py-3 px-4 text-center">{r.studentCount}</td>
                        <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.passCount}</td>
                        <td className="py-3 px-4 text-center font-bold">{r.passRate}%</td>
                        <td className="py-3 px-4 text-center">{r.averagePercentage}%</td>
                        <td className="py-3 px-4 text-center">{r.highestPercentage}%</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => fetchPdfAndDownload(
                              `/api/office/published-results/class-report/pdf?type=EXAMINATION&academicYearId=${academicYearId}&examinationId=${r.examinationId}&classId=${r.classId}&sectionId=${r.sectionId}`,
                              `Exam_Report_${r.examinationName}_${r.className}_${r.sectionName}.pdf`.replace(/\s+/g, '_')
                            )}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 inline-flex items-center space-x-1"
                          >
                            <Download className="w-3 h-3" /><span>PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : activeTab === 'FINAL_RESULT' ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Class &amp; Section</th>
                    <th className="py-3 px-4 text-center">Students</th>
                    <th className="py-3 px-4 text-center">Passed</th>
                    <th className="py-3 px-4 text-center">Promoted</th>
                    <th className="py-3 px-4 text-center">Retained</th>
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">Avg %</th>
                    <th className="py-3 px-4 text-center">Highest %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.finalResultReports || []).length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">No published final result summaries found.</td></tr>
                  ) : (
                    data.finalResultReports.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{r.className} - {r.sectionName}</td>
                        <td className="py-3 px-4 text-center">{r.studentCount}</td>
                        <td className="py-3 px-4 text-center text-emerald-700 font-semibold">{r.passCount}</td>
                        <td className="py-3 px-4 text-center text-blue-700 font-semibold">{r.promotedCount}</td>
                        <td className="py-3 px-4 text-center text-rose-700 font-semibold">{r.retainedCount}</td>
                        <td className="py-3 px-4 text-center font-bold">{r.passRate}%</td>
                        <td className="py-3 px-4 text-center">{r.averagePercentage}%</td>
                        <td className="py-3 px-4 text-center">{r.highestPercentage}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class &amp; Sec</th>
                    <th className="py-3 px-4 text-center">Roll / Adm No</th>
                    <th className="py-3 px-4 text-center">Published Exams</th>
                    <th className="py-3 px-4 text-center">Final % / Grade</th>
                    <th className="py-3 px-4 text-center">Result</th>
                    <th className="py-3 px-4 text-right">Marksheet PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.studentReports || []).length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-500">No published student reports found.</td></tr>
                  ) : (
                    data.studentReports.map((st, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{st.studentName}</td>
                        <td className="py-3 px-4">{st.className} - {st.sectionName}</td>
                        <td className="py-3 px-4 text-center">{st.rollNumber || '—'} / {st.admissionNumber || '—'}</td>
                        <td className="py-3 px-4 text-center">{st.examResultsCount}</td>
                        <td className="py-3 px-4 text-center font-bold">
                          {st.finalPercentage != null ? `${st.finalPercentage}%` : `${st.latestExamPercentage ?? 0}%`} ({st.overallGrade || '—'})
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            st.resultStatus === 'PASS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {st.resultStatus || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {st.finalResultId ? (
                            <button
                              type="button"
                              onClick={() => fetchPdfAndDownload(
                                `/api/office/published-results/${st.finalResultId}/pdf?type=FINAL`,
                                `Final_Marksheet_${st.studentName.replace(/\s+/g, '_')}.pdf`
                              )}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 inline-flex items-center space-x-1"
                            >
                              <Download className="w-3 h-3" /><span>Final PDF</span>
                            </button>
                          ) : st.latestExamResultId ? (
                            <button
                              type="button"
                              onClick={() => fetchPdfAndDownload(
                                `/api/office/published-results/${st.latestExamResultId}/pdf?type=EXAMINATION`,
                                `Exam_Marksheet_${st.studentName.replace(/\s+/g, '_')}.pdf`
                              )}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 inline-flex items-center space-x-1"
                            >
                              <Download className="w-3 h-3" /><span>Term PDF</span>
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OfficeAcademicReportsPage;
