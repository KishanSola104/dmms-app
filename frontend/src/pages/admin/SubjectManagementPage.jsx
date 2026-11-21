import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import api from '../../services/api';
import {
  BookOpen,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Layers
} from 'lucide-react';

const SubjectManagementPage = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  const [alert, setAlert] = useState({ type: '', message: '' });

  // Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [formData, setFormData] = useState({
    subjectCode: '',
    subjectName: '',
    subjectType: 'ACADEMIC'
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchSubjects(pagination.currentPage);
  }, [search, typeFilter, statusFilter]);

  const fetchSubjects = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        type: typeFilter,
        status: statusFilter
      });
      const res = await api.get(`/admin/subjects?${params.toString()}`);
      if (res.success) {
        setSubjects(res.subjects);
        setPagination(res.pagination);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedSubject(null);
    setFormData({
      subjectCode: '',
      subjectName: '',
      subjectType: 'ACADEMIC'
    });
    setFormError('');
  };

  const handleOpenEdit = (s) => {
    setModalMode('edit');
    setSelectedSubject(s);
    setFormData({
      subjectCode: s.subjectCode || '',
      subjectName: s.subjectName || '',
      subjectType: s.subjectType || 'ACADEMIC'
    });
    setFormError('');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/subjects', formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Subject '${res.subject.subjectName}' created successfully.`
          });
          setModalMode(null);
          fetchSubjects(1);
        }
      } else if (modalMode === 'edit') {
        const res = await api.put(`/admin/subjects/${selectedSubject._id}`, formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Subject '${res.subject.subjectName}' updated successfully.`
          });
          setModalMode(null);
          fetchSubjects(pagination.currentPage);
        }
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (s) => {
    const newStatus = s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch(`/admin/subjects/${s._id}/status`, { status: newStatus });
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchSubjects(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const columns = [
    {
      header: 'Subject Code',
      accessor: 'subjectCode',
      render: (s) => <span className="font-mono text-xs font-bold text-slate-800">{s.subjectCode}</span>
    },
    {
      header: 'Subject Name',
      accessor: 'subjectName',
      render: (s) => (
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800">{s.subjectName}</span>
        </div>
      )
    },
    {
      header: 'Subject Type',
      accessor: 'subjectType',
      render: (s) => <StatusBadge status={s.subjectType} label={s.subjectTypeLabel} />
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (s) => <StatusBadge status={s.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            type="button"
            onClick={() => handleOpenEdit(s)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Subject"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleToggleStatus(s)}
            className={`p-1.5 rounded-lg transition-colors ${
              s.status === 'ACTIVE'
                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={s.status === 'ACTIVE' ? 'Deactivate Subject' : 'Activate Subject'}
          >
            {s.status === 'ACTIVE' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-150">
        <AdminPageHeader
          title="Subjects Management"
          description="Configure course subjects categorized into Scholastic (Academic) and Co-Scholastic (Co-curricular) domains."
          actionLabel="Create Subject"
          actionIcon={Plus}
          onAction={handleOpenCreate}
        />

        {alert.message && (
          <div
            className={`p-4 rounded-xl flex items-start space-x-3 text-sm ${
              alert.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            )}
            <div className="flex-1">
              <p className="font-medium">{alert.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setAlert({ type: '', message: '' })}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        <AdminSearchBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by Subject Code or Subject Name..."
          filters={[
            {
              name: 'type',
              label: 'Subject Type',
              value: typeFilter,
              onChange: setTypeFilter,
              options: [
                { value: 'ALL', label: 'All Types' },
                { value: 'ACADEMIC', label: 'Academic (Scholastic)' },
                { value: 'CO_CURRICULAR', label: 'Co-curricular (Co-Scholastic)' }
              ]
            },
            {
              name: 'status',
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' }
              ]
            }
          ]}
          onReset={() => {
            setSearch('');
            setTypeFilter('ALL');
            setStatusFilter('ALL');
          }}
        />

        <AdminDataTable
          columns={columns}
          data={subjects}
          loading={loading}
          emptyMessage="No subjects found matching your criteria."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchSubjects(p)}
        />

        {/* Create / Edit Subject Modal */}
        <AdminModal
          isOpen={modalMode !== null}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Create New Subject' : 'Edit Subject Information'}
          subtitle="Keep Academic and Co-curricular subjects distinguishable for assessment calculations."
        >
          <form onSubmit={handleSubmitForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.subjectCode}
                onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })}
                placeholder="e.g. MATH-101, ENG-01"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.subjectName}
                onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                placeholder="e.g. Mathematics"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.subjectType}
                onChange={(e) => setFormData({ ...formData, subjectType: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                required
              >
                <option value="ACADEMIC">Academic (Scholastic)</option>
                <option value="CO_CURRICULAR">Co-curricular (Co-Scholastic)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Scholastic subjects participate in numerical academic marks calculations.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-all focus:outline-hidden disabled:opacity-50"
              >
                {formSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                <span>{modalMode === 'create' ? 'Create Subject' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default SubjectManagementPage;
