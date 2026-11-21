import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { useUserAuth } from '../context/UserAuthContext';
import { ArrowRight, LogIn, CheckCircle2, Shield, Award, Users, BookOpen } from 'lucide-react';
import homeImg from '../assets/home-image.png';

const HomePage = () => {
  const navigate = useNavigate();
  const { isSchoolAuthenticated } = useSchoolAuth();
  const { isUserAuthenticated } = useUserAuth();

  const handleLoginClick = () => {
    if (isUserAuthenticated) {
      navigate('/dashboard');
    } else if (isSchoolAuthenticated) {
      navigate('/user-login');
    } else {
      navigate('/school-login');
    }
  };

  const handleGetStartedClick = () => {
    navigate('/register-school');
  };

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-slate-50 via-white to-slate-50">
      {/* 1. Header */}
      <Header />

      {/* 2. Main Content (Two-Column Layout) */}
      <main className="flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Heading, Description & Action Buttons */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-xs font-semibold">
                <Award className="w-3.5 h-3.5 text-blue-600" />
                <span>Next-Gen Academic Evaluation Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Digital Marksheet <br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600">
                  Management System
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed mx-auto lg:mx-0">
                A unified, secure, and modern digital platform designed for schools, teachers, and administrators to streamline academic evaluation, manage student records, and generate tamper-proof marksheet reports effortlessly.
              </p>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left max-w-xl mx-auto lg:mx-0">
                <div className="flex items-center space-x-2.5 text-slate-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Role-Based Access for 4 Key User Roles</span>
                </div>
                <div className="flex items-center space-x-2.5 text-slate-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Automated Credential Generation &amp; Email</span>
                </div>
                <div className="flex items-center space-x-2.5 text-slate-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dynamic Academic Year Switching</span>
                </div>
                <div className="flex items-center space-x-2.5 text-slate-700 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Strict School Data Isolation</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={handleGetStartedClick}
                  className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all flex items-center justify-center space-x-2 group cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={handleLoginClick}
                  className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-xl border border-slate-300 shadow-xs hover:border-slate-400 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-600" />
                  <span>Login</span>
                </button>
              </div>

              {/* User Roles Ribbon */}
              <div className="pt-6 border-t border-slate-200">
                <p className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">
                  Tailored Portals for:
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    <span>School Administrator</span>
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-purple-600" />
                    <span>Head Teacher</span>
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Teacher</span>
                  </span>
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>Office Staff</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Home Page illustration / image */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-lg">
                <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-20"></div>
                <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-2 sm:p-4">
                  <img
                    src={homeImg}
                    alt="DMMS Illustration"
                    className="w-full h-auto object-contain rounded-xl"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/home-image.png';
                    }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;
