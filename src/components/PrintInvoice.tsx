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

  if (items.length <= 10) {
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
  const firstPageItems = currentItems.splice(0, 10);
  pages.push({
    items: firstPageItems,
    pageIndex: pageNum++,
    isFirst: true,
    isLast: currentItems.length === 0
  });

  // Middle/Last page layout
  while (currentItems.length > 0) {
    if (currentItems.length <= 12) {
      pages.push({
        items: currentItems.splice(0, 12),
        pageIndex: pageNum++,
        isFirst: false,
        isLast: true
      });
    } else {
      const takeCount = Math.min(15, currentItems.length);
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
  const safeDueDate = invoice?.createdAt ? format(new Date(new Date(invoice.createdAt).getTime() + (appSettings?.defaultValidity || 30) * 24 * 60 * 60 * 1000), 'dd MMM yyyy') : 'Current Date';
  const safeSubject = invoice?.subject || '';
  const safePaymentStatus = invoice?.paymentStatus || 'Unpaid';

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
            <div className="flex flex-col flex-1 overflow-hidden">
              
              {/* Header */}
              <div className="mb-4 pt-4">
                {appSettings?.headerImage ? (
                  <img src={appSettings.headerImage} alt="Invoice Header" className="w-full h-auto mb-2 object-contain object-top" />
                ) : (
                  <>
                    <div className="flex justify-between items-center bg-[#E9F3F6] p-3 mb-2">
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold text-[#53909A] leading-tight whitespace-pre-line">
                          {appSettings?.companyNameEn || 'Al Zahra Al Malakia\nBuilding Materials Trading L.L.C'}
                        </h1>
                      </div>
                      <div className="px-4 shrink-0">
                        <div className="w-14 h-20 border border-[#53909A] flex items-center justify-center bg-white rounded-sm">
                          <span className="text-[#1A3A5C] font-bold text-2xl font-sans">AZM</span>
                        </div>
                      </div>
                      <div className="flex-1 text-right font-arabic">
                        <h1 className="text-2xl font-bold text-[#53909A] leading-tight whitespace-pre-line">
                          {appSettings?.companyNameAr || 'الزهرة الملكية\nلتجارة مواد البناء ذ.م.م'}
                        </h1>
                      </div>
                    </div>
                    <div className="text-center text-[#53909A] text-[12px] font-medium tracking-wide">
                      Tel: {appSettings?.phone || '+971 4 28 444 52'} | Add.: {appSettings?.address || 'Shop No. 12, Building Materials Mall, Dubai, U.A.E'} | Email: office@alzahrabm.com
                    </div>
                  </>
                )}
              </div>

              {/* Information Tables - Only on first page */}
              {isFirst && (
                <div className="flex gap-[12mm] mb-4">
                  {/* Left Column: Customer Details */}
                  <div className="flex-1">
                    <div className="bg-[#509E9F] text-white text-center font-bold py-1.5 px-2 text-[14px]">
                      CUSTOMER INFORMATION
                    </div>
                    <table className="w-full border-collapse text-[12px]">
                      <tbody>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] w-32 border-r border-slate-200">Customer Name:</td>
                          <td className="p-2 font-bold">{safeCustomer.companyName || safeCustomer.customerName || '-'}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Contact No.:</td>
                          <td className="p-2">{safeCustomer.mobile || '-'}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Address:</td>
                          <td className="p-2">{safeCustomer.address || '-'}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">L.P.O NO.</td>
                          <td className="p-2">{safeCustomer.reference || '-'}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Subject:</td>
                          <td className="p-2">{safeSubject || '-'}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Customer TRN:</td>
                          <td className="p-2">{safeCustomer.trn || '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right Column: Invoice Details */}
                  <div className="flex-1">
                    <div className="bg-[#509E9F] text-white text-center font-bold py-1.5 px-2 text-[14px]">
                      TAX INVOICE
                    </div>
                    <table className="w-full border-collapse text-[12px]">
                      <tbody>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] w-28 border-r border-slate-200 text-[#1A3A5C]">No.:</td>
                          <td className="p-2 font-bold text-[#1A3A5C] text-[14px]">{safeInvoiceNo}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Date:</td>
                          <td className="p-2">{invoice.createdAt ? format(parseDate(invoice.createdAt), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Due Date:</td>
                          <td className="p-2">{safeDueDate}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">TRN:</td>
                          <td className="p-2">{appSettings?.trn || '1002 5994 2900 003'}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Salesperson:</td>
                          <td className="p-2">{safeSalesperson}</td>
                        </tr>
                        <tr className="border border-slate-200">
                          <td className="p-2 font-bold bg-[#F8FAFC] border-r border-slate-200">Payment Status:</td>
                          <td className="p-2">{safePaymentStatus}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Products Table */}
              <div className="flex-1 overflow-hidden mt-2">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#509E9F] text-white">
                      <th className="px-2 py-1.5 text-center border border-slate-300 w-12 font-bold">Sr.<br/>No.</th>
                      <th className="px-2 py-1.5 text-center border border-slate-300 font-bold">Item Description</th>
                      <th className="px-2 py-1.5 text-center border border-slate-300 w-16 font-bold">Qty</th>
                      <th className="px-2 py-1.5 text-center border border-slate-300 w-16 font-bold">Unit</th>
                      <th className="px-2 py-1.5 text-center border border-slate-300 w-28 font-bold">Unit Price<br/>(AED)</th>
                      <th className="px-2 py-1.5 text-center border border-slate-300 w-32 font-bold">Total Amount<br/>(AED)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const globalIdx = invoice.items?.findIndex(i => i.id === item.id) ?? idx;
                      let itemDesc = '';
                      if (item.productId === 'MANUAL') {
                        itemDesc = item.product?.name || 'Manual Item';
                      } else {
                        itemDesc = `${item.product?.sku || ''}\n${item.product?.name || ''}`;
                      }

                      return (
                        <tr key={item.id || idx} className="border-b border-slate-200">
                          <td className="px-2 py-1.5 text-center border-l border-r border-slate-200">{globalIdx + 1}</td>
                          <td className="px-2 py-1.5 border-r border-slate-200 whitespace-pre-line">{itemDesc}</td>
                          <td className="px-2 py-1.5 text-center border-r border-slate-200">{item.qty}</td>
                          <td className="px-2 py-1.5 text-center border-r border-slate-200">{item.product?.unit || 'Pcs'}</td>
                          <td className="px-2 py-1.5 text-right border-r border-slate-200">{formatCurrency(item.unitPrice || 0)}</td>
                          <td className="px-2 py-1.5 text-right border-r border-slate-200">{formatCurrency(item.total || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Content Area */}
            <div>
              {/* Only show Totals and Signatures on the last page */}
              {isLast ? (
                <div className="mt-0 flex flex-col gap-6">
                  {/* Bank Details & Totals Row */}
                  <div className="flex gap-[12mm]">
                    {/* Left: Bank Details */}
                    <div className="flex-1 border border-slate-200 border-t-0 p-3 h-fit bg-slate-50/50">
                      <h3 className="font-bold text-[12px] mb-1">Bank Details:</h3>
                      <table className="w-full text-[10px]">
                        <tbody>
                          <tr>
                            <td className="py-0.5 w-24">Bank Name:</td>
                            <td className="py-0.5 font-bold">{appSettings?.bankName || "National Bank Of Ras Al Khaimah"}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5">Account Name:</td>
                            <td className="py-0.5 font-bold">{appSettings?.accountName || "Al Zahra Al Malakia Building Materials Trading L.L.C."}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5">Account Number:</td>
                            <td className="py-0.5 font-bold">{appSettings?.accountNumber || "83621 5391 5902"}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5">IBAN Number:</td>
                            <td className="py-0.5 font-bold">{appSettings?.iban || "AE39 0400 0083 6215 3915 902"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Right: Totals */}
                    <div className="w-64 flex-shrink-0">
                      <table className="w-full text-[12px] border-collapse border-t-0">
                        <tbody className="[&>tr>td]:border-t-0">
                          <tr className="border border-slate-200 bg-[#F8FAFC]">
                            <td className="py-2 px-3 font-bold text-right border-r border-slate-200">Sub Total</td>
                            <td className="py-2 px-3 font-bold text-right w-28">{formatCurrency(safeSubtotal)}</td>
                          </tr>
                          {discountPercentage > 0 && (
                            <>
                              <tr className="border border-slate-200 bg-[#F8FAFC]">
                                <td className="py-2 px-3 font-bold text-right border-r border-slate-200">Discount ({discountPercentage}%)</td>
                                <td className="py-2 px-3 font-bold text-right text-emerald-600">-{formatCurrency(discountAmount)}</td>
                              </tr>
                              <tr className="border border-slate-200 bg-[#F8FAFC]">
                                <td className="py-2 px-3 font-bold text-right border-r border-slate-200">Net Total</td>
                                <td className="py-2 px-3 font-bold text-right text-[#1A3A5C]">{formatCurrency(netTotal)}</td>
                              </tr>
                            </>
                          )}
                          <tr className="border border-slate-200 bg-[#F8FAFC]">
                            <td className="py-2 px-3 font-bold text-right border-r border-slate-200 text-[#1A3A5C]">VAT 5%</td>
                            <td className="py-2 px-3 font-bold text-right text-[#1A3A5C]">{formatCurrency(safeVatAmount)}</td>
                          </tr>
                          <tr className="border border-[#509E9F] bg-[#509E9F] text-white">
                            <td className="py-2 px-3 font-bold text-right border-r border-[#509E9F]">Grand Total</td>
                            <td className="py-2 px-3 font-bold text-right">{formatCurrency(safeGrandTotal)}</td>
                          </tr>
                          <tr className="border border-green-200 bg-green-50 text-green-800">
                            <td className="py-2 px-3 font-bold text-right border-r border-green-200">Paid Amount</td>
                            <td className="py-2 px-3 font-bold text-right">{formatCurrency(invoice?.paidAmount || 0)}</td>
                          </tr>
                          <tr className="border border-red-200 bg-red-50 text-red-700">
                            <td className="py-2 px-3 font-bold text-right border-r border-red-200">Due Amount</td>
                            <td className="py-2 px-3 font-bold text-right">{formatCurrency(invoice?.outstandingBalance || Math.max(0, safeGrandTotal - (invoice?.paidAmount || 0)))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Declaration */}
                  <div className="text-[12px] mt-2">
                    <p className="font-normal whitespace-pre-line text-[#1A1A1A]">
                      {appSettings?.invoiceDeclaration || "Declaration\nWe declare that this invoice shows the actual price of the goods\ndescribed and that all particulars are true and correct.\nReceived the above goods in good order and condition"}
                    </p>
                  </div>

                  {/* Signatures */}
                  <div className="flex justify-between items-end mt-16 px-4">
                    <div className="w-48 border-t border-slate-300 pt-2 text-center text-[12px] text-[#1A1A1A]">
                      Customer's Signature
                    </div>
                    <div className="w-48 text-center relative">
                      {appSettings?.companyStamp && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 mix-blend-multiply opacity-90">
                          <img src={appSettings.companyStamp} alt="Company Stamp" className="w-32 h-auto" />
                        </div>
                      )}
                      <div className="border-t border-slate-300 pt-2 text-[12px] text-[#1A1A1A]">
                        Authorised Signature
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-4"></div>
              )}

              {/* Footer */}
              <div className="mt-8 pb-4">
                {appSettings?.footerImage ? (
                  <img src={appSettings.footerImage} alt="Invoice Footer" className="w-full h-auto object-contain object-bottom" />
                ) : (
                  <>
                    <div className="flex justify-between px-2 mb-3">
                      <span className="text-[#1A3A5C] font-bold text-[12px]">VADO</span>
                      <span className="text-[#1A3A5C] font-bold text-[12px] italic">jaquar</span>
                      <span className="text-[#1A3A5C] font-bold text-[12px]">ITALIAN STANDARDS</span>
                      <span className="text-[#1A3A5C] font-bold text-[12px]">NOURK</span>
                      <span className="text-[#1A3A5C] font-bold text-[12px]">SANIT</span>
                      <span className="text-[#1A3A5C] font-bold text-[12px]">KLUDI RAK</span>
                      <span className="text-[#1A3A5C] font-bold text-[12px]">SONET</span>
                    </div>
                    <div className="h-10 bg-[#1A3A5C] relative flex items-center justify-between px-4">
                      <div className="absolute left-0 top-0 bottom-0 w-20 bg-[#53909A]" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' }}></div>
                      <div className="z-10 text-white font-bold text-[12px]">www.alzahrabm.com</div>
                      <div className="z-10 text-white font-bold text-[12px]">Empowering Projects. Shaping spaces.</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

PrintInvoice.displayName = 'PrintInvoice';
