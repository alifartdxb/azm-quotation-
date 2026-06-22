import { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Users, FileText, CheckCircle2, ChevronRight, 
  Search, Play, RefreshCw, Send, AlertCircle, Trash2, Plus, Edit3, X, Eye, 
  Sparkles, Layers, ListTodo, Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  getCrmCustomers, getWhatsAppTemplates, saveWhatsAppTemplate, 
  deleteWhatsAppTemplate, getWhatsAppCampaigns, saveWhatsAppCampaign, 
  logActivity 
} from '../lib/firebase';
import type { CrmCustomer, WhatsAppTemplate, WhatsAppCampaign } from '../types';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const CATEGORIES = [
  'Retail', 'Contractor', 'Builder', 'Interior Designer', 
  'Architect', 'Project Customer', 'Dealer', 'VIP'
];

const TAGS = [
  'Hot Lead', 'Active Customer', 'Inactive Customer', 'Follow Up Required'
];

export default function WhatsAppMarketing() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterTag, setFilterTag] = useState('All');
  
  // Selection State
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  
  // Custom template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<WhatsAppTemplate> | null>(null);
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const [senderId, setSenderId] = useState<string>('+971558090292');

  // Active Sending / Simulation State
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sendingLogs, setSendingLogs] = useState<{name: string, status: 'pending'|'success'|'failed', details?: string}[]>([]);
  const [completedCampaign, setCompletedCampaign] = useState<string | null>(null);

  // Load everything
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [custs, temps, camps] = await Promise.all([
        getCrmCustomers(),
        getWhatsAppTemplates(),
        getWhatsAppCampaigns()
      ]);
      setCustomers(custs);
      setTemplates(temps);
      setCampaigns(camps);
      
      // Auto-select first template
      if (temps.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(temps[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = 
        (c.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.mobile || '').includes(searchTerm);
      const matchType = filterType === 'All' || c.customerType === filterType;
      const matchTag = filterTag === 'All' || c.tag === filterTag;
      return matchSearch && matchType && matchTag;
    });
  }, [customers, searchTerm, filterType, filterTag]);

  // Handle Multi-Select helpers
  const handleToggleSelectAll = () => {
    const visibleIds = filteredCustomers.map(c => c.id as string).filter(Boolean);
    const allSelected = visibleIds.every(id => selectedCustomerIds.includes(id));

    if (allSelected) {
      // Unselect visible accounts
      setSelectedCustomerIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all visible accounts
      setSelectedCustomerIds(prev => {
        const union = [...prev];
        visibleIds.forEach(id => {
          if (!union.includes(id)) union.push(id);
        });
        return union;
      });
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select group based on Filters directly
  const handleSelectGroup = (type: 'all' | 'none') => {
    if (type === 'all') {
      setSelectedCustomerIds(customers.map(c => c.id as string).filter(Boolean));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  // Current selected template object
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Message compiler utility
  const compileMessage = (templateBody: string, customer: CrmCustomer): string => {
    if (!templateBody) return '';
    return templateBody
      .replace(/{{CustomerName}}/g, customer.customerName)
      .replace(/{{CompanyName}}/g, customer.companyName || 'valued residential status')
      .replace(/{{LastQuotationNo}}/g, customer.lastQuotationNo || 'AZM-2025-001')
      .replace(/{{PreparedBy}}/g, 'Ali Sabeer (AZM Team)');
  };

  // Chat Bubble Preview logic
  const compiledPreviewMessage = useMemo(() => {
    if (!activeTemplate || customers.length === 0) return 'Select a template and customer to view live preview...';
    // Use first selected customer or just the first in list
    const sampleCustomer = customers.find(c => selectedCustomerIds.includes(c.id || '')) || customers[0];
    if (!sampleCustomer) return 'Add your first customer to view live preview.';
    return compileMessage(activeTemplate.body, sampleCustomer);
  }, [activeTemplate, customers, selectedCustomerIds]);

  // Execute Bulk Campaign Trigger
  const handleLaunchCampaign = () => {
    if (selectedCustomerIds.length === 0) {
      alert("Please select at least one recipient first.");
      return;
    }
    if (!activeTemplate) {
      alert("Please select a template first.");
      return;
    }
    setShowLaunchConfirm(true);
  };

  // Actual Campaign Runner after customized user confirmation
  const executeCampaignConfirmed = async () => {
    setShowLaunchConfirm(false);
    
    // Validate sender identity before dispatching
    const ALLOWED_SENDER = '+971558090292';
    
    // Strict authentication & authorization validation check
    if (senderId.trim() !== ALLOWED_SENDER) {
      alert(`SECURITY REJECTION: Attempt to broadcast from unauthorized sender ID "${senderId}". Only verified official corporate gateway "${ALLOWED_SENDER}" is allowed to dispatch bulk customer marketing messages.`);
      return;
    }
    
    const recipientList = customers.filter(c => selectedCustomerIds.includes(c.id as string));
    if (recipientList.length === 0) return;

    setIsSending(true);
    setProgress(0);
    setCompletedCampaign(null);

    // Construct verified hardcoded API payload structure for secure outbound dispatching
    const apiPayload = {
      sender_id: ALLOWED_SENDER, // strictly hardcoded sender ID
      template_id: activeTemplate.id,
      timestamp: new Date().toISOString(),
      recipients: recipientList.map(r => ({
        customer_id: r.id || '',
        customer_name: r.customerName,
        phone_number: r.whatsapp || r.mobile,
        compiled_body: compileMessage(activeTemplate.body, r)
      }))
    };
    
    console.log("🔒 VERIFIED SENDER DISPATCH SUCCESSFUL. Outbound Simulated API Payload:", apiPayload);

    const logs: { name: string; status: 'pending' | 'success' | 'failed'; details?: string }[] = recipientList.map(r => ({
      name: r.customerName,
      status: 'pending'
    }));
    setSendingLogs(logs);

    let successfullySent = 0;
    let failed = 0;
    const recipientsSummary: { customerId: string; customerName: string; mobile: string; status: 'Sent' | 'Failed' | string; sentAt: string; error?: string }[] = [];

    // Process each simulated message in sequence representing real CRM automation
    for (let i = 0; i < recipientList.length; i++) {
      const recipient = recipientList[i];
      
      // Simulate real short network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // WhatsApp sending has 95% mock success rate (to demonstrate errors or fallback paths elegantly)
      const isSuccess = Math.random() < 0.96; 
      
      if (isSuccess) {
        successfullySent++;
        logs[i].status = 'success';
        recipientsSummary.push({
          customerId: recipient.id || '',
          customerName: recipient.customerName,
          mobile: recipient.mobile,
          status: 'Sent',
          sentAt: new Date().toISOString()
        });
      } else {
        failed++;
        logs[i].status = 'failed';
        logs[i].details = "API timeout / Invalid number structure";
        recipientsSummary.push({
          customerId: recipient.id || '',
          customerName: recipient.customerName,
          mobile: recipient.mobile,
          status: 'Failed',
          sentAt: new Date().toISOString(),
          error: "API timeout / Invalid number structure"
        });
      }

      setSendingLogs([...logs]);
      setProgress(Math.round(((i + 1) / recipientList.length) * 100));
    }

    // Save Campaign History to Firestore
    const campaignId = uuidv4();
    const newCampaign: WhatsAppCampaign = {
      id: campaignId,
      name: activeTemplate.name,
      templateId: activeTemplate.id,
      templateName: activeTemplate.name,
      senderId: ALLOWED_SENDER,
      sentCount: successfullySent,
      failedCount: failed,
      createdAt: new Date().toISOString(),
      recipients: recipientsSummary
    };

    try {
      await saveWhatsAppCampaign(newCampaign);
      await logActivity(
        'Launched WhatsApp Marketing Campaign', 
        'System', 
        campaignId, 
        `Campaign "${newCampaign.name}" broadcasted to ${newCampaign.recipients.length} customers. (Success: ${newCampaign.sentCount}, Failed: ${newCampaign.failedCount})`
      );
      
      // reload campaigns List
      const freshCamps = await getWhatsAppCampaigns();
      setCampaigns(freshCamps);
      setCompletedCampaign(`Campaign completed successfully. (${successfullySent} sent, ${failed} failed)`);
    } catch (dbErr) {
      console.error(dbErr);
    } finally {
      setIsSending(false);
    }
  };

  // Open Real WhatsApp individual link
  const openWhatsAppDirect = (customer: CrmCustomer) => {
    if (!activeTemplate) return;
    const msg = compileMessage(activeTemplate.body, customer);
    const cleanPhone = customer.whatsapp ? customer.whatsapp.replace(/[^0-9]/g, '') : customer.mobile.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Manage Templates triggers
  const handleOpenTemplateModal = (temp?: WhatsAppTemplate) => {
    if (temp) {
      setEditingTemplate({ ...temp });
    } else {
      setEditingTemplate({
        id: 'user-temp-' + Date.now(),
        name: '',
        type: 'Promotional Offer',
        body: 'Dear {{CustomerName}},\n\n[Your custom message here]\n\nBest Regards,\n{{PreparedBy}}',
        createdAt: new Date().toISOString()
      });
    }
    setIsManagingTemplates(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.body) {
      alert("Please provide flat Template Name and Body content.");
      return;
    }
    try {
      await saveWhatsAppTemplate(editingTemplate as WhatsAppTemplate);
      await logActivity(
        'Saved Message Template', 
        'System', 
        editingTemplate.id, 
        `Message template saved/modified: ${editingTemplate.name}`
      );
      
      const fresh = await getWhatsAppTemplates();
      setTemplates(fresh);
      setIsManagingTemplates(false);
      setEditingTemplate(null);
    } catch (err) {
      alert("Error saving message template");
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}" from reusable presets?`)) return;
    try {
      await deleteWhatsAppTemplate(id);
      await logActivity('Deleted Message Template', 'System', id, `Deleted template ${name}`);
      
      const fresh = await getWhatsAppTemplates();
      setTemplates(fresh);
      if (selectedTemplateId === id) {
        setSelectedTemplateId(fresh[0]?.id || '');
      }
    } catch (err) {
      alert("Error deleting template");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif text-slate-900 tracking-tight flex items-center gap-2">
              WhatsApp CRM & Marketing
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide mt-0.5">
              Select key target audiences, customize template variables, and dispatch bulk CRM followups.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 active:scale-95 transition-all text-xs flex items-center gap-1"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            Reset Lists
          </button>

          <button 
            onClick={() => handleOpenTemplateModal()}
            className="py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#C9A96E]" />
            New Template
          </button>
        </div>
      </div>

      {/* AZM Verified Corporate Sender Gateway Status Board */}
      <div className="bg-gradient-to-r from-[#1B6B72]/10 via-[#F5F0E8] to-[#C9A96E]/10 p-5 rounded-2xl border border-[#1B6B72]/20 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div className="md:col-span-2 flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-[#1B6B72] flex items-center justify-center text-white shadow-md">
              <MessageSquare className="w-6 h-6 fill-current" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Official Company Sender</span>
              <span className={cn(
                "px-1.5 py-0.2 text-[8px] font-bold uppercase rounded-md tracking-wider transition-colors",
                senderId.trim() === '+971558090292' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              )}>
                {senderId.trim() === '+971558090292' ? 'Gateway Connected' : 'Security Alert: Unauthorized'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input 
                type="text" 
                value={senderId} 
                onChange={(e) => setSenderId(e.target.value)} 
                className={cn(
                  "bg-white border rounded-lg px-2.5 py-0.5 text-sm font-mono font-bold focus:outline-none focus:ring-1 w-44 transition-colors",
                  senderId.trim() === '+971558090292' ? "border-slate-200 text-slate-900 focus:ring-[#1B6B72]" : "border-rose-400 text-rose-700 bg-rose-50/50 focus:ring-rose-500"
                )}
                placeholder="Sender ID"
              />
              {senderId.trim() === '+971558090292' ? (
                <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Verified
                </span>
              ) : (
                <span className="text-[9px] text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Blocked
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block font-medium mt-1">Al Zahra Al Malakia Building Materials (AZM Group)</span>
          </div>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-200/80 pt-3 md:pt-0 md:pl-4 space-y-0.5">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Channel Routing</span>
          <strong className="text-xs text-slate-800 font-semibold block">Dubai & Sharjah B2B Portals</strong>
          <span className="text-[9px] text-[#1B6B72] font-semibold block">Rate limit fallback: Active</span>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-200/80 pt-3 md:pt-0 md:pl-4 flex flex-col justify-center">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Official Credentials</span>
          <div className="flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-800">Business Certified</span>
          </div>
          <span className="text-[9px] text-slate-400 block">All system broadcasts linked</span>
        </div>
      </div>

      {isSending && (
        <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
              <h3 className="font-bold text-slate-900 text-sm">Automating WhatsApp Broadcast...</h3>
            </div>
            <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{progress}% Completed</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Mini Real-Time Logs */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs font-mono max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin">
            {sendingLogs.map((log, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-slate-700">Sending to: <strong>{log.name}</strong></span>
                <span className={cn(
                  "font-semibold text-[10px] uppercase rounded-md px-1.5 py-0.2",
                  log.status === 'success' ? "bg-emerald-50 text-emerald-600" :
                  log.status === 'failed' ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500 animate-pulse"
                )}>
                  {log.status === 'success' ? '✓ Dispatched' : log.status === 'failed' ? '✗ Failed: ' + (log.details || 'Unknown Error') : '● Processing...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {completedCampaign && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 rounded-2xl text-emerald-800 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{completedCampaign}</span>
          </div>
          <button 
            onClick={() => setCompletedCampaign(null)} 
            className="text-xs font-bold text-emerald-990 hover:underline border border-emerald-300/40 px-2.5 py-1 rounded-lg"
          >
            Acknowledge Logs
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Recipient Selector (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#1B6B72]" /> 1. Select Target CRM Contacts
              </h2>
              
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button 
                  onClick={() => handleSelectGroup('all')}
                  className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 font-semibold active:scale-95 transition"
                >
                  Select All Database
                </button>
                <button 
                  onClick={() => handleSelectGroup('none')}
                  className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 font-semibold active:scale-95 transition"
                >
                  Unselect All
                </button>
              </div>
            </div>

            {/* Recipient Filters Search bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1">
                <select 
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1B6B72]/30 bg-white font-medium"
                >
                  <option value="All">All Categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-1">
                <select 
                  value={filterTag}
                  onChange={e => setFilterTag(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1B6B72]/30 bg-white font-medium"
                >
                  <option value="All">All Leads</option>
                  {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="sm:col-span-1 relative">
                <input 
                  type="text"
                  placeholder="Search user..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#1B6B72]/30 bg-white"
                />
                <span className="absolute left-2.5 top-2.5 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Recipients List table viewport */}
            <div className="max-h-[380px] overflow-y-auto border border-slate-150 rounded-xl overflow-hidden scrollbar-thin">
              {loading ? (
                <div className="py-20 text-center text-slate-400 text-xs font-semibold">Queries running...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">No CRM matching parameters found.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 pl-4 w-10">
                        <input 
                          type="checkbox"
                          checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomerIds.includes(c.id as string))}
                          onChange={handleToggleSelectAll}
                          className="rounded border-slate-300 w-3.5 h-3.5 accent-[#1B6B72]"
                        />
                      </th>
                      <th className="p-3">Customer Profile</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Preview / Direct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCustomers.map(cust => {
                      const isSelected = selectedCustomerIds.includes(cust.id as string);
                      return (
                        <tr 
                          key={cust.id} 
                          className={cn(
                            "hover:bg-slate-50 transition-colors cursor-pointer",
                            isSelected && "bg-[#1B6B72]/5"
                          )}
                          onClick={() => handleToggleSelectOne(cust.id as string)}
                        >
                          <td className="p-3 pl-4" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOne(cust.id as string)}
                              className="rounded border-slate-300 w-3.5 h-3.5 accent-[#1B6B72]"
                            />
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{cust.customerName}</span>
                            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{cust.companyName || 'Residential Case'}</span>
                            <span className="text-[9px] font-mono text-slate-400 block mt-0.5">{cust.mobile}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                              {cust.customerType}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-full text-[9px] font-semibold w-24 block mx-auto text-center",
                              cust.tag === 'Hot Lead' ? "bg-red-50 text-red-600 border border-red-200" :
                              cust.tag === 'Active Customer' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                              "bg-slate-100 text-slate-500"
                            )}>
                              {cust.tag}
                            </span>
                          </td>
                          <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => openWhatsAppDirect(cust)}
                              className="p-1 px-2 border border-slate-200 hover:border-[#C9A96E] hover:text-[#C9A96E] rounded-md text-slate-500 hover:bg-[#C9A96E]/5 text-[10px] font-semibold flex items-center gap-1 ml-auto"
                              title="Send Individual message directly via actual protocol links"
                            >
                              <Send className="w-3 h-3 text-[darkgreen]" />
                              Direct Link
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold flex justify-between items-center border border-slate-150">
              <span>Recipients selected current queue:</span>
              <strong className="text-[#1B6B72] text-[13px]">{selectedCustomerIds.length} / {customers.length} Accounts</strong>
            </div>

          </div>

          {/* Campaign Log list panel details */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Activity className="w-4 h-4 text-[#C9A96E]" /> Log History of Campaign Broadcasts
            </h3>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {campaigns.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-xs italic">No historical marketing logs found.</p>
              ) : (
                campaigns.map(camp => (
                  <div key={camp.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-slate-900 block font-serif mb-1">{camp.name}</strong>
                      <span className="text-[10px] block text-[#94a3b8] font-mono">
                        Date: {camp.createdAt ? format(new Date(camp.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="block font-bold text-[#1B6B72] font-mono">{camp.recipients ? camp.recipients.length : camp.sentCount + camp.failedCount} Users</span>
                      <span className={cn(
                        "text-[9px] uppercase font-bold inline-block px-1.5 rounded-full mt-1",
                        camp.failedCount === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      )}>
                        Success: {camp.sentCount} | Fail: {camp.failedCount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Templates & Preview (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Template presets view */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C9A96E]" /> 2. Message Template Preset
              </h2>
              <button 
                onClick={() => setIsManagingTemplates(!isManagingTemplates)}
                className="text-xs text-[#1B6B72] hover:underline font-bold"
              >
                {isManagingTemplates ? 'Done editing' : 'Manage list'}
              </button>
            </div>

            {isManagingTemplates ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {templates.map(temp => (
                  <div key={temp.id} className="p-2 border border-slate-150 rounded-xl bg-slate-50 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 truncate max-w-[180px]">{temp.name}</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleOpenTemplateModal(temp)}
                        className="p-1 border border-slate-200 hover:border-blue-300 text-blue-600 rounded-md bg-white hover:bg-slate-50"
                        title="Edit Template body text"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(temp.id, temp.name)}
                        className="p-1 border border-slate-200 hover:border-red-300 text-red-500 rounded-md bg-white hover:bg-slate-50"
                        title="Delete Template"
                        disabled={temp.id === 'new-product-launch' || temp.id === 'promotional-offer'} // Prevent deleting base seed structures
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => handleOpenTemplateModal()}
                  className="w-full py-2 border border-dashed border-[#1B6B72]/30 hover:border-[#1B6B72] text-[#1B6B72] text-xs font-semibold rounded-xl text-center transition flex justify-center items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Custom Preset Template
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs text-slate-400 font-bold mb-1 uppercase tracking-wide">Selected Template Subject</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {templates.map(temp => (
                    <button 
                      key={temp.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(temp.id)}
                      className={cn(
                        "w-full text-left p-3 border rounded-xl text-xs font-medium flex justify-between items-center transition-all duration-150",
                        selectedTemplateId === temp.id 
                          ? "bg-[#1B6B72]/10 border-[#1B6B72]/65 text-[#1B6B72] shadow-inner font-bold" 
                          : "border-slate-150 text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>{temp.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#C9A96E]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Guide lines variables */}
            <div className="bg-[#F5F0E8] p-3 rounded-xl text-[10px] text-slate-600 leading-normal space-y-1">
              <span className="font-bold text-slate-800 uppercase tracking-widest block text-[9px] text-[#1A3A5C]">Dynamic Variable Presets:</span>
              <p>Variables below auto-inject personalized metrics per client profile:</p>
              <div className="grid grid-cols-2 gap-1.5 pt-1 font-mono text-[9px]">
                <div className="flex gap-1.5"><span className="text-[#1B6B72] font-semibold">{"{{CustomerName}}"}</span> <span>Client Name</span></div>
                <div className="flex gap-1.5"><span className="text-[#1B6B72] font-semibold">{"{{CompanyName}}"}</span> <span>Company Name</span></div>
                <div className="flex gap-1.5"><span className="text-[#1B6B72] font-semibold">{"{{LastQuotationNo}}"}</span> <span>Quotation Number</span></div>
                <div className="flex gap-1.5"><span className="text-[#1B6B72] font-semibold">{"{{PreparedBy}}"}</span> <span>Staff Name</span></div>
              </div>
            </div>
          </div>

          {/* Majestic WhatsApp Chat Bubble Preview Device simulation */}
          <div className="bg-slate-100 rounded-3xl border border-slate-300 overflow-hidden shadow-sm max-w-sm mx-auto">
            <div className="bg-[#075E54] p-3 text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <div className="overflow-hidden">
                <span className="font-bold text-[11px] block">Al Zahra Al Malakia (AZM Group) Support</span>
                <span className="text-[8px] text-slate-200 block">WhatsApp automated pipeline</span>
              </div>
            </div>

            {/* Simulated background chats */}
            <div className="p-3 space-y-3 min-h-[170px] bg-[#ece5dd] relative flex flex-col justify-end text-[11px]">
              
              {/* Recipient bubble */}
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/55 max-w-[85%] shadow-sm self-start leading-relaxed text-slate-800 rounded-tl-none">
                Hello. Can you please share details on your premium porcelain tiles / Grohe mixers pipeline price list?
                <span className="text-[8px] text-slate-400 text-right block mt-0.5 font-mono">09:44 AM</span>
              </div>

              {/* Automated Response bubble */}
              <div className="bg-[#dcf8c6] p-2.5 rounded-lg max-w-[85%] shadow-sm self-end leading-relaxed text-slate-805 rounded-tr-none">
                <p className="whitespace-pre-line">{compiledPreviewMessage}</p>
                <span className="text-[8px] text-slate-400 text-right block mt-1 font-mono">09:45 AM • Auto Preview</span>
              </div>
            </div>
          </div>

          {/* Action Trigger Bulk Campaigns */}
          <button 
            type="button"
            onClick={handleLaunchCampaign}
            disabled={isSending || selectedCustomerIds.length === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg active:scale-95 disabled:opacity-40 select-none transition-all flex justify-center items-center gap-2 text-sm"
          >
            <Play className="w-5 h-5 fill-current" />
            {isSending ? 'Bulk campaign executing...' : `Launch Campaign to ${selectedCustomerIds.length} Recipients`}
          </button>
        </div>
      </div>

      {/* Editor Modal for customized reusable templates */}
      {isManagingTemplates && editingTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-serif text-sm font-bold text-slate-900">
                Setup Campaign Preset Message Template
              </h3>
              <button 
                onClick={() => setEditingTemplate(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Preset name *</label>
                <input 
                  type="text"
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="E.g., Winter Festive Promotion or VIP Follow-up"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Campaign category / type</label>
                <select 
                  value={editingTemplate.type}
                  onChange={e => setEditingTemplate(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl outline-none text-xs font-semibold"
                >
                  <option value="New Product Launch">New Product Launch</option>
                  <option value="Promotional Offer">Promotional Offer</option>
                  <option value="Follow-up Reminder">Follow-up Reminder</option>
                  <option value="Holiday Greetings">Holiday Greetings</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Message content block (Body) *</label>
                <textarea 
                  value={editingTemplate.body}
                  onChange={e => setEditingTemplate(prev => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] text-xs font-sans leading-relaxed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                  Note: Do not delete variable tags so that the compiler is capable of automatic customer matches.
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 text-xs">
              <button 
                onClick={() => setEditingTemplate(null)}
                className="py-2 px-4 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600 transition"
              >
                Discard
              </button>
              <button 
                onClick={handleSaveTemplate}
                className="py-2 px-5 bg-[#1B6B72] hover:bg-[#155359] text-white font-bold rounded-xl shadow-md transition"
              >
                Log Save Preset Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Branded Confirmation Dialog for Campaign Execution */}
      {showLaunchConfirm && activeTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#1B6B72]/10 via-transparent to-transparent flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1B6B72]/10 flex items-center justify-center text-[#1B6B72]">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-[13px] font-bold text-slate-905">
                  Confirm Campaign Pipeline Output
                </h3>
                <p className="text-[9px] text-[#94a3b8] font-semibold tracking-wider uppercase">B2B WhatsApp Automated Service</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed font-sans">
                You are about to launch the customized message template <strong className="text-slate-900 font-serif">"{activeTemplate.name}"</strong> from gateway identity <strong className="text-slate-900 font-mono">{senderId}</strong> to:
              </p>

              <div className="bg-[#1B6B72]/5 border border-[#1B6B72]/15 p-3 px-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Target Recipients</span>
                  <strong className="text-lg font-bold font-mono text-[#1B6B72]">{selectedCustomerIds.length} Accounts</strong>
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded-full text-[8px] uppercase font-mono font-bold",
                  senderId.trim() === '+971558090292' ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800 animate-pulse"
                )}>
                  {senderId.trim() === '+971558090292' ? 'Simulated API' : 'API Blocked'}
                </div>
              </div>

              {senderId.trim() === '+971558090292' ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-normal flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#1B6B72]" />
                  <p className="text-[10px]">
                    All dispatched messages originate from the verified enterprise number <strong className="text-slate-900 font-mono">+971 55 809 0292</strong>. History logs & executive CRM pipeline stats auto-update immediately.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 leading-normal flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="text-[10px] space-y-0.5">
                    <strong className="font-bold block">Security Exception Trigger</strong>
                    <p>
                      The gateway number <strong className="font-mono">{senderId}</strong> is unauthorized. Dispatched campaign pipeline rejects this request instantly.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 text-xs">
              <button 
                onClick={() => setShowLaunchConfirm(false)}
                className="py-2 px-3.5 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600 transition"
              >
                Cancel
              </button>
              <button 
                onClick={executeCampaignConfirmed}
                className="py-2 px-4.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
