import React from 'react';
import type { Quotation, QuoteItem } from '../types';
import { formatCurrency, parseDate } from '../lib/utils';
import { format } from 'date-fns';

interface Props {
  quotation: Quotation;
  preloadedImages?: Record<string, string>;
  appSettings?: any;
}

interface PageData {
  items: QuoteItem[];
  pageIndex: number;
  isFirst: boolean;
  isLast: boolean;
}

// Deterministic partitioning of quotation items into pages
// to prevent vertical cutoffs when printing or saving as PDF.
const partitionItems = (items: QuoteItem[]): PageData[] => {
  if (items.length === 0) {
    return [{
      items: [],
      pageIndex: 1,
      isFirst: true,
      isLast: true
    }];
  }

  // Guidelines for item capacities per page to fit on standard A4 layout:
  // - Single page: fits up to 3 items comfortably along with header, meta-tables, totals, stamp, and signature sections.
  // - Multi-page:
  //   - Page 1: fits up to 5 items (since it contains the main Letterhead Header + Customer Meta Tables)
  //   - Page Middle: fits up to 8 items (only containing running header)
  //   - Page Last: fits up to 4 items (leaving enough room for bank details, totals table, signatures, stamps, brands)
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

  // Fallback to ensure the last page flag is marked appropriately
  if (pages.length > 0) {
    pages[pages.length - 1].isLast = true;
  }

  return pages;
};

export const PrintQuotation = React.forwardRef<HTMLDivElement, Props>(({ quotation, preloadedImages, appSettings }, ref) => {
  const safeCustomer = quotation?.customer || {
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

  const safeItems = quotation?.items || [];
  const safeSubTotal = quotation?.subTotal || 0;
  const safeVatAmount = quotation?.vatAmount || 0;
  const safeGrandTotal = quotation?.grandTotal || 0;
  const safeQuoteNo = quotation?.quoteNo || 'Draft';
  const safeSalesperson = quotation?.salesperson || 'Ahmed Abdullah';
  const safeValidityDays = quotation?.validityDays || 10;
  const safeSubject = quotation?.subject || '';

  const pages = partitionItems(safeItems);
  const totalPages = pages.length;

  return (
    <div ref={ref} className="bg-slate-200/50 p-2 sm:p-6 lg:p-8 flex flex-col items-center gap-6 no-print w-full min-w-[210mm] max-w-[210mm]">
      {/* Target wrapper style for both print layouts and on-screen renders */}
      <div className="print:m-0 print:p-0 flex flex-col gap-8 w-full">
        {pages.map(({ items, pageIndex, isFirst, isLast }) => (
          <div
            key={pageIndex}
            id={`quotation-page-${pageIndex}`}
            className="block-page bg-white text-black p-[15mm] w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] flex flex-col justify-between shadow-lg relative print:shadow-none print:border-none print:m-0 print:p-[15mm]"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Top Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
              
              {/* First Page Premium Header */}
              {isFirst ? (
                <div className="mb-4">
                  <div className="flex justify-between items-center bg-blue-50 rounded-lg border-2 border-blue-800 p-3 mb-2">
                    <div className="flex-1">
                      <h1 className="text-2xl font-serif font-bold text-blue-800 leading-tight">Al Zahra Al Malakia</h1>
                      <h2 className="text-lg font-serif font-semibold text-blue-800">Building Materials Trading L.L.C</h2>
                    </div>
                    <div className="px-4">
                      <div className="w-16 h-16 border-[3px] border-blue-800 rotate-45 flex items-center justify-center bg-white rounded-sm">
                        <span className="text-blue-800 font-bold -rotate-45 text-2xl font-serif">AZ</span>
                      </div>
                    </div>
                    <div className="flex-1 text-right font-arabic">
                      <h1 className="text-3xl font-bold text-blue-800 leading-tight">الزهــرة المـلـكـيـة</h1>
                      <h2 className="text-xl font-bold text-blue-800 mt-1">لتـــجــارة مــواد الـبــنــاء ذ.م.م</h2>
                    </div>
                  </div>
                  <div className="text-center text-blue-800 text-[11px] font-medium">
                    Tel: +971 4 28 444 52 | Add.: Shop No. 12, Building Materials Mall, Dubai, U.A.E | Email: office@alzahrabm.com
                  </div>
                </div>
              ) : (
                /* Subsequent Pages Running Header */
                <div className="flex justify-between items-center border-b border-gray-300 pb-2 mb-4 text-[10px] text-gray-500 font-medium">
                  <span className="font-bold text-blue-800 uppercase tracking-wider">AL ZAHRA AL MALAKIA - Quotation</span>
                  <span>Quotation No: <span className="font-bold">{safeQuoteNo}</span></span>
                </div>
              )}

              {/* First Page Meta Tables */}
              {isFirst && (
                <div className="flex gap-4 mb-4 items-stretch">
                  {/* Customer Info */}
                  <div className="flex-1 flex flex-col">
                    <table className="w-full h-full border-collapse border border-gray-300 text-[11px]">
                      <thead>
                        <tr>
                          <th colSpan={2} className="bg-[#1e8d98] text-white text-center py-1 uppercase tracking-widest font-semibold text-xs rounded-t-lg">
                            Customer Info
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300 [&>tr>td]:p-1 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                        <tr>
                          <td className="w-1/3 font-bold bg-slate-100">Customer Name:</td>
                          <td>{safeCustomer.customerName}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Contact No.:</td>
                          <td>{safeCustomer.mobile}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Email:</td>
                          <td>{safeCustomer.email}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Address:</td>
                          <td>{safeCustomer.address}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Subject:</td>
                          <td>{safeSubject}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100 rounded-bl-lg">Customer TRN:</td>
                          <td className="rounded-br-lg">{safeCustomer.trn}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Quotation Info */}
                  <div className="w-[35%] flex flex-col">
                    <table className="w-full h-full border-collapse border border-gray-300 text-[11px]">
                      <thead>
                        <tr>
                          <th colSpan={2} className="bg-blue-800 text-white text-center py-1 uppercase tracking-widest font-semibold text-xs rounded-t-lg">
                            Quotation
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300 [&>tr>td]:p-1 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                        <tr>
                          <td className="w-1/3 font-bold bg-slate-100">No.:</td>
                          <td className="font-bold">{safeQuoteNo}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Date:</td>
                          <td>{format(parseDate(quotation?.createdAt), 'dd MMM yyyy')}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Validity:</td>
                          <td>{safeValidityDays} Days</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">TRN:</td>
                          <td>1002 5994 2900 003</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100 rounded-bl-lg">Salesperson:</td>
                          <td className="rounded-br-lg">{safeSalesperson}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Items Table for this specific page */}
              <table className="w-full border-collapse border border-gray-300 text-center text-[11px] mb-2">
                <thead>
                  <tr className="bg-slate-100 border-b border-gray-300 [&>th]:p-1.5 [&>th]:border-x [&>th]:border-gray-300 [&>th]:font-semibold text-[11px]">
                    <th className="w-[6%]">Sr. No.</th>
                    <th className="text-left w-[44%]">Item Description</th>
                    <th className="w-[14%]">Picture</th>
                    <th className="w-[8%]">Qty</th>
                    <th className="w-[8%]">Unit</th>
                    <th className="text-right w-[10%]">Unit Price</th>
                    <th className="text-right w-[10%]">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 [&>tr>td]:p-1.5 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                  {items.map((item) => {
                    const globalIndex = safeItems.indexOf(item);
                    const srNo = globalIndex + 1;
                    const imgUrl = (preloadedImages && item.product?.sku && preloadedImages[item.product.sku]) || item.product?.image;

                    return (
                      <tr key={item.id} className="page-break-inside-avoid">
                        <td>{srNo}</td>
                        <td className="text-left">
                          <div className="font-bold text-gray-800">{item.product?.sku || ''}</div>
                          <div className="text-gray-600 text-[10px] leading-tight mt-0.5">{item.product?.name || ''}</div>
                        </td>
                        <td className="p-0.5">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.product?.sku || 'Item'}
                              className="w-12 h-12 object-contain m-auto"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 m-auto text-gray-400 text-[9px] flex items-center justify-center">No Img</div>
                          )}
                        </td>
                        <td>{item.qty}</td>
                        <td>{item.product?.unit || 'Pcs'}</td>
                        <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Content Area (pushed to exact bottom of standard A4 container) */}
            <div className="mt-auto">
              {/* "Continued on next page" alert for non-last pages */}
              {!isLast && (
                <div className="text-right text-[10px] text-gray-500 font-semibold italic mb-2 py-1 border-t border-dashed border-gray-300">
                  Continued on next page...
                </div>
              )}

              {/* Last Page Totals, Terms, Stamp, Signature, Brands */}
              {isLast && (
                <div className="w-full">
                  {/* Bank Details & Totals */}
                  <div className="flex gap-4 mb-2 mt-2 items-stretch">
                    {/* Bank Details */}
                    <div className="flex-1 text-[10px] leading-tight text-gray-800">
                      <h4 className="font-bold uppercase text-gray-900 mb-1 border-b border-gray-100 pb-0.5">Bank Details:</h4>
                      <div className="space-y-0.5">
                        <p><span className="font-semibold">Bank Name:</span> {appSettings?.bankName || 'Dubai Islamic Bank'}</p>
                        <p><span className="font-semibold">AccountName:</span> {appSettings?.accountName || 'AZM Group LLC'}</p>
                        <p><span className="font-semibold">Account Number:</span> {appSettings?.accountNumber || '0000000000000000'}</p>
                        <p><span className="font-semibold">IBAN Number:</span> {appSettings?.iban || 'AE0000000000000000'}</p>
                      </div>
                    </div>

                    {/* Totals Table */}
                    <div className="w-[35%]">
                      <table className="w-full border-collapse border border-gray-300 text-right text-[11px]">
                        <tbody className="divide-y divide-gray-300 [&>tr>td]:p-1 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                          <tr>
                            <td className="font-bold w-1/2">Sub Total</td>
                            <td className="font-bold">{formatCurrency(safeSubTotal)}</td>
                          </tr>
                          <tr>
                            <td className="font-bold bg-slate-100">VAT 5%</td>
                            <td className="bg-slate-100 font-medium">{formatCurrency(safeVatAmount)}</td>
                          </tr>
                          <tr>
                            <td className="font-bold bg-blue-800 text-white">Grand Total</td>
                            <td className="font-bold bg-slate-100 text-blue-800 text-xs">{formatCurrency(safeGrandTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Terms and Signatures row */}
                  <div className="flex justify-between items-end mb-2 mt-2">
                    {/* Terms */}
                    <div className="w-[58%]">
                      <h4 className="font-bold text-[10px] text-gray-950 mb-1">Terms & Conditions:</h4>
                      <ol className="list-decimal list-inside text-[9px] text-gray-800 space-y-0.5 leading-tight">
                        <li>The above prices are in Dirhams (AED) quoted based on the quantities requested.</li>
                        <li>Payment Terms 100% advance against order confirmation.</li>
                        <li>Delivery time to be confirmed upon order confirmation.</li>
                        <li>Local delivery charges are not included within this quotation.</li>
                        <li>Customized items eg. counter tops/vanity cannot be cancelled or exchanged after confirmation.</li>
                      </ol>
                      <div className="mt-4 border-t border-black w-40 pt-1 font-semibold text-center text-[10px]">
                        Customer's Signature
                      </div>
                    </div>

                    {/* Authorized signature & Stamp */}
                    <div className="w-[38%] text-center">
                      <div className="text-[9px] mb-1 leading-tight text-gray-700">
                        <span className="italic">For</span> <span className="font-bold text-blue-800 text-[10px]">AL ZAHRA AL MALAKIA</span><br />
                        Building Materials Trading LLC
                      </div>
                      <div className="relative h-14 flex items-center justify-center">
                        <div className="w-16 h-16 border border-blue-800/20 rounded-full flex items-center justify-center text-blue-800/20 rotate-[-15deg] font-semibold text-[8px] absolute opacity-40">
                          COMPANY STAMP
                        </div>
                      </div>
                      <div className="border-t border-black w-full pt-1 font-semibold text-[10px] mt-1">
                        Authorised Signature
                      </div>
                    </div>
                  </div>

                  {/* Top Quality Brands footer */}
                  <div className="pt-1.5 mt-2 border-t border-blue-800 flex justify-between text-[9px] font-bold text-slate-800/80 uppercase tracking-wider">
                    <div>VADO</div>
                    <div>Jaquar</div>
                    <div>ITALIAN STANDARDS</div>
                    <div>NOURK</div>
                    <div>SANIT</div>
                    <div>KLUDI RAK</div>
                    <div>SONET</div>
                  </div>
                </div>
              )}

              {/* Absolute Page Numbering */}
              <div className="flex justify-between items-center text-[9px] text-gray-400 font-medium pt-1 mt-1 border-t border-gray-100">
                <span>Printed on {format(new Date(), 'dd MMM yyyy HH:mm')}</span>
                <span>Page {pageIndex} of {totalPages}</span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
});

PrintQuotation.displayName = 'PrintQuotation';
