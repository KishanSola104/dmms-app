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
  GraduationCap,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Users
} from 'lucide-react';

const ClassManagementPage = () => {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
  const [selectedClass, setSelectedClass] = useState(null);
  const [formData, setFormData] = useState({
    classCode: '',
    className: '',
    classTeacherId: '',
    numberOfSections: 1
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchEligibleTeachers();
  }, []);

  useEffect(() => {
    fetchClasses(pagination.currentPage);
  }, [search, statusFilter]);

  const fetchEligibleTeachers = async () => {
    try {
      const res = await api.get('/admin/teachers');
      if (res.success) {
        setTeachers(res.teachers);
      }
    } catch (err) {
      console.warn('Error fetching teachers:', err.message);
    }
  };

  const fetchClasses = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const res = await api.get(`/admin/classes?${params.toString()}`);
      if (res.success) {
        setClasses(res.classes);
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
    setSelectedClass(null);
    setFormData({
      classCode: '',
      className: '',
      classTeacherId: '',
      numberOfSections: 1
    });
    setFormError('');
  };

  const handleOpenEdit = (c) => {
    setModalMode('edit');
    setSelectedClass(c);
    setFormData({
      classCode: c.classCode || '',
      className: c.className || '',
      classTeacherId: c.classTeacherId || '',
      numberOfSections: c.plannedSections || 1
    });
    setFormError('');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/classes', formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Class '${res.class.className}' created successfully.`
          });
          setModalMode(null);
          fetchClasses(1);
        }
      } else if (modalMode === 'edit') {
        const res = await api.put(`/admin/classes/${selectedClass._id}`, formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Class '${res.class.className}' updated successfully.`
          });
          setModalMode(null);
          fetchClasses(pagination.currentPage);
        }
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (c) => {
    const newStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.patch(`/admin/classes/${c._id}/status`, { status: newStatus });
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchClasses(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const columns = [
    {
      header: 'Class Code',
      accessor: 'classCode',
      render: (c) => <span className="font-mono text-xs font-bold text-slate-800">{c.classCode}</span>
    },
    {
      header: 'Class Name',
      accessor: 'className',
      render: (c) => (
        <div className="flex items-center space-x-2">
          <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800">{c.className}</span>
        </div>
      )
    },
    {
      header: 'Number of Sections',
      accessor: 'actualSectionsCount',
      render: (c) => (
        <div className="text-xs text-slate-700">
          <span className="font-semibold text-blue-700">{c.actualSectionsCount}</span>
          <span className="text-slate-400"> (Planned: {c.plannedSections})</span>
        </div>
      )
    },
    {
      header: 'Class Teacher',
      accessor: 'classTeacherName',
      render: (c) => (
        <div className="text-xs text-slate-700 font-medium">
          {c.classTeacherName || <span className="text-slate-400 italic">Not Assigned</span>}
        </div>
      )
    },
    {
      header: 'Total Capacity',
      accessor: 'totalCapacity',
      render: (c) => (
        <div className="flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-800">{c.totalCapacity} students</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (c) => <StatusBadge status={c.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            type="button"
            onClick={() => handleOpenEdit(c)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Class"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleToggleStatus(c)}
            className={`p-1.5 rounded-lg transition-colors ${
              c.status === 'ACTIVE'
                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={c.status === 'ACTIVE' ? 'Deactivate Class' : 'Activate Class'}
          >
            {c.status === 'ACTIVE' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-150">
        <AdminPageHeader
          title="Class Management"
          description="Manage educational grades and classes. Total class capacity calculates automatically from sections."
          actionLabel="Create Class"
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
          searchPlaceholder="Search by Class Code or Class Name..."
          filters={[
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
            setStatusFilter('ALL');
          }}
        />

        <AdminDataTable
          columns={columns}
          data={classes}
          loading={loading}
          emptyMessage="No classes found matching your criteria."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchClasses(p)}
        />

        {/* Create / Edit Class Modal */}
        <AdminModal
          isOpen={modalMode !== null}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Create New Class' : 'Edit Class Information'}
          subtitle="Total maximum capacity will be calculated automatically from all active sections."
        >
          <form onSubmit={handleSubmitForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.classCode}
                  onChange={(e) => setFormData({ ...formData, classCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. 1ST, JR-KG"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  placeholder="e.g. 1st Standard"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Class Teacher
              </label>
              <select
                value={formData.classTeacherId}
                onChange={(e) => setFormData({ ...formData, classTeacherId: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Select Class Teacher (Optional) --</option>
                {teachers.map((t) => (
                  <option key={t.employeeId} value={t.employeeId}>
                    {t.fullName} ({t.roleName})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Showing eligible active Teachers &amp; Head Teacher from this school.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Planned Number of Sections <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.numberOfSections}
                onChange={(e) => setFormData({ ...formData, numberOfSections: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
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
                <span>{modalMode === 'create' ? 'Create Class' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default ClassManagementPage;
