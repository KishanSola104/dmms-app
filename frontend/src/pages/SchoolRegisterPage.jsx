import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../services/api';
import {
  Building2,
  Users,
  ShieldCheck,
  ClipboardCheck,
  Check,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  Phone,
  Calendar,
  Globe,
  MapPin,
  AlertCircle,
  Loader2
} from 'lucide-react';

const SchoolRegisterPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successData, setSuccessData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: School Details
    schoolName: '',
    establishedYear: '',
    email: '',
    mobileNumber: '',
    address: '',
    websiteUrl: '',

    // Step 2: Contact Persons (2 to 3)
    contactPersons: [
      { fullName: '', email: '', mobileNumber: '', designation: '' },
      { fullName: '', email: '', mobileNumber: '', designation: '' }
    ],

    // Step 3: Initial Administrator Details
    adminFullName: '',
    adminEmail: '',
    adminMobile: '',

    // Step 4: Terms Acceptance
    termsAccepted: false
  });

  // Normalization Helpers
  const normEmail = (val) => (val || '').trim().toLowerCase();
  const normPhone = (val) => {
    if (!val) return '';
    let digits = String(val).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    return digits;
  };
  const normName = (val) => (val || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // Step 1 input handlers
  const handleSchoolChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrorMessage('');
    setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Step 2 contact persons handlers
  const handleContactChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.contactPersons];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, contactPersons: updated };
    });
    setErrorMessage('');
    setFieldErrors(prev => ({ ...prev, [`cp_${index}_${field}`]: '' }));
  };

  const addContactPerson = () => {
    if (formData.contactPersons.length < 3) {
      setFormData(prev => ({
        ...prev,
        contactPersons: [...prev.contactPersons, { fullName: '', email: '', mobileNumber: '', designation: '' }]
      }));
      setErrorMessage('');
    }
  };

  const removeContactPerson = (index) => {
    if (formData.contactPersons.length > 2) {
      setFormData(prev => ({
        ...prev,
        contactPersons: prev.contactPersons.filter((_, i) => i !== index)
      }));
      setErrorMessage('');
      setFieldErrors({});
    }
  };

  // Step 3 admin handlers
  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrorMessage('');
    setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Step Validations
  const validateStep1 = () => {
    const { schoolName, establishedYear, email, mobileNumber, address, websiteUrl } = formData;
    const errors = {};

    if (!schoolName.trim()) {
      errors.schoolName = 'Please enter the school full name.';
      setFieldErrors(errors);
      setErrorMessage(errors.schoolName);
      return false;
    }
    const currentYear = new Date().getFullYear();
    const estYear = parseInt(establishedYear, 10);
    if (!establishedYear || isNaN(estYear) || estYear < 1800 || estYear > currentYear) {
      errors.establishedYear = `Please enter a valid established year between 1800 and ${currentYear}.`;
      setFieldErrors(errors);
      setErrorMessage(errors.establishedYear);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      errors.email = 'Please enter a valid school email address.';
      setFieldErrors(errors);
      setErrorMessage(errors.email);
      return false;
    }
    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!mobileNumber.trim() || !phoneRegex.test(mobileNumber)) {
      errors.mobileNumber = 'Please enter a valid school contact number (7-15 digits).';
      setFieldErrors(errors);
      setErrorMessage(errors.mobileNumber);
      return false;
    }
    if (!address.trim()) {
      errors.address = 'Please enter the complete school address.';
      setFieldErrors(errors);
      setErrorMessage(errors.address);
      return false;
    }
    if (websiteUrl && websiteUrl.trim()) {
      const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(:\d{1,5})?(\/.*)?$/i;
      if (!urlPattern.test(websiteUrl.trim())) {
        errors.websiteUrl = 'Please enter a valid website URL or leave it empty.';
        setFieldErrors(errors);
        setErrorMessage(errors.websiteUrl);
        return false;
      }
    }
    setFieldErrors({});
    return true;
  };

  const validateStep2 = () => {
    const { contactPersons, email: schoolEmail, mobileNumber: schoolMobile } = formData;
    const errors = {};

    if (contactPersons.length < 2 || contactPersons.length > 3) {
      setErrorMessage('You must provide at least 2 and at most 3 contact persons.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;

    // Basic format checks
    for (let i = 0; i < contactPersons.length; i++) {
      const cp = contactPersons[i];
      if (!cp.fullName.trim()) {
        errors[`cp_${i}_fullName`] = `Please enter the full name for Contact Person #${i + 1}.`;
        setFieldErrors(errors);
        setErrorMessage(errors[`cp_${i}_fullName`]);
        return false;
      }
      if (!cp.designation.trim()) {
        errors[`cp_${i}_designation`] = `Please specify the designation for Contact Person #${i + 1}.`;
        setFieldErrors(errors);
        setErrorMessage(errors[`cp_${i}_designation`]);
        return false;
      }
      if (!cp.email.trim() || !emailRegex.test(cp.email)) {
        errors[`cp_${i}_email`] = `Please enter a valid email address for Contact Person #${i + 1}.`;
        setFieldErrors(errors);
        setErrorMessage(errors[`cp_${i}_email`]);
        return false;
      }
      if (!cp.mobileNumber.trim() || !phoneRegex.test(cp.mobileNumber)) {
        errors[`cp_${i}_mobileNumber`] = `Please enter a valid mobile number for Contact Person #${i + 1}.`;
        setFieldErrors(errors);
        setErrorMessage(errors[`cp_${i}_mobileNumber`]);
        return false;
      }
    }

    const nSchoolEmail = normEmail(schoolEmail);
    const nSchoolMobile = normPhone(schoolMobile);

    // Rule 1 & Rule 2: Contact Person details cannot duplicate Official School details
    for (let i = 0; i < contactPersons.length; i++) {
      const cp = contactPersons[i];
      if (normEmail(cp.email) === nSchoolEmail) {
        errors[`cp_${i}_email`] = `Official School Email cannot be the same as Contact Person #${i + 1} Email.`;
        setFieldErrors(errors);
        setErrorMessage(errors[`cp_${i}_email`]);
        return false;
      }
      if (normPhone(cp.mobileNumber) === nSchoolMobile) {
        errors[`cp_${i}_mobileNumber`] = `Official School Mobile Number cannot be the same as Contact Person #${i + 1} Mobile Number.`;
        setFieldErrors(errors);
        setErrorMessage(errors[`cp_${i}_mobileNumber`]);
        return false;
      }
    }

    // Rule 4: Contact Persons must not share duplicate emails, mobile numbers, or full names among themselves
    for (let i = 0; i < contactPersons.length; i++) {
      const cpA = contactPersons[i];
      const nCpAEmail = normEmail(cpA.email);
      const nCpAMobile = normPhone(cpA.mobileNumber);
      const nCpAName = normName(cpA.fullName);

      for (let j = i + 1; j < contactPersons.length; j++) {
        const cpB = contactPersons[j];
        const nCpBEmail = normEmail(cpB.email);
        const nCpBMobile = normPhone(cpB.mobileNumber);
        const nCpBName = normName(cpB.fullName);

        if (nCpAEmail === nCpBEmail) {
          errors[`cp_${j}_email`] = `Contact Person #${i + 1} and Contact Person #${j + 1} cannot share duplicate email address.`;
          setFieldErrors(errors);
          setErrorMessage(errors[`cp_${j}_email`]);
          return false;
        }
        if (nCpAMobile === nCpBMobile) {
          errors[`cp_${j}_mobileNumber`] = `Contact Person #${i + 1} and Contact Person #${j + 1} cannot share duplicate mobile number.`;
          setFieldErrors(errors);
          setErrorMessage(errors[`cp_${j}_mobileNumber`]);
          return false;
        }
        if (nCpAName === nCpBName) {
          errors[`cp_${j}_fullName`] = `Contact Person #${i + 1} and Contact Person #${j + 1} cannot share duplicate full name.`;
          setFieldErrors(errors);
          setErrorMessage(errors[`cp_${j}_fullName`]);
          return false;
        }
      }
    }

    setFieldErrors({});
    return true;
  };

  const validateStep3 = () => {
    const { adminFullName, adminEmail, adminMobile, email: schoolEmail, mobileNumber: schoolMobile, contactPersons } = formData;
    const errors = {};

    if (!adminFullName.trim()) {
      errors.adminFullName = 'Please enter the administrator full name.';
      setFieldErrors(errors);
      setErrorMessage(errors.adminFullName);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminEmail.trim() || !emailRegex.test(adminEmail)) {
      errors.adminEmail = 'Please enter a valid administrator email address.';
      setFieldErrors(errors);
      setErrorMessage(errors.adminEmail);
      return false;
    }
    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!adminMobile.trim() || !phoneRegex.test(adminMobile)) {
      errors.adminMobile = 'Please enter a valid administrator mobile number.';
      setFieldErrors(errors);
      setErrorMessage(errors.adminMobile);
      return false;
    }

    const nSchoolEmail = normEmail(schoolEmail);
    const nSchoolMobile = normPhone(schoolMobile);
    const nAdminEmail = normEmail(adminEmail);
    const nAdminMobile = normPhone(adminMobile);
    const nAdminName = normName(adminFullName);

    // Rule 1: Administrator Email vs Official School Email
    if (nAdminEmail === nSchoolEmail) {
      errors.adminEmail = 'Official School Email and Administrator Email cannot be the same.';
      setFieldErrors(errors);
      setErrorMessage(errors.adminEmail);
      return false;
    }

    // Rule 2: Administrator Mobile vs Official School Mobile
    if (nAdminMobile === nSchoolMobile) {
      errors.adminMobile = 'Official School Mobile Number and Administrator Mobile Number cannot be the same.';
      setFieldErrors(errors);
      setErrorMessage(errors.adminMobile);
      return false;
    }

    // Rule 3 & Rule 5: Administrator details vs Contact Persons details
    for (let i = 0; i < contactPersons.length; i++) {
      const cp = contactPersons[i];
      if (nAdminEmail === normEmail(cp.email)) {
        errors.adminEmail = `Administrator Email cannot be the same as Contact Person #${i + 1} Email.`;
        setFieldErrors(errors);
        setErrorMessage(errors.adminEmail);
        return false;
      }
      if (nAdminMobile === normPhone(cp.mobileNumber)) {
        errors.adminMobile = `Administrator Mobile Number cannot be the same as Contact Person #${i + 1} Mobile Number.`;
        setFieldErrors(errors);
        setErrorMessage(errors.adminMobile);
        return false;
      }
      if (nAdminName === normName(cp.fullName)) {
        errors.adminFullName = `Administrator Full Name cannot be the same as Contact Person #${i + 1} Full Name.`;
        setFieldErrors(errors);
        setErrorMessage(errors.adminFullName);
        return false;
      }
    }

    setFieldErrors({});
    return true;
  };

  const handleNext = () => {
    setErrorMessage('');
    setFieldErrors({});
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setErrorMessage('');
    setFieldErrors({});
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Final Registration Submission
  const handleSubmitRegistration = async () => {
    setErrorMessage('');
    setFieldErrors({});

    // Comprehensive multi-step verification before submit
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateStep3()) {
      setStep(3);
      return;
    }

    if (!formData.termsAccepted) {
      setErrorMessage('You must accept the Terms and Conditions to complete school registration.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/school/register', formData);
      if (res.success) {
        setSuccessData(res.data);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    { num: 1, title: 'School Details', icon: Building2 },
    { num: 2, title: 'Contact Persons', icon: Users },
    { num: 3, title: 'Administrator', icon: ShieldCheck },
    { num: 4, title: 'Review & Confirm', icon: ClipboardCheck }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Success Screen */}
          {successData ? (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center max-w-2xl mx-auto animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 ring-8 ring-emerald-50">
                <Check className="w-8 h-8" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                School Registered Successfully
              </h2>

              <p className="text-slate-600 mt-3 text-base leading-relaxed">
                Your school has been successfully registered on the DMMS platform.
              </p>

              <div className="my-6 p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-left space-y-2">
                <p className="text-xs uppercase font-bold text-blue-700 tracking-wider">
                  Generated Registration Identifiers:
                </p>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center text-sm pt-1">
                  <span className="text-slate-600 font-medium">School ID:</span>
                  <span className="font-mono font-bold text-blue-900 bg-white px-2.5 py-1 rounded border border-blue-100">
                    {successData.schoolId}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center text-sm">
                  <span className="text-slate-600 font-medium">Initial Administrator ID:</span>
                  <span className="font-mono font-bold text-emerald-900 bg-white px-2.5 py-1 rounded border border-emerald-100">
                    {successData.adminId}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                Your School ID and Administrator credentials have been sent to their respective registered email addresses. Please check your inbox (and spam folder) for temporary passwords.
              </p>

              <div className="mt-8">
                <button
                  onClick={() => navigate('/school-login')}
                  className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all inline-flex items-center justify-center space-x-2"
                >
                  <span>Go to School Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Multi-step Registration Wizard */
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              
              {/* Wizard Header & Progress Bar */}
              <div className="bg-slate-900 px-6 py-8 text-white">
                <div className="text-center max-w-xl mx-auto mb-8">
                  <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold">
                    Step-by-Step Onboarding
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
                    School Registration
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Complete all 4 steps to set up your institution on DMMS
                  </p>
                </div>

                {/* Stepper Indicator */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-3xl mx-auto">
                  {stepTitles.map((s) => {
                    const IconComponent = s.icon;
                    const isActive = step === s.num;
                    const isCompleted = step > s.num;
                    return (
                      <div key={s.num} className="text-center">
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                            isCompleted
                              ? 'bg-emerald-500 text-white'
                              : isActive
                              ? 'bg-blue-600 text-white ring-4 ring-blue-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isCompleted ? <Check className="w-5 h-5" /> : <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                        <p className={`mt-2 text-[10px] sm:text-xs font-medium truncate ${isActive ? 'text-white font-bold' : 'text-slate-400'}`}>
                          {s.title}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Alert Box */}
              {errorMessage && (
                <div className="mx-6 sm:mx-8 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Validation Notice</p>
                    <p className="text-xs mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Step Forms */}
              <div className="p-6 sm:p-8">
                
                {/* STEP 1: School Details */}
                {step === 1 && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        <span>Step 1: School Details</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Please provide basic information regarding your educational institution.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* School Name */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          School Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="schoolName"
                          value={formData.schoolName}
                          onChange={handleSchoolChange}
                          placeholder="e.g. Kishore Bharti Primary School"
                          className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                            fieldErrors.schoolName ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all`}
                        />
                        {fieldErrors.schoolName && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.schoolName}</p>
                        )}
                      </div>

                      {/* Established Year */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Established Year <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            name="establishedYear"
                            value={formData.establishedYear}
                            onChange={handleSchoolChange}
                            placeholder="e.g. 1995"
                            className={`w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border ${
                              fieldErrors.establishedYear ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all`}
                          />
                          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        {fieldErrors.establishedYear && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.establishedYear}</p>
                        )}
                      </div>

                      {/* Official Email */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Official School Email <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleSchoolChange}
                            placeholder="admin@school.edu"
                            className={`w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border ${
                              fieldErrors.email ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all`}
                          />
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        {fieldErrors.email && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.email}</p>
                        )}
                      </div>

                      {/* Mobile Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Official Contact Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            name="mobileNumber"
                            value={formData.mobileNumber}
                            onChange={handleSchoolChange}
                            placeholder="e.g. 9876543210"
                            className={`w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border ${
                              fieldErrors.mobileNumber ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all`}
                          />
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        {fieldErrors.mobileNumber && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.mobileNumber}</p>
                        )}
                      </div>

                      {/* Website URL */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Website URL <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="url"
                            name="websiteUrl"
                            value={formData.websiteUrl}
                            onChange={handleSchoolChange}
                            placeholder="https://www.kbps.edu"
                            className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                          />
                          <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                      </div>

                      {/* Address */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Complete Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <textarea
                            name="address"
                            rows={3}
                            value={formData.address}
                            onChange={handleSchoolChange}
                            placeholder="Street, City, District, State, PIN Code"
                            className={`w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border ${
                              fieldErrors.address ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all`}
                          />
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        {fieldErrors.address && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.address}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Contact Persons Details (Min 2, Max 3) */}
                {step === 2 && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                          <Users className="w-5 h-5 text-blue-600" />
                          <span>Step 2: Contact Person Details</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Provide at least 2 and at most 3 emergency/official contact representatives.
                        </p>
                      </div>

                      {formData.contactPersons.length < 3 && (
                        <button
                          type="button"
                          onClick={addContactPerson}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition-colors self-start sm:self-auto cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Contact ({formData.contactPersons.length}/3)</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {formData.contactPersons.map((contact, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                              Contact Person #{idx + 1}
                            </span>
                            {formData.contactPersons.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeContactPerson(idx)}
                                className="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center space-x-1 p-1 hover:bg-rose-50 rounded"
                                title="Remove this contact"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Full Name <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={contact.fullName}
                                onChange={(e) => handleContactChange(idx, 'fullName', e.target.value)}
                                placeholder="Contact Full Name"
                                className={`w-full px-3 py-2 text-xs rounded-lg border ${
                                  fieldErrors[`cp_${idx}_fullName`] ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                                } focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                              />
                              {fieldErrors[`cp_${idx}_fullName`] && (
                                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors[`cp_${idx}_fullName`]}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Designation <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={contact.designation}
                                onChange={(e) => handleContactChange(idx, 'designation', e.target.value)}
                                placeholder="e.g. Vice Principal, Trustee, Coordinator"
                                className={`w-full px-3 py-2 text-xs rounded-lg border ${
                                  fieldErrors[`cp_${idx}_designation`] ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                                } focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                              />
                              {fieldErrors[`cp_${idx}_designation`] && (
                                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors[`cp_${idx}_designation`]}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Email Address <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="email"
                                value={contact.email}
                                onChange={(e) => handleContactChange(idx, 'email', e.target.value)}
                                placeholder="person@school.edu"
                                className={`w-full px-3 py-2 text-xs rounded-lg border ${
                                  fieldErrors[`cp_${idx}_email`] ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                                } focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                              />
                              {fieldErrors[`cp_${idx}_email`] && (
                                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors[`cp_${idx}_email`]}</p>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">
                                Mobile Number <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="tel"
                                value={contact.mobileNumber}
                                onChange={(e) => handleContactChange(idx, 'mobileNumber', e.target.value)}
                                placeholder="9876543210"
                                className={`w-full px-3 py-2 text-xs rounded-lg border ${
                                  fieldErrors[`cp_${idx}_mobileNumber`] ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                                } focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                              />
                              {fieldErrors[`cp_${idx}_mobileNumber`] && (
                                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors[`cp_${idx}_mobileNumber`]}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 3: Initial Administrator Details */}
                {step === 3 && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <span>Step 3: Initial Administrator Details</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        This person will be designated as the primary School Administrator with full portal control.
                      </p>
                    </div>

                    <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
                      <strong>Important Notice:</strong> Initial Administrator login credentials will be generated automatically and dispatched to the email provided below. The administrator will not need to create a separate account.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Administrator Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="adminFullName"
                          value={formData.adminFullName}
                          onChange={handleAdminChange}
                          placeholder="e.g. Kishan Solanki"
                          className={`w-full px-3.5 py-2.5 text-sm rounded-lg border ${
                            fieldErrors.adminFullName ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                        />
                        {fieldErrors.adminFullName && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.adminFullName}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Administrator Email Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            name="adminEmail"
                            value={formData.adminEmail}
                            onChange={handleAdminChange}
                            placeholder="admin.personal@gmail.com"
                            className={`w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border ${
                              fieldErrors.adminEmail ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                          />
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        {fieldErrors.adminEmail && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.adminEmail}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Administrator Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            name="adminMobile"
                            value={formData.adminMobile}
                            onChange={handleAdminChange}
                            placeholder="9876543210"
                            className={`w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border ${
                              fieldErrors.adminMobile ? 'border-rose-400 ring-1 ring-rose-400' : 'border-slate-300'
                            } focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden`}
                          />
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        </div>
                        {fieldErrors.adminMobile && (
                          <p className="text-xs text-rose-600 mt-1">{fieldErrors.adminMobile}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Review & Confirmation */}
                {step === 4 && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                        <ClipboardCheck className="w-5 h-5 text-blue-600" />
                        <span>Step 4: Review and Confirmation</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Please review all submitted information carefully before final submission.
                      </p>
                    </div>

                    {/* Summary Card 1: School */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          1. School Information
                        </span>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs">
                        <div>
                          <dt className="text-slate-500 font-medium">School Name:</dt>
                          <dd className="text-slate-900 font-bold mt-0.5">{formData.schoolName}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 font-medium">Established Year:</dt>
                          <dd className="text-slate-900 font-semibold mt-0.5">{formData.establishedYear}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 font-medium">Official Email:</dt>
                          <dd className="text-slate-900 font-semibold mt-0.5">{formData.email}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 font-medium">Contact Number:</dt>
                          <dd className="text-slate-900 font-semibold mt-0.5">{formData.mobileNumber}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-slate-500 font-medium">Address:</dt>
                          <dd className="text-slate-900 mt-0.5">{formData.address}</dd>
                        </div>
                        {formData.websiteUrl && (
                          <div className="sm:col-span-2">
                            <dt className="text-slate-500 font-medium">Website:</dt>
                            <dd className="text-blue-600 mt-0.5">{formData.websiteUrl}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Summary Card 2: Contact Persons */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          2. Contact Persons ({formData.contactPersons.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        {formData.contactPersons.map((cp, i) => (
                          <div key={i} className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                            <p className="font-bold text-slate-900">{cp.fullName}</p>
                            <p className="text-blue-600 font-medium">{cp.designation}</p>
                            <p className="text-slate-600">{cp.email}</p>
                            <p className="text-slate-600">{cp.mobileNumber}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary Card 3: Administrator */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          3. Initial Administrator
                        </span>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs">
                        <div>
                          <dt className="text-slate-500 font-medium">Full Name:</dt>
                          <dd className="text-slate-900 font-bold mt-0.5">{formData.adminFullName}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 font-medium">Email Address:</dt>
                          <dd className="text-slate-900 font-semibold mt-0.5">{formData.adminEmail}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 font-medium">Mobile Number:</dt>
                          <dd className="text-slate-900 font-semibold mt-0.5">{formData.adminMobile}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 font-medium">Initial Role:</dt>
                          <dd className="text-emerald-700 font-bold mt-0.5">School Administrator</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Terms and Conditions Checkbox */}
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.termsAccepted}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, termsAccepted: e.target.checked }));
                            setErrorMessage('');
                          }}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-700 leading-relaxed">
                          I declare that the information provided above is true and authentic. I accept the{' '}
                          <span className="font-semibold text-slate-900">DMMS Terms and Conditions</span> and privacy policy on behalf of the registered institution.
                        </span>
                      </label>
                    </div>

                  </div>
                )}

                {/* Form Navigation Controls */}
                <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={loading}
                      className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <div>
                      <Link to="/" className="text-xs text-slate-500 hover:text-slate-800">
                        Cancel and return to Home
                      </Link>
                    </div>
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitRegistration}
                      disabled={!formData.termsAccepted || loading}
                      className={`px-7 py-2.5 text-xs sm:text-sm font-semibold text-white rounded-lg shadow-md transition-all flex items-center space-x-2 ${
                        formData.termsAccepted && !loading
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25 cursor-pointer'
                          : 'bg-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Registering School...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Register School</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SchoolRegisterPage;
