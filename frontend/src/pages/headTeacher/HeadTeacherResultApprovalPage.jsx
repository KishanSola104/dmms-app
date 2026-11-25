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
  Eye,
  CheckCircle2,
  RotateCcw,
  Globe,
  SearchCheck,
  RefreshCw,
  AlertCircle,
  Printer,
  Download,
  Loader2
} from 'lucide-react';

const HeadTeacherResultApprovalPage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [examinations, setExaminations] = useState([]);

  const [resultType, setResultType] = useState('FINAL'); // 'FINAL' | 'EXAMINATION'
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Student Detail Modal
  const [activeBatch, setActiveBatch] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Return Reason Modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnTargetBatch, setReturnTargetBatch] = useState(null);
  const [returnReason, setReturnReason] = useState('');

  // PDF Preview Modal
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfTarget, setPdfTarget] = useState(null);
  const pdfIframeRef = useRef(null);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: resultType });
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (resultType === 'EXAMINATION' && selectedExamId) params.append('examinationId', selectedExamId);
      if (selectedClassId !== 'ALL') params.append('classId', selectedClassId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await api.get(`/head-teacher/results/batches?${params.toString()}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        if (res.selectedAcademicYear?._id && !academicYearId) {
          setAcademicYearId(res.selectedAcademicYear._id);
        }
        setClasses(res.classes || []);
        setExaminations(res.examinations || []);
        setBatches(res.batches || []);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load submitted class results.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [academicYearId, resultType, selectedExamId, selectedClassId, statusFilter]);

  const handleOpenDetails = async (batch) => {
    setActiveBatch(batch);
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        type: batch.type,
        academicYearId: batch.academicYearId,
        classId: batch.classId,
        sectionId: batch.sectionId
      });
      if (batch.examinationId) params.append('examinationId', batch.examinationId);

      const res = await api.get(`/head-teacher/results/details?${params.toString()}`);
      if (res.success) {
        setBatchStudents(res.results || []);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load student details.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const runBatchAction = async (endpoint, batch, extraBody = {}, confirmMsg = '') => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post(`/head-teacher/results/${endpoint}`, {
        type: batch.type,
        academicYearId: batch.academicYearId,
        examinationId: batch.examinationId || null,
        classId: batch.classId,
        sectionId: batch.sectionId,
        ...extraBody
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchBatches();
        if (detailModalOpen && activeBatch?.batchKey === batch.batchKey) {
          await handleOpenDetails(batch);
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Action failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnTargetBatch) return;
    if (!returnReason.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a mandatory correction reason.' });
      return;
    }
    await runBatchAction('return', returnTargetBatch, { reason: returnReason.trim() });
    setReturnModalOpen(false);
    setReturnReason('');
    setReturnTargetBatch(null);
  };

  const fetchPdfBlob = async (row, type) => {
    const userToken = localStorage.getItem('dmms_user_token');
    const schoolToken = localStorage.getItem('dmms_school_token');
    const seg = type === 'EXAMINATION' ? 'examination' : 'final';
    const response = await axios.get(`/api/head-teacher/results/${seg}/${row._id}/pdf`, {
      responseType: 'blob',
      headers: {
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
        ...(schoolToken ? { 'x-school-token': schoolToken } : {})
      }
    });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handlePreviewPdf = async (row, type) => {
    try {
      const blob = await fetchPdfBlob(row, type);
      const url = URL.createObjectURL(blob);
      setPdfTarget({ row, type });
      setPdfPreviewUrl(url);
      setPdfModalOpen(true);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to generate marksheet PDF preview.' });
    }
  };

  const handleDownloadPdf = async (row, type) => {
    try {
      const blob = await fetchPdfBlob(row, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type === 'EXAMINATION' ? 'Term_Result' : 'Final_Marksheet'}_${row.studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to download marksheet PDF.' });
    }
  };

  const columns = [
    {
      header: 'Class & Section',
      accessor: 'className',
      render: (b) => (
        <div>
          <p className="font-bold text-slate-900">
            {b.className} - {b.sectionName}
          </p>
          <p className="text-[11px] text-slate-500">Class Teacher: {b.classTeacherName}</p>
        </div>
      )
    },
    {
      header: 'Scope / Exam',
      accessor: 'examinationName',
      render: (b) => (
        <span className="text-xs font-medium text-slate-700">{b.examinationName}</span>
      )
    },
    {
      header: 'Students',
      accessor: 'studentCount',
      align: 'center',
      render: (b) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {b.studentCount} ({b.passCount} Pass)
        </span>
      )
    },
    {
      header: 'Class Avg %',
      accessor: 'averagePercentage',
      align: 'center',
      render: (b) => (
        <span className="font-mono text-xs font-bold text-indigo-700">{b.averagePercentage}%</span>
      )
    },
    {
      header: 'Workflow Status',
      accessor: 'batchStatus',
      render: (b) => <StatusBadge status={b.batchStatus} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (b) => {
        const canReview = b.batchStatus === 'SUBMITTED_TO_HEAD_TEACHER';
        const canApproveOrReturn = ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW'].includes(b.batchStatus);
        const canPublish = b.batchStatus === 'APPROVED';

        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenDetails(b)}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              Inspect
            </button>

            {canReview && (
              <button
                type="button"
                disabled={busy}
                onClick={() => runBatchAction('review', b)}
                className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg disabled:opacity-50"
              >
                <SearchCheck className="w-3.5 h-3.5 mr-1" />
                Start Review
              </button>
            )}

            {canApproveOrReturn && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runBatchAction(
                      'approve',
                      b,
                      {},
                      `Verify and approve ${b.examinationName} for ${b.className} - ${b.sectionName}?`
                    )
                  }
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setReturnTargetBatch(b);
                    setReturnReason('');
                    setReturnModalOpen(true);
                  }}
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Return
                </button>
              </>
            )}

            {canPublish && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runBatchAction(
                    'publish',
                    b,
                    {},
                    `Officially publish ${b.examinationName} for ${b.className} - ${b.sectionName}? Once published, Office Staff will be able to access and download marksheets.`
                  )
                }
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                <Globe className="w-3.5 h-3.5 mr-1" />
                Publish
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded">
              Head Teacher Approval &amp; Publishing
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Result Review &amp; Publish
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review results submitted by Class Teachers, return batches requiring corrections, approve verified classes, and officially publish results for Office Staff release.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchBatches}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg self-start"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
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
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Result Scope</label>
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
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED_TO_HEAD_TEACHER">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RETURNED">Returned</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="GENERATED">Generated (Awaiting Submission)</option>
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

        <AdminDataTable
          columns={columns}
          data={batches}
          loading={loading}
          emptyMessage="No examination or final results submitted by Class Teachers yet."
        />

        {/* Batch Student Review Modal */}
        <AdminModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={activeBatch ? `${activeBatch.className} - ${activeBatch.sectionName} (${activeBatch.examinationName})` : 'Result Batch Review'}
          subtitle={activeBatch ? `Class Teacher: ${activeBatch.classTeacherName} • Current Status: ${activeBatch.batchStatus}` : ''}
          maxWidth="max-w-5xl"
        >
          {detailLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Roll</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3 text-center">Total</th>
                      <th className="py-2.5 px-3 text-center">%</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3">Result</th>
                      <th className="py-2.5 px-3">Remark</th>
                      <th className="py-2.5 px-3 text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchStudents.map((st) => (
                      <tr key={st._id}>
                        <td className="py-2 px-3 font-mono">{st.rollNumber || '—'}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{st.studentName}</td>
                        <td className="py-2 px-3 text-center font-mono">
                          {st.overallTotalObtained ?? st.totalMarksObtained} / {st.overallMaxMarks ?? st.totalMaximumMarks}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-indigo-700">
                          {st.finalPercentage ?? st.percentage}%
                        </td>
                        <td className="py-2 px-3 text-center font-bold">{st.overallGrade}</td>
                        <td className="py-2 px-3">
                          <StatusBadge status={st.resultStatus} />
                        </td>
                        <td className="py-2 px-3 max-w-[200px] truncate text-slate-600" title={st.finalRemark ?? st.termRemark}>
                          {st.finalRemark ?? st.termRemark ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handlePreviewPdf(st, activeBatch.type)}
                              className="p-1.5 text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg"
                              title="Preview Marksheet PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(st, activeBatch.type)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg"
                              title="Download Marksheet PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AdminModal>

        {/* Return for Correction Modal */}
        <AdminModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          title="Return Results for Correction"
          subtitle={
            returnTargetBatch
              ? `${returnTargetBatch.className} - ${returnTargetBatch.sectionName} • ${returnTargetBatch.examinationName}`
              : ''
          }
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correction Reason for Class Teacher <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Specify the discrepancies or corrections required..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                Return to Class Teacher
              </button>
            </div>
          </form>
        </AdminModal>

        {/* PDF Preview Modal */}
        <AdminModal
          isOpen={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl('');
            setPdfTarget(null);
          }}
          title="Marksheet A4 PDF Preview"
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
                {pdfTarget && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(pdfTarget.row, pdfTarget.type)}
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
                title="Head Teacher Marksheet PDF"
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

export default HeadTeacherResultApprovalPage;
