import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useUserAuth } from '../context/UserAuthContext';
import api from '../services/api';
import {
  User,
  Mail,
  Phone,
  Shield,
  Building2,
  Camera,
  Check,
  AlertCircle,
  Loader2,
  MapPin,
  GraduationCap,
  Calendar
} from 'lucide-react';

const ProfilePage = () => {
  const { currentUser, updateUser } = useUserAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [sigLoading, setSigLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Editable Form fields
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [qualification, setQualification] = useState('');

  const fileInputRef = useRef(null);
  const sigInputRef = useRef(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/profile/me');
      if (res.success && res.profile) {
        setProfile(res.profile);
        setFullName(res.profile.fullName || '');
        setMobileNumber(res.profile.mobileNumber || '');
        setAddress(res.profile.address || '');
        setQualification(res.profile.qualification || '');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim() || !mobileNumber.trim()) {
      setErrorMessage('Full Name and Mobile Number are required.');
      return;
    }

    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!phoneRegex.test(mobileNumber.trim())) {
      setErrorMessage('Please enter a valid mobile number.');
      return;
    }

    setSaveLoading(true);
    try {
      const res = await api.put('/profile/update', {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        address: address.trim(),
        qualification: qualification.trim()
      });

      if (res.success) {
        setSuccessMessage('Profile details updated successfully.');
        updateUser({ fullName: fullName.trim() });
        setProfile(prev => ({
          ...prev,
          fullName: fullName.trim(),
          mobileNumber: mobileNumber.trim(),
          address: address.trim(),
          qualification: qualification.trim()
        }));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Invalid file format. Please upload a JPG, JPEG, or PNG image.');
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 2MB limit. Please choose a smaller file.');
      return;
    }

    const formData = new FormData();
    formData.append('profileImage', file);

    setImageLoading(true);
    try {
      const res = await api.post('/profile/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.success && res.profileImage) {
        setProfile(prev => ({ ...prev, profileImage: res.profileImage }));
        updateUser({ profileImage: res.profileImage });
        setSuccessMessage('Profile photo updated successfully!');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload profile image.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Invalid signature format. Please upload a JPG, JPEG, or PNG image.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Signature image size exceeds 2MB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('signature', file);

    setSigLoading(true);
    try {
      const res = await api.post('/profile/upload-signature', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success && res.signatureUrl) {
        setProfile(prev => ({ ...prev, signatureUrl: res.signatureUrl }));
        updateUser({ signatureUrl: res.signatureUrl });
        setSuccessMessage('E-Signature uploaded successfully!');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload e-signature.');
    } finally {
      setSigLoading(false);
    }
  };

  const handleDeleteSignature = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setSigLoading(true);
    try {
      const res = await api.delete('/profile/signature');
      if (res.success) {
        setProfile(prev => ({ ...prev, signatureUrl: null }));
        updateUser({ signatureUrl: null });
        setSuccessMessage('E-Signature removed successfully.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to remove e-signature.');
    } finally {
      setSigLoading(false);
    }
  };

  const avatarUrl = profile?.profileImage
    ? (profile.profileImage.startsWith('http') ? profile.profileImage : profile.profileImage)
    : null;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              View and manage your personal details and account settings
            </p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
            Role: {profile?.roleName || currentUser?.roleName}
          </span>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-xs">
            <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Card: Profile Image & Read-Only Meta */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 text-center">
                
                {/* Avatar with Upload Button */}
                <div className="relative inline-block mx-auto mb-4">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-3xl shadow-md ring-4 ring-slate-100">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>
                        {profile?.fullName
                          ? profile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                          : 'U'}
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/png, image/jpeg, image/jpg"
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageLoading}
                    className="absolute bottom-1 right-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg ring-2 ring-white transition-all cursor-pointer"
                    title="Upload new profile image"
                  >
                    {imageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                </div>

                <h2 className="text-base font-bold text-slate-900">{profile?.fullName}</h2>
                <p className="text-xs text-blue-600 font-medium mt-0.5">{profile?.designation}</p>

                {/* Read-Only Account Badges */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-left text-xs">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">User ID:</span>
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {profile?.userId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">System Role:</span>
                    <span className="font-semibold text-slate-800">{profile?.roleName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">School ID:</span>
                    <span className="font-mono font-bold text-blue-600">{profile?.school?.schoolId}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">School:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[150px]" title={profile?.school?.schoolName}>
                      {profile?.school?.schoolName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic pt-2">
                    * User ID and Assigned Role cannot be edited directly through My Profile.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card: Editable Personal Information Form */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-6 sm:p-8">
              <h2 className="text-base font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100 flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>Personal &amp; Professional Details</span>
              </h2>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                      required
                    />
                  </div>

                  {/* Registered Email (Read-only as per standard auth) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-slate-400 font-normal">(Account Linked)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={profile?.email || ''}
                        disabled
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed outline-hidden"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                        required
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={profile?.designation || ''}
                      disabled
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed outline-hidden"
                    />
                  </div>

                  {/* Qualification */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Highest Qualification
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        placeholder="e.g. M.Sc, B.Ed, MCA"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                      <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Residential Address
                    </label>
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street, City, PIN Code"
                        className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {saveLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>

          </div>
        )}

        {/* E-Signature Management Card (Teachers and Head Teachers) */}
        {!loading && ['TEACHER', 'HEAD_TEACHER'].includes(profile?.roleCode || currentUser?.roleCode) && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Digital E-Signature (Marksheet Output)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload a transparent or clean-background signature image (PNG/JPG, max 2MB) for digital marksheets.
                </p>
              </div>
              <input
                type="file"
                ref={sigInputRef}
                onChange={handleSignatureUpload}
                accept=".jpg,.jpeg,.png"
                className="hidden"
              />
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={sigLoading}
                  onClick={() => sigInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {sigLoading ? 'Uploading...' : profile?.signatureUrl ? 'Replace Signature' : 'Upload Signature'}
                </button>
                {profile?.signatureUrl && (
                  <button
                    type="button"
                    disabled={sigLoading}
                    onClick={handleDeleteSignature}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {profile?.signatureUrl ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-700">Current Uploaded Signature</p>
                  <p className="text-[11px] text-slate-500">
                    Used on authorized examination and final marksheets when e-signatures are enabled.
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2">
                  <img
                    src={profile.signatureUrl}
                    alt="E-Signature"
                    className="h-14 max-w-[180px] object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 text-center">
                No e-signature uploaded yet. Printed marksheets will continue to provide physical signature space.
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
