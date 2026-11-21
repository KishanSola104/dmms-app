import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  CalendarPlus,
  Edit2,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Loader2
} from 'lucide-react';

const AcademicYearManagementPage = () => {
  const { fetchAcademicYears: refreshHeaderYears } = useAcademicYear();

  // Listing State
  const [academicYears, setAcademicYears] = useState([]);
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

  // Create / Edit Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedYear, setSelectedYear] = useState(null);
  const [formData, setFormData] = useState({
    yearName: '',
    startDate: '',
    endDate: '',
    isCurrent: false
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchYears(pagination.currentPage);
  }, [search, statusFilter]);

  const fetchYears = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });
      const res = await api.get(`/admin/academic-years?${params.toString()}`);
      if (res.success) {
        setAcademicYears(res.academicYears);
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
    setSelectedYear(null);
    const now = new Date();
    const curYear = now.getFullYear();
    setFormData({
      yearName: `Academic Year ${curYear}-${curYear + 1}`,
      startDate: `${curYear}-06-01`,
      endDate: `${curYear + 1}-05-31`,
      isCurrent: false
    });
    setFormError('');
  };

  const handleOpenEdit = (year) => {
    setModalMode('edit');
    setSelectedYear(year);
    const startStr = year.startDate ? new Date(year.startDate).toISOString().split('T')[0] : '';
    const endStr = year.endDate ? new Date(year.endDate).toISOString().split('T')[0] : '';
    setFormData({
      yearName: year.yearName || '',
      startDate: startStr,
      endDate: endStr,
      isCurrent: year.isCurrent || false
    });
    setFormError('');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/academic-years', formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Academic year '${res.academicYear.yearName}' created successfully.`
          });
          setModalMode(null);
          fetchYears(1);
          await refreshHeaderYears();
        }
      } else if (modalMode === 'edit') {
        const res = await api.put(`/admin/academic-years/${selectedYear._id}`, formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `Academic year '${res.academicYear.yearName}' updated successfully.`
          });
          setModalMode(null);
          fetchYears(pagination.currentPage);
          await refreshHeaderYears();
        }
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSetAsCurrent = async (year) => {
    if (year.isCurrent) return;

    if (!window.confirm(`Set '${year.yearName}' as the Current Academic Year for the school?`)) {
      return;
    }

    try {
      const res = await api.put(`/admin/academic-years/${year._id}/set-current`);
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchYears(pagination.currentPage);
        await refreshHeaderYears();
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const columns = [
    {
      header: 'Academic Year Name',
      accessor: 'yearName',
      render: (y) => (
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold text-slate-800">{y.yearName}</p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">Code: {y.yearCode}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Start Date',
      accessor: 'startDate',
      render: (y) => <span className="text-xs font-medium text-slate-700">{formatDate(y.startDate)}</span>
    },
    {
      header: 'End Date',
      accessor: 'endDate',
      render: (y) => <span className="text-xs font-medium text-slate-700">{formatDate(y.endDate)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (y) => <StatusBadge status={y.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (y) => (
        <div className="flex items-center justify-end space-x-2">
          {!y.isCurrent && y.status !== 'FINISHED' && y.status !== 'UPCOMING' && (
            <button
              type="button"
              onClick={() => handleSetAsCurrent(y)}
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              title="Set as Current Academic Year"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Set Current</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenEdit(y)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Academic Year"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-150">
        <AdminPageHeader
          title="Academic Year Management"
          description="Configure and manage school academic calendar sessions and active terms."
          actionLabel="Create Academic Year"
          actionIcon={CalendarPlus}
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
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
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
          searchPlaceholder="Search by Year Name or Code..."
          filters={[
            {
              name: 'status',
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'ALL', label: 'All Statuses' },
                { value: 'CURRENT', label: 'Current' },
                { value: 'UPCOMING', label: 'Upcoming' },
                { value: 'FINISHED', label: 'Past / Finished' }
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
          data={academicYears}
          loading={loading}
          emptyMessage="No academic years found matching your search or filters."
        />

        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchYears(p)}
        />

        {/* Create / Edit Modal */}
        <AdminModal
          isOpen={modalMode !== null}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Create Academic Year' : 'Edit Academic Year'}
          subtitle="Configure session dates. Past years cannot be created."
        >
          <form onSubmit={handleSubmitForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Year Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.yearName}
                onChange={(e) => setFormData({ ...formData, yearName: e.target.value })}
                placeholder="e.g. Academic Year 2026-2027"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCurrent}
                  onChange={(e) => setFormData({ ...formData, isCurrent: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 border-slate-300 w-4 h-4 cursor-pointer"
                />
                <span>Set as Current Academic Year (Only valid if today is in date range)</span>
              </label>
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
                <span>{modalMode === 'create' ? 'Create Academic Year' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default AcademicYearManagementPage;
