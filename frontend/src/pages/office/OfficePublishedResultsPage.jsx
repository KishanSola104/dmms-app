import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import axios from 'axios';
import {
  FileCheck2,
  Download,
  Printer,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';

const OfficePublishedResultsPage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [examinations, setExaminations] = useState([]);

  const [resultType, setResultType] = useState('FINAL');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedSectionId, setSelectedSectionId] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [summary, setSummary] = useState({ totalPublished: 0, passCount: 0, averagePercentage: 0, publishedClassesCount: 0 });
  const [classSummaries, setClassSummaries] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Detail Modal
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // PDF Preview Modal
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfMeta, setPdfMeta] = useState(null);
  const pdfIframeRef = useRef(null);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const filteredSections = useMemo(() => {
    if (selectedClassId === 'ALL') return sections;
    return sections.filter(s => String(s.classRef) === String(selectedClassId));
  }, [sections, selectedClassId]);

  useEffect(() => {
    if (selectedClassId === 'ALL') {
      setSelectedSectionId('ALL');
    } else if (
      selectedSectionId !== 'ALL' &&
      !filteredSections.some(s => String(s._id) === String(selectedSectionId))
    ) {
      setSelectedSectionId('ALL');
    }
  }, [selectedClassId, filteredSections, selectedSectionId]);

  const fetchPublished = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const params = new URLSearchParams({ type: resultType });
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (resultType === 'EXAMINATION' && selectedExamId) params.append('examinationId', selectedExamId);
      if (selectedClassId !== 'ALL') params.append('classId', selectedClassId);
      if (selectedSectionId !== 'ALL') params.append('sectionId', selectedSectionId);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await api.get(`/office/published-results?${params.toString()}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        if (res.selectedAcademicYear?._id && !academicYearId) {
          setAcademicYearId(res.selectedAcademicYear._id);
        }
        setClasses(res.classes || []);
        setSections(res.sections || []);
        setExaminations(res.examinations || []);
        setSummary(res.summary || { totalPublished: 0, passCount: 0, averagePercentage: 0, publishedClassesCount: 0 });
        setClassSummaries(res.classSummaries || []);
        setResults(res.results || []);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load published results.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublished();
  }, [academicYearId, resultType, selectedExamId, selectedClassId, selectedSectionId]);

  const fetchPdfBlob = async (url) => {
    const userToken = localStorage.getItem('dmms_user_token');
    const schoolToken = localStorage.getItem('dmms_school_token');
    const response = await axios.get(url, {
      responseType: 'blob',
      headers: {
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        ...(schoolToken ? { 'x-school-token': schoolToken } : {})
      }
    });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handlePreviewStudentPdf = async (row) => {
    try {
      const url = `/api/office/published-results/${row._id}/pdf?type=${resultType}`;
      const blob = await fetchPdfBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      setPdfMeta({
        filename: `${resultType === 'EXAMINATION' ? 'Term_Marksheet' : 'Final_Marksheet'}_${row.studentName.replace(/\s+/g, '_')}.pdf`,
        apiUrl: url
      });
      setPdfPreviewUrl(blobUrl);
      setPdfModalOpen(true);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Unable to preview published marksheet PDF.' });
    }
  };

  const handleDownloadStudentPdf = async (row) => {
    try {
      const blob = await fetchPdfBlob(`/api/office/published-results/${row._id}/pdf?type=${resultType}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resultType === 'EXAMINATION' ? 'Term_Marksheet' : 'Final_Marksheet'}_${row.studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Unable to download published marksheet PDF.' });
    }
  };

  const handleDownloadClassPdf = async (clsSummary) => {
    try {
      const params = new URLSearchParams({
        type: clsSummary.type,
        academicYearId: clsSummary.academicYearId,
        classId: clsSummary.classId,
        sectionId: clsSummary.sectionId
      });
      if (clsSummary.examinationId) params.append('examinationId', clsSummary.examinationId);

      const blob = await fetchPdfBlob(`/api/office/published-results/class-report/pdf?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Class_Published_Report_${clsSummary.className}_${clsSummary.sectionName}.pdf`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Unable to generate class-wise published result PDF.' });
    }
  };

  const columns = [
    {
      header: 'Class & Section',
      accessor: 'className',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">
            {r.className} - {r.sectionName}
          </p>
          <p className="text-[10px] text-slate-500">Roll #{r.rollNumber || '—'}</p>
        </div>
      )
    },
    {
      header: 'Student',
      accessor: 'studentName',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.studentName}</p>
          <p className="text-[10px] font-mono text-slate-400">{r.admissionNumber}</p>
        </div>
      )
    },
    {
      header: 'Total Marks',
      accessor: 'overallTotalObtained',
      align: 'center',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {r.overallTotalObtained ?? r.totalMarksObtained} / {r.overallMaxMarks ?? r.totalMaximumMarks}
        </span>
      )
    },
    {
      header: 'Percentage',
      accessor: 'finalPercentage',
      align: 'center',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-indigo-700">
          {r.finalPercentage ?? r.percentage}%
        </span>
      )
    },
    {
      header: 'Grade',
      accessor: 'overallGrade',
      align: 'center',
      render: (r) => (
        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800">
          {r.overallGrade}
        </span>
      )
    },
    {
      header: 'Result',
      accessor: 'resultStatus',
      render: (r) => <StatusBadge status={r.resultStatus} />
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedResult(r);
              setDetailModalOpen(true);
            }}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            View
          </button>
          <button
            type="button"
            onClick={() => handlePreviewStudentPdf(r)}
            className="p-1.5 text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg"
            title="Preview & Print Marksheet"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDownloadStudentPdf(r)}
            className="p-1.5 text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg"
            title="Download Marksheet PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded">
              Office Staff Portal
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Published Results &amp; Marksheets
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Access officially published academic results approved and released by the Head Teacher. Download or print individual marksheets and class-wise registers.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchPublished}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg self-start"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Published Marksheets</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalPublished}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Published Classes</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{summary.publishedClassesCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Passed Students</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.passCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Overall Average %</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{summary.averagePercentage}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Academic Year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              {availableYears.map((y) => (
                <option key={y._id} value={y._id}>
                  {y.yearName || y.yearCode} {y.isCurrent ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Result Type</label>
            <select
              value={resultType}
              onChange={(e) => setResultType(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="FINAL">Final Academic Results</option>
              <option value="EXAMINATION">Term Examination Results</option>
            </select>
          </div>

          {resultType === 'EXAMINATION' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Examination</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="">All Examinations</option>
                {examinations.map((ex) => (
                  <option key={ex._id} value={ex._id}>
                    {ex.examinationName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.className} ({c.classCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">All Sections</option>
              {filteredSections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.sectionName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchPublished();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student by name, roll number, or admission number..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Search
          </button>
        </form>

        {feedback.message && (
          <div
            className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Class-Wise PDF Registers */}
        {classSummaries.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
              Class-Wise Published Result PDF Registers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classSummaries.map((cs) => (
                <div
                  key={cs.key}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {cs.className} - {cs.sectionName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {cs.examinationName} &bull; {cs.studentCount} students ({cs.passCount} Pass)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadClassPdf(cs)}
                    className="inline-flex items-center px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Class PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Published Student Results Table */}
        <AdminDataTable
          columns={columns}
          data={results}
          loading={loading}
          emptyMessage="No officially published results available yet. Results appear here once approved and published by the Head Teacher."
        />

        {/* Published Result Detail Modal */}
        <AdminModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={selectedResult ? `Published Marksheet — ${selectedResult.studentName}` : 'Published Marksheet'}
          subtitle={
            selectedResult
              ? `${selectedResult.className} - ${selectedResult.sectionName} • Roll #${selectedResult.rollNumber || '—'}`
              : ''
          }
          maxWidth="max-w-3xl"
        >
          {selectedResult && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div>
                  <p className="text-slate-500">Total Marks</p>
                  <p className="font-bold text-slate-900">
                    {selectedResult.overallTotalObtained ?? selectedResult.totalMarksObtained} / {selectedResult.overallMaxMarks ?? selectedResult.totalMaximumMarks}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Percentage</p>
                  <p className="font-bold text-indigo-700">
                    {selectedResult.finalPercentage ?? selectedResult.percentage}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Grade</p>
                  <p className="font-bold text-slate-900">{selectedResult.overallGrade}</p>
                </div>
                <div>
                  <p className="text-slate-500">Result</p>
                  <StatusBadge status={selectedResult.resultStatus} />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2 px-3">Subject</th>
                      <th className="py-2 px-3 text-center">Marks Obtained</th>
                      <th className="py-2 px-3 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedResult.academicSubjects || []).map((sub, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-slate-900">{sub.subjectName}</td>
                        <td className="py-2 px-3 text-center font-mono">
                          {sub.finalMarksObtained ?? sub.totalMarksObtained} / {sub.finalMaxMarks ?? sub.totalMaximumMarks}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">{sub.grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(selectedResult.finalRemark || selectedResult.termRemark) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-800 mb-1">Class Teacher Remark</p>
                  <p className="text-slate-700 italic">{selectedResult.finalRemark || selectedResult.termRemark}</p>
                </div>
              )}
            </div>
          )}
        </AdminModal>

        {/* PDF Preview & Print Modal */}
        <AdminModal
          isOpen={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl('');
            setPdfMeta(null);
          }}
          title="Published Marksheet (A4 PDF Preview)"
          maxWidth="max-w-4xl"
        >
          {pdfPreviewUrl ? (
            <div className="space-y-3">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => pdfIframeRef.current?.contentWindow?.print()}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Marksheet
                </button>
                {pdfMeta && (
                  <a
                    href={pdfPreviewUrl}
                    download={pdfMeta.filename}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download PDF
                  </a>
                )}
              </div>
              <iframe
                ref={pdfIframeRef}
                src={pdfPreviewUrl}
                title="Published Marksheet PDF"
                className="w-full h-[68vh] rounded-lg border border-slate-200"
              />
            </div>
          ) : (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            </div>
          )}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default OfficePublishedResultsPage;
