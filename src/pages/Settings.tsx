import { useState, useEffect, useRef } from 'react';
import { Save, Building2, Landmark, FileText, Share2, Download, Upload, Database, Lock, ShieldAlert, CheckCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAppSettings, saveAppSettingsDoc, db, logActivity } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface CounterData {
  currentNumber: number;
  prefix: string;
  year: number;
}

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Settings values state
  const [companyNameEn, setCompanyNameEn] = useState('');
  const [companyNameAr, setCompanyNameAr] = useState('');
  const [trn, setTrn] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');

  const [defaultTerms, setDefaultTerms] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');

  const [headerImage, setHeaderImage] = useState('');
  const [footerImage, setFooterImage] = useState('');

  // Counters live values state (Only for Super Admin to manage/view)
  const [counterCurrentNumber, setCounterCurrentNumber] = useState(735);
  const [counterPrefix, setCounterPrefix] = useState('QTN');
  const [counterYear, setCounterYear] = useState(new Date().getFullYear());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authorization level Check
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isSalesManager = user?.role === 'SALES_MANAGER';
  const isAuthorizedToView = isSuperAdmin || isSalesManager;
  const isAuthorizedToWrite = isSuperAdmin;

  useEffect(() => {
    if (!isAuthorizedToView) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const settings = await getAppSettings();
        setCompanyNameEn(settings.companyNameEn || '');
        setCompanyNameAr(settings.companyNameAr || '');
        setTrn(settings.trn || '');
        setPhone(settings.phone || '');
        setAddress(settings.address || '');

        setBankName(settings.bankName || '');
        setAccountName(settings.accountName || '');
        setAccountNumber(settings.accountNumber || '');
        setIban(settings.iban || '');

        setDefaultTerms(settings.defaultTerms || '');
        setWhatsappTemplate(settings.whatsappTemplate || '');

        setHeaderImage(settings.headerImage || '');
        setFooterImage(settings.footerImage || '');

        // Load live counter configuration if Super Admin
        if (isSuperAdmin) {
          const counterSnap = await getDoc(doc(db, 'counters', 'quotationCounter'));
          if (counterSnap.exists()) {
            const counterData = counterSnap.data() as CounterData;
            setCounterCurrentNumber(counterData.currentNumber || 735);
            setCounterPrefix(counterData.prefix || 'QTN');
            setCounterYear(counterData.year || new Date().getFullYear());
          }
        }
      } catch (err: any) {
        console.error("Failed to load settings:", err);
        setErrorMessage("Could not load some settings. Please contact the administrator.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, isAuthorizedToView, isSuperAdmin]);

  // Handle Save based on active tab
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedToWrite) {
      setErrorMessage("You do not have permission to modify settings.");
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');

    try {
      if (activeTab === 'company') {
        const companyData = { companyNameEn, companyNameAr, trn, phone, address };
        await saveAppSettingsDoc('company', companyData);
        await logActivity('Company Settings Updated', 'Settings', 'company', `Updated English name: ${companyNameEn}`);
      } else if (activeTab === 'bank') {
        const bankData = { bankName, accountName, accountNumber, iban };
        await saveAppSettingsDoc('bank', bankData);
        await logActivity('Bank Settings Updated', 'Settings', 'bank', `Updated bank: ${bankName}`);
      } else if (activeTab === 'terms') {
        const termsData = { defaultTerms };
        await saveAppSettingsDoc('templates', termsData);
        await logActivity('Terms Settings Updated', 'Settings', 'templates', 'Updated default quotation terms & conditions');
      } else if (activeTab === 'integrations') {
        const whatsappData = { whatsappTemplate };
        await saveAppSettingsDoc('whatsapp', whatsappData);
        await logActivity('WhatsApp Settings Updated', 'Settings', 'whatsapp', 'Updated default messages template');
      } else if (activeTab === 'branding') {
        const brandingData = { headerImage, footerImage };
        await saveAppSettingsDoc('branding', brandingData);
        await logActivity('Branding Settings Updated', 'Settings', 'branding', 'Updated PDF header/footer images');
      } else if (activeTab === 'counters') {
        // Super Admin updating counter properties
        const counterRef = doc(db, 'counters', 'quotationCounter');
        await setDoc(counterRef, {
          currentNumber: Number(counterCurrentNumber),
          prefix: counterPrefix,
          year: Number(counterYear)
        });
        await logActivity('Quotation Counter Reset', 'System', 'quotationCounter', `Sequence reset to Prefix: ${counterPrefix}, Year: ${counterYear}, Current: ${counterCurrentNumber}`);
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setSaveStatus('error');
      setErrorMessage(err.message || "An error occurred while saving. Please try again.");
    }
  };

  // Export Settings Backup (JSON download)
  const handleExportBackup = async () => {
    try {
      const settings = await getAppSettings();
      
      let counterConf = { currentNumber: 735, prefix: 'QTN', year: 2026 };
      if (isSuperAdmin) {
        const snap = await getDoc(doc(db, 'counters', 'quotationCounter'));
        if (snap.exists()) {
          counterConf = snap.data() as CounterData;
        }
      }

      const backupObj = {
        backupVersion: 1,
        backupDate: new Date().toISOString(),
        exportedBy: user?.email || 'unknown',
        settings: {
          company: {
            companyNameEn: settings.companyNameEn || '',
            companyNameAr: settings.companyNameAr || '',
            trn: settings.trn || '',
            phone: settings.phone || '',
            address: settings.address || '',
          },
          bank: {
            bankName: settings.bankName || '',
            accountName: settings.accountName || '',
            accountNumber: settings.accountNumber || '',
            iban: settings.iban || '',
          },
          templates: {
            defaultTerms: settings.defaultTerms || '',
          },
          whatsapp: {
            whatsappTemplate: settings.whatsappTemplate || '',
          },
          branding: {
            headerImage: settings.headerImage || '',
            footerImage: settings.footerImage || ''
          }
        },
        counters: {
          quotationCounter: counterConf
        }
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AZM_Enterprise_Settings_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      await logActivity('System Configuration Exported', 'System', undefined, 'Downloaded JSON backup file');
    } catch (err) {
      alert("Failed to export backup file.");
    }
  };

  // Import Settings Backup (JSON upload)
  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAuthorizedToWrite) {
      alert("You do not have permission to restore backups.");
      return;
    }

    if (!confirm("Are you sure you want to restore settings from this backup? This will overwrite the current live configuration documents.")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        if (!json.backupVersion || !json.settings) {
          alert("Invalid backup file format. Restore aborted.");
          return;
        }

        setSaveStatus('saving');

        // Restore segregated docs
        const s = json.settings;
        if (s.company) await saveAppSettingsDoc('company', s.company);
        if (s.bank) await saveAppSettingsDoc('bank', s.bank);
        if (s.templates) await saveAppSettingsDoc('templates', s.templates);
        if (s.whatsapp) await saveAppSettingsDoc('whatsapp', s.whatsapp);
        if (s.branding) await saveAppSettingsDoc('branding', s.branding);

        // Restore counter
        if (json.counters?.quotationCounter) {
          const c = json.counters.quotationCounter;
          await setDoc(doc(db, 'counters', 'quotationCounter'), {
            currentNumber: Number(c.currentNumber || 735),
            prefix: c.prefix || 'QTN',
            year: Number(c.year || 2026),
          });
        }

        // Update local state smoothly
        if (s.company) {
          setCompanyNameEn(s.company.companyNameEn || '');
          setCompanyNameAr(s.company.companyNameAr || '');
          setTrn(s.company.trn || '');
          setPhone(s.company.phone || '');
          setAddress(s.company.address || '');
        }
        if (s.bank) {
          setBankName(s.bank.bankName || '');
          setAccountName(s.bank.accountName || '');
          setAccountNumber(s.bank.accountNumber || '');
          setIban(s.bank.iban || '');
        }
        if (s.templates) {
          setDefaultTerms(s.templates.defaultTerms || '');
        }
        if (s.whatsapp) {
          setWhatsappTemplate(s.whatsapp.whatsappTemplate || '');
        }
        if (s.branding) {
          setHeaderImage(s.branding.headerImage || '');
          setFooterImage(s.branding.footerImage || '');
        }
        if (json.counters?.quotationCounter) {
          const c = json.counters.quotationCounter;
          setCounterCurrentNumber(c.currentNumber || 735);
          setCounterPrefix(c.prefix || 'QTN');
          setCounterYear(c.year || 2026);
        }

        await logActivity('System Configuration Restored', 'System', undefined, `Restored backup originally created by: ${json.exportedBy}`);
        setSaveStatus('success');
        alert("Configuration restored successfully!");
        setSaveStatus('idle');
      } catch (err: any) {
        console.error("Failed to import settings:", err);
        setSaveStatus('error');
        alert("Error importing file: " + (err.message || err));
      }
    };
    reader.readAsText(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Compression
          const MAX_WIDTH = 1000;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill background white in case of transparent png
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setter(dataUrl);
          } else {
            setter(event.target!.result as string);
          }
        };
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  // Guard for Loading State
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading system configuration...</p>
        </div>
      </div>
    );
  }

  // Guard for Access Restriction (Executive & Viewer roles get Friendly Lockscreen)
  if (!isAuthorizedToView) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden transform transition-all duration-300 hover:shadow-xl">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-rose-500 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-serif mb-3">Access Restrained</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
            You do not have permission to access this section. Please contact the system administrator.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-2 text-xs font-semibold text-slate-400">
            <span>Enterprise Security Model v2.4</span>
          </div>
        </div>
      </div>
    );
  }

  // Render the Main Authorized Settings Page
  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Page Title & Status Bars */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-serif flex items-center gap-2">
            System Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage company parameters, bank details, and sequences</p>
        </div>
        
        {/* Save and feedback status notifications */}
        {saveStatus === 'saving' && (
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl border border-blue-100 flex items-center gap-2 text-xs font-semibold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" /> Saving changes...
          </div>
        )}
        {saveStatus === 'success' && (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs font-semibold shadow-sm animate-bounce">
            <CheckCircle className="w-4 h-4" /> Settings updated successfully!
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-100 flex items-center gap-2 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4" /> {errorMessage || 'Error saving settings'}
          </div>
        )}
      </div>

      {/* Access Level Notification banner */}
      {isSalesManager && (
        <div id="read-only-notice" className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex gap-3 text-sm leading-relaxed shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <span className="font-bold">Read-Only Session:</span> As a <span className="font-bold text-amber-900">Sales Manager</span>, you have authorization to view the active settings but cannot save changes, manage sequences, or restore backups. Only Super Admins can perform write operations.
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Tabs sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col space-y-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'company' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <Building2 className="w-4 h-4" /> Company Info
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'bank' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <Landmark className="w-4 h-4 text-inherit" /> Bank Accounts
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'terms' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <FileText className="w-4 h-4" /> Terms & Conditions
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'integrations' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <Share2 className="w-4 h-4" /> Email & WhatsApp
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'branding' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> PDF Branding
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('counters')}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                  activeTab === 'counters' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <Database className="w-4 h-4" /> Backup & Counters
              </button>
            )}
          </nav>
        </div>

        {/* Dynamic Tab Body content */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 sm:p-8">
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* COMPANY TAB */}
              {activeTab === 'company' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">Company Configuration</h3>
                    <Building2 className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Company Name (English)</label>
                      <input 
                        type="text" 
                        required 
                        disabled={isSalesManager}
                        value={companyNameEn} 
                        onChange={(e) => setCompanyNameEn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2" dir="rtl">اسم الشركة باللغة العربية</label>
                      <input 
                        type="text" 
                        required 
                        disabled={isSalesManager}
                        value={companyNameAr} 
                        onChange={(e) => setCompanyNameAr(e.target.value)}
                        dir="rtl" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-arabic transition-all disabled:opacity-70"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Government TRN Number</label>
                      <input 
                        type="text" 
                        required 
                        disabled={isSalesManager}
                        value={trn} 
                        onChange={(e) => setTrn(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Official Telephone</label>
                      <input 
                        type="text" 
                        required 
                        disabled={isSalesManager}
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Company Physical Address</label>
                      <textarea 
                        required
                        disabled={isSalesManager}
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none h-24 resize-none transition-all disabled:opacity-70"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BANK TAB */}
              {activeTab === 'bank' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">Bank Routing Accounts</h3>
                    <Landmark className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Primary Bank Name</label>
                        <input 
                          type="text" 
                          required 
                          disabled={isSalesManager}
                          value={bankName} 
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Official Account Holder Name</label>
                        <input 
                          type="text" 
                          required 
                          disabled={isSalesManager}
                          value={accountName} 
                          onChange={(e) => setAccountName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Account Code Number</label>
                        <input 
                          type="text" 
                          required 
                          disabled={isSalesManager}
                          value={accountNumber} 
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Swift / IBAN Code</label>
                        <input 
                          type="text" 
                          required 
                          disabled={isSalesManager}
                          value={iban} 
                          onChange={(e) => setIban(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-70"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TERMS & CONDITIONS TAB */}
              {activeTab === 'terms' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">Standard Quotation Terms</h3>
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Default Terms (Split sentences using line breaks)</label>
                    <textarea 
                      required
                      disabled={isSalesManager}
                      value={defaultTerms} 
                      onChange={(e) => setDefaultTerms(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none h-64 font-mono leading-relaxed resize-none transition-all disabled:opacity-70" 
                    />
                  </div>
                </div>
              )}

              {/* INTEGRATIONS TAB */}
              {activeTab === 'integrations' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">Message Templates</h3>
                    <Share2 className="w-5 h-5 text-slate-400" />
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm">WhatsApp Default Copy</h4>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Message Copy Template</label>
                      <textarea 
                        required
                        disabled={isSalesManager}
                        value={whatsappTemplate} 
                        onChange={(e) => setWhatsappTemplate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none h-32 font-mono resize-none transition-all disabled:opacity-70" 
                      />
                      <p className="text-[11px] text-slate-400 mt-2 italic font-medium">Available wildcards: {"{{customer_name}}, {{quotation_no}}"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* BRANDING TAB */}
              {activeTab === 'branding' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">PDF Branding</h3>
                    <ImageIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">Upload custom header and footer images for your printed quotations. Ideal dimensions are A4 width (e.g. 2480px) at high resolution.</p>
                  
                  <div className="space-y-8">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Header Image</label>
                      {headerImage ? (
                        <div className="relative inline-block w-full max-w-2xl bg-slate-100 border border-slate-200 rounded-[20px] overflow-hidden group">
                          <img src={headerImage} alt="Header Preview" className="w-full h-auto block" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              disabled={isSalesManager}
                              onClick={() => setHeaderImage('')}
                              className="bg-white text-red-600 px-4 py-2 font-bold text-sm rounded-lg shadow-sm"
                            >
                              Remove Header
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative border-2 border-dashed border-slate-300 rounded-[20px] p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors">
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/webp"
                            disabled={isSalesManager}
                            onChange={(e) => handleImageUpload(e, setHeaderImage)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-slate-700">Click or drag image to upload header</p>
                          <p className="text-xs text-slate-500 mt-1">Recommended width: up to 1200px</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Footer Image</label>
                      {footerImage ? (
                        <div className="relative inline-block w-full max-w-2xl bg-slate-100 border border-slate-200 rounded-[20px] overflow-hidden group">
                          <img src={footerImage} alt="Footer Preview" className="w-full h-auto block" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              disabled={isSalesManager}
                              onClick={() => setFooterImage('')}
                              className="bg-white text-red-600 px-4 py-2 font-bold text-sm rounded-lg shadow-sm"
                            >
                              Remove Footer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative border-2 border-dashed border-slate-300 rounded-[20px] p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors">
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/webp"
                            disabled={isSalesManager}
                            onChange={(e) => handleImageUpload(e, setFooterImage)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                          <p className="text-sm font-semibold text-slate-700">Click or drag image to upload footer</p>
                          <p className="text-xs text-slate-500 mt-1">Recommended width: up to 1200px</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* COUNTERS & BACKUP TAB (Only Super Admin visible) */}
              {activeTab === 'counters' && isSuperAdmin && (
                <div className="space-y-8 animate-fadeIn">
                  {/* Part 1: Manage Sequencer Live settings */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-bold text-slate-900">Sequence Counter Settings</h3>
                      <Database className="w-5 h-5 text-slate-400" />
                    </div>
                    
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-amber-900 text-xs leading-relaxed">
                      <span className="font-bold">Important Notice:</span> These inputs modify the real-time numbering systems sequence database atomically. Changing sequence ranges arbitrarily could cause overlap conflicts with old quotations. Proceed with expert caution.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Quotation Prefix</label>
                        <input 
                          type="text" 
                          required
                          value={counterPrefix}
                          onChange={(e) => setCounterPrefix(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fiscal Sequence Year</label>
                        <input 
                          type="number" 
                          required
                          value={counterYear}
                          onChange={(e) => setCounterYear(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Live Incremental Number</label>
                        <input 
                          type="number" 
                          required
                          value={counterCurrentNumber}
                          onChange={(e) => setCounterCurrentNumber(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Part 2: Backup and Recovery Actions */}
                  <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Backup Configuration & Counters</h4>
                      <p className="text-xs text-slate-500 mt-1">Export your complete segregated setups and active quotation increment keys, or upload previously saved systems to restore databases.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Export Module card */}
                      <div className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-slate-50/50 flex flex-col justify-between">
                        <div>
                          <div className="w-10 h-10 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3">
                            <Download className="w-5 h-5" />
                          </div>
                          <h5 className="font-bold text-slate-800 text-sm">Download Configuration Backup</h5>
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Generates a fully structured JSON asset containing the company properties, bank routers,terms, templates, and primary counters.</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={handleExportBackup}
                          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" /> Export DB Backup
                        </button>
                      </div>

                      {/* Restore Module card */}
                      <div className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-slate-50/50 flex flex-col justify-between">
                        <div>
                          <div className="w-10 h-10 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-3">
                            <Upload className="w-5 h-5" />
                          </div>
                          <h5 className="font-bold text-slate-800 text-sm">Upload & Restore Settings</h5>
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Overwrite all company systems and active increment numbers using a downloaded JSON file. High warning: this is destructive.</p>
                        </div>
                        
                        <div className="mt-4">
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImportBackup} 
                            accept=".json" 
                            className="hidden" 
                          />
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" /> Import & Restore DB
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SAVE ACTION BAR (Only visible to write roles, e.g. Super Admin) */}
              {isAuthorizedToWrite && (
                <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={saveStatus === 'saving'}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Settings
                  </button>
                </div>
              )}

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
