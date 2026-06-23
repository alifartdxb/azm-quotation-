import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Users, FileText, CheckCircle, Clock, MessageSquare, Calendar, ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DashboardStats, Quotation } from '../types';
import { getDashboardStats, getQuotations } from '../lib/firebase';
import { format } from 'date-fns';
import { formatCurrency, parseDate } from '../lib/utils';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
    getQuotations().then(setAllQuotations).catch(console.error);
  }, []);

  const chartData = useMemo(() => {
    const dataByMonth: Record<string, number> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize current year months
    months.forEach(m => dataByMonth[m] = 0);

    const currentYear = new Date().getFullYear();

    allQuotations.forEach(q => {
      const d = parseDate(q.createdAt);
      if (d.getFullYear() === currentYear) {
        const monthName = format(d, 'MMM');
        if (dataByMonth[monthName] !== undefined && q.status !== 'Rejected' && q.status !== 'Expired') {
          dataByMonth[monthName] += (q.grandTotal || 0);
        }
      }
    });

    return months.map(name => ({
      name,
      value: dataByMonth[name]
    }));
  }, [allQuotations]);

  const biMetrics = useMemo(() => {
    const totalRevenue = allQuotations
      .filter(q => q.status === 'Approved' || q.status === 'Converted to Order')
      .reduce((sum, q) => sum + q.grandTotal, 0);

    const approvedCount = allQuotations.filter(q => q.status === 'Approved' || q.status === 'Converted to Order').length;
    const approvalRate = allQuotations.length ? Math.round((approvedCount / allQuotations.length) * 100) : 0;
    
    const avgQuoteValue = allQuotations.length ? Math.round(allQuotations.reduce((sum, q) => sum + q.grandTotal, 0) / allQuotations.length) : 0;

    return { totalRevenue, approvalRate, avgQuoteValue };
  }, [allQuotations]);


  if (!stats) {
    return <div className="text-center py-10 opacity-60">Loading dashboard...</div>;
  }

  const statCards = [
    { name: 'Total Quotations', value: stats.totalQuotes, icon: FileText },
    { name: 'Pending Quotations', value: stats.pendingQuotes, icon: Clock },
    { name: 'Approved Quotations', value: stats.approvedQuotes, icon: CheckCircle },
    { name: 'Average Value', value: formatCurrency(biMetrics.avgQuoteValue), icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={() => window.location.href = '/quotations/new'}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
        >
          <FileText className="w-4 h-4" />
          <span>New Quotation</span>
        </button>
        <button 
          onClick={() => window.location.href = '/invoices/new'}
          className="bg-[#1B6B72] hover:bg-[#16565c] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>New Invoice</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group overflow-hidden relative">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.name}</p>
            <p className="text-xl font-bold text-slate-900 font-mono line-clamp-1">{stat.value}</p>
            <div className="absolute -right-2 -bottom-2 text-slate-50 group-hover:text-blue-50 transition-colors">
              <stat.icon className="w-16 h-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="font-bold text-slate-800">Quotation Revenue Pipeline (Current Year)</h3>
            <button className="text-xs text-blue-600 font-semibold hover:underline">Download Report</button>
          </div>
          <div className="p-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} width={80} tickFormatter={(val) => Math.round(val).toLocaleString()} />
                <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(val: number) => Math.round(val).toLocaleString() + ' AED'} />
                <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-6">
           <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0 h-full">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Recent Quotes</h3>
             </div>
             <div className="space-y-4 overflow-y-auto">
                {stats.recentQuotes.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent quotations.</p>
                ) : (
                  stats.recentQuotes.map(quote => (
                    <div key={quote.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors px-2 -mx-2 rounded-lg">
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-blue-600">{quote.quoteNo}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{quote.customer?.companyName || 'Unknown Customer'}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                         <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold inline-block",
                          quote.status === 'Draft' ? "bg-slate-100 text-slate-700" :
                          quote.status === 'Pending Approval' ? "bg-amber-100 text-amber-700" :
                          quote.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                          quote.status === 'Rejected' ? "bg-red-100 text-red-700" :
                          quote.status === 'Sent' ? "bg-blue-100 text-blue-700" :
                          quote.status === 'Converted to Order' ? "bg-purple-100 text-purple-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {quote.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
             </div>
           </div>
        </div>
      </div>

      {/* CRM Lightweight Executive Statistics Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-serif font-bold text-slate-905 text-base">AZM Customer CRM & Pipeline Insights</h3>
            <p className="text-slate-400 text-xs mt-0.5">Automated tracking of contractor engagement, hot leads, and WhatsApp conversion history.</p>
          </div>
          <button 
            onClick={() => window.location.href = '/customers'}
            className="text-xs font-bold text-[#1B6B72] hover:underline flex items-center gap-1.5 bg-[#1B6B72]/5 px-3 py-1.5 rounded-xl border border-[#1B6B72]/15"
          >
            Access CRM Hub
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total CRM Database */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center gap-4 hover:border-[#1B6B72]/30 hover:bg-[#1B6B72]/5 transition-all">
            <div className="p-3 bg-blue-100 rounded-xl text-blue-700 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">New / Registered Customers</span>
              <strong className="text-xl font-bold font-mono text-slate-900 block mt-0.5">{stats.totalCustomers || 0}</strong>
            </div>
          </div>

          {/* Active Contacts */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center gap-4 hover:border-[#1B6B72]/30 hover:bg-[#1B6B72]/5 transition-all">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Active Accounts</span>
              <strong className="text-xl font-bold font-mono text-slate-900 block mt-0.5">{stats.activeCustomers || 0}</strong>
            </div>
          </div>

          {/* Hot Leads */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center gap-4 hover:border-[#1B6B72]/30 hover:bg-[#1B6B72]/5 transition-all">
            <div className="p-3 bg-red-105 rounded-xl text-red-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Hot Leads</span>
              <strong className="text-xl font-bold font-mono text-slate-900 block mt-0.5">{stats.hotLeads || 0}</strong>
            </div>
          </div>

          {/* Follow up actions required */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center gap-4 hover:border-[#1B6B72]/30 hover:bg-[#1B6B72]/5 transition-all">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] block">Follow-ups Required</span>
              <strong className="text-xl font-bold font-mono text-slate-900 block mt-0.5">{stats.followUpRequired || 0}</strong>
            </div>
          </div>
        </div>

        {/* Dynamic CRM marketing shortcuts banner */}
        <div className="bg-gradient-to-r from-[#1B6B72]/5 to-[#C9A96E]/5 p-4 rounded-xl border border-[#1B6B72]/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <strong className="text-xs text-slate-800 block">Deploy Automated Customer Engagement Campaigns</strong>
            <p className="text-[11px] text-slate-500 leading-normal">
              Connect directly with architects, builders, and developers or schedule personalized phone reminders regarding payment and quotation approvals.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/whatsapp-marketing'}
            className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition whitespace-nowrap animate-pulse"
          >
            Open WhatsApp Marketing Module
          </button>
        </div>
      </div>
    </div>
  );
}
