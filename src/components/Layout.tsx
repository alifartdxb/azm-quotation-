import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Package, FileText, Settings, LogOut, Menu, Search, Plus, Bell, Activity, User } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Quotations', path: '/quotations', icon: FileText },
    { name: 'Products', path: '/products', icon: Package },
    { name: 'My Profile', path: '/profile', icon: User },
  ];

  if (user?.role === 'SUPER_ADMIN' || user?.role === 'SALES_MANAGER') {
    navItems.push({ name: 'Settings', path: '/settings', icon: Settings });
  }

  if (user?.role === 'SUPER_ADMIN') {
    navItems.push({ name: 'Audit Logs', path: '/audit-logs', icon: Activity });
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-slate-300 border-r border-slate-800 z-50 transition-transform duration-300 flex flex-col shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">A</div>
              <h1 className="text-white font-bold text-lg tracking-tight uppercase">AZM Group</h1>
            </div>
            <div className="text-[10px] text-slate-500 font-medium tracking-widest uppercase text-right leading-none mt-2">نظام إدارة عروض الأسعار</div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "px-3 py-2 border border-transparent rounded-md flex items-center gap-3 transition-colors",
                  isActive 
                    ? "bg-blue-600/10 text-blue-400" 
                    : "hover:bg-slate-800"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-4 h-4" />
                <span className={cn("text-sm", isActive && "font-semibold")}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center justify-between">
            <Link to="/profile" className="flex items-center gap-3 hover:opacity-80 transition-opacity" title="View Profile">
              <div className="w-10 h-10 rounded-full bg-[#509AA3] flex items-center justify-center text-white font-bold shrink-0">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.role?.replace('_', ' ')}</p>
              </div>
            </Link>
            <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-white transition-colors shrink-0" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 md:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-[384px] hidden sm:block">
              <span className="absolute left-3 top-2.5 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input type="text" placeholder="Search Quotations, SKUs, or Clients..." className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {['SUPER_ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE'].includes(user?.role || '') && (
              <Link to="/quotations/new" className="hidden sm:flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all">
                <Plus className="w-4 h-4" />
                New Quotation
              </Link>
            )}
            <div className="w-px h-8 bg-slate-200 mx-1 sm:mx-2 hidden sm:block"></div>
            <button className="p-2 text-slate-400 hover:text-slate-600 focus:outline-none">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col">
          <div className="p-4 md:p-8 flex-1">
            <Outlet />
          </div>
          
          <footer className="h-10 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center justify-between text-[10px] text-slate-400 font-medium shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                System Operational
              </span>
              <span className="hidden sm:inline">Server: DXB-CENTRAL-01</span>
              <span className="hidden sm:inline">Last Sync: Just now</span>
            </div>
            <div>
              QMS Enterprise v4.2.0 &copy; 2026 AZM Group
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
