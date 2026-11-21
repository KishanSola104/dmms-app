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
  Layers,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Users
} from 'lucide-react';

const SectionManagementPage = () => {
  const [sections, setSections] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
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
  const [selectedSection, setSelectedSection] = useState(null);
  const [formData, setFormData] = useState({
    classId: '',
    sectionCode: '',
    sectionName: '',
    sectionTeacherId: '',
    maxCapacity: 40
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchSections(pagination.currentPage);
  }, [search, classFilter, statusFilter]);

  const fetchMetadata = async () => {
    try {
      const [classRes, teacherRes] = await Promise.all([
        api.get('/admin/classes?limit=100'),
        api.get('/admin/teachers')
      ]);

      if (classRes.success) {
        setClassesList(classRes.classes);
      }
      if (teacherRes.success) {
        setTeachers(teacherRes.teachers);
      }
    } catch (err) {
      console.warn('Error fetching metadata:', err.message);
    }
  };

  const fetchSections = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        classId: classFilter,
        status: statusFilter
      });
      const res = await api.get(`/admin/sections?${params.toString()}`);
      if (res.success) {
        setSections(res.sections);
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
    setSelectedSection(null);
    setFormData({
      classId: classesList[0]?._id || '',
      sectionCode: '',
      sectionName: '',
      sectionTeacherId: '',
      maxCapacity: 40
    });
    setFormError('');
  };

  const handleOpenEdit = (s) => {
    setModalMode('edit');
    setSelectedSection(s);
    setFormData({
      classId: s.classId || '',
      sectionCode: s.sectionCode || '',
      sectionName: s.sectionName || '',
      sectionTeacherId: s.sectionTeacherId || '',
      maxCapacity: s.maxCapacity || 40
    });
    setFormError('');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/sections', formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Section '${res.section.sectionName}' created successfully. Class capacity updated.`
          });
          setModalMode(null);
          fetchSections(1);
        }
      } else if (modalMode === 'edit') {
        const res = await api.put(`/admin/sections/${selectedSection._id}`, formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Section '${res.section.sectionName}' updated successfully.`
          });
          setModalMode(null);
          fetchSections(pagination.currentPage);
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
      const res = await api.patch(`/admin/sections/${s._id}/status`, { status: newStatus });
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchSections(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const columns = [
    {
      header: 'Section Code',
      accessor: 'sectionCode',
      render: (s) => <span className="font-mono text-xs font-bold text-slate-800">{s.sectionCode}</span>
    },
    {
      header: 'Section Name',
      accessor: 'sectionName',
      render: (s) => (
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800">{s.sectionName}</span>
        </div>
      )
    },
    {
      header: 'Class',
      accessor: 'className',
      render: (s) => (
        <div>
          <span className="text-xs font-semibold text-slate-800">{s.className}</span>
          <span className="block text-[11px] font-mono text-slate-400">{s.classCode}</span>
        </div>
      )
    },
    {
      header: 'Section Teacher',
      accessor: 'sectionTeacherName',
      render: (s) => (
        <span className="text-xs text-slate-700 font-medium">
          {s.sectionTeacherName || <span className="text-slate-400 italic">Not Assigned</span>}
        </span>
      )
    },
    {
      header: 'Max Capacity',
      accessor: 'maxCapacity',
      render: (s) => (
        <div className="flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-800">{s.maxCapacity} students</span>
        </div>
      )
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
            title="Edit Section"
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
            title={s.status === 'ACTIVE' ? 'Deactivate Section' : 'Activate Section'}
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
          title="Section Management"
          description="Manage classroom divisions, assign section teachers, and configure seat capacities."
          actionLabel="Create Section"
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
          searchPlaceholder="Search by Section Code, Name, or Class..."
          filters={[
            {
              name: 'class',
              label: 'Class',
              value: classFilter,
              onChange: setClassFilter,
              options: [
                { value: 'ALL', label: 'All Classes' },
                ...classesList.map((c) => ({ value: c._id, label: c.className }))
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
            setClassFilter('ALL');
            setStatusFilter('ALL');
          }}
        />

        <AdminDataTable
          columns={columns}
          data={sections}
          loading={loading}
          emptyMessage="No sections found matching your criteria."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchSections(p)}
        />

        {/* Create / Edit Section Modal */}
        <AdminModal
          isOpen={modalMode !== null}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Create New Section' : 'Edit Section Information'}
          subtitle="Define section code and maximum student capacity."
        >
          <form onSubmit={handleSubmitForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Class <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                required
              >
                <option value="">-- Choose Class --</option>
                {classesList.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.className} ({c.classCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.sectionCode}
                  onChange={(e) => setFormData({ ...formData, sectionCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. A, B, C"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.sectionName}
                  onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                  placeholder="e.g. Section A"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section Teacher
              </label>
              <select
                value={formData.sectionTeacherId}
                onChange={(e) => setFormData({ ...formData, sectionTeacherId: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Select Section Teacher (Optional) --</option>
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
                Maximum Student Capacity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.maxCapacity}
                onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
                placeholder="e.g. 40"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This capacity will automatically increment the parent class's total capacity.
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
                <span>{modalMode === 'create' ? 'Create Section' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default SectionManagementPage;
