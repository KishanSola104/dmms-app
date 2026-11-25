import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  ListChecks,
  CheckCircle2,
  RotateCcw,
  Eye,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShieldAlert,
  History,
  BellRing
} from 'lucide-react';

const TeacherMarksVerificationPage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [ctSections, setCtSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [examinations, setExaminations] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');

  const [items, setItems] = useState([]);
  const [readiness, setReadiness] = useState({ isReadyForResultGeneration: false, pendingItems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const fetchVerificationOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (selectedSectionId) params.append('sectionId', selectedSectionId);
      if (selectedExamId) params.append('examinationId', selectedExamId);

      const res = await api.get(`/teacher/verification/overview?${params.toString()}`);
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
        setItems(res.items || []);
        setReadiness(res.readiness || { isReadyForResultGeneration: false, pendingItems: [] });
      }
    } catch (err) {
      setError(err.message || 'Unable to load marks verification overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationOverview();
  }, [academicYearId, selectedSectionId, selectedExamId]);

  const handleOpenReview = async (item) => {
    if (!item.submissionId) return;
    setReviewModalOpen(true);
    setReviewLoading(true);
    setReviewData(null);
    setReturnReason('');
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.get(`/teacher/marks/submissions/${item.submissionId}`);
      if (res.success) {
        setReviewData(res);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setReviewLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!reviewData?.submission?._id) return;
    setActionBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post(`/teacher/verification/${reviewData.submission._id}/verify`);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setReviewModalOpen(false);
        await fetchVerificationOverview();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionBusy(false);
    }
  };

  const handleReturnForCorrection = async () => {
    if (!reviewData?.submission?._id) return;
    if (!returnReason.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a mandatory reason before returning marks for correction.' });
      return;
    }
    setActionBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post(`/teacher/verification/${reviewData.submission._id}/return`, {
        reason: returnReason.trim()
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setReviewModalOpen(false);
        await fetchVerificationOverview();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestCoCurricularFinal = async () => {
    const sec = ctSections.find(s => s._id === selectedSectionId) || ctSections[0];
    if (!sec) return;
    setActionBusy(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.post('/teacher/co-curricular/request-final', {
        academicYearId,
        classId: sec.classRef,
        sectionId: sec._id
      });
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchVerificationOverview();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionBusy(false);
    }
  };

  const columns = [
    {
      header: 'Examination / Period',
      accessor: 'examinationName',
      render: (item) => <span className="font-semibold text-slate-900">{item.examinationName}</span>
    },
    {
      header: 'Class & Section',
      accessor: 'className',
      render: (item) => (
        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
          {item.className} - {item.sectionName}
        </span>
      )
    },
    {
      header: 'Subject',
      accessor: 'subjectName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-800">{item.subjectName}</span>
          <span className="ml-1.5 font-mono text-[10px] text-slate-400">({item.subjectCode})</span>
        </div>
      )
    },
    {
      header: 'Assigned Teacher',
      accessor: 'assignedTeacherName',
      render: (item) => (
        <span className="text-xs text-slate-700 font-medium">{item.assignedTeacherName}</span>
      )
    },
    {
      header: 'Submitted / Total',
      accessor: 'marksSubmitted',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {item.marksSubmitted} / {item.totalStudents}
        </span>
      )
    },
    {
      header: 'Pending',
      accessor: 'pendingMarks',
      align: 'center',
      render: (item) => (
        <span className={`font-mono text-xs font-bold ${item.pendingMarks > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
          {item.pendingMarks}
        </span>
      )
    },
    {
      header: 'Submission Status',
      accessor: 'submissionStatus',
      render: (item) => <StatusBadge status={item.submissionStatus} />
    },
    {
      header: 'Verification Status',
      accessor: 'verificationStatus',
      render: (item) => <StatusBadge status={item.verificationStatus} />
    },
    {
      header: 'Action',
      align: 'right',
      render: (item) =>
        item.submissionId ? (
          <button
            type="button"
            onClick={() => handleOpenReview(item)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {item.submissionStatus === 'SUBMITTED' ? 'Review & Verify' : 'View'}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Awaiting entry</span>
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Marks Verification</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review subject teacher submissions for your assigned class/section, verify accurate marks, or return entries for correction.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ctSections.length > 0 && (
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleRequestCoCurricularFinal}
                className="inline-flex items-center px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg"
                title="Notify co-curricular subject teachers for separate final grade submission (Option B)"
              >
                <BellRing className="w-3.5 h-3.5 mr-1.5" />
                Request Final Co-curricular Grades
              </button>
            )}
            <button
              type="button"
              onClick={fetchVerificationOverview}
              className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </button>
          </div>
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
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Assigned Class &amp; Section</label>
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
                    <option value="">No examinations configured</option>
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

            {/* Readiness Banner */}
            {!loading && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  readiness.isReadyForResultGeneration
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {readiness.isReadyForResultGeneration ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Examination Ready for Result Generation</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span>Examination Result Generation Pending Verification</span>
                    </>
                  )}
                </div>
                {!readiness.isReadyForResultGeneration && readiness.pendingItems?.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {readiness.pendingItems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <AdminDataTable
              columns={columns}
              data={items}
              loading={loading}
              emptyMessage="No subject marks submissions found for the selected examination and section."
            />
          </>
        )}

        {/* Review & Verification Modal */}
        <AdminModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={reviewData?.submission ? `Review: ${reviewData.submission.subjectName}` : 'Review Marks'}
          subtitle={
            reviewData?.submission
              ? `${reviewData.submission.examinationName} • ${reviewData.submission.className} - ${reviewData.submission.sectionName} • Teacher: ${reviewData.submission.assignedTeacherName}`
              : ''
          }
          maxWidth="max-w-3xl"
        >
          {reviewLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading submitted marks...</p>
            </div>
          ) : reviewData ? (
            <div className="space-y-4">
              {feedback.message && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {feedback.message}
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Roll</th>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Component Breakdown / Grade</th>
                      <th className="py-2 px-3 text-center">Total</th>
                      <th className="py-2 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reviewData.entries || []).map((ent) => (
                      <tr key={ent._id}>
                        <td className="py-2 px-3 font-mono text-slate-600">{ent.rollNumber}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{ent.studentName}</td>
                        <td className="py-2 px-3">
                          {ent.isAbsent ? (
                            <span className="text-rose-600 font-semibold">Absent</span>
                          ) : ent.grade ? (
                            <span className="font-bold text-indigo-700">{ent.grade}</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(ent.componentMarks || []).map((cm) => (
                                <span key={cm.componentName} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                                  {cm.componentName}: <strong>{cm.marksObtained}/{cm.maximumMarks}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {ent.isAbsent ? 'AB' : ent.grade ? ent.grade : `${ent.totalMarksObtained} / ${ent.totalMaximumMarks}`}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{ent.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Controls for SUBMITTED status */}
              {reviewData.submission?.status === 'SUBMITTED' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Correction Reason (mandatory if returning for correction)
                    </label>
                    <textarea
                      rows={2}
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Specify which student marks or components need correction..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleReturnForCorrection}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Return for Correction
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleVerify}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Verify Marks
                    </button>
                  </div>
                </div>
              )}

              {/* Audit History */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                  <History className="w-3.5 h-3.5 mr-1.5" />
                  Verification &amp; Submission History
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(reviewData.auditHistory || []).map((log) => (
                    <div key={log._id} className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] flex justify-between">
                      <span>
                        <strong>{log.action.replace(/_/g, ' ')}</strong> — {log.details} ({log.performedByName})
                      </span>
                      <span className="text-slate-400 shrink-0 ml-2">
                        {new Date(log.performedAt).toLocaleString('en-GB')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default TeacherMarksVerificationPage;
