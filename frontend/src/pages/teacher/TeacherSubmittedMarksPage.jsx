import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Send,
  Eye,
  Edit3,
  RefreshCw,
  AlertCircle,
  Loader2,
  History,
  AlertTriangle
} from 'lucide-react';

const TeacherSubmittedMarksPage = () => {
  const navigate = useNavigate();
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [entryTypeFilter, setEntryTypeFilter] = useState('ALL');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (entryTypeFilter !== 'ALL') params.append('entryType', entryTypeFilter);

      const res = await api.get(`/teacher/marks/submitted?${params.toString()}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        setSubmissions(res.submissions || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load submitted marks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [academicYearId, statusFilter, entryTypeFilter]);

  const handleOpenDetails = async (item) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await api.get(`/teacher/marks/submissions/${item._id}`);
      if (res.success) {
        setDetailData(res);
      }
    } catch (err) {
      console.error('[SubmittedMarks] Detail fetch error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGoToEdit = (item) => {
    if (item.entryType === 'EXTRA_COMPONENT') {
      navigate('/teacher/extra-components');
    } else if (item.entryType === 'CO_CURRICULAR_TERM' || item.entryType === 'CO_CURRICULAR_FINAL') {
      navigate('/teacher/co-curricular-grades');
    } else {
      navigate('/teacher/marks-entry');
    }
  };

  const columns = [
    {
      header: 'Examination / Period',
      accessor: 'examinationName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900">{item.examinationName}</span>
          <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">
            {item.examinationCode}
          </span>
        </div>
      )
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
      header: 'Submission Date',
      accessor: 'submittedAt',
      render: (item) =>
        item.submittedAt ? (
          <span className="text-xs text-slate-600">
            {new Date(item.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">Not submitted</span>
        )
    },
    {
      header: 'Entered / Total',
      accessor: 'marksEntered',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {item.marksEntered} / {item.totalStudents}
        </span>
      )
    },
    {
      header: 'Submission Status',
      accessor: 'submissionStatus',
      render: (item) => (
        <div className="space-y-1">
          <StatusBadge status={item.submissionStatus} />
          {item.returnReason && (
            <p className="text-[11px] text-rose-700 max-w-xs line-clamp-2">Reason: {item.returnReason}</p>
          )}
        </div>
      )
    },
    {
      header: 'Verification Status',
      accessor: 'verificationStatus',
      render: (item) => <StatusBadge status={item.verificationStatus} />
    },
    {
      header: 'Action',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenDetails(item)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            View
          </button>
          {['DRAFT', 'RETURNED'].includes(item.submissionStatus) && (
            <button
              type="button"
              onClick={() => handleGoToEdit(item)}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              {item.submissionStatus === 'RETURNED' ? 'Fix' : 'Edit'}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Submitted Marks</h1>
            <p className="mt-1 text-sm text-slate-500">
              Track your saved drafts, submitted marks, verification progress, and returned submissions requiring correction.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSubmissions}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg self-start"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            {availableYears.map((y) => (
              <option key={y._id} value={y._id}>
                {y.yearName || y.yearCode} {y.isCurrent ? '(Active)' : ''}
              </option>
            ))}
          </select>

          <select
            value={entryTypeFilter}
            onChange={(e) => setEntryTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="ALL">All Assessment Types</option>
            <option value="EXAM_ACADEMIC">Examination Marks</option>
            <option value="EXTRA_COMPONENT">Extra / Project Components</option>
            <option value="CO_CURRICULAR_TERM">Co-curricular (Term)</option>
            <option value="CO_CURRICULAR_FINAL">Co-curricular (Final)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="RETURNED">Returned for Correction</option>
            <option value="VERIFIED">Verified</option>
          </select>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-2 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <AdminDataTable
          columns={columns}
          data={submissions}
          loading={loading}
          emptyMessage="No marks submissions found for the selected filters."
        />

        {/* Submission Detail Modal */}
        <AdminModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={detailData?.submission ? `${detailData.submission.subjectName} — Submission Details` : 'Submission Details'}
          subtitle={
            detailData?.submission
              ? `${detailData.submission.examinationName} • ${detailData.submission.className} - ${detailData.submission.sectionName}`
              : ''
          }
          maxWidth="max-w-3xl"
        >
          {detailLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading submission details...</p>
            </div>
          ) : detailData ? (
            <div className="space-y-4">
              {detailData.submission.returnReason && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Correction Remarks</p>
                    <p>{detailData.submission.returnReason}</p>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Roll</th>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Score / Grade</th>
                      <th className="py-2 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(detailData.entries || []).map((ent) => (
                      <tr key={ent._id}>
                        <td className="py-2 px-3 font-mono text-slate-600">{ent.rollNumber}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{ent.studentName}</td>
                        <td className="py-2 px-3 font-mono font-bold">
                          {ent.isAbsent ? (
                            <span className="text-rose-600">Absent</span>
                          ) : ent.grade ? (
                            ent.grade
                          ) : (
                            `${ent.totalMarksObtained ?? '—'} / ${ent.totalMaximumMarks}`
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{ent.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center">
                  <History className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Audit History
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(detailData.auditHistory || []).map((log) => (
                    <div key={log._id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] flex justify-between">
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

export default TeacherSubmittedMarksPage;
