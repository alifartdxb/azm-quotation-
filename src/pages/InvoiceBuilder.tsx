import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { SalesInvoice, Customer, Product, QuoteItem } from '../types';
import { useReactToPrint } from 'react-to-print';
import { PrintInvoice } from '../components/PrintInvoice';
import { Save, Printer, Plus, Trash2, ArrowLeft, Edit, Download, Search, X, Image as ImageIcon, ChevronDown, DollarSign } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency, parseDate, cleanFirestoreData } from '../lib/utils';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProducts, getSalesInvoice, saveSalesInvoice, generateNextInvoiceNumber, logActivity, getAppSettings } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

function InvoiceBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState(!id);
  const [isSaving, setIsSaving] = useState(false);

  const [invoice, setInvoice] = useState<Partial<SalesInvoice>>({
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
    subject: '',
    items: [],
    status: 'Draft',
    salesperson: 'Sabeer',
    preparedBy: 'Ali G',
    paymentStatus: 'Unpaid',
    paidAmount: 0,
    outstandingBalance: 0,
    remarks: ''
  });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Record<string, string>>({});
  const [appSettings, setAppSettings] = useState<any>(null);

  // Search references
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);

  const [loadingPhase, setLoadingPhase] = useState<'initial' | 'settings' | 'products' | 'invoice' | 'done'>('initial');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoadingPhase('settings');
        const settings = await getAppSettings();
        setAppSettings(settings);

        setLoadingPhase('products');
        const prods = await getProducts();
        setProducts(prods);

        if (id) {
          setLoadingPhase('invoice');
          const data = await getSalesInvoice(id);
          if (data) {
            const sanitizedItems = (data.items || []).map((item: any) => ({
              ...item,
              id: item.id || uuidv4()
            }));
            setInvoice({
              ...data,
              items: sanitizedItems
            });
          } else {
            alert("Location payload: Invoice not found.");
            navigate('/invoices');
          }
        } else {
          try {
            const nextInvoiceNo = await generateNextInvoiceNumber();
            setInvoice(prev => ({
              ...prev,
              invoiceNo: nextInvoiceNo,
              invoiceDate: new Date().toISOString()
            }));
          } catch(err) {
            console.error("Failed to generate next invoice number:", err);
          }
        }
        setLoadingPhase('done');
      } catch (err) {
        console.error("Critical loader bootstrap failure:", err);
        setLoadingPhase('done');
      }
    };
    bootstrap();
  }, [id, navigate]);

  // Recalculate totals periodically when items edit
  useEffect(() => {
    recalculateTotals();
  }, [invoice.items, invoice.discountPercentage, invoice.paidAmount]);

  const recalculateTotals = () => {
    const items = invoice.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const discountPercent = invoice.discountPercentage || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const netTotal = subtotal - discountAmount;
    const vatAmount = netTotal * 0.05;
    const grandTotal = netTotal + vatAmount;

    const paidAmt = invoice.paidAmount || 0;
    const outstanding = Math.max(0, grandTotal - paidAmt);
    let paymentStat: SalesInvoice['paymentStatus'] = 'Unpaid';
    if (paidAmt >= grandTotal && grandTotal > 0) {
      paymentStat = 'Paid';
    } else if (paidAmt > 0) {
      paymentStat = 'Partially Paid';
    }

    setInvoice(prev => {
      // Avoid infinite loop by shallow comparisons
      if (
        prev.subtotal === subtotal &&
        prev.discountAmount === discountAmount &&
        prev.netTotal === netTotal &&
        prev.vatAmount === vatAmount &&
        prev.grandTotal === grandTotal &&
        prev.outstandingBalance === outstanding &&
        prev.paymentStatus === paymentStat
      ) {
        return prev;
      }
      return {
        ...prev,
        subtotal: Math.round(subtotal * 100) / 100,
        discountAmount: Math.round(discountAmount * 100) / 100,
        netTotal: Math.round(netTotal * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        grandTotal: Math.round(grandTotal * 100) / 100,
        outstandingBalance: Math.round(outstanding * 100) / 100,
        paymentStatus: paymentStat
      };
    });
  };

  const convertImgToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve('');
        return;
      }
      if (url.startsWith('data:image/')) {
        resolve(url);
        return;
      }
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
          resolve('');
        }
      };
      img.onerror = () => {
        resolve('');
      };
      img.src = url;
    });
  };

  const handleDownloadPdf = async () => {
    if (!invoice?.items || invoice.items.length === 0) {
      alert("Error: Items list is empty.");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const preloaded: Record<string, string> = {};
      const imagePromises = (invoice.items || []).map(async (item) => {
        if (item.product?.image) {
          const b64 = await convertImgToBase64(item.product.image);
          if (b64) {
            preloaded[item.product.sku || item.id] = b64;
          }
        }
      });
      await Promise.allSettled(imagePromises);
      setPreloadedImages(preloaded);

      // Create PDF
      const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
      const pageHeight = pdf.internal.pageSize.height;
      let totalPagesExp = "{total_pages_count_string}";

      const formatNum = (val: number) => `AED ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Setup Autotable
      autoTable(pdf, {
        html: '#invoice-pdf-render',
        startY: 20,
        didDrawPage: (data) => {
          // Drawing run-time header & footer
          pdf.setFontSize(8);
          pdf.text(`Invoice No: ${invoice.invoiceNo}`, 14, 10);
          pdf.text(`Date: ${format(new Date(), 'yyyy-MM-dd')}`, 170, 10);
        }
      });

      pdf.save(`Invoice_${invoice.invoiceNo}_${invoice.customer?.companyName || 'AZM'}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Error creating PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!invoice.customer?.customerName) return alert("Please enter Customer Name");
    setIsSaving(true);
    try {
      const invoiceNo = invoice.invoiceNo || await generateNextInvoiceNumber();
      const invoiceToSave = {
        ...invoice,
        invoiceNo,
        createdAt: invoice.createdAt || new Date().toISOString()
      };

      const docId = await saveSalesInvoice(invoiceToSave);
      setIsEditing(false);
      navigate(`/invoices/${docId}`);
    } catch (err) {
      console.error(err);
      alert("Error saving Invoice");
    } finally {
      setIsSaving(false);
    }
  };

  // Items manipulation
  const handleAddItem = () => {
    const newItem: QuoteItem = {
      id: uuidv4(),
      product: {
        id: '',
        sku: 'MANUAL',
        name: '',
        brand: '',
        price: 0,
        unit: 'Pcs',
        category: 'Miscellaneous'
      },
      qty: 1,
      unitPrice: 0,
      total: 0
    };
    setInvoice(prev => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const handleRemoveItem = (id: string) => {
    setInvoice(prev => ({
      ...prev,
      items: (prev.items || []).filter(item => item.id !== id)
    }));
  };

  const handleItemProductSelect = (index: number, product: Product) => {
    setInvoice(prev => {
      const items = [...(prev.items || [])];
      items[index] = {
        ...items[index],
        productId: product.id,
        product: product,
        unitPrice: product.price,
        total: items[index].qty * product.price
      };
      return { ...prev, items };
    });
    setShowProductDropdown(null);
  };

  const handleItemPropertyChange = (index: number, field: string, value: any) => {
    setInvoice(prev => {
      const items = [...(prev.items || [])];
      const item = { ...items[index] };
      
      if (field === 'qty') {
        item.qty = Number(value);
      } else if (field === 'unitPrice') {
        item.unitPrice = Number(value);
      } else if (field === 'discountAmt') {
        item.discountAmt = value ? Number(value) : undefined;
      } else if (field === 'name') {
        item.product = { ...item.product, name: value };
      } else if (field === 'sku') {
        item.product = { ...item.product, sku: value };
      } else if (field === 'brand') {
        item.product = { ...item.product, brand: value };
      } else if (field === 'unit') {
        item.product = { ...item.product, unit: value };
      }

      // Calculate localized row total
      const discountRatio = item.discountAmt ? (1 - item.discountAmt / 100) : 1;
      item.total = item.qty * item.unitPrice * discountRatio;
      items[index] = item;

      return { ...prev, items };
    });
  };

  if (loadingPhase !== 'done') {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mb-6"></div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 tracking-tight text-center animate-pulse">Initializing Invoice Engine</h2>
        <div className="space-y-3 w-full max-w-xs text-xs text-slate-400">
          <p className="flex justify-between">Settings bootstrap: <span>{loadingPhase === 'settings' ? 'Loading' : 'OK'}</span></p>
          <p className="flex justify-between">Product collection index: <span>{loadingPhase === 'products' ? 'Loading' : 'OK'}</span></p>
          <p className="flex justify-between">Invoices storage path: <span>{loadingPhase === 'invoice' ? 'Loading' : 'OK'}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/invoices')} className="p-2 bg-white border border-slate-200 hover:bg-slate-50 transition-all rounded-lg text-slate-500 shadow-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-cyan-50 text-[#1B6B72] px-2.5 py-1 text-[10px] font-black uppercase rounded tracking-wider border border-cyan-100 font-mono">
                Sales Invoice Engine
              </span>
              {invoice.invoiceNo && (
                <span className="text-sm font-mono font-bold text-slate-700">{invoice.invoiceNo}</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-950 mt-1">
              {id ? `Invoice Details: ${invoice.invoiceNo}` : 'New Billing Invoice Builder'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95">
              <Edit className="w-4 h-4" />
              <span>Edit Invoice Details</span>
            </button>
          )}

          {isEditing && (
            <button disabled={isSaving} onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Invoice...' : 'Save Invoice'}</span>
            </button>
          )}

          {id && !isEditing && (
            <>
              {/* Send WhatsApp Share Button */}
              <button 
                onClick={() => {
                  const baseMsg = `Dear ${invoice.customer?.customerName || 'Customer'},\n\nPlease find attached Invoice No. ${invoice.invoiceNo || 'Draft'} against Quotation ${invoice.quotationNo || '-'}.\n\nThank you for your business and continued trust in Al Zahra Al Malakia (AZM Group).\n\nBest Regards,\n${invoice.preparedBy || 'Ali G'}`;
                  const msg = encodeURIComponent(baseMsg);
                  const mobile = invoice.customer?.mobile || '';
                  const mobileClean = mobile.replace(/\D/g, '');
                  const url = mobileClean 
                    ? `https://wa.me/${mobileClean}?text=${msg}` 
                    : `https://wa.me/?text=${msg}`;
                  window.open(url, '_blank');
                }}
                className="bg-[#25D366] hover:bg-[#20b858] text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <span>Send via WhatsApp</span>
              </button>
              <button 
                disabled={isDownloadingPdf}
                onClick={handleDownloadPdf}
                className="bg-[#1A3A5C] hover:bg-slate-850 text-[#C9A96E] border border-[#C9A96E]/20 px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Invoice PDF'}</span>
              </button>
              <button onClick={() => handlePrint()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-sm active:scale-95">
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-6">
            
            {/* Document details section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Invoice Logistics</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.subject || ''} onChange={e => setInvoice({...invoice, subject: e.target.value})} placeholder="Subject" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Salesperson</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.salesperson || ''} onChange={e => setInvoice({...invoice, salesperson: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prepared By</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.preparedBy || ''} onChange={e => setInvoice({...invoice, preparedBy: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ref Quotation Number</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.quotationNo || ''} onChange={e => setInvoice({...invoice, quotationNo: e.target.value})} placeholder="QTN-2026-XXXXXX" />
                </div>
              </div>
            </div>

            {/* Client profile */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight border-b border-slate-100 pb-3 mb-4">Customer Segment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Client Company</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-semibold" 
                    value={invoice.customer?.companyName || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), companyName: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact Officer</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.customer?.customerName || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), customerName: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">TRN Registration</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold" 
                    value={invoice.customer?.trn || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), trn: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono">Mobile (WhatsApp link enabled)</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.customer?.mobile || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), mobile: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact Email</label>
                  <input type="email" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.customer?.email || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), email: e.target.value}})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Delivery Address</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                    value={invoice.customer?.address || ''} onChange={e => setInvoice({...invoice, customer: {...(invoice.customer as Customer), address: e.target.value}})} />
                </div>
              </div>
            </div>

            {/* Payment tracker configuration */}
            <div className="bg-amber-50/50 rounded-xl shadow-sm border border-amber-200 p-6">
              <h3 className="text-sm font-bold text-amber-800 uppercase tracking-tight border-b border-amber-200/40 pb-3 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>Payment Tracking Configurations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Amount Paid (AED)</label>
                  <input type="number" className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-emerald-700" 
                    value={invoice.paidAmount || 0} onChange={e => setInvoice({...invoice, paidAmount: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Payment Date</label>
                  <input type="date" className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.paymentDate || ''} onChange={e => setInvoice({...invoice, paymentDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Payment Option</label>
                  <select className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={invoice.paymentMethod || 'Bank Transfer'} onChange={e => setInvoice({...invoice, paymentMethod: e.target.value})}>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Online Link">Online Payment Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 font-mono">Cheque Number / Ref Code</label>
                  <input type="text" className="w-full border border-slate-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                    value={invoice.chequeNo || ''} onChange={e => setInvoice({...invoice, chequeNo: e.target.value})} placeholder="e.g. CHQ-930210" />
                </div>
              </div>
            </div>

            {/* Product items table builder */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Active Invoiced Line Items</h3>
                <button onClick={handleAddItem} className="bg-[#1B6B72] hover:bg-[#16565c] text-white px-3.5 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all shadow-sm active:scale-95">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert Manual Row</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left col-table border-collapse">
                  <thead className="bg-[#1B6B72] text-white text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 min-w-[200px]">Product / Assembly Description</th>
                      <th className="px-4 py-3 w-28">Unit</th>
                      <th className="px-4 py-3 w-24">Price (AED)</th>
                      <th className="px-4 py-3 w-20">Qty</th>
                      <th className="px-4 py-3 w-20">Disc (%)</th>
                      <th className="px-4 py-3 w-32 text-right">Row Net total</th>
                      <th className="px-4 py-3 w-16 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoice.items || []).map((item, index) => (
                      <tr key={item.id || `invoice-item-${index}`} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 space-y-2">
                          <div className="relative">
                            <input 
                              type="text" 
                              className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none font-semibold text-slate-800"
                              value={item.product?.name || ''}
                              onChange={e => handleItemPropertyChange(index, 'name', e.target.value)}
                              placeholder="Product details or custom marble cutting specs"
                            />
                            {/* Simple dropdown indicator */}
                            <button 
                              onClick={() => setShowProductDropdown(showProductDropdown === index ? null : index)}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>

                            {showProductDropdown === index && (
                              <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg max-h-52 overflow-y-auto">
                                <div className="p-2 border-b border-rose-100 bg-slate-50 sticky top-0">
                                  <input 
                                    type="text" 
                                    className="w-full p-1.5 border border-slate-200 rounded text-xs" 
                                    placeholder="Search warehouse inventory..."
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                  />
                                </div>
                                {products
                                  .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                                  .map(p => (
                                    <div 
                                      key={p.id} 
                                      className="p-2 text-xs hover:bg-slate-100 cursor-pointer border-b border-slate-50 flex justify-between font-medium text-slate-700"
                                      onClick={() => handleItemProductSelect(index, p)}
                                    >
                                      <span>{p.sku} - {p.name} ({p.brand})</span>
                                      <b className="font-mono text-blue-700">AED {p.price}</b>
                                    </div>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <input 
                              type="text" 
                              className="border border-slate-200 bg-white rounded-lg p-1.5 font-mono"
                              placeholder="SKU"
                              value={item.product?.sku || ''}
                              onChange={e => handleItemPropertyChange(index, 'sku', e.target.value)}
                            />
                            <input 
                              type="text" 
                              className="border border-slate-200 bg-white rounded-lg p-1.5"
                              placeholder="Brand"
                              value={item.product?.brand || ''}
                              onChange={e => handleItemPropertyChange(index, 'brand', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-center"
                            value={item.product?.unit || 'Pcs'}
                            onChange={e => handleItemPropertyChange(index, 'unit', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none font-mono"
                            value={item.unitPrice || 0}
                            onChange={e => handleItemPropertyChange(index, 'unitPrice', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-center font-mono font-semibold"
                            value={item.qty || 1}
                            onChange={e => handleItemPropertyChange(index, 'qty', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none text-center font-mono text-slate-500"
                            value={item.discountAmt || ''}
                            onChange={e => handleItemPropertyChange(index, 'discountAmt', e.target.value)}
                            placeholder="-"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 leading-3 text-sm">
                          {formatCurrency(item.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-red-650 transition-colors focus:outline-none">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!invoice.items || invoice.items.length === 0) && (
                      <tr key="empty-state">
                        <td colSpan={7} className="p-8 text-center text-slate-400 text-sm font-medium">
                          No items added. Click insert manual row to compile invoice breakdown.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary calculations block */}
              <div className="bg-slate-50 p-6 border-t border-slate-100 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="text-xs text-slate-400 font-medium">
                  VAT calculated at standard Gulf Regional limit of 5%.
                </div>
                <div className="w-full md:w-80 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCurrency(invoice.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 gap-4">
                    <span>Discount Percentage %:</span>
                    <input 
                      type="number" 
                      className="w-20 border border-slate-200 bg-white rounded p-1 text-center font-mono text-xs" 
                      value={invoice.discountPercentage || 0}
                      onChange={e => setInvoice({...invoice, discountPercentage: Number(e.target.value)})}
                    />
                  </div>
                  {invoice.discountAmount ? invoice.discountAmount > 0 : false && (
                    <div className="flex justify-between text-rose-650 font-semibold text-xs">
                      <span>Discount Amount:</span>
                      <span className="font-mono">-{formatCurrency(invoice.discountAmount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 font-bold border-t border-slate-200 pt-2 text-xs">
                    <span>Net Total:</span>
                    <span className="font-mono font-black">{formatCurrency(invoice.netTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>VAT (5%):</span>
                    <span className="font-mono font-semibold">{formatCurrency(invoice.vatAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black border-t-2 border-slate-300 pt-2.5 text-base text-[#1B6B72]">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatCurrency(invoice.grandTotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-red-650 font-black border-t border-slate-200 pt-1 text-xs">
                    <span>Outstanding Due:</span>
                    <span className="font-mono">{formatCurrency(invoice.outstandingBalance || 0)}</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* View PDF/Web Layout block when not editing */}
      {!isEditing && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
          <PrintInvoice invoice={invoice as SalesInvoice} appSettings={appSettings} />
        </div>
      )}
    </div>
  );
}

export default InvoiceBuilder;
