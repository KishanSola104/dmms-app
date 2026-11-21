import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import ConfirmationCodeModal from '../../components/admin/ConfirmationCodeModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useUserAuth } from '../../context/UserAuthContext';
import api from '../../services/api';
import {
  UserPlus,
  Edit2,
  UserX,
  UserCheck,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const UserManagementPage = () => {
  const { currentUser } = useUserAuth();

  // Listing State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Alerts
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Create / Edit Modal State
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    designation: '',
    roleCode: 'TEACHER',
    address: '',
    qualification: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Confirmation Code Modal State
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    action: '', // 'DEACTIVATE_USER' | 'DELETE_USER'
    targetUser: null
  });

  // Load Roles & Users
  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    fetchUsers(pagination.currentPage);
  }, [search, roleFilter, statusFilter]);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/admin/roles');
      if (res.success) {
        setRoles(res.roles);
      }
    } catch (err) {
      console.warn('Error fetching roles:', err.message);
    }
  };

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        role: roleFilter,
        status: statusFilter
      });
      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res.success) {
        setUsers(res.users);
        setPagination(res.pagination);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    fetchUsers(newPage);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedUser(null);
    setFormData({
      fullName: '',
      email: '',
      mobileNumber: '',
      designation: '',
      roleCode: roles[0]?.roleCode || 'TEACHER',
      address: '',
      qualification: ''
    });
    setFormError('');
  };

  // Open Edit Modal
  const handleOpenEdit = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      mobileNumber: user.mobileNumber || '',
      designation: user.designation || '',
      roleCode: user.roleCode || 'TEACHER',
      address: user.address || '',
      qualification: user.qualification || ''
    });
    setFormError('');
  };

  // Submit Create / Edit Form
  const handleSubmitUserForm = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/users', formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `User ${res.user.fullName} (${res.user.userId}) created successfully! Credentials emailed.`
          });
          setModalMode(null);
          fetchUsers(1);
        }
      } else if (modalMode === 'edit') {
        const res = await api.put(`/admin/users/${selectedUser.userId}`, formData);
        if (res.success) {
          setAlert({
            type: 'success',
            message: `User details updated successfully.`
          });
          setModalMode(null);
          fetchUsers(pagination.currentPage);
        }
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Activate User Action (No confirmation code needed)
  const handleActivateUser = async (user) => {
    try {
      const res = await api.post('/admin/users/activate', { targetUserId: user.userId });
      if (res.success) {
        setAlert({ type: 'success', message: res.message });
        fetchUsers(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  // Open Deactivate Confirmation Modal
  const handleOpenDeactivate = (user) => {
    if (user.userId === currentUser?.userId) {
      setAlert({ type: 'error', message: 'You cannot deactivate your own administrator account.' });
      return;
    }
    setConfirmationModal({
      isOpen: true,
      action: 'DEACTIVATE_USER',
      targetUser: user
    });
  };

  // Open Delete Confirmation Modal
  const handleOpenDelete = (user) => {
    if (user.userId === currentUser?.userId) {
      setAlert({ type: 'error', message: 'You cannot delete your own administrator account.' });
      return;
    }
    setConfirmationModal({
      isOpen: true,
      action: 'DELETE_USER',
      targetUser: user
    });
  };

  const handleConfirmationSuccess = (msg) => {
    setAlert({ type: 'success', message: msg });
    fetchUsers(pagination.currentPage);
  };

  // Table Columns Definition
  const columns = [
    {
      header: 'Name & User ID',
      accessor: 'fullName',
      render: (u) => (
        <div>
          <p className="font-semibold text-slate-800">{u.fullName}</p>
          <p className="text-xs font-mono text-slate-400 mt-0.5">{u.userId}</p>
        </div>
      )
    },
    {
      header: 'Email',
      accessor: 'email',
      render: (u) => <span className="font-mono text-xs text-slate-600">{u.email}</span>
    },
    {
      header: 'Mobile',
      accessor: 'mobileNumber',
      render: (u) => <span className="text-xs text-slate-600">{u.mobileNumber}</span>
    },
    {
      header: 'Designation / Role',
      accessor: 'roleName',
      render: (u) => (
        <div>
          <span className="text-xs font-medium text-slate-800">{u.designation}</span>
          <span className="block text-[11px] text-blue-600 font-semibold">{u.roleName}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (u) => <StatusBadge status={u.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (u) => {
        const isSelf = u.userId === currentUser?.userId;
        return (
          <div className="flex items-center justify-end space-x-1">
            {/* Edit Button */}
            <button
              type="button"
              onClick={() => handleOpenEdit(u)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit User"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {/* Activate / Deactivate Button */}
            {u.status === 'ACTIVE' ? (
              <button
                type="button"
                onClick={() => handleOpenDeactivate(u)}
                disabled={isSelf}
                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={isSelf ? 'Cannot deactivate self' : 'Deactivate User (Requires Email OTP)'}
              >
                <UserX className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleActivateUser(u)}
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Activate User"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            )}

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => handleOpenDelete(u)}
              disabled={isSelf}
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={isSelf ? 'Cannot delete self' : 'Delete User (Requires Email OTP)'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Header */}
        <AdminPageHeader
          title="User Management"
          description="Manage school administrators, teachers, and staff accounts for your school."
          actionLabel="Create User"
          actionIcon={UserPlus}
          onAction={handleOpenCreate}
        />

        {/* Global Notification Banner */}
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

        {/* Search & Filters */}
        <AdminSearchBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by Name, Email, or User ID..."
          filters={[
            {
              name: 'role',
              label: 'Role',
              value: roleFilter,
              onChange: setRoleFilter,
              options: [
                { value: 'ALL', label: 'All Roles' },
                ...roles.map((r) => ({ value: r.roleCode, label: r.roleName }))
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
                { value: 'INACTIVE', label: 'Deactivated' }
              ]
            }
          ]}
          onReset={() => {
            setSearch('');
            setRoleFilter('ALL');
            setStatusFilter('ALL');
          }}
        />

        {/* Data Table */}
        <AdminDataTable
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="No users found for this school matching the filter criteria."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={handlePageChange}
        />

        {/* Create / Edit User Modal */}
        <AdminModal
          isOpen={modalMode !== null}
          onClose={() => setModalMode(null)}
          title={modalMode === 'create' ? 'Create New User' : 'Edit User Information'}
          subtitle={
            modalMode === 'create'
              ? 'New user will receive account credentials via email.'
              : `Updating profile details for ${selectedUser?.fullName}`
          }
        >
          <form onSubmit={handleSubmitUserForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ramesh@school.edu"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role / Designation Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.roleCode}
                  onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  required
                >
                  {roles.map((r) => (
                    <option key={r.roleCode} value={r.roleCode}>
                      {r.roleName}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Limits: Admin (Max 2), Head Teacher (Max 1)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designation Title
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g. Senior Math Teacher"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {modalMode === 'edit' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    placeholder="e.g. M.Sc, B.Ed"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Residential Address
                  </label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Staff Quarters, Campus A"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </>
            )}

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
                <span>{modalMode === 'create' ? 'Create & Email Credentials' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </AdminModal>

        {/* Confirmation Code Modal for Sensitive Actions */}
        <ConfirmationCodeModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal({ isOpen: false, action: '', targetUser: null })}
          action={confirmationModal.action}
          targetUser={confirmationModal.targetUser}
          onSuccess={handleConfirmationSuccess}
        />
      </div>
    </DashboardLayout>
  );
};

export default UserManagementPage;
