import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminModal from '../../components/admin/AdminModal';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  UserPlus,
  Camera,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  GraduationCap,
  Users,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  Info,
  Check
} from 'lucide-react';

const StudentAdmissionPage = () => {
  const navigate = useNavigate();
  const { academicYears, selectedYear } = useAcademicYear();

  // Academic Dropdowns
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Personal Info
    admissionNumberMethod: 'AUTO', // 'AUTO' or 'MANUAL'
    admissionNumber: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    profilePhotoUrl: '',
    phone: '',
    email: '',

    // Guardian Info (at least 1, 1 primary)
    guardianDetails: [
      {
        fullName: '',
        relationship: 'FATHER',
        mobileNumber: '',
        email: '',
        isPrimaryContact: true
      }
    ],

    // Placement & Admission
    academicYearRef: '',
    classRef: '',
    sectionRef: '',
    rollNumberMethod: 'AUTO', // 'AUTO' or 'MANUAL'
    rollNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  // Photo Upload State
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');

  // Auto Number Previews
  const [autoAdmissionPreview, setAutoAdmissionPreview] = useState('');
  const [loadingAutoAdmission, setLoadingAutoAdmission] = useState(false);
  const [autoRollPreview, setAutoRollPreview] = useState('');
  const [loadingAutoRoll, setLoadingAutoRoll] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ type: '', message: '' });
  const [successModalData, setSuccessModalData] = useState(null);

  // 1. Initial Load: Academic Year and Classes
  useEffect(() => {
    if (selectedYear?._id) {
      setFormData((prev) => ({ ...prev, academicYearRef: selectedYear._id }));
    }
    fetchClasses();
    fetchNextAdmissionNumber();
  }, [selectedYear?._id]);

  // 2. When Class changes, fetch Sections for that Class
  useEffect(() => {
    if (formData.classRef) {
      fetchSections(formData.classRef);
    } else {
      setSections([]);
      setFormData((prev) => ({ ...prev, sectionRef: '', rollNumber: '' }));
    }
  }, [formData.classRef]);

  // 3. When Section or Academic Year changes and Roll Number is AUTO, fetch next Roll Number
  useEffect(() => {
    if (
      formData.academicYearRef &&
      formData.classRef &&
      formData.sectionRef &&
      formData.rollNumberMethod === 'AUTO'
    ) {
      fetchNextRollNumber(formData.academicYearRef, formData.classRef, formData.sectionRef);
    }
  }, [formData.academicYearRef, formData.classRef, formData.sectionRef, formData.rollNumberMethod]);

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await api.get('/admin/classes?status=ACTIVE&limit=100');
      if (res.success && res.classes) {
        setClasses(res.classes);
      }
    } catch (err) {
      console.warn('Failed to load classes:', err.message);
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchSections = async (classId) => {
    setLoadingSections(true);
    try {
      const res = await api.get(`/admin/sections?classId=${classId}&status=ACTIVE&limit=100`);
      if (res.success && res.sections) {
        setSections(res.sections);
        if (res.sections.length > 0 && !formData.sectionRef) {
          setFormData((prev) => ({ ...prev, sectionRef: res.sections[0]._id }));
        }
      }
    } catch (err) {
      console.warn('Failed to load sections:', err.message);
    } finally {
      setLoadingSections(false);
    }
  };

  const fetchNextAdmissionNumber = async () => {
    setLoadingAutoAdmission(true);
    try {
      const res = await api.get('/admin/students/next-admission-number');
      if (res.success && res.nextAdmissionNumber) {
        setAutoAdmissionPreview(res.nextAdmissionNumber);
      }
    } catch (err) {
      console.warn('Failed to load next admission number:', err.message);
    } finally {
      setLoadingAutoAdmission(false);
    }
  };

  const fetchNextRollNumber = async (ayRef, cRef, sRef) => {
    setLoadingAutoRoll(true);
    try {
      const res = await api.get(
        `/admin/students/next-roll-number?academicYearRef=${ayRef}&classRef=${cRef}&sectionRef=${sRef}`
      );
      if (res.success && res.nextRollNumber) {
        setAutoRollPreview(res.nextRollNumber);
      }
    } catch (err) {
      console.warn('Failed to load next roll number:', err.message);
    } finally {
      setLoadingAutoRoll(false);
    }
  };

  // Photo Upload Handler
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setAlert({ type: 'error', message: 'Photo size cannot exceed 2MB.' });
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setAlert({ type: 'error', message: 'Only JPG, JPEG, and PNG images are allowed.' });
      return;
    }

    setPhotoUploading(true);
    setAlert({ type: '', message: '' });

    const uploadPayload = new FormData();
    uploadPayload.append('photo', file);

    try {
      const res = await api.post('/admin/students/upload-photo', uploadPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success && res.photoUrl) {
        setFormData((prev) => ({ ...prev, profilePhotoUrl: res.photoUrl }));
        setPhotoPreview(URL.createObjectURL(file));
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to upload photo.' });
    } finally {
      setPhotoUploading(false);
    }
  };

  // Guardian Management
  const handleAddGuardian = () => {
    setFormData((prev) => ({
      ...prev,
      guardianDetails: [
        ...prev.guardianDetails,
        {
          fullName: '',
          relationship: 'MOTHER',
          mobileNumber: '',
          email: '',
          isPrimaryContact: false
        }
      ]
    }));
  };

  const handleRemoveGuardian = (index) => {
    if (formData.guardianDetails.length <= 1) {
      setAlert({ type: 'error', message: 'At least one guardian is required.' });
      return;
    }

    setFormData((prev) => {
      const updated = prev.guardianDetails.filter((_, idx) => idx !== index);
      // Ensure at least one is primary
      if (!updated.some((g) => g.isPrimaryContact) && updated.length > 0) {
        updated[0].isPrimaryContact = true;
      }
      return { ...prev, guardianDetails: updated };
    });
  };

  const handleUpdateGuardian = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.guardianDetails];
      if (field === 'isPrimaryContact') {
        // Toggle primary: exactly one must be primary
        updated.forEach((g, i) => {
          g.isPrimaryContact = i === index;
        });
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, guardianDetails: updated };
    });
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ type: '', message: '' });

    // Client-side validation
    if (!formData.firstName.trim()) {
      setAlert({ type: 'error', message: 'First name is required.' });
      return;
    }
    if (!formData.lastName.trim()) {
      setAlert({ type: 'error', message: 'Last name is required.' });
      return;
    }
    if (!formData.dateOfBirth) {
      setAlert({ type: 'error', message: 'Date of birth is required.' });
      return;
    }
    if (formData.admissionNumberMethod === 'MANUAL' && !formData.admissionNumber.trim()) {
      setAlert({ type: 'error', message: 'Please enter a manual admission number or select Auto-generate.' });
      return;
    }
    if (!formData.academicYearRef) {
      setAlert({ type: 'error', message: 'Please select an academic year.' });
      return;
    }
    if (!formData.classRef) {
      setAlert({ type: 'error', message: 'Please select a class.' });
      return;
    }
    if (!formData.sectionRef) {
      setAlert({ type: 'error', message: 'Please select a section.' });
      return;
    }

    // Guardian validation
    for (let i = 0; i < formData.guardianDetails.length; i++) {
      const g = formData.guardianDetails[i];
      if (!g.fullName.trim()) {
        setAlert({ type: 'error', message: `Guardian #${i + 1} full name is required.` });
        return;
      }
      if (!g.mobileNumber.trim()) {
        setAlert({ type: 'error', message: `Guardian #${i + 1} mobile number is required.` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        admissionNumberMethod: formData.admissionNumberMethod,
        admissionNumber: formData.admissionNumberMethod === 'MANUAL' ? formData.admissionNumber.trim() : undefined,
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        profilePhotoUrl: formData.profilePhotoUrl,
        contact: {
          phone: formData.phone.trim(),
          email: formData.email.trim()
        },
        guardianDetails: formData.guardianDetails,
        academicYearRef: formData.academicYearRef,
        classRef: formData.classRef,
        sectionRef: formData.sectionRef,
        rollNumberMethod: formData.rollNumberMethod,
        rollNumber: formData.rollNumberMethod === 'MANUAL' ? formData.rollNumber.trim() : undefined,
        admissionDate: formData.admissionDate,
        remarks: formData.remarks.trim()
      };

      const res = await api.post('/admin/students/admission', payload);
      if (res.success) {
        setSuccessModalData({
          student: res.student,
          enrollment: res.enrollment
        });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to admit student.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessModalData(null);
    setPhotoPreview('');
    setFormData({
      admissionNumberMethod: 'AUTO',
      admissionNumber: '',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'MALE',
      profilePhotoUrl: '',
      phone: '',
      email: '',
      guardianDetails: [
        {
          fullName: '',
          relationship: 'FATHER',
          mobileNumber: '',
          email: '',
          isPrimaryContact: true
        }
      ],
      academicYearRef: selectedYear?._id || '',
      classRef: '',
      sectionRef: '',
      rollNumberMethod: 'AUTO',
      rollNumber: '',
      admissionDate: new Date().toISOString().split('T')[0],
      remarks: ''
    });
    fetchNextAdmissionNumber();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedClassObj = classes.find((c) => c._id === formData.classRef);
  const selectedSectionObj = sections.find((s) => s._id === formData.sectionRef);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Dashboard
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-lg">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">New Student Admission</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Register permanent student master details and create initial academic year enrollment.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Module 4 – Phase 1
            </span>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert.message && (
          <div
            className={`p-4 rounded-xl text-xs flex items-start space-x-3 border ${
              alert.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {alert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{alert.message}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========================================================
              SECTION 1: PERSONAL INFORMATION
             ======================================================== */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                <Users className="w-4 h-4 mr-2 text-blue-400" />
                1. Personal Information
              </h2>
              <span className="text-[11px] text-slate-500">Student Permanent Master Record</span>
            </div>

            {/* Admission Number Method Selector */}
            <div className="bg-slate-800/40 p-3.5 rounded-lg border border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Admission Number Assignment <span className="text-rose-400">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="admissionNumberMethod"
                    value="AUTO"
                    checked={formData.admissionNumberMethod === 'AUTO'}
                    onChange={(e) => setFormData({ ...formData, admissionNumberMethod: e.target.value })}
                    className="text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                  />
                  <span>Automatically Generate</span>
                  {loadingAutoAdmission ? (
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                  ) : (
                    autoAdmissionPreview && (
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                        Preview: {autoAdmissionPreview}
                      </span>
                    )
                  )}
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="admissionNumberMethod"
                    value="MANUAL"
                    checked={formData.admissionNumberMethod === 'MANUAL'}
                    onChange={(e) => setFormData({ ...formData, admissionNumberMethod: e.target.value })}
                    className="text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                  />
                  <span>Manual Entry</span>
                </label>
              </div>

              {formData.admissionNumberMethod === 'MANUAL' && (
                <div className="pt-2 max-w-sm">
                  <input
                    type="text"
                    placeholder="Enter unique admission number (e.g. ADM-2026-0045)"
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              )}
            </div>

            {/* Profile Photo & Name Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              {/* Photo Box */}
              <div className="flex flex-col items-center justify-center p-3 bg-slate-800/20 border border-slate-800 rounded-xl space-y-2 text-center">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                  {photoPreview || formData.profilePhotoUrl ? (
                    <img
                      src={photoPreview || formData.profilePhotoUrl}
                      alt="Student Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-10 h-10 text-slate-600" />
                  )}
                  {photoUploading && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>
                  )}
                </div>

                <label className="cursor-pointer inline-flex items-center px-2.5 py-1 text-[11px] font-semibold text-blue-400 bg-blue-600/10 border border-blue-500/20 rounded-md hover:bg-blue-600/20 transition-colors">
                  <Camera className="w-3.5 h-3.5 mr-1" />
                  <span>{photoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-500">Max 2MB (JPG/PNG)</p>
              </div>

              {/* Names & Basic Information */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    First Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aarav"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Middle Name</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Last Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date of Birth <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Gender <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Student Phone</label>
                  <input
                    type="tel"
                    placeholder="Optional 10-digit"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Student Email</label>
                  <input
                    type="email"
                    placeholder="Optional student personal email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 2: GUARDIAN / PARENT DETAILS
             ======================================================== */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Users className="w-4 h-4 mr-2 text-purple-400" />
                  2. Parent &amp; Guardian Information
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  At least one guardian required. Select exactly one primary contact.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddGuardian}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-purple-400 hover:text-white bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Guardian
              </button>
            </div>

            <div className="space-y-3">
              {formData.guardianDetails.map((guardian, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Guardian #{index + 1}
                    </span>

                    <div className="flex items-center space-x-3">
                      <label className="inline-flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="primaryGuardian"
                          checked={guardian.isPrimaryContact}
                          onChange={() => handleUpdateGuardian(index, 'isPrimaryContact', true)}
                          className="text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                        />
                        <span className={guardian.isPrimaryContact ? 'text-emerald-400 font-bold' : ''}>
                          Primary Contact
                        </span>
                      </label>

                      {formData.guardianDetails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGuardian(index)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="Remove Guardian"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rajesh Sharma"
                        value={guardian.fullName}
                        onChange={(e) => handleUpdateGuardian(index, 'fullName', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Relationship <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={guardian.relationship}
                        onChange={(e) => handleUpdateGuardian(index, 'relationship', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        required
                      >
                        <option value="FATHER">Father</option>
                        <option value="MOTHER">Mother</option>
                        <option value="GUARDIAN">Guardian</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Mobile Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile"
                        value={guardian.mobileNumber}
                        onChange={(e) => handleUpdateGuardian(index, 'mobileNumber', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="Optional"
                        value={guardian.email}
                        onChange={(e) => handleUpdateGuardian(index, 'email', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================
              SECTION 3: ADMISSION & ENROLLMENT PLACEMENT
             ======================================================== */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                <GraduationCap className="w-4 h-4 mr-2 text-emerald-400" />
                3. Admission &amp; Initial Placement Details
              </h2>
              <span className="text-[11px] text-slate-500">Initial Academic Year Placement</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Academic Year */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Academic Year <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.academicYearRef}
                  onChange={(e) => setFormData({ ...formData, academicYearRef: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">-- Select Academic Year --</option>
                  {academicYears.map((ay) => (
                    <option key={ay._id} value={ay._id}>
                      {ay.yearName} {ay.isCurrent ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Class <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.classRef}
                  onChange={(e) => setFormData({ ...formData, classRef: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                  disabled={loadingClasses}
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.className} ({cls.classCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Section <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.sectionRef}
                  onChange={(e) => setFormData({ ...formData, sectionRef: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  required
                  disabled={!formData.classRef || loadingSections}
                >
                  <option value="">
                    {loadingSections ? 'Loading sections...' : '-- Select Section --'}
                  </option>
                  {sections.map((sec) => (
                    <option key={sec._id} value={sec._id}>
                      {sec.sectionName} ({sec.sectionCode}) – Max: {sec.maxCapacity}
                    </option>
                  ))}
                </select>
                {selectedSectionObj && (
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center">
                    <Info className="w-3 h-3 mr-1 text-blue-400" />
                    Section Maximum Capacity: <strong>{selectedSectionObj.maxCapacity} students</strong>
                  </p>
                )}
              </div>

              {/* Roll Number Method */}
              <div className="sm:col-span-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Roll Number Assignment (Optional)
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="rollNumberMethod"
                      value="AUTO"
                      checked={formData.rollNumberMethod === 'AUTO'}
                      onChange={(e) => setFormData({ ...formData, rollNumberMethod: e.target.value })}
                      className="text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                    />
                    <span>Automatic Sequential</span>
                    {loadingAutoRoll ? (
                      <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    ) : (
                      autoRollPreview && (
                        <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                          Next: #{autoRollPreview}
                        </span>
                      )
                    )}
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="rollNumberMethod"
                      value="MANUAL"
                      checked={formData.rollNumberMethod === 'MANUAL'}
                      onChange={(e) => setFormData({ ...formData, rollNumberMethod: e.target.value })}
                      className="text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
                    />
                    <span>Manual Entry</span>
                  </label>

                  {formData.rollNumberMethod === 'MANUAL' && (
                    <input
                      type="text"
                      placeholder="e.g. 15"
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-white font-mono text-right focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              </div>

              {/* Admission Date */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Admission Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.admissionDate}
                  onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                  required
                />
              </div>

              {/* Remarks */}
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-300 mb-1">Admission Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Optional notes or background information regarding admission..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving Admission...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Complete Admission
                </>
              )}
            </button>
          </div>
        </form>

        {/* ========================================================
            ADMISSION SUCCESS CONFIRMATION MODAL
           ======================================================== */}
        {successModalData && (
          <AdminModal
            isOpen={Boolean(successModalData)}
            onClose={handleResetForm}
            title="Student Admission Confirmed"
            maxWidth="max-w-lg"
          >
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">
                  {successModalData.student?.firstName} {successModalData.student?.lastName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Student master record and initial enrollment created successfully.
                </p>
              </div>

              {/* Details Summary Card */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 text-xs text-left space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <span className="text-slate-400 font-medium">Admission Number:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {successModalData.student?.admissionNumber}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Class &amp; Section:</span>
                  <span className="font-semibold text-white">
                    {successModalData.enrollment?.className} – {successModalData.enrollment?.sectionName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Roll Number:</span>
                  <span className="font-mono font-semibold text-white">
                    {successModalData.enrollment?.rollNumber || 'Not Assigned'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Academic Year:</span>
                  <span className="text-white font-medium">
                    {successModalData.enrollment?.academicYearName}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                  <span className="text-slate-400">Primary Contact:</span>
                  <span className="text-slate-200">
                    {successModalData.student?.guardianDetails?.find((g) => g.isPrimaryContact)?.fullName ||
                      'Guardian'}{' '}
                    (
                    {successModalData.student?.guardianDetails?.find((g) => g.isPrimaryContact)?.mobileNumber}
                    )
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-3 pt-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Admit Another Student
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </AdminModal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentAdmissionPage;
