import { useState, useEffect } from 'react';
import type { SalesInvoice } from '../types';
import { Plus, Search, FileText, Trash2, ArrowUpRight, DollarSign, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { formatCurrency, cn, parseDate } from '../lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { getSalesInvoices, deleteSalesInvoice, logActivity, updateSalesInvoiceStatus } from '../lib/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Invoices() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Custom Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<{ id: string; invoiceNo: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Status edit states
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = () => {
    setLoading(true);
    getSalesInvoices().then(data => {
      setInvoices(data);
      setLoading(false);
    });
  };

  const handleStatusChange = async (id: string, invoiceNo: string, oldStatus: string, newStatus: string) => {
    if (oldStatus === newStatus) return;
    setUpdatingStatusId(id);
    try {
      await updateSalesInvoiceStatus(id, newStatus);
      await logActivity('Invoice Status Changed', 'System', id, `Changed status of invoice ${invoiceNo} from ${oldStatus} to ${newStatus}`);
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv));
    } catch (error) {
      console.error("Error updating invoice status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const openDeleteModal = (id: string, invoiceNo: string) => {
    setInvoiceToDelete({ id, invoiceNo });
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteSalesInvoice(invoiceToDelete.id);
      await logActivity('Invoice Deleted', 'System', invoiceToDelete.id, `Deleted sales invoice ${invoiceToDelete.invoiceNo}`);
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
      loadInvoices();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      setDeleteError("Failed to delete invoice. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = invoices.filter(inv => {
    const s = search.toLowerCase();
    return (
      (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(s)) ||
      (inv.customer?.companyName && inv.customer.companyName.toLowerCase().includes(s)) ||
      (inv.customer?.customerName && inv.customer.customerName.toLowerCase().includes(s)) ||
      (inv.status && inv.status.toLowerCase().includes(s)) ||
      (inv.salesperson && inv.salesperson.toLowerCase().includes(s)) ||
      (inv.quotationNo && inv.quotationNo.toLowerCase().includes(s))
    );
  });

  // Calculate dynamic dashboard statistics
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstandingBalance !== undefined ? inv.outstandingBalance : inv.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  const pendingPaymentCount = invoices.filter(inv => inv.paymentStatus === 'Unpaid' || !inv.paymentStatus).length;
  const partiallyPaidCount = invoices.filter(inv => inv.paymentStatus === 'Partially Paid').length;
  const paidCount = invoices.filter(inv => inv.paymentStatus === 'Paid').length;

  // Chart data: Monthly Revenue
  // Format aggregate by month (e.g. "Jan", "Feb", "Mar")
  const revenueByMonthMap: Record<string, number> = {};
  invoices.forEach(inv => {
    if (inv.createdAt) {
      try {
        const date = parseDate(inv.createdAt);
        const monthKey = format(date, 'MMM yy');
        revenueByMonthMap[monthKey] = (revenueByMonthMap[monthKey] || 0) + (inv.grandTotal || 0);
      } catch (err) {
        // Fallback
      }
    }
  });

  const chartData = Object.keys(revenueByMonthMap).map(month => ({
    name: month,
    Revenue: revenueByMonthMap[month]
  })).reverse(); // Standard chronological order

  return (
    <div className="space-y-6">
      {/* Upper Title Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Invoice Management</h1>
          <p className="text-sm text-slate-500 mt-1">Convert approved quotes to invoices, configure billing details, and view payment tracking dashboards</p>
        </div>
        <Link 
          to="/invoices/new" 
          className="bg-[#1B6B72] hover:bg-[#16565c] text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Invoice</span>
        </Link>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Monthly Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Invoiced Amount</p>
            <h3 className="text-2xl font-black font-mono text-slate-900 mt-1">{formatCurrency(totalAmount)}</h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Full cumulative invoicing value</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* KPI: Outstanding Amount */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outstanding Receivable</p>
            <h3 className="text-2xl font-black font-mono text-red-650 mt-1">{formatCurrency(totalOutstanding)}</h3>
            <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              <span>Awaiting payment clearance</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-red-50 text-red-650 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* KPI: Realized Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Paid / Cleared Balance</p>
            <h3 className="text-2xl font-black font-mono text-emerald-700 mt-1">{formatCurrency(totalPaid)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              <span>Realized cash-in-hand</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* KPI: Collection Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invoice Settlement Ratio</p>
            <h3 className="text-2xl font-black font-mono text-blue-600 mt-1">
              {totalAmount > 0 ? `${Math.round((totalPaid / totalAmount) * 100)}%` : '0%'}
            </h3>
            <div className="w-28 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-1.5 rounded-full" 
                style={{ width: `${totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Invoice Charting View */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between col-span-2 mb-4">
            <h3 className="font-bold text-slate-800">Monthly Invoicing Revenue Trend</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B6B72" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1B6B72" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area type="monotone" dataKey="Revenue" stroke="#1B6B72" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Billing Status Multiplier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 scale-110"></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Pending Invoices</p>
            <p className="text-lg font-black text-slate-850">{pendingPaymentCount} Invoices</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Partially Paid</p>
            <p className="text-lg font-black text-slate-850">{partiallyPaidCount} Invoices</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Fully Settled</p>
            <p className="text-lg font-black text-slate-850">{paidCount} Settled</p>
          </div>
        </div>
      </div>

      {/* Primary Invoices Listing Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800">All Sales Invoices</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by invoice, company, partner..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none animate-transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#1B6B72] text-white text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3">Invoice Details</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Payment status</th>
                <th className="px-6 py-3 text-center">Working status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inv => {
                const outstanding = inv.outstandingBalance !== undefined ? inv.outstandingBalance : inv.grandTotal;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-50 text-[#1B6B72] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-[#1B6B72] font-mono text-sm">{inv.invoiceNo}</p>
                          {inv.quotationNo && (
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Qtn: {inv.quotationNo}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">{inv.customer?.companyName || 'Unknown'}</p>
                      <p className="text-[11px] text-slate-500">{inv.customer?.customerName}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {format(parseDate(inv.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-mono text-sm font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</p>
                      {outstanding > 0 && (
                        <p className="text-[10px] text-red-500 font-mono">Due: {formatCurrency(outstanding)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        inv.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                        inv.paymentStatus === 'Partially Paid' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {inv.paymentStatus || 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="relative inline-block text-left w-36">
                        <select
                          value={inv.status}
                          disabled={updatingStatusId === inv.id}
                          onChange={(e) => handleStatusChange(inv.id, inv.invoiceNo, inv.status, e.target.value)}
                          className={cn(
                            "w-full px-2.5 py-1 pr-7 rounded-lg text-[10px] font-bold uppercase tracking-wider border-none ring-0 outline-none cursor-pointer focus:ring-1 focus:ring-[#1B6B72]/30 transition-all appearance-none bg-[right_0.5rem_center] bg-no-repeat text-center",
                            updatingStatusId === inv.id ? "opacity-50 cursor-not-allowed" : "",
                            inv.status === 'Draft' ? "bg-slate-100 text-slate-700" :
                            inv.status === 'Pending Approval' ? "bg-amber-100 text-amber-700" :
                            inv.status === 'Approved' ? "bg-emerald-100 text-emerald-700 font-bold" :
                            inv.status === 'Invoice Sent' ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-700"
                          )}
                          style={{
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233d3d3d' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundSize: '10px',
                          }}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Pending Approval">Pending Approval</option>
                          <option value="Approved">Approved</option>
                          <option value="Invoice Sent">Invoice Sent</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <Link to={`/invoices/${inv.id}`} className="text-[11px] text-blue-600 font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                        Open invoice / Track Payment
                      </Link>
                      <button
                        onClick={() => openDeleteModal(inv.id, inv.invoiceNo)}
                        className="text-slate-400 hover:text-red-650 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4 inline-block" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 text-sm font-medium">
                    No sales invoices found. Convert an Approved Quotation or build a new template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && invoiceToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-fade-inScale">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Invoice</h3>
              <p className="text-sm text-slate-500 mb-4">
                Are you sure you want to delete sales invoice <span className="font-semibold text-slate-850 font-mono">{invoiceToDelete.invoiceNo}</span>? This action is permanent and cannot be undone.
              </p>
              {deleteError && (
                <div className="p-2.5 mb-4 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setInvoiceToDelete(null);
                  }} 
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={confirmDelete} 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
