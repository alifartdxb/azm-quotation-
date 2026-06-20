import { useState, useEffect } from 'react';
import type { Quotation } from '../types';
import { Plus, Search, FileText, Trash2 } from 'lucide-react';
import { formatCurrency, cn, parseDate } from '../lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { getQuotations, deleteQuotation, logActivity } from '../lib/firebase';

export default function Quotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Custom Delete Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; quoteNo: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadQuotations();
  }, []);

  const loadQuotations = () => {
    setLoading(true);
    getQuotations().then(data => {
      setQuotations(data);
      setLoading(false);
    });
  };

  const openDeleteModal = (id: string, quoteNo: string) => {
    setQuoteToDelete({ id, quoteNo });
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!quoteToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteQuotation(quoteToDelete.id);
      await logActivity('Quotation Deleted', 'Quotation', quoteToDelete.id, `Deleted quotation ${quoteToDelete.quoteNo}`);
      setIsDeleteModalOpen(false);
      setQuoteToDelete(null);
      loadQuotations();
    } catch (error) {
      console.error("Error deleting quotation:", error);
      setDeleteError("Failed to delete quotation. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = quotations.filter(q => {
    const s = search.toLowerCase();
    return (
      (q.quoteNo && q.quoteNo.toLowerCase().includes(s)) || 
      (q.customer?.companyName && q.customer.companyName.toLowerCase().includes(s)) ||
      (q.status && q.status.toLowerCase().includes(s)) ||
      (q.salesperson && q.salesperson.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quotations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track your quotes</p>
        </div>
        <Link to="/quotations/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold shadow-sm transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          <span>Create Quotation</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
         <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">All Quotations</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by quote no or customer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#509AA3] text-white text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3">Quote Details</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-blue-600 font-mono text-sm">{quote.quoteNo}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{quote.items.length} items</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-800">{quote.customer?.companyName || 'Unknown'}</p>
                    <p className="text-[11px] text-slate-500">{quote.customer?.customerName}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {format(parseDate(quote.createdAt), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-sm font-medium text-slate-900">{formatCurrency(quote.grandTotal)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold inline-block",
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
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link to={`/quotations/${quote.id}`} className="text-[11px] text-blue-600 font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                      View / Print
                    </Link>
                    <button
                      onClick={() => openDeleteModal(quote.id as string, quote.quoteNo)}
                      className="text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Quotation"
                    >
                      <Trash2 className="w-4 h-4 inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
               {filtered.length === 0 && (
                 <tr>
                 <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                   No quotations found.
                 </td>
               </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && quoteToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Quotation</h3>
              <p className="text-sm text-slate-500 mb-4">
                Are you sure you want to delete quotation <span className="font-semibold text-slate-800 font-mono">{quoteToDelete.quoteNo}</span>? This action is permanent and cannot be undone.
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
                    setQuoteToDelete(null);
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
                  {isDeleting ? "Deleting..." : "Delete Quotation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
