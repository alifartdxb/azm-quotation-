import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Search, UserPlus, FileText, Calendar, Filter, 
  MapPin, Landmark, Briefcase, Plus, Trash2, Edit3, X, 
  Download, RefreshCw, CheckCircle, Clock, AlertCircle, Phone, MessageSquare 
} from 'lucide-react';
import { cn, formatCurrency, parseDate } from '../lib/utils';
import { 
  getCrmCustomers, saveCrmCustomer, deleteCrmCustomer, 
  getCrmCustomerQuotationHistory, logActivity, db 
} from '../lib/firebase';
import type { CrmCustomer, Quotation } from '../types';
import { format } from 'date-fns';
import Papa from 'papaparse';

const CUSTOMER_TYPES = [
  'Retail', 'Contractor', 'Builder', 'Interior Designer', 
  'Architect', 'Project Customer', 'Dealer', 'VIP'
];

const CUSTOMER_TAGS = [
  'Hot Lead', 'Active Customer', 'Inactive Customer', 'Follow Up Required'
];

const CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'];

export default function Customers() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail view state
  const [viewCustomer, setViewCustomer] = useState<CrmCustomer | null>(null);
  const [customerQuotes, setCustomerQuotes] = useState<Quotation[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  // Edit / Add Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Partial<CrmCustomer> | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Quick Follow Up state on Detail View
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpType, setFollowUpType] = useState<'Call' | 'WhatsApp' | 'None'>('None');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  // Load Customers
  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCrmCustomers();
      setCustomers(data);
    } catch (err) {
      console.error("Error loading customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Sync quotation history for selected customer
  useEffect(() => {
    if (viewCustomer && viewCustomer.mobile) {
      setLoadingQuotes(true);
      getCrmCustomerQuotationHistory(viewCustomer.mobile)
        .then(setCustomerQuotes)
        .catch(console.error)
        .finally(() => setLoadingQuotes(false));
      
      // Load follow up states
      setFollowUpDate(viewCustomer.followUpDate || '');
      setFollowUpType((viewCustomer.followUpType as any) || 'None');
      setFollowUpNotes(viewCustomer.followUpNotes || '');
    } else {
      setCustomerQuotes([]);
    }
  }, [viewCustomer]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCustomers();
    setIsRefreshing(false);
  };

  // Search & Filtered logic
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = 
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile.includes(searchTerm) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.trn && c.trn.includes(searchTerm));

      const matchType = selectedType === 'All' || c.customerType === selectedType;
      const matchTag = selectedTag === 'All' || c.tag === selectedTag;

      return matchSearch && matchType && matchTag;
    });
  }, [customers, searchTerm, selectedType, selectedTag]);

  // Export as CSV
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      alert("No customers to export");
      return;
    }
    const cleanData = filteredCustomers.map(c => ({
      'Customer Name': c.customerName,
      'Company Name': c.companyName || 'N/A',
      'Contact Person': c.contactPerson || 'N/A',
      'Mobile': c.mobile,
      'WhatsApp': c.whatsapp || c.mobile,
      'Email': c.email || 'N/A',
      'TRN': c.trn || 'N/A',
      'City': c.city || 'Dubai',
      'Address': c.address || 'N/A',
      'Project': c.projectName || 'N/A',
      'Customer Type': c.customerType,
      'Tag': c.tag,
      'Created Date': c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd') : 'N/A',
      'Last Quotation Date': c.lastQuotationDate ? format(new Date(c.lastQuotationDate), 'yyyy-MM-dd') : 'N/A',
      'Last Quotation No': c.lastQuotationNo || 'N/A',
      'Notes': c.notes || 'N/A'
    }));

    const csv = Papa.unparse(cleanData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AZM_Group_Customers_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Edit / Add Modal
  const handleOpenModal = (cust?: CrmCustomer) => {
    setModalError(null);
    if (cust) {
      setEditCustomer({ ...cust });
    } else {
      setEditCustomer({
        customerName: '',
        companyName: '',
        contactPerson: '',
        mobile: '',
        whatsapp: '',
        email: '',
        trn: '',
        address: '',
        city: 'Dubai',
        projectName: '',
        customerType: 'Retail',
        tag: 'Hot Lead',
        notes: '',
        createdAt: new Date().toISOString()
      });
    }
    setIsModalOpen(true);
  };

  // Save Customer Handler
  const handleSaveCustomer = async () => {
    if (!editCustomer || !editCustomer.customerName || !editCustomer.mobile) {
      setModalError('Customer Name and Mobile Number are required.');
      return;
    }
    setModalError(null);
    setIsSaving(true);
    try {
      const savedId = await saveCrmCustomer(editCustomer);
      await logActivity(
        editCustomer.id ? 'Updated Customer CRM Profile' : 'Added Customer to CRM', 
        'Customer', 
        savedId, 
        `Customer profile saved/updated: ${editCustomer.customerName} (${editCustomer.mobile})`
      );
      
      await loadCustomers();
      setIsModalOpen(false);
      setEditCustomer(null);

      // If viewing the updated customer, refresh its view
      if (viewCustomer && viewCustomer.id === savedId) {
        const freshList = await getCrmCustomers();
        const freshCust = freshList.find(c => c.id === savedId);
        if (freshCust) setViewCustomer(freshCust);
      }
    } catch (err: any) {
      setModalError(err.message || 'Error saving customer profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save follow up details
  const handleSaveFollowUp = async () => {
    if (!viewCustomer) return;
    setIsSavingFollowUp(true);
    try {
      const updatedCust = {
        ...viewCustomer,
        followUpDate,
        followUpType,
        followUpNotes
      };
      await saveCrmCustomer(updatedCust);
      await logActivity(
        'Updated Customer CRM Followup',
        'Customer',
        viewCustomer.id,
        `Follow-up date scheduled for ${followUpDate} [Type: ${followUpType}]`
      );
      await loadCustomers();
      setViewCustomer(updatedCust);
      alert('Follow-up schedule stored successfully.');
    } catch (err: any) {
      alert('Failed to save follow-up: ' + err.message);
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name} from CRM completely?`)) return;
    try {
      await deleteCrmCustomer(id);
      await logActivity('Deleted Customer Profile', 'Customer', id, `Deleted customer ${name}`);
      await loadCustomers();
      if (viewCustomer?.id === id) {
        setViewCustomer(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting customer profile');
    }
  };

  // Customer metrics calculations
  const totalAmountGiven = useMemo(() => {
    return customerQuotes.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
  }, [customerQuotes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#1B6B72]/10 rounded-xl text-[#1B6B72]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-slate-900 tracking-tight flex items-center gap-2">
                Customer Database CRM
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide font-sans mt-0.5">
                Manage accounts, track transaction histories, segments, and custom follow-up alarms.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={handleRefresh}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 active:scale-95 transition-all text-xs flex items-center gap-1"
            title="Refresh database"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Refresh
          </button>
          
          <button 
            onClick={handleExportCSV}
            className="py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 active:scale-95 transition-all text-xs flex items-center gap-1.5 font-semibold"
          >
            <Download className="w-4 h-4 text-[#C9A96E]" />
            Export CSV
          </button>

          <button 
            onClick={() => handleOpenModal()}
            className="py-2 px-4 bg-[#1B6B72] hover:bg-[#155359] text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            New Customer profile
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Listing Section (7 Columns) */}
        <div className={cn("lg:col-span-12 flex flex-col gap-4", viewCustomer && "lg:col-span-7")}>
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                placeholder="Search by Name, Company, Mobile, Email, or TRN..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:ring-1 focus:ring-[#1B6B72]/35 focus:border-[#1B6B72] outline-none rounded-xl text-sm transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="text-slate-400 font-semibold uppercase flex items-center gap-1 tracking-wider mr-1">
                <Filter className="w-3.5 h-3.5 text-[#C9A96E]" /> Filters:
              </span>
              
              {/* Customer Type Dropdown */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Segment:</span>
                <select 
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1B6B72]/30 text-xs text-slate-800 bg-white font-medium"
                >
                  <option value="All">All Categories</option>
                  {CUSTOMER_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Tag Dropdown */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Tag:</span>
                <select 
                  value={selectedTag}
                  onChange={e => setSelectedTag(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1B6B72]/30 text-xs text-slate-800 bg-white const font-medium"
                >
                  <option value="All">All Leads</option>
                  {CUSTOMER_TAGS.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {(selectedTag !== 'All' || selectedType !== 'All' || searchTerm) && (
                <button 
                  onClick={() => { setSelectedTag('All'); setSelectedType('All'); setSearchTerm(''); }}
                  className="text-red-500 hover:underline font-semibold text-[11px] self-center ml-auto"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Customers Table List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            {loading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#1B6B72] animate-spin"></div>
                <span className="text-xs font-semibold">Fetching Client Profiles...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-20 text-center text-slate-500">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="font-semibold text-sm">No customers matched your filters</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting search terms or add a new profile manually.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="px-5 py-3">Customer Profile</th>
                      <th className="px-5 py-3">Segment</th>
                      <th className="px-5 py-3">Follow Up Date</th>
                      <th className="px-5 py-3 text-center">Tag Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredCustomers.map(cust => {
                      const hasFollowUp = cust.followUpDate;
                      const isUpcoming = hasFollowUp && parseDate(cust.followUpDate).getTime() >= new Date().setHours(0,0,0,0);
                      const isPast = hasFollowUp && parseDate(cust.followUpDate).getTime() < new Date().setHours(0,0,0,0);

                      return (
                        <tr 
                          key={cust.id}
                          className={cn(
                            "hover:bg-[#1B6B72]/5 group cursor-pointer transition-colors",
                            viewCustomer?.id === cust.id && "bg-[#1B6B72]/5"
                          )}
                          onClick={() => setViewCustomer(cust)}
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900 group-hover:text-[#1B6B72] transition-colors">{cust.customerName}</div>
                            <div className="text-xs text-slate-500 font-medium mt-0.5">{cust.companyName || 'Residential Client'}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1">{cust.mobile}  •  {cust.email || 'No email'}</div>
                          </td>
                          <td className="px-5 py-3.5 align-middle">
                            <span className="px-2 py-0.5 rounded-md bg-slate-150 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                              {cust.customerType}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 align-middle text-xs">
                            {hasFollowUp ? (
                              <div className="flex flex-col gap-0.5">
                                <span className={cn(
                                  "font-semibold flex items-center gap-1",
                                  isUpcoming ? "text-emerald-700" : isPast ? "text-amber-600" : "text-slate-700"
                                )}>
                                  {cust.followUpType === 'Call' ? <Phone className="w-3 h-3 text-blue-500" /> : <MessageSquare className="w-3 h-3 text-emerald-500" />}
                                  {format(parseDate(cust.followUpDate), 'yyyy-MM-dd')}
                                </span>
                                {cust.followUpNotes && <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{cust.followUpNotes}</span>}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None scheduled</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 align-middle text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold block w-32 mx-auto text-center",
                              cust.tag === 'Hot Lead' ? "bg-red-50 text-red-600 border border-red-200" :
                              cust.tag === 'Active Customer' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              cust.tag === 'Follow Up Required' ? "bg-amber-50 text-amber-600 border border-amber-200" :
                              "bg-slate-100 text-slate-500 border border-slate-200"
                            )}>
                              {cust.tag.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 align-middle text-right space-x-2" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleOpenModal(cust)}
                              className="p-1 px-2 border border-slate-200 hover:border-[#1B6B72] hover:text-[#1B6B72] rounded-lg text-slate-500 transition-colors"
                              title="Edit Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCustomer(cust.id as string, cust.customerName)}
                              className="p-1 px-2 border border-slate-200 hover:border-red-400 hover:text-red-500 rounded-lg text-slate-400 transition-colors"
                              title="Delete Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Selected Customer Detailed Profile Panel (5 Columns) */}
        {viewCustomer && (
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Header profile info */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 pb-4 bg-slate-50/50 flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-12 h-12 bg-[#1B6B72] rounded-full flex items-center justify-center font-bold text-white text-xl shadow-inner">
                    {viewCustomer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-serif">{viewCustomer.customerName}</h2>
                    <p className="text-xs text-slate-500 font-medium">{viewCustomer.companyName || 'Private Residential Account'}</p>
                    <p className="text-[10px] text-[#C9A96E] font-bold tracking-wider uppercase mt-1">
                      {viewCustomer.customerType} • {viewCustomer.city || 'Dubai'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewCustomer(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Core Details list */}
              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Contact Person</span>
                    <span className="font-semibold text-slate-800">{viewCustomer.contactPerson || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">TRN Number</span>
                    <span className="font-semibold text-slate-800 font-mono">{viewCustomer.trn || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Mobile Phone</span>
                    <span className="font-semibold text-slate-800 font-mono">{viewCustomer.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">WhatsApp</span>
                    <span className="font-semibold text-slate-800 font-mono">{viewCustomer.whatsapp || viewCustomer.mobile}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Email Address</span>
                    <span className="font-semibold text-slate-800 font-mono">{viewCustomer.email || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Site Location & Project</span>
                    <span className="font-semibold text-slate-850">
                      {viewCustomer.projectName ? `${viewCustomer.projectName} - ` : ''}{viewCustomer.address || 'N/A'}
                    </span>
                  </div>
                  {viewCustomer.notes && (
                    <div className="col-span-2 bg-[#F5F0E8]/40 p-2.5 rounded-lg border border-[#F5F0E8] text-slate-700">
                      <span className="text-slate-400 block uppercase font-bold text-[8px] tracking-wider mb-1">CRM Log Notes</span>
                      <p className="leading-relaxed italic">{viewCustomer.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Follow-up Alarm Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Calendar className="w-4 h-4 text-[#C9A96E]" /> Schedule Next Follow-Up
              </h3>
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Alert Date</label>
                    <input 
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-205 rounded-lg outline-none focus:ring-1 focus:ring-[#1B6B72]/30 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Alert Type</label>
                    <select 
                      value={followUpType}
                      onChange={e => setFollowUpType(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 border border-slate-205 rounded-lg outline-none focus:ring-1 focus:ring-[#1B6B72]/30 bg-white font-medium text-xs"
                    >
                      <option value="None">No Reminder</option>
                      <option value="Call">Phone Call</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Follow up Instructions / Notes</label>
                  <textarea 
                    value={followUpNotes}
                    onChange={e => setFollowUpNotes(e.target.value)}
                    rows={2}
                    placeholder="E.g., call at 2pm regarding payment approval or tiles selection details."
                    className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-lg outline-none focus:ring-1 focus:ring-[#1B6B72]/30 focus:border-[#1B6B72] text-xs"
                  />
                </div>

                <button 
                  onClick={handleSaveFollowUp}
                  disabled={isSavingFollowUp}
                  className="w-full py-2 bg-[#1B6B72] hover:bg-[#155359] text-white text-xs font-bold rounded-lg shadow active:scale-95 transition-all text-center"
                >
                  {isSavingFollowUp ? 'Updating database...' : 'Store Follow-up schedule'}
                </button>
              </div>
            </div>

            {/* Quotation History list */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#1B6B72]" /> Quotation History
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#C9A96E]/10 text-[#C9A96E] text-[10px] font-bold">
                  {customerQuotes.length} Quotes
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 max-h-[280px]">
                {loadingQuotes ? (
                  <div className="text-center py-10 text-xs text-slate-400">Loading invoice logs...</div>
                ) : customerQuotes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 leading-normal border border-dashed border-slate-200 rounded-lg m-2">
                    <p className="font-semibold text-xs text-slate-500">No linked quotations</p>
                    <p className="text-[10px] text-slate-400">Quotations added with matching phone {viewCustomer.mobile} will stack here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerQuotes.map(quote => (
                      <div 
                        key={quote.id}
                        className="p-3 border border-slate-105 rounded-lg hover:border-[#1B6B72]/30 transition-all flex justify-between items-center bg-slate-50/20"
                      >
                        <div className="overflow-hidden">
                          <span className="font-bold text-slate-900 block font-mono text-xs">{quote.quoteNo}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {quote.createdAt ? format(parseDate(quote.createdAt), 'yyyy-MM-dd') : 'N/A'} • Sent by {quote.preparedBy || 'Ali G'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-900 block font-mono text-xs">{formatCurrency(quote.grandTotal)}</span>
                          <span className={cn(
                            "px-2 py-0.2 rounded-full text-[9px] font-bold inline-block mt-0.5 uppercase tracking-wide",
                            quote.status === 'Draft' ? "bg-slate-100 text-slate-700" :
                            quote.status === 'Sent' ? "bg-blue-100 text-blue-700 font-bold" :
                            quote.status === 'Approved' ? "bg-emerald-100 text-emerald-800 font-bold" :
                            quote.status === 'Rejected' ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {quote.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    <div className="p-3 bg-[#F5F0E8]/50 border border-[#F5F0E8] rounded-xl text-center text-xs">
                      <span className="text-slate-500 font-medium">Total pipeline value: </span>
                      <strong className="text-[#1B6B72] font-mono font-bold text-sm ml-1">{formatCurrency(totalAmountGiven)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && editCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1B6B72]" /> 
                {editCustomer.id ? `Edit Customer Profile: ${editCustomer.customerName}` : 'Add New CRM Customer Profile'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 group transition-all"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Customer Name *</label>
                  <input 
                    type="text"
                    value={editCustomer.customerName}
                    onChange={e => setEditCustomer(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Full Human Name (e.g., Sabeer Pedhiwala)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Company Name</label>
                  <input 
                    type="text"
                    value={editCustomer.companyName}
                    onChange={e => setEditCustomer(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="E.g., Elegant Style Ceramics LLC"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Person (Procurement/Site Eng/Sales)</label>
                  <input 
                    type="text"
                    value={editCustomer.contactPerson || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, contactPerson: e.target.value }))}
                    placeholder="E.g., Jasim Bin Juma"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>

                {/* Mobile */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Mobile Number *</label>
                  <input 
                    type="text"
                    value={editCustomer.mobile}
                    onChange={e => setEditCustomer(prev => {
                      const m = e.target.value;
                      return { ...prev, mobile: m, whatsapp: prev?.whatsapp ? prev.whatsapp : m };
                    })}
                    placeholder="E.g., +971 55 809 0292"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">WhatsApp Number</label>
                  <input 
                    type="text"
                    value={editCustomer.whatsapp || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="WhatsApp No (defaults to Mobile)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                  <input 
                    type="email"
                    value={editCustomer.email}
                    onChange={e => setEditCustomer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="E.g., office@alzahrabm.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>

                {/* TRN */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">TRN Number</label>
                  <input 
                    type="text"
                    value={editCustomer.trn}
                    onChange={e => setEditCustomer(prev => ({ ...prev, trn: e.target.value }))}
                    placeholder="15-digit UAE VAT Registration"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Emirate / City</label>
                  <select 
                    value={editCustomer.city || 'Dubai'}
                    onChange={e => setEditCustomer(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs font-semibold"
                  >
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Project Name */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Project Name (Reference Villa / Tower)</label>
                  <input 
                    type="text"
                    value={editCustomer.projectName || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, projectName: e.target.value }))}
                    placeholder="E.g., Warsan-3 Showroom Fitout or Jumeirah Luxury Villa"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>

                {/* Segment & Status / Tag */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Customer category / Segment</label>
                  <select 
                    value={editCustomer.customerType}
                    onChange={e => setEditCustomer(prev => ({ ...prev, customerType: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs font-semibold"
                  >
                    {CUSTOMER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Tracking status / tag</label>
                  <select 
                    value={editCustomer.tag}
                    onChange={e => setEditCustomer(prev => ({ ...prev, tag: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs font-semibold"
                  >
                    {CUSTOMER_TAGS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Full Postal / site Address</label>
                  <input 
                    type="text"
                    value={editCustomer.address}
                    onChange={e => setEditCustomer(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="E.g., Warehouse Block B, Al Sajaa Industrial Area, Sharjah"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Private internal notes</label>
                  <textarea 
                    value={editCustomer.notes || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Enter interior design preferences, discount histories, contractor references or site manager requests."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3.5">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="py-2 px-4 hover:bg-slate-100 border border-slate-200 rounded-xl font-semibold hover:text-slate-700 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCustomer}
                disabled={isSaving}
                className="py-2 px-6 bg-[#1B6B72] hover:bg-[#155359] text-white font-bold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {isSaving ? 'Storing database record...' : 'Commit Save Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
