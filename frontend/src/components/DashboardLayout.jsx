import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { Menu, X } from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Shared Header */}
      <Header />

      {/* Mobile Sidebar Toggle Button */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-2 flex items-center justify-between border-b border-slate-800">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex items-center space-x-2 text-xs font-medium text-slate-300 hover:text-white"
        >
          {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>{mobileSidebarOpen ? 'Close Menu' : 'Open Sidebar'}</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-row">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Slide-in Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative w-64 bg-slate-900 z-10 flex flex-col h-full shadow-2xl">
              <Sidebar />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
};

export default DashboardLayout;
