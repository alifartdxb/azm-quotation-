import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Quotation, Customer, Product, QuoteItem } from '../types';
import { useReactToPrint } from 'react-to-print';
import { PrintQuotation } from '../components/PrintQuotation';
import { Save, Printer, Plus, Trash2, ArrowLeft, Edit, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency, parseDate, cleanFirestoreData } from '../lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getProducts, getQuotation, db, generateNextQuotationNumber, logActivity, getAppSettings } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

function QuotationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState<Product[]>([]);
  
  const [isEditing, setIsEditing] = useState(!id);
  const [isSaving, setIsSaving] = useState(false);

  const [quote, setQuote] = useState<Partial<Quotation>>({
    customer: {
      customerName: '',
      companyName: '',
      contactPerson: '',
      mobile: '',
      email: '',
      trn: '',
      projectName: '',
      siteLocation: '',
      address: '',
      reference: ''
    },
    validityDays: 10,
    subject: '',
    items: [],
    status: 'Draft',
    salesperson: 'Ahmed Abdullah'
  });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Record<string, string>>({});

  const convertImgToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
          } else {
            resolve('');
          }
        } catch (err) {
          console.warn('Canvas conversion failed for image:', url, err);
          resolve('');
        }
      };
      img.onerror = () => {
        resolve('');
      };
      if (url.startsWith('http')) {
        img.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'no_cache=' + Math.random();
      } else {
        img.src = url;
      }
    });
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;

    // 1. Data Validation
    if (!quote) {
      alert("Error: Missing quotation data.");
      return;
    }
    if (!quote.quoteNo) {
      alert("Error: Quotation number is missing.");
      return;
    }
    if (!quote.customer || !quote.customer.companyName || !quote.customer.customerName) {
      alert("Error: Customer information is incomplete.");
      return;
    }
    if (!quote.items || quote.items.length === 0) {
      alert("Error: Quotation item list is empty.");
      return;
    }
    const hasInvalidPrice = quote.items.some(item => typeof item.unitPrice !== 'number' || isNaN(item.unitPrice) || item.unitPrice < 0);
    if (hasInvalidPrice) {
      alert("Error: One or more items have invalid unit prices.");
      return;
    }
    if (quote.grandTotal === undefined || isNaN(quote.grandTotal)) {
      alert("Error: Totals are not fully calculated.");
      return;
    }

    setIsDownloadingPdf(true);
    
    try {
      // 2. Pre-load Images (Timeout & CORS-friendly check)
      const imagesToLoad = quote.items.filter(item => item.product?.image);
      const preloaded: Record<string, string> = {};

      const loadImagesPromise = Promise.all(
        imagesToLoad.map(async (item) => {
          if (item.product?.image && item.product?.sku) {
            try {
              const base64 = await convertImgToBase64(item.product.image);
              if (base64) {
                preloaded[item.product.sku] = base64;
              }
            } catch (imageErr) {
              console.warn(`Failed to convert image for sku ${item.product.sku}:`, imageErr);
            }
          }
        })
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Unable to load images')), 8000)
      );

      try {
        await Promise.race([loadImagesPromise, timeoutPromise]);
      } catch (raceErr) {
        console.warn('Image preloading race status:', raceErr);
      }

      setPreloadedImages(preloaded);

      // Brief delay to allow React to paint Base64 src to the DOM elements
      await new Promise(resolve => setTimeout(resolve, 350));

      const element = printRef.current;
      const pages = element.querySelectorAll('.block-page');
      
      if (!pages || pages.length === 0) {
        throw new Error('Canvas rendering error');
      }

      // 3. Setup A4 jsPDF instance
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const engineTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF engine timeout')), 18000)
      );

      const generatePdfPages = async () => {
        for (let i = 0; i < pages.length; i++) {
          const pageEl = pages[i] as HTMLElement;
          
          const canvas = await html2canvas(pageEl, {
            scale: 2, // 2x device pixel ratio for super crisp text and borders
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          if (i > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        }
      };

      await Promise.race([generatePdfPages(), engineTimeoutPromise]);
      
      const sanitizeName = (name: string) => name.replace(/[/\\?%*:|"<>]/g, '-').trim();
      const company = quote.customer?.companyName || quote.customer?.customerName || 'Customer';
      const quoteNo = quote.quoteNo || 'Draft';
      const docName = sanitizeName(`Quotation_${quoteNo}_${company}.pdf`);
      
      pdf.save(docName);
      
      if (id) {
        await logActivity('Downloaded PDF', 'Quotation', id, `Downloaded PDF copy for individual quote ${quoteNo}`);
      }
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
      let errorMsg = 'Failed to generate PDF. You can still use the "Print / PDF" option as a fallback.';
      if (err.message === 'PDF engine timeout') {
        errorMsg = 'Error: PDF engine timeout.';
      } else if (err.message?.includes('Canvas') || err.message?.includes('canvas')) {
        errorMsg = 'Error: Canvas rendering error.';
      } else if (err.message === 'Unable to load images') {
        errorMsg = 'Error: Unable to load images.';
      } else if (err instanceof RangeError || err.message?.includes('memory')) {
        errorMsg = 'Error: Insufficient memory.';
      }
      alert(errorMsg);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'settings' | 'quoteNo' | 'products' | 'quotation' | 'done'>('settings');

  useEffect(() => {
    const loadAllWorkspaceData = async () => {
      try {
        setLoadingPhase('settings');
        // Step 1: Load settings
        let settings;
        try {
          settings = await getAppSettings();
        } catch (err: any) {
          console.error("Step 1 (Load settings) failed:", err);
          throw new Error(`Step 1 (Load settings) failed: ${err.message || err}`);
        }
        
        let nextQuoteNo = '';
        if (!id) {
          // New Quote
          setLoadingPhase('quoteNo');
          // Step 2: Generate quotation number
          try {
            nextQuoteNo = await generateNextQuotationNumber();
          } catch (err: any) {
            console.error("Step 2 (Generate quotation number) failed:", err);
            throw new Error(`Step 2 (Generate quotation number) failed: ${err.message || err}`);
          }
        }

        setLoadingPhase('products');
        // Step 3: Load products catalogue
        let prodData;
        try {
          prodData = await getProducts();
        } catch (err: any) {
          console.error("Step 3 (Load products catalogue) failed:", err);
          throw new Error(`Step 3 (Load products catalogue) failed: ${err.message || err}`);
        }
        setProducts(prodData || []);

        if (id) {
          setLoadingPhase('quotation');
          let q;
          try {
            q = await getQuotation(id);
          } catch (err: any) {
            console.error("Step 4 (Load quotation document) failed:", err);
            throw new Error(`Step 4 (Load quotation document) failed: ${err.message || err}`);
          }
          if (q) {
            setQuote({
              customer: q.customer || {
                customerName: '',
                companyName: '',
                contactPerson: '',
                mobile: '',
                email: '',
                trn: '',
                projectName: '',
                siteLocation: '',
                address: '',
                reference: ''
              },
              validityDays: q.validityDays || 10,
              subject: q.subject || '',
              items: q.items || [],
              status: q.status || 'Draft',
              salesperson: q.salesperson || 'Ahmed Abdullah',
              quoteNo: q.quoteNo || '',
              subTotal: q.subTotal || 0,
              discountTotal: q.discountTotal || 0,
              vatAmount: q.vatAmount || 0,
              grandTotal: q.grandTotal || 0,
              createdAt: q.createdAt
            });
          } else {
            throw new Error("Unable to locate quotation with specified identifier");
          }
        } else {
          // Initialize quotation state with first row automatically added as per Step 6
          setQuote({
            customer: {
              customerName: '',
              companyName: '',
              contactPerson: '',
              mobile: '',
              email: '',
              trn: '',
              projectName: '',
              siteLocation: '',
              address: '',
              reference: ''
            },
            validityDays: 10,
            subject: '',
            items: [{
              id: uuidv4(),
              productId: '',
              product: {} as Product,
              qty: 1,
              unitPrice: 0,
              discountAmt: 0,
              total: 0
            }],
            subTotal: 0,
            discountTotal: 0,
            vatAmount: 0,
            grandTotal: 0,
            status: 'Draft',
            salesperson: 'Ahmed Abdullah',
            quoteNo: nextQuoteNo,
          });
        }
        setLoadingPhase('done');
      } catch (err) {
        console.error("QuotationBuilder workspace initiation error:", err);
        // Let the upper application scope handle the rendering fail state cleanly via boundary
        throw err;
      }
    };

    loadAllWorkspaceData();
  }, [id]);

  const addItem = () => {
    setQuote(prev => ({
      ...prev,
      items: [...(prev.items || []), {
        id: uuidv4(),
        productId: '',
        product: {} as Product,
        qty: 1,
        unitPrice: 0,
        discountAmt: 0,
        total: 0
      }]
    }));
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...(quote.items || [])];
    const item = { ...newItems[index] };
    
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        item.productId = prod.id;
        item.product = prod;
        item.unitPrice = prod.price;
      }
    } else {
      (item as any)[field] = value;
    }
    
    // Float precision fix
    item.total = Math.round((item.qty * item.unitPrice) * 100) / 100;
    newItems[index] = item;
    
    recalculateTotals(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = (quote.items || []).filter((_, i) => i !== index);
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: QuoteItem[]) => {
    const subTotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
    const vatAmount = subTotal * 0.05;
    const grandTotal = subTotal + vatAmount;

    setQuote(prev => ({
      ...prev,
      items,
      subTotal: Math.round(subTotal * 100) / 100,
      discountTotal: 0,
      vatAmount: Math.round(vatAmount * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    }));
  };

  const handleSave = async () => {
    if (!quote.customer?.companyName && !quote.customer?.customerName) return alert("Please enter Customer or Company Name");
    setIsSaving(true);
    
    try {
      const quoteNo = quote.quoteNo || await generateNextQuotationNumber();

      const quoteToSave = cleanFirestoreData({
        ...quote,
        quoteNo,
        createdAt: quote.createdAt || new Date().toISOString(),
      });

      if (id) {
        await updateDoc(doc(db, 'quotations', id), quoteToSave);
        await logActivity('Updated Quotation', 'Quotation', id, `Updated status to ${quote.status}`);
        setIsEditing(false);
      } else {
        const docRef = await addDoc(collection(db, 'quotations'), quoteToSave);
        await logActivity('Created Quotation', 'Quotation', docRef.id, `Created quote ${quoteNo}`);
        navigate(`/quotations/${docRef.id}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving quotation");
    } finally {
       setIsSaving(false);
    }
  };

  if (loadingPhase !== 'done') {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mb-6"></div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight text-center">Preparing Quotation Workspace</h2>
        <div className="space-y-3 w-full max-w-xs">
          <div className="flex items-center gap-3 text-sm">
            <span className={loadingPhase === 'settings' ? 'text-blue-600 animate-pulse font-medium' : 'text-slate-400'}>
              {loadingPhase === 'settings' ? '● Loading settings...' : '✓ Settings loaded'}
            </span>
          </div>
          {!id && (
            <div className="flex items-center gap-3 text-sm">
              <span className={
                loadingPhase === 'quoteNo' 
                  ? 'text-blue-600 animate-pulse font-medium' 
                  : (loadingPhase === 'settings' ? 'text-slate-300' : '✓ Quotation sequence generated')
              }>
                {loadingPhase === 'settings' 
                  ? '○ Pending quotation sequence...' 
                  : (loadingPhase === 'quoteNo' ? '● Allocating sequence number...' : '✓ Quotation sequence generated')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <span className={
              loadingPhase === 'products' 
                ? 'text-blue-600 animate-pulse font-medium' 
                : (['settings', 'quoteNo'].includes(loadingPhase) ? 'text-slate-300' : '✓ Product catalog loaded')
            }>
              {['settings', 'quoteNo'].includes(loadingPhase) 
                ? '○ Pending product catalog...' 
                : (loadingPhase === 'products' ? '● Loading product catalog...' : '✓ Product catalog loaded')}
            </span>
          </div>
          {id && (
            <div className="flex items-center gap-3 text-sm">
              <span className={
                (loadingPhase as string) === 'quotation' 
                  ? 'text-blue-600 animate-pulse font-medium' 
                  : ((loadingPhase as string) !== 'done' && (loadingPhase as string) !== 'quotation' ? 'text-slate-300' : '✓ Quotation document loaded')
              }>
                {(loadingPhase as string) !== 'quotation' && (loadingPhase as string) !== 'done'
                  ? '○ Pending quotation document...' 
                  : ((loadingPhase as string) === 'quotation' ? '● Loading quotation document...' : '✓ Quotation document loaded')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotations')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
             <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {id ? `Quotation ${quote.quoteNo}` : 'New Quotation'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all active:scale-95">
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          )}

          {isEditing && (
            <button disabled={isSaving} onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Document'}</span>
            </button>
          )}
          
          {id && !isEditing && (
            <>
              <button 
                onClick={() => {
                  const msg = encodeURIComponent(`Dear ${quote.customer?.companyName || 'Customer'},\n\nPlease find our quotation ${quote.quoteNo}.\n\nThank you.\nBest Regards,\nAZM Group`);
                  window.open(`https://wa.me/${quote.customer?.mobile.replace(/\D/g, '')}?text=${msg}`, '_blank');
                }}
                className="bg-[#25D366] hover:bg-[#20b858] text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <span>Send WhatsApp</span>
              </button>
              <button 
                disabled={isDownloadingPdf}
                onClick={handleDownloadPdf}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>
              <button onClick={() => handlePrint()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95">
                <Printer className="w-4 h-4" />
                <span>Print / PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
               <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                 <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Document Settings</h3>
                 {id && (
                    <select 
                      className="border border-slate-200 bg-slate-50 rounded-lg p-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      value={quote.status}
                      onChange={e => setQuote({...quote, status: e.target.value})}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Sent">Sent</option>
                      <option value="Expired">Expired</option>
                      <option value="Converted to Order">Converted to Order</option>
                    </select>
                 )}
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                    <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={quote.subject || ''} onChange={e => setQuote({...quote, subject: e.target.value})} 
                      placeholder="e.g. Supply of Bath Fittings" />
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Validity (Days)</label>
                    <input type="number" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={quote.validityDays || 10} onChange={e => setQuote({...quote, validityDays: Number(e.target.value)})} />
                 </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight mb-4 border-b border-slate-100 pb-3">Customer Information</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Company Name</label>
                   <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.companyName || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, companyName: e.target.value}})} />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customer Name</label>
                   <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.customerName || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, customerName: e.target.value}})} />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mobile Number</label>
                   <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.mobile || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, mobile: e.target.value}})} />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                   <input type="email" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.email || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, email: e.target.value}})} />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">TRN Number</label>
                   <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.trn || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, trn: e.target.value}})} />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Reference Number</label>
                   <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.reference || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, reference: e.target.value}})} />
                 </div>
                 <div className="md:col-span-2 lg:col-span-3">
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                   <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.address || ''} onChange={e => setQuote({...quote, customer: {...quote.customer!, address: e.target.value}})} />
                 </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Line Items</h3>
                 <button onClick={addItem} className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline">
                   <Plus className="w-3 h-3"/> Add Item
                 </button>
              </div>
              
              <div className="overflow-x-auto p-5">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 w-1/3">Product</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-b border-slate-100">
                    {quote.items?.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                           <select 
                             className="w-full border border-slate-200 bg-white rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                             value={item.productId}
                             onChange={e => updateItem(idx, 'productId', e.target.value)}
                           >
                             <option value="">Select product...</option>
                             {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                           </select>
                        </td>
                        <td className="py-3 px-4">
                          <input type="number" min="1" className="w-20 border border-slate-200 bg-white rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                             value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} />
                        </td>
                        <td className="py-3 px-4">
                          <input type="number" className="w-28 border border-slate-200 bg-white rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                             value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 text-sm">
                          {formatCurrency(item.total)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {quote.items?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-sm bg-slate-50/50">
                          No items added yet. Click "Add Item" to begin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
  
                {/* Live Totals summary */}
                <div className="mt-6 flex justify-end">
                   <div className="w-72 bg-slate-50 p-5 rounded-xl space-y-3 border border-slate-200 shadow-sm">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-mono font-medium text-slate-900">{formatCurrency(quote.subTotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600 border-b border-slate-200 pb-3">
                        <span>VAT (5%)</span>
                        <span className="font-mono font-medium text-slate-900">{formatCurrency(quote.vatAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-slate-900 pt-1">
                        <span>Grand Total</span>
                        <span className="font-mono">{formatCurrency(quote.grandTotal || 0)}</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print View */}
      {!isEditing && quote.customer && (
        <div className="bg-slate-100 p-8 rounded-xl overflow-auto flex justify-center border-2 border-dashed border-slate-300">
          <div className="shadow-2xl">
            <PrintQuotation ref={printRef} quotation={quote as Quotation} preloadedImages={preloadedImages} />
          </div>
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 font-bold text-xl">!</div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Workspace Error</h2>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Unable to load quotation. Please refresh or contact administrator.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function QuotationBuilderWithBoundary() {
  return (
    <ErrorBoundary>
      <QuotationBuilder />
    </ErrorBoundary>
  );
}
