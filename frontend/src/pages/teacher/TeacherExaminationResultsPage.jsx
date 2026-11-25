import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import axios from 'axios';
import {
  FileCheck2,
  Play,
  Send,
  Eye,
  Printer,
  Download,
  Sparkles,
  Save,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Loader2
} from 'lucide-react';

const TeacherExaminationResultsPage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [ctSections, setCtSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [examinations, setExaminations] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');

  const [readiness, setReadiness] = useState({ isReady: false, pendingItems: [] });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Detail & Remark Modal
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarkBusy, setRemarkBusy] = useState(false);

  // PDF Preview Modal
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfRow, setPdfRow] = useState(null);
  const pdfIframeRef = useRef(null);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const fetchResultsContext = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (selectedSectionId) params.append('sectionId', selectedSectionId);
      if (selectedExamId) params.append('examinationId', selectedExamId);

      const res = await api.get(`/teacher/examination-results?${params.toString()}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        setCtSections(res.classTeacherSections || []);
        if (res.selectedSection?._id && !selectedSectionId) {
          setSelectedSectionId(res.selectedSection._id);
        }
        setExaminations(res.examinations || []);
        if (res.selectedExamination?._id && !selectedExamId) {
          setSelectedExamId(res.selectedExamination._id);
        }
        setReadiness(res.readiness || { isReady: false, pendingItems: [] });
        setResults(res.results || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load examination results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResultsContext();
  }, [academicYearId, selectedSectionId, selectedExamId]);

  const activeSection = ctSections.find(s => s._id === selectedSectionId) || ctSections[0];

  const handleGenerateResults = async () => {
    if (!activeSection || !selectedExamId) return;
    setBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/teacher/examination-results/generate', {
        academicYearId,
        examinationId: selectedExamId,
        classId: activeSection.classRef,
        sectionId: activeSection._id
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchResultsContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitToHeadTeacher = async () => {
    if (!activeSection || !selectedExamId) return;
    if (!window.confirm('Submit generated examination results to the Head Teacher for review and approval?')) {
      return;
    }
    setBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/teacher/examination-results/submit', {
        academicYearId,
        examinationId: selectedExamId,
        classId: activeSection.classRef,
        sectionId: activeSection._id
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchResultsContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDetail = (row) => {
    setSelectedResult(row);
    setRemarkDraft(row.termRemark || '');
    setDetailModalOpen(true);
  };

  const handleSuggestRemark = async () => {
    if (!selectedResult) return;
    setRemarkBusy(true);
    try {
      const res = await api.put(`/teacher/examination-results/${selectedResult._id}/remark`, {
        suggestOnly: true
      });
      if (res.success && res.suggestedRemark) {
        setRemarkDraft(res.suggestedRemark);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRemarkBusy(false);
    }
  };

  const handleSaveRemark = async () => {
    if (!selectedResult) return;
    setRemarkBusy(true);
    try {
      const res = await api.put(`/teacher/examination-results/${selectedResult._id}/remark`, {
        termRemark: remarkDraft,
        approve: true,
        suggestOnly: false
      });
      if (res.success) {
        setFeedback({ type: 'success', message: 'Term remark approved and saved.' });
        setSelectedResult(res.result);
        await fetchResultsContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRemarkBusy(false);
    }
  };

  const fetchPdfBlob = async (resultId) => {
    const userToken = localStorage.getItem('dmms_user_token');
    const schoolToken = localStorage.getItem('dmms_school_token');
    const response = await axios.get(`/api/teacher/examination-results/${resultId}/pdf`, {
      responseType: 'blob',
      headers: {
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        ...(schoolToken ? { 'x-school-token': schoolToken } : {})
      }
    });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handlePreviewPdf = async (row) => {
    try {
      const blob = await fetchPdfBlob(row._id);
      const url = URL.createObjectURL(blob);
      setPdfRow(row);
      setPdfPreviewUrl(url);
      setPdfModalOpen(true);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to generate PDF preview.' });
    }
  };

  const handleDownloadPdf = async (row) => {
    try {
      const blob = await fetchPdfBlob(row._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Marksheet_${row.examinationCode}_${row.studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to download PDF.' });
    }
  };

  const anyLocked = results.some(r =>
    ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(r.status)
  );
  const returnedItem = results.find(r => r.status === 'RETURNED');

  const columns = [
    {
      header: 'Roll',
      accessor: 'rollNumber',
      render: (r) => <span className="font-mono text-xs text-slate-600">{r.rollNumber || '—'}</span>
    },
    {
      header: 'Student Name',
      accessor: 'studentName',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.studentName}</p>
          <p className="text-[10px] font-mono text-slate-400">{r.admissionNumber}</p>
        </div>
      )
    },
    {
      header: 'Marks Obtained',
      accessor: 'totalMarksObtained',
      align: 'center',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {r.totalMarksObtained} / {r.totalMaximumMarks}
        </span>
      )
    },
    {
      header: 'Percentage',
      accessor: 'percentage',
      align: 'center',
      render: (r) => <span className="font-mono text-xs font-semibold text-indigo-700">{r.percentage}%</span>
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
      header: 'Workflow Status',
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
            onClick={() => handleOpenDetail(r)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Details / Remark
          </button>
          <button
            type="button"
            onClick={() => handlePreviewPdf(r)}
            className="p-1.5 text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg"
            title="Preview & Print Marksheet PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf(r)}
            className="p-1.5 text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg"
            title="Download PDF"
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
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded">
              Class Teacher Only
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Examination Results</h1>
            <p className="mt-1 text-sm text-slate-500">
              Generate individual term examination results after verification, manage term-wise remarks, preview A4 result cards, and submit to the Head Teacher.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchResultsContext}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg self-start"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-900">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">Access Restricted</h3>
              <p className="text-xs mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Class &amp; Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setSelectedExamId('');
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {ctSections.map((sec) => (
                    <option key={sec._id} value={sec._id}>
                      {sec.className} - {sec.sectionName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Examination</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {examinations.length === 0 ? (
                    <option value="">No examinations available</option>
                  ) : (
                    examinations.map((ex) => (
                      <option key={ex._id} value={ex._id}>
                        {ex.examinationName} ({ex.examinationCode})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {feedback.message && (
              <div
                className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs ${
                  feedback.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {feedback.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{feedback.message}</span>
              </div>
            )}

            {returnedItem && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-900 text-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Examination Results Returned by Head Teacher for Correction</p>
                  <p className="mt-0.5">Reason: {returnedItem.returnReason || 'Please review and resubmit.'}</p>
                </div>
              </div>
            )}

            {/* Readiness & Action Bar */}
            {!loading && (
              <div
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                  readiness.isReady
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    {readiness.isReady ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>All subject marks &amp; grades verified — Ready to generate results</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <span>Pending Verification Required Before Result Generation</span>
                      </>
                    )}
                  </div>
                  {!readiness.isReady && readiness.pendingItems?.length > 0 && (
                    <ul className="list-disc list-inside pl-1">
                      {readiness.pendingItems.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy || !readiness.isReady || anyLocked}
                    onClick={handleGenerateResults}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    {results.length > 0 ? 'Regenerate Results' : 'Generate Results'}
                  </button>

                  {results.length > 0 && !anyLocked && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSubmitToHeadTeacher}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit to Head Teacher
                    </button>
                  )}
                </div>
              </div>
            )}

            <AdminDataTable
              columns={columns}
              data={results}
              loading={loading}
              emptyMessage="No examination results generated for this class and examination yet."
            />
          </>
        )}

        {/* Result Detail & Term Remark Modal */}
        <AdminModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={selectedResult ? `${selectedResult.studentName} — ${selectedResult.examinationName}` : 'Result Details'}
          subtitle={
            selectedResult
              ? `${selectedResult.className} - ${selectedResult.sectionName} • Roll #${selectedResult.rollNumber || '—'} • Policy v${selectedResult.configVersion}`
              : ''
          }
          maxWidth="max-w-3xl"
        >
          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div>
                  <p className="text-slate-500">Total Marks</p>
                  <p className="font-bold text-slate-900">
                    {selectedResult.totalMarksObtained} / {selectedResult.totalMaximumMarks}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Percentage</p>
                  <p className="font-bold text-indigo-700">{selectedResult.percentage}%</p>
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

              {/* Academic Subjects */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2 px-3">Academic Subject</th>
                      <th className="py-2 px-3">Components</th>
                      <th className="py-2 px-3 text-center">Total</th>
                      <th className="py-2 px-3 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedResult.academicSubjects || []).map((sub, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-slate-900">{sub.subjectName}</td>
                        <td className="py-2 px-3">
                          {sub.isAbsent ? (
                            <span className="text-rose-600 font-semibold">Absent</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(sub.components || []).map((c) => (
                                <span key={c.componentName} className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">
                                  {c.componentName}: {c.marksObtained}/{c.maximumMarks}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {sub.totalMarksObtained} / {sub.totalMaximumMarks}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">{sub.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Co-curricular */}
              {(selectedResult.coCurricularSubjects || []).length > 0 && (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                        <th className="py-2 px-3">Co-curricular Subject</th>
                        <th className="py-2 px-3 text-right">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedResult.coCurricularSubjects.map((cc, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{cc.subjectName}</td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-700">{cc.grade || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Term-wise Remark Editor */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Term-Wise Class Teacher Remark ({selectedResult.examinationName})
                  </label>
                  {!['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(selectedResult.status) && (
                    <button
                      type="button"
                      disabled={remarkBusy}
                      onClick={handleSuggestRemark}
                      className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggest Positive Remark
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  disabled={['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(selectedResult.status)}
                  value={remarkDraft}
                  onChange={(e) => setRemarkDraft(e.target.value)}
                  placeholder="Enter encouraging term-wise remark for this student..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                />
                {!['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(selectedResult.status) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={remarkBusy}
                      onClick={handleSaveRemark}
                      className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Approve &amp; Save Remark
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </AdminModal>

        {/* PDF Preview Modal */}
        <AdminModal
          isOpen={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl('');
            setPdfRow(null);
          }}
          title="Term Examination Result Card (A4 PDF Preview)"
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
                {pdfRow && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(pdfRow)}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download PDF
                  </button>
                )}
              </div>
              <iframe
                ref={pdfIframeRef}
                src={pdfPreviewUrl}
                title="Term Result Card PDF"
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

export default TeacherExaminationResultsPage;
