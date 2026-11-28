import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import api from '../../services/api';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  User,
  Phone,
  Mail,
  Users,
  Clock,
  History,
  Edit2,
  UserX,
  UserCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Camera,
  Plus,
  Download
} from 'lucide-react';

const StudentProfilePage = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [currentEnrollment, setCurrentEnrollment] = useState(null);
  const [allEnrollments, setAllEnrollments] = useState([]);
  const [enrollmentHistory, setEnrollmentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Quick Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    profilePhotoUrl: '',
    phone: '',
    email: '',
    guardianDetails: []
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [studentId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/students/${studentId}`);
      if (res.success) {
        setStudent(res.student);
        setCurrentEnrollment(res.currentEnrollment);
        setAllEnrollments(res.allEnrollments || []);
        setEnrollmentHistory(res.enrollmentHistory || []);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load student profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (!student) return;
    setEditError('');
    setEditForm({
      firstName: student.firstName || '',
      middleName: student.middleName || '',
      lastName: student.lastName || '',
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
      gender: student.gender || 'MALE',
      profilePhotoUrl: student.profilePhotoUrl || '',
      phone: student.contact?.phone || '',
      email: student.contact?.email || '',
      guardianDetails: (student.guardianDetails && student.guardianDetails.length > 0)
        ? student.guardianDetails.map(g => ({ ...g }))
        : [{ fullName: '', relationship: 'FATHER', mobileNumber: '', email: '', isPrimaryContact: true }]
    });
    setEditModalOpen(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError('Please upload a valid image file (JPEG, PNG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setEditError('Image file size must be less than 2MB.');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setPhotoUploading(true);
    setEditError('');

    try {
      const res = await api.post('/admin/students/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setEditForm((prev) => ({ ...prev, profilePhotoUrl: res.photoUrl }));
      }
    } catch (err) {
      setEditError(err.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleAddGuardian = () => {
    setEditForm((prev) => ({
      ...prev,
      guardianDetails: [
        ...prev.guardianDetails,
        {
          fullName: '',
          relationship: 'MOTHER',
          mobileNumber: '',
          email: '',
          isPrimaryContact: prev.guardianDetails.length === 0
        }
      ]
    }));
  };

  const handleRemoveGuardian = (index) => {
    if (editForm.guardianDetails.length === 1) {
      setEditError('At least one guardian detail must be retained.');
      return;
    }
    const updated = editForm.guardianDetails.filter((_, i) => i !== index);
    if (!updated.some((g) => g.isPrimaryContact) && updated.length > 0) {
      updated[0].isPrimaryContact = true;
    }
    setEditForm((prev) => ({ ...prev, guardianDetails: updated }));
  };

  const handleGuardianChange = (index, field, value) => {
    const updated = [...editForm.guardianDetails];
    if (field === 'isPrimaryContact') {
      updated.forEach((g, i) => {
        g.isPrimaryContact = i === index;
      });
    } else {
      updated[index][field] = value;
    }
    setEditForm((prev) => ({ ...prev, guardianDetails: updated }));
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError('');

    try {
      const payload = {
        firstName: editForm.firstName,
        middleName: editForm.middleName,
        lastName: editForm.lastName,
        dateOfBirth: editForm.dateOfBirth,
        gender: editForm.gender,
        profilePhotoUrl: editForm.profilePhotoUrl,
        contact: {
          phone: editForm.phone,
          email: editForm.email
        },
        guardianDetails: editForm.guardianDetails
      };

      const res = await api.put(`/admin/students/${student._id}`, payload);
      if (res.success) {
        setAlert({
          type: 'success',
          message: 'Student details updated successfully.'
        });
        setEditModalOpen(false);
        fetchProfile();
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update student.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!student) return;
    setStatusSubmitting(true);

    try {
      const targetStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await api.patch(`/admin/students/${student._id}/status`, {
        status: targetStatus
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: `Student marked as ${targetStatus}.`
        });
        setStatusModalOpen(false);
        fetchProfile();
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to update status.' });
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch(`/api/admin/students/${student._id}/export/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('dmms_user_token') || ''}`,
          'x-school-token': localStorage.getItem('dmms_school_token') || ''
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to generate PDF.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'PDF export failed.' });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading student profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="py-24 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Student Not Found</h2>
          <p className="text-sm text-slate-500">The requested student could not be found or you do not have permission to view it.</p>
          <button
            onClick={() => navigate('/admin/students')}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
          >
            Back to Student Directory
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const fullName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/students')}
            className="flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Student Directory</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handleOpenEdit}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit Details</span>
            </button>
            <button
              onClick={() => setStatusModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs ${
                student.status === 'ACTIVE'
                  ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {student.status === 'ACTIVE' ? (
                <>
                  <UserX className="w-3.5 h-3.5 text-red-600" />
                  <span>Deactivate Student</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reactivate Student</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert.message && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border shadow-sm ${
              alert.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
            <button onClick={() => setAlert({ type: '', message: '' })} className="p-1 hover:bg-black/5 rounded-lg">
              ✕
            </button>
          </div>
        )}

        {/* Main Profile Header Banner Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
            {/* Student Photo */}
            <div className="w-24 h-24 rounded-2xl bg-blue-50 border-2 border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
              {student.profilePhotoUrl ? (
                <img
                  src={student.profilePhotoUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-blue-600">
                  {student.firstName?.[0]}
                  {student.lastName?.[0]}
                </span>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
                <StatusBadge status={student.status} />
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded-lg border border-slate-200">
                  Adm: {student.admissionNumber}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                <div className="flex items-center space-x-1.5">
                  <GraduationCap className="w-4 h-4 text-blue-500" />
                  <span>
                    Current Class:{' '}
                    <strong>
                      {currentEnrollment?.classRef?.className || 'Not Enrolled'}{' '}
                      {currentEnrollment?.sectionRef?.sectionName
                        ? `(Sec: ${currentEnrollment.sectionRef.sectionName})`
                        : ''}
                    </strong>
                  </span>
                </div>
                {currentEnrollment?.rollNumber && (
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold">
                      Roll #{currentEnrollment.rollNumber}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>
                    DOB:{' '}
                    {student.dateOfBirth
                      ? new Date(student.dateOfBirth).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="capitalize">{student.gender?.toLowerCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Grid Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Personal & Admission Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
              <User className="w-4 h-4 text-blue-600" />
              <span>Personal &amp; Admission Details</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Full Name</span>
                <span className="text-slate-800 font-semibold">{fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Admission Number</span>
                <span className="text-slate-800 font-mono font-semibold">{student.admissionNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Date of Birth</span>
                <span className="text-slate-800 font-medium">
                  {student.dateOfBirth
                    ? new Date(student.dateOfBirth).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Gender</span>
                <span className="text-slate-800 font-medium capitalize">{student.gender?.toLowerCase()}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Student Mobile</span>
                <span className="text-slate-800 font-medium">{student.contact?.phone || 'Not Provided'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Student Email</span>
                <span className="text-slate-800 font-medium">{student.contact?.email || 'Not Provided'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Admission Date</span>
                <span className="text-slate-800 font-medium">
                  {student.admissionDate
                    ? new Date(student.admissionDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Initial Admission Class</span>
                <span className="text-slate-800 font-medium">
                  {student.admissionClassRef?.className || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Guardian Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Guardian Information</span>
            </div>

            <div className="space-y-3">
              {(student.guardianDetails || []).map((guardian, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border text-xs space-y-2 ${
                    guardian.isPrimaryContact
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                      <span>{guardian.fullName}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                        {guardian.relationship}
                      </span>
                    </div>
                    {guardian.isPrimaryContact && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white font-semibold rounded-full text-[10px]">
                        Primary Contact
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${guardian.mobileNumber}`} className="hover:text-blue-600 hover:underline">
                        {guardian.mobileNumber}
                      </a>
                    </div>
                    {guardian.email && (
                      <div className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <a href={`mailto:${guardian.email}`} className="hover:text-blue-600 hover:underline truncate">
                          {guardian.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Academic Year Placement History */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span>Academic Year Enrollment Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <th className="py-2.5 px-3">Academic Year</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Enrollment Date</th>
                  <th className="py-2.5 px-3">Enrollment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-slate-400 italic">
                      No enrollments found for this student.
                    </td>
                  </tr>
                ) : (
                  allEnrollments.map((enr) => (
                    <tr key={enr._id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {enr.academicYearRef?.yearName || 'N/A'}{' '}
                        {enr.academicYearRef?.isCurrent && (
                          <span className="text-[10px] text-emerald-600 font-bold ml-1">(Current)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-800">{enr.classRef?.className || 'N/A'}</td>
                      <td className="py-3 px-3 text-slate-800">{enr.sectionRef?.sectionName || 'N/A'}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {enr.rollNumber ? `#${enr.rollNumber}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {enr.enrollmentDate
                          ? new Date(enr.enrollmentDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={enr.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 4: Complete Transition & Transfer History Audit Timeline */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
            <History className="w-4 h-4 text-amber-600" />
            <span>Academic Transition &amp; Transfer History</span>
          </div>

          <div className="space-y-3">
            {enrollmentHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No history recorded yet.</p>
            ) : (
              enrollmentHistory.map((h, i) => (
                <div
                  key={h._id || i}
                  className="flex items-start space-x-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                        {h.changeType}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {h.changedAt
                          ? new Date(h.changedAt).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : ''}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {h.changeType === 'ADMISSION' && (
                        <span>
                          Initial admission into{' '}
                          <strong>
                            {h.newClassRef?.className} - {h.newSectionRef?.sectionName}
                          </strong>
                        </span>
                      )}
                      {h.changeType === 'SECTION_TRANSFER' && (
                        <span>
                          Transferred from {h.previousSectionRef?.sectionName || 'Previous'} to{' '}
                          <strong>{h.newSectionRef?.sectionName}</strong>
                        </span>
                      )}
                      {h.changeType === 'PROMOTION' && (
                        <span>
                          Promoted from {h.previousClassRef?.className} to{' '}
                          <strong>{h.newClassRef?.className}</strong>
                        </span>
                      )}
                      {h.changeType === 'REPETITION' && (
                        <span>
                          Retained in <strong>{h.newClassRef?.className}</strong>
                        </span>
                      )}
                    </p>
                    {h.remarks && (
                      <p className="text-[11px] text-slate-500 italic">"{h.remarks}"</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* EDIT MODAL */}
        <AdminModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit Student Details: ${student.admissionNumber}`}
          size="2xl"
        >
          <form onSubmit={handleSubmitEdit} className="space-y-6">
            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Profile Photo */}
            <div className="flex items-center space-x-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="relative group w-20 h-20 rounded-full border-2 border-slate-300 overflow-hidden bg-white shadow-xs flex-shrink-0 flex items-center justify-center">
                {editForm.profilePhotoUrl ? (
                  <img src={editForm.profilePhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-400">{editForm.firstName?.[0] || 'S'}</span>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Change Profile Photo</label>
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Upload New Photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  {editForm.profilePhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, profilePhotoUrl: '' }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">First Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Middle Name</label>
                <input
                  type="text"
                  value={editForm.middleName}
                  onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Last Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* DOB & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Gender *</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Student Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Student Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Guardians */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Guardians</h4>
                <button
                  type="button"
                  onClick={handleAddGuardian}
                  className="px-2.5 py-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Guardian</span>
                </button>
              </div>

              {editForm.guardianDetails.map((guardian, index) => (
                <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Guardian #{index + 1}</span>
                    {editForm.guardianDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGuardian(index)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        required
                        value={guardian.fullName}
                        onChange={(e) => handleGuardianChange(index, 'fullName', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <select
                        value={guardian.relationship}
                        onChange={(e) => handleGuardianChange(index, 'relationship', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      >
                        <option value="FATHER">Father</option>
                        <option value="MOTHER">Mother</option>
                        <option value="GUARDIAN">Guardian</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Mobile *"
                        required
                        value={guardian.mobileNumber}
                        onChange={(e) => handleGuardianChange(index, 'mobileNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <input
                      type="email"
                      placeholder="Email (Optional)"
                      value={guardian.email || ''}
                      onChange={(e) => handleGuardianChange(index, 'email', e.target.value)}
                      className="w-2/3 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="primaryGuardianProfile"
                        checked={guardian.isPrimaryContact}
                        onChange={() => handleGuardianChange(index, 'isPrimaryContact', true)}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-xs font-semibold text-slate-700">Primary Contact</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {editSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </AdminModal>

        {/* STATUS TOGGLE MODAL */}
        <AdminModal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title={student.status === 'ACTIVE' ? 'Deactivate Student' : 'Reactivate Student'}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to {student.status === 'ACTIVE' ? 'deactivate' : 'reactivate'}{' '}
              <strong>{fullName}</strong>?
            </p>
            <p className="text-xs text-slate-500">
              {student.status === 'ACTIVE'
                ? 'All historical enrollments, attendance, and exam records are strictly preserved.'
                : 'The student will become active again in the system.'}
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusSubmitting}
                onClick={handleConfirmToggleStatus}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white ${
                  student.status === 'ACTIVE' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusSubmitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default StudentProfilePage;
