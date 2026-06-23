import React from 'react';
import type { SalesInvoice, QuoteItem } from '../types';
import { formatCurrency, parseDate } from '../lib/utils';
import { format } from 'date-fns';

interface Props {
  invoice: SalesInvoice;
  preloadedImages?: Record<string, string>;
  appSettings?: any;
}

interface PageData {
  items: QuoteItem[];
  pageIndex: number;
  isFirst: boolean;
  isLast: boolean;
}

// Deterministic partitioning of items into pages to prevent vertical cutoffs when printing.
const partitionItems = (items: QuoteItem[]): PageData[] => {
  if (items.length === 0) {
    return [{
      items: [],
      pageIndex: 1,
      isFirst: true,
      isLast: true
    }];
  }

  if (items.length <= 3) {
    return [{
      items,
      pageIndex: 1,
      isFirst: true,
      isLast: true
    }];
  }

  const pages: PageData[] = [];
  const currentItems = [...items];
  let pageNum = 1;

  // First page layout
  const firstPageItems = currentItems.splice(0, 5);
  pages.push({
    items: firstPageItems,
    pageIndex: pageNum++,
    isFirst: true,
    isLast: currentItems.length === 0
  });

  // Middle/Last page layout
  while (currentItems.length > 0) {
    if (currentItems.length <= 4) {
      pages.push({
        items: currentItems.splice(0, 4),
        pageIndex: pageNum++,
        isFirst: false,
        isLast: true
      });
    } else {
      const takeCount = Math.min(8, currentItems.length);
      const chunk = currentItems.splice(0, takeCount);
      pages.push({
        items: chunk,
        pageIndex: pageNum++,
        isFirst: false,
        isLast: currentItems.length === 0
      });
    }
  }

  if (pages.length > 0) {
    pages[pages.length - 1].isLast = true;
  }

  return pages;
};

export const PrintInvoice = React.forwardRef<HTMLDivElement, Props>(({ invoice, preloadedImages, appSettings }, ref) => {
  const safeCustomer = invoice?.customer || {
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
  };

  const safeItems = invoice?.items || [];
  const safeSubtotal = invoice?.subtotal || 0;
  const discountPercentage = invoice?.discountPercentage || 0;
  const discountAmount = invoice?.discountAmount || 0;
  const netTotal = invoice?.netTotal || safeSubtotal;
  const safeVatAmount = invoice?.vatAmount || 0;
  const safeGrandTotal = invoice?.grandTotal || 0;
  const safeInvoiceNo = invoice?.invoiceNo || 'Draft';
  const safeSalesperson = invoice?.salesperson || 'Sabeer';
  const safeSubject = invoice?.subject || '';

  const pages = partitionItems(safeItems);
  const totalPages = pages.length;

  return (
    <div ref={ref} className="bg-slate-200/50 p-2 sm:p-6 lg:p-8 flex flex-col items-center gap-6 no-print w-full min-w-[210mm] max-w-[210mm]">
      <div className="print:m-0 print:p-0 flex flex-col gap-8 w-full">
        {pages.map(({ items, pageIndex, isFirst, isLast }) => (
          <div
            key={pageIndex}
            id={`invoice-page-${pageIndex}`}
            className="block-page bg-white text-black px-[8mm] py-0 w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] flex flex-col justify-between shadow-lg relative print:shadow-none print:border-none print:m-0 print:px-[8mm] print:py-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Top Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
              
              {/* Header */}
              <div className="mb-4">
                {appSettings?.headerImage ? (
                  <img src={appSettings.headerImage} alt="Invoice Header" className="w-full h-auto mb-2 object-contain object-top" />
                ) : isFirst ? (
                  <>
                    <div className="flex justify-between items-center bg-blue-50 rounded-lg border-2 border-blue-800 p-3 mb-2">
                      <div className="flex-1">
                        <h1 className="text-xl font-serif font-bold text-blue-800 leading-tight whitespace-pre-line">
                          {appSettings?.companyNameEn || 'Al Zahra Al Malakia\nBuilding Materials Trading L.L.C'}
                        </h1>
                      </div>
                      <div className="px-4 shrink-0">
                        <div className="w-16 h-16 border-[3px] border-blue-800 rotate-45 flex items-center justify-center bg-white rounded-sm">
                          <span className="text-blue-800 font-bold -rotate-45 text-2xl font-serif">AZ</span>
                        </div>
                      </div>
                      <div className="flex-1 text-right font-arabic">
                        <h1 className="text-xl font-bold text-blue-800 leading-tight whitespace-pre-line">
                          {appSettings?.companyNameAr || 'الزهــرة المـلـكـيـة\nلتـــجــارة مــواد الـبــنــاء ذ.م.م'}
                        </h1>
                      </div>
                    </div>
                    <div className="text-center text-blue-800 text-[11px] font-medium">
                      Tel: {appSettings?.phone || '+971 4 28 444 52'} | Add.: {appSettings?.address || 'Shop No. 12, Building Materials Mall, Dubai, U.A.E'} | Email: office@alzahrabm.com
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center border-b border-gray-300 pb-2 mb-4 text-[10px] text-gray-500 font-medium">
                    <div>AZM Group - Sales Invoice {safeInvoiceNo}</div>
                    <div>Page {pageIndex} of {totalPages}</div>
                  </div>
                )}
              </div>

              {/* Document Title / Banner */}
              {isFirst && (
                <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Sales Invoice</h2>
                    <p className="text-xs text-slate-500">فاتورة مبيعات</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-800 font-mono">{safeInvoiceNo}</p>
                    <p className="text-[10px] text-slate-400">Date: {format(parseDate(invoice.createdAt || new Date().toISOString()), 'yyyy-MM-dd')}</p>
                    {invoice.quotationNo && (
                      <p className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block font-mono mt-1">Ref Qtn: {invoice.quotationNo}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Customer & Document Information Tables */}
              {isFirst && (
                <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                  {/* Left Column: Client Details */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">Customer Details / بيانات العميل</h3>
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Company:</td>
                          <td className="py-1 font-bold text-slate-950">{safeCustomer.companyName || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Attention:</td>
                          <td className="py-1 text-slate-800">{safeCustomer.customerName || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">TRN No:</td>
                          <td className="py-1 font-mono font-bold text-slate-900">{safeCustomer.trn || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Contact:</td>
                          <td className="py-1 font-mono text-slate-800">{safeCustomer.mobile || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Project / Site:</td>
                          <td className="py-1 text-slate-800">{[safeCustomer.projectName, safeCustomer.siteLocation].filter(Boolean).join(' - ') || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right Column: Invoice Details & Status */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">Invoice Details / تفاصيل الفاتورة</h3>
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Salesperson:</td>
                          <td className="py-1 text-slate-850 font-medium">{safeSalesperson}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Prepared By:</td>
                          <td className="py-1 text-slate-850">{invoice.preparedBy || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Subject:</td>
                          <td className="py-1 text-slate-850 font-medium">{safeSubject || '-'}</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Due Date:</td>
                          <td className="py-1 text-red-650 font-medium font-mono">Upon Confirmation</td>
                        </tr>
                        <tr className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-semibold text-slate-500">Payment Status:</td>
                          <td className="py-1 font-medium text-slate-850">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                              invoice.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                              invoice.paymentStatus === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {invoice.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Products Table */}
              <div className="flex-1 overflow-hidden">
                <table className="col-table w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#1A3A5C] text-white">
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-left border border-slate-300 w-10">S.N.</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-left border border-slate-300 w-24">SKU / Item</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-left border border-slate-300">Description / الصنف Click To Edit</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-center border border-slate-300 w-16">Unit</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-right border border-slate-300 w-16">Qty</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-right border border-slate-300 w-24">Unit Price</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-right border border-slate-300 w-16">Disc</th>
                      <th className="px-3 py-2 text-[10px] uppercase font-bold text-right border border-slate-300 w-28">Total (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => {
                      const absoluteIndex = isFirst ? index + 1 : (pageIndex - 1) * 8 + (isFirst ? 0 : 5) + index;
                      const hasDiscount = item.discountAmt && item.discountAmt > 0;
                      return (
                        <tr key={index} className="odd:bg-white even:bg-slate-50/50">
                          <td className="px-3 py-2 border border-slate-200 text-center font-mono text-[11px] text-slate-500">{absoluteIndex}</td>
                          <td className="px-3 py-2 border border-slate-200 font-mono text-[11px] font-semibold text-slate-700">{item.product?.sku || 'MANUAL'}</td>
                          <td className="px-3 py-2 border border-slate-200 text-slate-800 leading-relaxed font-medium">
                            {item.product?.name}
                            {item.product?.brand && <span className="text-[10px] text-slate-400 block font-normal">Brand: {item.product.brand}</span>}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-center uppercase text-slate-500">{item.product?.unit || 'Pcs'}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-mono font-semibold text-slate-900">{item.qty}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-mono text-slate-600">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-mono text-slate-500">
                            {hasDiscount ? `${item.discountAmt}%` : '-'}
                          </td>
                          <td className="px-3 py-2 border border-slate-200 text-right font-mono font-bold text-slate-950">{formatCurrency(item.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Bottom Section (Only on Last Page) */}
            {isLast && (
              <div className="flex flex-col gap-4 border-t-2 border-slate-900 pt-3 pb-4">
                {/* Financial Summary and Bank Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Bank Details Container (8 Cols) */}
                  <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">Bank Details / المعاملات البنكية</h4>
                      <div className="space-y-1">
                        <p className="flex justify-between"><b className="text-slate-500 font-semibold text-[10px] uppercase">Bank Name:</b> <span className="font-bold text-slate-800">{appSettings?.bankName || 'National Bank of Ras Al Khaimah'}</span></p>
                        <p className="flex justify-between"><b className="text-slate-500 font-semibold text-[10px] uppercase">Account Name:</b> <span className="font-semibold text-slate-800">{appSettings?.accountName || 'Al Zahra Al Malakia Building Materials Trading L.L.C'}</span></p>
                        <p className="flex justify-between"><b className="text-slate-500 font-semibold text-[10px] uppercase">Account Number:</b> <span className="font-mono font-bold text-slate-950">{appSettings?.accountNumber || '83621 5391 5902'}</span></p>
                        <p className="flex justify-between"><b className="text-slate-500 font-semibold text-[10px] uppercase">IBAN Number:</b> <span className="font-mono font-bold text-blue-900">{appSettings?.iban || 'AE00000000000000000'}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Totals Box (5 Cols) */}
                  <div className="md:col-span-5 bg-slate-900 text-white rounded-lg p-3.5 text-xs flex flex-col justify-between shadow-md">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Subtotal / المجموع الفرعي:</span>
                        <span className="font-mono font-semibold text-slate-300">{formatCurrency(safeSubtotal)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between items-center text-red-400 font-medium">
                          <span>Discount / الخصم: ({discountPercentage}%):</span>
                          <span className="font-mono">{formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-slate-800 pt-1.5 text-slate-300 font-semibold">
                        <span>Net Total / المجموع الصافي:</span>
                        <span className="font-mono">{formatCurrency(netTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>VAT (5%) / ضريبة القيمة المضافة:</span>
                        <span className="font-mono">{formatCurrency(safeVatAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t-2 border-slate-700 pt-2 text-gold-accent font-bold text-sm">
                        <span className="text-[#C9A96E]">Grand Total / المجموع الكلي:</span>
                        <span className="font-mono text-[#C9A96E] text-base">{formatCurrency(safeGrandTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800 pt-1 text-xs text-slate-400 font-mono">
                        <span>Outstanding Balance:</span>
                        <span className="font-bold text-red-400">{formatCurrency(invoice.outstandingBalance || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                        <span>Paid Amount:</span>
                        <span className="font-bold text-emerald-400">{formatCurrency(invoice.paidAmount || 0)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Terms and Conditions */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-[10px] text-slate-600">
                  <h5 className="font-bold text-slate-800 mb-1 border-b border-slate-200 pb-0.5">Terms & Conditions / الشروط والأحكام</h5>
                  <p className="whitespace-pre-line leading-relaxed">
                    {appSettings?.defaultTerms || "Standard AZM Group Terms apply. Quotation subject to structural limits. 100% advance."}
                  </p>
                </div>

                {/* Stamp & Signatures */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="p-3 border border-dashed border-slate-300 text-center rounded-lg flex flex-col justify-between h-20">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Customer Acceptance</span>
                    <div className="h-0.5 bg-slate-400 w-32 mx-auto"></div>
                  </div>
                  
                  <div className="p-3 border border-dashed border-slate-300 text-center rounded-lg flex flex-col justify-between h-20 items-center justify-center relative">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Authorised Signature</span>
                    {appSettings?.companyStamp && appSettings.showStampInPdf && (
                      <img src={appSettings.companyStamp} alt="Company Stamp" className="absolute w-20 h-auto opacity-75 object-contain" style={{ bottom: '2px' }} />
                    )}
                    <div className="h-0.5 bg-slate-400 w-32 mx-auto z-10 w-full mb-1"></div>
                  </div>
                </div>

                {/* Footer Running Brands / Corporate */}
                {appSettings?.footerImage ? (
                  <img src={appSettings.footerImage} alt="Invoice Footer logo list" className="w-full h-auto mt-2 object-contain" />
                ) : (
                  <div className="flex justify-center flex-wrap gap-2 text-[9px] text-slate-400 uppercase tracking-wider font-semibold pt-2 border-t border-slate-100">
                    <span>Grohe</span><span>|</span><span>Jaquar</span><span>|</span><span>Kludi Rak</span><span>|</span><span>VitrA</span><span>|</span><span>Makita</span><span>|</span><span>Milano</span>
                  </div>
                )}

              </div>
            )}

            {/* Page Number */}
            <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-slate-400 font-memo">
              Page {pageIndex} of {totalPages}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
});

PrintInvoice.displayName = 'PrintInvoice';
