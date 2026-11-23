import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useSchoolAuth } from '../../context/SchoolAuthContext';
import api from '../../services/api';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Lock,
  Upload,
  Trash2,
  Plus,
  Save,
  AlertCircle,
  CheckCircle2,
  Users,
  Shield,
  Loader2,
  ExternalLink,
  Info
} from 'lucide-react';

const SchoolProfilePage = () => {
  const { currentSchool, updateSchoolData } = useSchoolAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [formData, setFormData] = useState({
    schoolId: '',
    schoolCode: '',
    email: '',
    schoolName: '',
    establishedYear: '',
    mobileNumber: '',
    address: '',
    websiteUrl: '',
    schoolLogoUrl: '',
    status: 'ACTIVE',
    contactPersons: []
  });

  // Fetch School Profile
  const fetchProfile = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await api.get('/admin/school-profile');
      if (res.success && res.school) {
        const s = res.school;
        setFormData({
          schoolId: s.schoolId || '',
          schoolCode: s.schoolCode || '',
          email: s.email || '',
          schoolName: s.schoolName || '',
          establishedYear: s.establishedYear ? String(s.establishedYear) : '',
          mobileNumber: s.mobileNumber || '',
          address: s.address || '',
          websiteUrl: s.websiteUrl || '',
          schoolLogoUrl: s.schoolLogoUrl || '',
          status: s.status || 'ACTIVE',
          contactPersons: (s.contactPersons && s.contactPersons.length > 0)
            ? s.contactPersons
            : [
                { fullName: '', email: '', mobileNumber: '', designation: '' },
                { fullName: '', email: '', mobileNumber: '', designation: '' }
              ]
        });
      }
    } catch (err) {
      console.error('[SchoolProfile] Fetch error:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load school profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Field change handler
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Contact Person handlers
  const handleContactPersonChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.contactPersons];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return {
        ...prev,
        contactPersons: updated
      };
    });
  };

  const handleAddContactPerson = () => {
    if (formData.contactPersons.length >= 3) return;
    setFormData(prev => ({
      ...prev,
      contactPersons: [
        ...prev.contactPersons,
        { fullName: '', email: '', mobileNumber: '', designation: '' }
      ]
    }));
  };

  const handleRemoveContactPerson = (index) => {
    if (formData.contactPersons.length <= 2) {
      alert('A school must maintain at least 2 contact persons.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      contactPersons: prev.contactPersons.filter((_, i) => i !== index)
    }));
  };

  // Logo file selection & upload
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({
        type: 'error',
        message: 'Logo file size exceeds 2MB limit. Please choose a smaller image.'
      });
      return;
    }

    // Validate format
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setFeedback({
        type: 'error',
        message: 'Invalid image format. Only JPG, JPEG, and PNG files are supported.'
      });
      return;
    }

    setUploadingLogo(true);
    setFeedback({ type: '', message: '' });

    try {
      const uploadData = new FormData();
      uploadData.append('logo', file);

      const res = await api.post('/admin/school-profile/logo', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.success && res.schoolLogoUrl) {
        setFormData(prev => ({
          ...prev,
          schoolLogoUrl: res.schoolLogoUrl
        }));
        if (updateSchoolData) {
          updateSchoolData({ schoolLogoUrl: res.schoolLogoUrl });
        }
        setFeedback({
          type: 'success',
          message: 'School logo uploaded and updated successfully!'
        });
      }
    } catch (err) {
      console.error('[SchoolProfile] Logo upload error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to upload logo image.'
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({
      ...prev,
      schoolLogoUrl: ''
    }));
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    // Client-side validations
    if (!formData.schoolName.trim()) {
      setFeedback({ type: 'error', message: 'School name is required.' });
      setSaving(false);
      return;
    }

    const estYear = parseInt(formData.establishedYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(estYear) || estYear < 1800 || estYear > currentYear) {
      setFeedback({
        type: 'error',
        message: `Established year must be between 1800 and ${currentYear}.`
      });
      setSaving(false);
      return;
    }

    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!formData.mobileNumber.trim() || !phoneRegex.test(formData.mobileNumber.trim())) {
      setFeedback({
        type: 'error',
        message: 'Please enter a valid school mobile number (7-15 digits).'
      });
      setSaving(false);
      return;
    }

    if (!formData.address.trim()) {
      setFeedback({ type: 'error', message: 'School address is required.' });
      setSaving(false);
      return;
    }

    if (formData.contactPersons.length < 2 || formData.contactPersons.length > 3) {
      setFeedback({
        type: 'error',
        message: 'School must have between 2 and 3 contact persons.'
      });
      setSaving(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (let i = 0; i < formData.contactPersons.length; i++) {
      const cp = formData.contactPersons[i];
      if (!cp.fullName.trim()) {
        setFeedback({ type: 'error', message: `Contact Person #${i + 1} full name is required.` });
        setSaving(false);
        return;
      }
      if (!cp.email.trim() || !emailRegex.test(cp.email.trim())) {
        setFeedback({ type: 'error', message: `Contact Person #${i + 1} has an invalid email.` });
        setSaving(false);
        return;
      }
      if (!cp.mobileNumber.trim() || !phoneRegex.test(cp.mobileNumber.trim())) {
        setFeedback({ type: 'error', message: `Contact Person #${i + 1} has an invalid mobile number.` });
        setSaving(false);
        return;
      }
      if (!cp.designation.trim()) {
        setFeedback({ type: 'error', message: `Contact Person #${i + 1} designation is required.` });
        setSaving(false);
        return;
      }
    }

    try {
      const payload = {
        schoolName: formData.schoolName.trim(),
        establishedYear: estYear,
        mobileNumber: formData.mobileNumber.trim(),
        address: formData.address.trim(),
        websiteUrl: formData.websiteUrl.trim(),
        schoolLogoUrl: formData.schoolLogoUrl,
        contactPersons: formData.contactPersons
      };

      const res = await api.put('/admin/school-profile', payload);
      if (res.success && res.school) {
        if (updateSchoolData) {
          updateSchoolData(res.school);
        }
        setFeedback({
          type: 'success',
          message: 'School profile updated successfully.'
        });
      }
    } catch (err) {
      console.error('[SchoolProfile] Update error:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update school profile.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <Building className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">School Profile Management</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              View and manage institution details, branding, contact persons, and administrative information.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Shield className="w-3.5 h-3.5 mr-1" />
              Status: {formData.status}
            </span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`p-4 rounded-xl flex items-start space-x-3 text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
          </div>
        )}

        {loading ? (
          <div className="min-h-[300px] flex items-center justify-center bg-white rounded-xl border border-slate-200">
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Loading school profile details...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION 1: Brand & Logo Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center">
                <Building className="w-4 h-4 mr-2 text-blue-600" />
                School Logo &amp; Identity
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                The school logo is displayed on report cards, generated marksheets, and dashboard navigation.
              </p>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Logo Preview Box */}
                <div className="relative group w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {formData.schoolLogoUrl ? (
                    <img
                      src={formData.schoolLogoUrl}
                      alt="School Logo"
                      className="w-full h-full object-contain p-2"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/logo.png';
                      }}
                    />
                  ) : (
                    <div className="text-center p-3">
                      <Building className="w-10 h-10 mx-auto text-slate-400 mb-1" />
                      <span className="text-[10px] text-slate-400 font-medium">No Logo Uploaded</span>
                    </div>
                  )}

                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoFileChange}
                      accept="image/png, image/jpeg, image/jpg"
                      className="hidden"
                    />

                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 mr-2" />
                      <span>{formData.schoolLogoUrl ? 'Replace Logo' : 'Upload School Logo'}</span>
                    </button>

                    {formData.schoolLogoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        <span>Remove Logo</span>
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Supported formats: <strong className="text-slate-700">PNG, JPG, JPEG</strong>.
                    Maximum file size: <strong className="text-slate-700">2MB</strong>.
                    Recommended size: square aspect ratio (e.g., 200x200px) with transparent background.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 2: General Information */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <Building className="w-4 h-4 mr-2 text-blue-600" />
                General Institution Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* School ID (Read-Only) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>School ID (System Identifier)</span>
                    <span className="inline-flex items-center text-[10px] text-amber-700 font-medium">
                      <Lock className="w-3 h-3 mr-1 text-amber-600" /> Read-Only
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={formData.schoolId}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-100 border border-slate-300 text-slate-700 text-sm font-mono font-bold rounded-lg cursor-not-allowed select-all"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Unique immutable school identifier assigned upon registration.</p>
                </div>

                {/* School Email (Read-Only) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Official School Email</span>
                    <span className="inline-flex items-center text-[10px] text-amber-700 font-medium">
                      <Lock className="w-3 h-3 mr-1 text-amber-600" /> Protected
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={formData.email}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-100 border border-slate-300 text-slate-700 text-sm rounded-lg cursor-not-allowed select-all"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Official email address. Changes require secure OTP verification workflow.
                  </p>
                </div>

                {/* School Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    School / Institution Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.schoolName}
                    onChange={(e) => handleInputChange('schoolName', e.target.value)}
                    placeholder="Enter complete legal school name"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Established Year */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Established Year <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1800"
                      max={new Date().getFullYear()}
                      value={formData.establishedYear}
                      onChange={(e) => handleInputChange('establishedYear', e.target.value)}
                      placeholder="e.g. 1995"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                {/* School Mobile Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    School Phone / Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                {/* Website URL */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Website URL</span>
                    {formData.websiteUrl && (
                      <a
                        href={formData.websiteUrl.startsWith('http') ? formData.websiteUrl : `https://${formData.websiteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[11px] text-blue-600 hover:underline"
                      >
                        Visit Website <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                      placeholder="https://www.yourschool.edu"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                {/* Physical Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Physical Campus Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      required
                      rows={3}
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter complete postal address with PIN code"
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Contact Persons Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 flex items-center">
                    <Users className="w-4 h-4 mr-2 text-blue-600" />
                    Authorized Contact Persons
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Maintain between 2 and 3 official school representatives for critical system alerts.
                  </p>
                </div>

                {formData.contactPersons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddContactPerson}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors self-start"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Add Contact Person</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {formData.contactPersons.map((person, idx) => (
                  <div
                    key={person._id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 relative space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[10px] mr-2">
                          {idx + 1}
                        </span>
                        Contact Person {idx + 1}
                      </span>

                      {formData.contactPersons.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContactPerson(idx)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={person.fullName}
                          onChange={(e) => handleContactPersonChange(idx, 'fullName', e.target.value)}
                          placeholder="e.g. Dr. Rajesh Sharma"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={person.email}
                          onChange={(e) => handleContactPersonChange(idx, 'email', e.target.value)}
                          placeholder="rajesh@school.edu"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Mobile */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={person.mobileNumber}
                          onChange={(e) => handleContactPersonChange(idx, 'mobileNumber', e.target.value)}
                          placeholder="+91 9876543210"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Designation */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Designation <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={person.designation}
                          onChange={(e) => handleContactPersonChange(idx, 'designation', e.target.value)}
                          placeholder="Principal / Vice Principal"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Action Controls */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="submit"
                disabled={saving || uploadingLogo}
                className="inline-flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    <span>Save School Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SchoolProfilePage;
