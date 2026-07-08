import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Compass, HelpCircle, ArrowLeft, LayoutDashboard, Building2 } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  // SEO & Robots settings
  useEffect(() => {
    // Set Document Title
    const originalTitle = document.title;
    document.title = "404 | Page Not Found";

    // Inject meta robots noindex tag
    const metaRobots = document.createElement('meta');
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    document.head.appendChild(metaRobots);

    return () => {
      document.title = originalTitle;
      document.head.removeChild(metaRobots);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-between p-6 md:p-12 font-sans selection:bg-[#319BA4]/10 selection:text-[#0F466B]">
      
      {/* Top Company Branding Header */}
      <motion.header 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-4xl flex items-center justify-center md:justify-start gap-3 mt-4"
      >
        <div className="w-10 h-10 rounded-xl bg-[#0F466B] flex items-center justify-center font-black text-white text-xl shadow-md border border-[#319BA4]/20">
          A
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-widest text-[#0F466B] uppercase">AZM Group</span>
          <span className="text-[10px] text-slate-500 font-semibold tracking-normal uppercase">
            AL Zahra Al Malakia Bldg. Mat. Tr. LLC (Shj. Br.)
          </span>
        </div>
      </motion.header>

      {/* Main Container Card */}
      <main className="my-auto w-full max-w-xl flex flex-col items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-100 flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Subtle decorative background gradient */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0F466B] via-[#319BA4] to-[#0F466B]" />

          {/* Large Floating Illustration */}
          <motion.div 
            animate={{ 
              y: [0, -10, 0],
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="relative mb-8"
          >
            {/* Soft background pulse */}
            <div className="absolute inset-0 bg-[#319BA4]/10 rounded-full blur-2xl scale-125" />
            
            {/* Visual 404 Isometric block style */}
            <div className="relative w-36 h-36 bg-gradient-to-tr from-[#0F466B] to-[#319BA4] rounded-2xl flex flex-col items-center justify-center shadow-xl border border-white/20">
              <span className="text-4xl font-extrabold text-white tracking-widest leading-none">404</span>
              <Compass className="w-8 h-8 text-[#319BA4] absolute -bottom-2 -right-2 bg-white rounded-lg p-1.5 shadow-md border border-slate-100" />
              <HelpCircle className="w-6 h-6 text-[#0F466B] absolute -top-2 -left-2 bg-white rounded-full p-1 shadow-md border border-slate-100" />
            </div>
          </motion.div>

          {/* Headings */}
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
            Oops! Page Not Found
          </h2>

          <p className="text-slate-600 font-medium text-sm leading-relaxed mb-2 max-w-sm">
            The page you are looking for may have been moved, deleted, or the URL may be incorrect.
          </p>
          
          <p className="text-[#319BA4] font-semibold text-xs tracking-wide uppercase mb-8">
            Please check the address or return to your dashboard.
          </p>

          {/* Buttons Layout */}
          <div className="flex flex-col sm:flex-row gap-3.5 w-full justify-center">
            
            {/* Go Back (Secondary Button) */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.history.back()}
              aria-label="Go to the previous page"
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#319BA4] focus:ring-offset-2 transition-all font-semibold text-sm cursor-pointer shadow-sm group"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:-translate-x-0.5 transition-all" />
              Go Back
            </motion.button>

            {/* Dashboard Link (Primary Button) */}
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/')}
              aria-label="Go to the QMS Dashboard homepage"
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#0F466B] text-white rounded-xl hover:bg-[#1B577E] focus:outline-none focus:ring-2 focus:ring-[#0F466B] focus:ring-offset-2 transition-all font-semibold text-sm cursor-pointer shadow-lg shadow-[#0F466B]/20 group"
            >
              <LayoutDashboard className="w-4 h-4 text-white/80 group-hover:rotate-6 transition-transform" />
              Go to Dashboard
            </motion.button>

          </div>
        </motion.div>
      </main>

      {/* Footer Branding Area */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="w-full max-w-4xl text-center md:text-right text-[10px] text-slate-400 font-medium pb-4 mt-6 flex flex-col md:flex-row items-center justify-between gap-2 border-t border-slate-200/60 pt-4"
      >
        <span className="flex items-center gap-1">
          <Building2 className="w-3 h-3 text-[#319BA4]" />
          Al Zahra Al Malakia Bldg. Mat. Tr. LLC
        </span>
        <span>
          QMS Enterprise v4.2.0 &copy; 2026 AZM Group
        </span>
      </motion.footer>
      
    </div>
  );
}
