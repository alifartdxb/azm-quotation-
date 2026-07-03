import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
        <FileQuestion className="w-12 h-12 text-slate-400" />
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">404</h1>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">Page Not Found</h2>
      <p className="text-slate-500 mb-8 max-w-md text-center text-sm">
        The page you are looking for doesn't exist or has been moved. Check the URL or navigate back to the dashboard.
      </p>
      <div className="flex gap-4">
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors font-medium text-sm shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <Link 
          to="/" 
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
