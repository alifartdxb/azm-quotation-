import { useState } from 'react';
import { Save, Building2, Landmark, FileText, Share2 } from 'lucide-react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Settings saved. (In a full implementation, this would save to Firestore doc "settings/company")');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-serif">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage company details, preferences, and templates</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col space-y-1">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'company' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Building2 className="w-4 h-4" /> Company Info
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'bank' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Landmark className="w-4 h-4" /> Bank Accounts
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'terms' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" /> Terms & Conditions
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'integrations' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Share2 className="w-4 h-4" /> Email & WhatsApp
            </button>
          </nav>
        </div>

        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <form onSubmit={handleSave}>
              
              {activeTab === 'company' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Company Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name (English)</label>
                      <input type="text" defaultValue="Al Zahra Al Malakia Building Materials Trading L.L.C" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name (Arabic)</label>
                      <input type="text" defaultValue="الزهــرة المـلـكـيـة لتـــجــارة مــواد الـبــنــاء ذ.م.م" dir="rtl" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-arabic" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">TRN Number</label>
                      <input type="text" defaultValue="1002 5994 2900 003" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone / Telephone</label>
                      <input type="text" defaultValue="+971 4 28 444 52" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Company Address</label>
                      <textarea defaultValue="Shop No. 12, Building Materials Mall, Dubai, U.A.E" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bank' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Bank Accounts</h3>
                  <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Bank Name</label>
                          <input type="text" defaultValue="National Bank Of Ras Al Khaimah" className="w-full bg-white border border-slate-200 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Account Name</label>
                          <input type="text" defaultValue="Al Zahra Al Malakia Building Materials Trading L.L.C." className="w-full bg-white border border-slate-200 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Account Number</label>
                          <input type="text" defaultValue="83621 5391 5902" className="w-full bg-white border border-slate-200 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">IBAN Number</label>
                          <input type="text" defaultValue="AE39 0400 0083 6215 3915 902" className="w-full bg-white border border-slate-200 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'terms' && (
                <div className="space-y-6">
                   <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Quotation Terms & Conditions</h3>
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-2">Default Terms (One per line)</label>
                     <textarea 
                       defaultValue="The above prices are in Dirhams (AED) quoted based on the quantities requested.
Payment Terms 100% advance against order confirmation.
Delivery time to be confirmed upon order confirmation.
Local delivery charges are not included within this quotation.
Customized items eg. counter tops/vanity cannot be cancelled or exchange after order confirmation." 
                       className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-64 font-mono leading-relaxed resize-none" 
                     />
                   </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                 <div className="space-y-8">
                   <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Integrations & Communication</h3>
                   
                   <div className="space-y-4">
                     <h4 className="font-semibold text-slate-800">WhatsApp Settings</h4>
                     <div>
                       <label className="block text-sm font-semibold text-slate-700 mb-2">Default Message Template</label>
                       <textarea 
                          defaultValue="Dear {{customer_name}},

Please find attached our quotation {{quotation_no}}.

Thank you.
Best Regards,
AZM Group" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 font-mono resize-none" 
                        />
                     </div>
                   </div>
                 </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                 <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-sm transition-all active:scale-95">
                   <Save className="w-4 h-4" />
                   Save Settings
                 </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
