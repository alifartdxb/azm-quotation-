import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Quotation, Customer, Product, QuoteItem } from '../types';
import { useReactToPrint } from 'react-to-print';
import { PrintQuotation } from '../components/PrintQuotation';
import { Save, Printer, Plus, Trash2, ArrowLeft, Edit } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../lib/utils';
import { getCustomers, getProducts, getQuotation, db, generateNextQuotationNumber, logActivity } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';

export default function QuotationBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [isEditing, setIsEditing] = useState(!id);
  const [isSaving, setIsSaving] = useState(false);

  const [quote, setQuote] = useState<Partial<Quotation>>({
    customer: null,
    validityDays: 10,
    reference: '',
    subject: '',
    items: [],
    status: 'Draft',
    salesperson: 'Ahmed Abdullah'
  });

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    Promise.all([
      getCustomers(),
      getProducts()
    ]).then(([custData, prodData]) => {
      setCustomers(custData);
      setProducts(prodData);
    });

    if (id) {
       getQuotation(id).then(q => {
         if (q) {
           if (q.customerId && !q.customer) {
             getDoc(doc(db, 'customers', q.customerId)).then(cSnap => {
                setQuote({ ...q, customer: { id: cSnap.id, ...cSnap.data()} as Customer });
             });
           } else {
             setQuote(q);
           }
         }
       });
    }
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
    item.total = Math.round(((item.qty * item.unitPrice) - item.discountAmt) * 100) / 100;
    newItems[index] = item;
    
    recalculateTotals(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = (quote.items || []).filter((_, i) => i !== index);
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: QuoteItem[]) => {
    const subTotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
    const discountTotal = items.reduce((sum, item) => sum + Number(item.discountAmt), 0);
    const netTotal = subTotal - discountTotal;
    const vatAmount = netTotal * 0.05;
    const grandTotal = netTotal + vatAmount;

    setQuote(prev => ({
      ...prev,
      items,
      subTotal: Math.round(subTotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    }));
  };

  const handleSave = async () => {
    if (!quote.customer) return alert("Please select a customer");
    setIsSaving(true);
    
    try {
      const quoteNo = quote.quoteNo || await generateNextQuotationNumber();

      const quoteToSave = {
        ...quote,
        quoteNo,
        customerId: quote.customer.id,
        createdAt: quote.createdAt || new Date().toISOString(),
      };
      
      delete quoteToSave.customer;

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

  if (!quote) return <div>Loading...</div>;

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
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Customer</label>
                   <select 
                     className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                     value={quote.customer?.id || ''}
                     onChange={e => setQuote({...quote, customer: customers.find(c => c.id === e.target.value) || null})}
                   >
                     <option value="">Select a customer...</option>
                     {customers.map(c => <option key={c.id} value={c.id}>{c.companyName} ({c.contactPerson})</option>)}
                   </select>
                 </div>
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
                      <th className="px-4 py-3">Disc. Amt</th>
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
                        <td className="py-3 px-4">
                          <input type="number" className="w-24 border border-slate-200 bg-white rounded-md p-2 text-sm text-red-600 focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                             value={item.discountAmt} onChange={e => updateItem(idx, 'discountAmt', Number(e.target.value))} />
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
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Discount</span>
                        <span className="font-mono font-medium text-red-600">-{formatCurrency(quote.discountTotal || 0)}</span>
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
            <PrintQuotation ref={printRef} quotation={quote as Quotation} />
          </div>
        </div>
      )}
    </div>
  );
}
