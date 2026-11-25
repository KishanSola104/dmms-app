import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import axios from 'axios';
import {
  Award,
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
  Loader2,
  Info
} from 'lucide-react';

const TeacherFinalResultPage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [ctSections, setCtSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [resultConfig, setResultConfig] = useState(null);
  const [examinations, setExaminations] = useState([]);

  const [readiness, setReadiness] = useState({ isReady: false, pendingItems: [] });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Detail & Final Remark Modal
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [finalRemarkDraft, setFinalRemarkDraft] = useState('');
  const [remarkBusy, setRemarkBusy] = useState(false);
  const [showTermBreakdown, setShowTermBreakdown] = useState(false);

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

  const fetchFinalContext = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (selectedSectionId) params.append('sectionId', selectedSectionId);

      const res = await api.get(`/teacher/final-results?${params.toString()}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        setCtSections(res.classTeacherSections || []);
        if (res.selectedSection?._id && !selectedSectionId) {
          setSelectedSectionId(res.selectedSection._id);
        }
        setResultConfig(res.resultConfig || null);
        setExaminations(res.examinations || []);
        setReadiness(res.readiness || { isReady: false, pendingItems: [] });
        setResults(res.results || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load final academic results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinalContext();
  }, [academicYearId, selectedSectionId]);

  const activeSection = ctSections.find(s => s._id === selectedSectionId) || ctSections[0];

  const handleGenerateFinal = async () => {
    if (!activeSection) return;
    setBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/teacher/final-results/generate', {
        academicYearId,
        classId: activeSection.classRef,
        sectionId: activeSection._id
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchFinalContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitFinal = async () => {
    if (!activeSection) return;
    if (!window.confirm('Submit Comprehensive Final Academic Results to the Head Teacher for review and approval?')) {
      return;
    }
    setBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/teacher/final-results/submit', {
        academicYearId,
        classId: activeSection.classRef,
        sectionId: activeSection._id
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchFinalContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleRequestCoCurricularFinal = async () => {
    if (!activeSection) return;
    setBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/teacher/co-curricular/request-final', {
        academicYearId,
        classId: activeSection.classRef,
        sectionId: activeSection._id
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchFinalContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDetail = (row) => {
    setSelectedResult(row);
    setFinalRemarkDraft(row.finalRemark || '');
    setDetailModalOpen(true);
  };

  const handleSuggestFinalRemark = async () => {
    if (!selectedResult) return;
    setRemarkBusy(true);
    try {
      const res = await api.put(`/teacher/final-results/${selectedResult._id}/remark`, {
        suggestOnly: true
      });
      if (res.success && res.suggestedRemark) {
        setFinalRemarkDraft(res.suggestedRemark);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRemarkBusy(false);
    }
  };

  const handleSaveFinalRemark = async () => {
    if (!selectedResult) return;
    setRemarkBusy(true);
    try {
      const res = await api.put(`/teacher/final-results/${selectedResult._id}/remark`, {
        finalRemark: finalRemarkDraft,
        approve: true,
        suggestOnly: false
      });
      if (res.success) {
        setFeedback({ type: 'success', message: 'Final overall remark approved and saved.' });
        setSelectedResult(res.result);
        await fetchFinalContext();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setRemarkBusy(false);
    }
  };

  const fetchPdfBlob = async (finalResultId) => {
    const userToken = localStorage.getItem('dmms_user_token');
    const schoolToken = localStorage.getItem('dmms_school_token');
    const response = await axios.get(`/api/teacher/final-results/${finalResultId}/pdf`, {
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
      setFeedback({ type: 'error', message: 'Failed to generate final marksheet PDF preview.' });
    }
  };

  const handleDownloadPdf = async (row) => {
    try {
      const blob = await fetchPdfBlob(row._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Final_Marksheet_${row.studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to download final marksheet PDF.' });
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
      header: 'Overall Total',
      accessor: 'overallTotalObtained',
      align: 'center',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {r.overallTotalObtained} / {r.overallMaxMarks}
        </span>
      )
    },
    {
      header: 'Final %',
      accessor: 'finalPercentage',
      align: 'center',
      render: (r) => <span className="font-mono text-xs font-semibold text-indigo-700">{r.finalPercentage}%</span>
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
      header: 'Promotion',
      accessor: 'promotionStatus',
      render: (r) => <StatusBadge status={r.promotionStatus} />
    },
    {
      header: 'Workflow',
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
            Marksheet / Remark
          </button>
          <button
            type="button"
            onClick={() => handlePreviewPdf(r)}
            className="p-1.5 text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg"
            title="Preview & Print Final Marksheet PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf(r)}
            className="p-1.5 text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg"
            title="Download Final Marksheet PDF"
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Final Academic Result</h1>
            <p className="mt-1 text-sm text-slate-500">
              Verify final readiness across all examinations, generate comprehensive annual academic marksheets, manage overall final remarks, and submit for Head Teacher review.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchFinalContext}
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
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Assigned Class &amp; Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {ctSections.map((sec) => (
                    <option key={sec._id} value={sec._id}>
                      {sec.className} - {sec.sectionName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Policy Summary */}
            {resultConfig && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-wrap items-center gap-3">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Active Result Policy (v{resultConfig.version}):</strong>{' '}
                  {resultConfig.academicFinalRule?.formulaType === 'DIRECT_AVERAGE_PLUS_ADDITIONAL'
                    ? 'Average of Terms + Additional/Project'
                    : `Sum of Terms ÷ ${resultConfig.academicFinalRule?.termSumDivisor ?? 2} + Additional/Project`}{' '}
                  &bull; Passing: <strong>{resultConfig.passingRules?.passingPercentage ?? 40}%</strong> &bull; Co-curricular:{' '}
                  <strong>
                    {resultConfig.coCurricularConfig?.finalWorkflow === 'SEPARATE_SUBMISSION'
                      ? 'Separate Final Submission (Option B)'
                      : 'System Term Average (Option A)'}
                  </strong>
                </span>
              </div>
            )}

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
                  <p className="font-bold">Final Results Returned by Head Teacher for Correction</p>
                  <p className="mt-0.5">Reason: {returnedItem.returnReason || 'Please review and resubmit.'}</p>
                </div>
              </div>
            )}

            {/* Readiness Banner */}
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
                        <span>All {readiness.examsCount} Examinations &amp; Verifications Completed — Ready for Final Result</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <span>Final Result Readiness Incomplete ({readiness.pendingItems?.length || 0} pending requirements)</span>
                      </>
                    )}
                  </div>
                  {!readiness.isReady && readiness.pendingItems?.length > 0 && (
                    <ul className="list-disc list-inside pl-1 max-h-32 overflow-y-auto">
                      {readiness.pendingItems.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {resultConfig?.coCurricularConfig?.finalWorkflow === 'SEPARATE_SUBMISSION' && !anyLocked && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleRequestCoCurricularFinal}
                      className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 disabled:opacity-50 rounded-lg shadow-2xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Request Final Co-curricular Grades
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy || !readiness.isReady || anyLocked}
                    onClick={handleGenerateFinal}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    {results.length > 0 ? 'Regenerate Final Results' : 'Generate Final Results'}
                  </button>

                  {results.length > 0 && !anyLocked && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSubmitFinal}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit Final Results
                    </button>
                  )}
                </div>
              </div>
            )}

            <AdminDataTable
              columns={columns}
              data={results}
              loading={loading}
              emptyMessage="No final academic results generated for this class and section yet."
            />
          </>
        )}

        {/* Comprehensive Final Marksheet Detail & Final Remark Modal */}
        <AdminModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={selectedResult ? `Comprehensive Final Marksheet — ${selectedResult.studentName}` : 'Final Marksheet'}
          subtitle={
            selectedResult
              ? `${selectedResult.academicYearName} • ${selectedResult.className} - ${selectedResult.sectionName} • Roll #${selectedResult.rollNumber || '—'} • Policy v${selectedResult.configVersion}`
              : ''
          }
          maxWidth="max-w-4xl"
        >
          {selectedResult && (
            <div className="space-y-5">
              {/* Section A: Academic Subjects */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                    Section A – Academic Subjects
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTermBreakdown((prev) => !prev)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg"
                  >
                    {showTermBreakdown ? 'Hide Term Component Breakdown' : 'Show Term Component Breakdown'}
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                        <th className="py-2 px-3">Subject</th>
                        {(selectedResult.examinationsIncluded || []).map((ex) => (
                          <th key={ex.examinationRef} className="py-2 px-3 text-center">
                            {ex.examinationName}
                          </th>
                        ))}
                        <th className="py-2 px-3 text-center">Project / Extra</th>
                        <th className="py-2 px-3 text-center">Final Marks</th>
                        <th className="py-2 px-3 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedResult.academicSubjects || []).map((sub, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-slate-900">{sub.subjectName}</td>
                          {(selectedResult.examinationsIncluded || []).map((ex) => {
                            const tr = (sub.termResults || []).find(
                              (t) => t.examinationRef.toString() === ex.examinationRef.toString()
                            );
                            return (
                              <td key={ex.examinationRef} className="py-2 px-3 text-center font-mono">
                                <div>
                                  {tr ? (tr.isAbsent ? 'AB' : `${tr.totalObtained}/${tr.totalMaximum}`) : '—'}
                                </div>
                                {showTermBreakdown && tr && !tr.isAbsent && (tr.components || []).length > 0 && (
                                  <div className="mt-1 flex flex-wrap justify-center gap-1 font-sans">
                                    {tr.components.map((c) => (
                                      <span
                                        key={c.componentName}
                                        className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] text-slate-600"
                                      >
                                        {c.componentName}: {c.marksObtained}/{c.maximumMarks}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-center font-mono">
                            {sub.additionalMarksMax > 0
                              ? `${sub.additionalMarksObtained}/${sub.additionalMarksMax}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                            {sub.finalMarksObtained} / {sub.finalMaxMarks}
                          </td>
                          <td className="py-2 px-3 text-center font-bold">{sub.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section B: Co-curricular Subjects */}
              {(selectedResult.coCurricularSubjects || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">
                    Section B – Co-curricular Subjects
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2 px-3">Subject</th>
                          {(selectedResult.examinationsIncluded || []).map((ex) => (
                            <th key={ex.examinationRef} className="py-2 px-3 text-center">
                              {ex.examinationName}
                            </th>
                          ))}
                          <th className="py-2 px-3 text-center">Final Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedResult.coCurricularSubjects.map((cc, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 font-semibold text-slate-900">{cc.subjectName}</td>
                            {(selectedResult.examinationsIncluded || []).map((ex) => {
                              const tg = (cc.termGrades || []).find(
                                (t) => t.examinationRef.toString() === ex.examinationRef.toString()
                              );
                              return (
                                <td key={ex.examinationRef} className="py-2 px-3 text-center font-semibold">
                                  {tg?.grade || '—'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-center font-bold text-indigo-700">
                              {cc.finalGrade || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section C: Overall Final Result */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <div>
                  <p className="text-slate-500">Overall Total</p>
                  <p className="font-bold text-slate-900">
                    {selectedResult.overallTotalObtained} / {selectedResult.overallMaxMarks}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Final %</p>
                  <p className="font-bold text-indigo-700">{selectedResult.finalPercentage}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Overall Grade</p>
                  <p className="font-bold text-slate-900">{selectedResult.overallGrade}</p>
                </div>
                <div>
                  <p className="text-slate-500">Result</p>
                  <StatusBadge status={selectedResult.resultStatus} />
                </div>
                <div>
                  <p className="text-slate-500">Promotion</p>
                  <StatusBadge status={selectedResult.promotionStatus} />
                </div>
              </div>

              {/* Term-Wise Remarks Summary (Read-Only Reference) */}
              {(selectedResult.termRemarks || []).length > 0 && (
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Term-Wise Remarks Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {selectedResult.termRemarks.map((tr) => (
                      <div key={tr.examinationRef} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="font-semibold text-slate-800">{tr.examinationName}</p>
                        <p className="text-slate-600 mt-0.5 italic">
                          {tr.remark || 'No term remark recorded.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section D: Overall Final Class Teacher Remark */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Section D – Overall Final Class Teacher Remark
                  </label>
                  {!['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(selectedResult.status) && (
                    <button
                      type="button"
                      disabled={remarkBusy}
                      onClick={handleSuggestFinalRemark}
                      className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Suggest Positive Final Remark
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  disabled={['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(selectedResult.status)}
                  value={finalRemarkDraft}
                  onChange={(e) => setFinalRemarkDraft(e.target.value)}
                  placeholder="Enter overall final remark across the academic year..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                />
                {!['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(selectedResult.status) && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={remarkBusy}
                      onClick={handleSaveFinalRemark}
                      className="inline-flex items-center px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Approve &amp; Save Final Remark
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
          title="Comprehensive Final Academic Marksheet (A4 PDF Preview)"
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
                title="Final Marksheet PDF"
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

export default TeacherFinalResultPage;
