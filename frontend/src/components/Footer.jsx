import React from 'react';

const Footer = ({ className = '' }) => {
  return (
    <footer className={`bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-sm ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
        <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
          DESIGN AND DEVELOPED BY
        </p>
        <p className="font-semibold text-slate-200">
          <a
            href="https://shreeji-it-solution.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors"
          >
            Shreeji IT Solutions PVT. LTD.
          </a>
        </p>
        <p className="text-xs text-slate-500 pt-1">
          &copy; {new Date().getFullYear()} Digital Marksheet Management System. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
