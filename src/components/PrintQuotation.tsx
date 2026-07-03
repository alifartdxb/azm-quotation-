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
  const safeSubtotal = quotation?.subtotal || 0;
  const discountPercentage = quotation?.discountPercentage || 0;
  const discountAmount = quotation?.discountAmount || 0;
  const netTotal = quotation?.netTotal || safeSubtotal;
  const safeVatAmount = quotation?.vatAmount || 0;
  const safeGrandTotal = quotation?.grandTotal || 0;
  const safeQuoteNo = quotation?.quoteNo || 'Draft';
  const safeSalesperson = quotation?.salesperson || 'Sabeer';
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
            className="block-page bg-white text-black px-[8mm] py-0 w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] flex flex-col justify-between shadow-lg relative print:shadow-none print:border-none print:m-0 print:px-[8mm] print:py-0"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Top Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
              
              {/* Header */}
              <div className="mb-4">
                {appSettings?.headerImage ? (
                  <img src={appSettings.headerImage} alt="Quotation Header" className="w-full h-auto mb-2 object-contain object-top" />
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
                  /* Subsequent Pages Running Header */
                  <div className="flex justify-between items-center border-b border-gray-300 pb-2 mb-4 text-[10px] text-gray-500 font-medium">
                    <span className="font-bold text-blue-800 uppercase tracking-wider">AL ZAHRA AL MALAKIA - Quotation</span>
                    <span>Quotation No: <span className="font-bold">{safeQuoteNo}</span></span>
                  </div>
                )}
              </div>

              {/* First Page Meta Tables */}
              {isFirst && (
                <div className="flex gap-4 mb-3 items-stretch">
                  {/* Customer Info */}
                  <div className="flex-1 flex flex-col">
                    <table className="w-full h-full border-collapse border border-gray-300 text-[12px]">
                      <thead>
                        <tr>
                          <th colSpan={2} className="bg-[#509AA3] text-white text-center py-1 uppercase tracking-widest font-bold text-[14px] rounded-t-sm">
                            CUSTOMER INFORMATION
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300 [&>tr>td]:py-0.25 [&>tr>td]:px-1.5 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                        <tr>
                          <td className="w-1/3 font-bold bg-slate-100">Company Name:</td>
                          <td className="font-bold text-gray-950">{safeCustomer.companyName || safeCustomer.customerName}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Contact Name:</td>
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
                          <td className="font-bold bg-slate-100">Customer TRN:</td>
                          <td>{safeCustomer.trn}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100 rounded-bl-sm">Reference:</td>
                          <td className="rounded-br-sm">{safeCustomer.reference}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Quotation Info */}
                  <div className="w-[35%] flex flex-col">
                    <table className="w-full h-full border-collapse border border-gray-300 text-[12px]">
                      <thead>
                        <tr>
                          <th colSpan={2} className="bg-[#509AA3] text-white text-center py-1 uppercase tracking-widest font-bold text-[14px] rounded-t-sm">
                            QUOTATION DETAILS
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300 [&>tr>td]:py-0.25 [&>tr>td]:px-1.5 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                        <tr>
                          <td className="w-1/3 font-bold bg-slate-100 text-[12px] text-[#1a3a5c] py-0.5">No.:</td>
                          <td className="font-bold text-[12px] text-[#1a3a5c] py-0.5">{safeQuoteNo}</td>
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
                          <td>{appSettings?.trn || '1002 5994 2900 003'}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100">Salesperson:</td>
                          <td>{safeSalesperson}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-slate-100 rounded-bl-sm">Prepared By:</td>
                          <td className="rounded-br-sm">{quotation?.preparedBy || 'Rukaiya'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Items Table for this specific page */}
              <table className="w-full border-collapse border border-gray-300 text-center text-[11px] mb-0">
                <thead>
                  <tr className="bg-[#509AA3] text-white border-b border-gray-300 [&>th]:py-1 [&>th]:px-1.5 [&>th]:border-x [&>th]:border-white/20 [&>th]:font-semibold text-[11px]">
                    <th className="w-[7%] text-center whitespace-nowrap px-1">Sr. No.</th>
                    <th className="text-left w-[30%]">Item Description</th>
                    <th className="w-[12%] text-center">Picture</th>
                    <th className="w-[10%] text-center">Qty</th>
                    <th className="w-[10%] text-center">Unit</th>
                    <th className="text-right w-[14%] whitespace-nowrap px-1">Unit Price (AED)</th>
                    <th className="text-right w-[17%] whitespace-nowrap px-1">Total Amount (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 [&>tr>td]:py-1 [&>tr>td]:px-1.5 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                  {items.map((item) => {
                    const globalIndex = safeItems.indexOf(item);
                    const srNo = globalIndex + 1;
                    const imgUrl = (preloadedImages && item.id && preloadedImages[item.id]) || (preloadedImages && item.product?.sku && preloadedImages[item.product.sku]) || item.product?.image;

                    return (
                      <tr key={`item-${globalIndex}`} className="page-break-inside-avoid">
                        <td className="text-center">{srNo}</td>
                        <td className="text-left">
                          {item.productId !== 'MANUAL' && (
                            <div className="font-bold text-gray-800">{item.product?.sku || ''}</div>
                          )}
                          <div className={`text-gray-600 text-[10px] leading-tight ${item.productId === 'MANUAL' ? 'font-bold mt-0' : 'mt-0.5'}`}>
                            {item.product?.name || (item.productId === 'MANUAL' ? 'Manual Item' : '')}
                          </div>
                        </td>
                        <td className="p-0.5 text-center">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.product?.sku || 'Item'}
                              className="w-8 h-8 object-contain m-auto"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 m-auto text-gray-400 text-[9px] flex items-center justify-center">No Img</div>
                          )}
                        </td>
                        <td className="text-center">{item.qty}</td>
                        <td className="text-center">{item.product?.unit || 'Pcs'}</td>
                        <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Bank Details & Totals touching the items table with zero gap */}
              {isLast && (
                <div className="flex justify-between items-stretch mt-0 mb-1 gap-4 w-full">
                  {/* Bank Details */}
                  <div className="flex-1 text-[10px] leading-tight text-gray-800 border border-gray-300 border-t-0 p-1.5 flex flex-col justify-center bg-slate-50/50">
                    <h4 className="font-bold uppercase text-gray-900 border-b border-gray-100 pb-0.5 text-[9px]">Bank Details:</h4>
                    <div className="space-y-0.5 mt-1">
                      <p><span className="font-semibold">Bank Name:</span> {appSettings?.bankName || 'Dubai Islamic Bank'}</p>
                      <p><span className="font-semibold">AccountName:</span> {appSettings?.accountName || 'AZM Group LLC'}</p>
                      <p><span className="font-semibold">Account Number:</span> {appSettings?.accountNumber || '0000000000000000'}</p>
                      <p><span className="font-semibold">IBAN Number:</span> {appSettings?.iban || 'AE0000000000000000'}</p>
                    </div>
                  </div>

                  {/* Totals Table */}
                  <div className="w-[31%] shrink-0">
                    <table className="w-full border-collapse border border-gray-300 border-t-0 text-right text-[11px]" style={{ tableLayout: 'fixed' }}>
                      <tbody className="divide-y divide-gray-300 [&>tr>td]:p-0.75 [&>tr>td]:border-x [&>tr>td]:border-gray-300 truncate">
                        <tr>
                          <td className="font-bold bg-slate-50 border-r border-gray-300 text-right pr-2" style={{ width: '45.16%' }}>Sub Total</td>
                          <td className="font-bold pr-1">{formatCurrency(safeSubtotal)}</td>
                        </tr>
                        {!!(discountPercentage && discountPercentage > 0) && (
                          <>
                            <tr>
                              <td className="text-gray-600 text-right pr-2">Discount ({discountPercentage}%)</td>
                              <td className="text-emerald-700 font-medium pr-1">-{formatCurrency(discountAmount)}</td>
                            </tr>
                            <tr>
                              <td className="font-bold text-right pr-2">Net Total</td>
                              <td className="font-bold pr-1">{formatCurrency(netTotal)}</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td className="font-bold bg-slate-100 text-right pr-2">VAT 5%</td>
                          <td className="bg-slate-100 font-medium pr-1">{formatCurrency(safeVatAmount)}</td>
                        </tr>
                        <tr>
                          <td className="font-bold bg-blue-800 text-white text-right pr-2">Grand Total</td>
                          <td className="font-bold bg-slate-100 text-blue-800 text-[11px] pr-1">{formatCurrency(safeGrandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                  {/* Terms and Signatures row */}
                  <div className="flex justify-between items-end mb-2 mt-3">
                    {/* Terms */}
                    <div className="w-[50%]">
                      <h4 className="font-bold text-[10px] text-gray-950 mb-1">Terms & Conditions:</h4>
                      <ol className="list-decimal list-inside text-[9px] text-gray-800 space-y-0.5 leading-tight">
                        {appSettings?.defaultTerms 
                          ? appSettings.defaultTerms.split('\n').filter((t: string) => t.trim() !== '').map((term: string, idx: number) => (
                              <li key={idx}>{term}</li>
                            ))
                          : (
                            <>
                              <li>The above prices are in Dirhams (AED) quoted based on the quantities requested.</li>
                              <li>Payment Terms 100% advance against order confirmation.</li>
                              <li>Delivery time to be confirmed upon order confirmation.</li>
                              <li>Local delivery charges are not included within this quotation.</li>
                              <li>Customized items eg. counter tops/vanity cannot be cancelled or exchanged after confirmation.</li>
                            </>
                          )
                        }
                      </ol>
                      
                      <div className="mt-10 border-t border-black w-48 sm:mx-0"></div>
                      <div className="mt-1 font-semibold text-[10px]">
                        Customer's Signature
                      </div>
                    </div>

                    {/* Authorized signature & Stamp */}
                    <div className="w-[45%] flex flex-col items-center justify-end">
                      <div className="relative min-h-[40px] w-full flex items-center justify-center mb-1">
                        {appSettings?.companyStamp && appSettings?.showStampInPreview !== false && (!appSettings?.showStampOnLastPageOnly || isLast) ? (
                          <img 
                            src={appSettings.companyStamp} 
                            alt="Company Stamp" 
                            className="h-auto max-h-16 w-full max-w-[140px] object-contain mix-blend-multiply opacity-90"
                          />
                        ) : (
                          <div className="w-12 h-12 border border-[#509AA3]/20 rounded-full flex items-center justify-center text-[#509AA3]/20 rotate-[-15deg] font-semibold text-[6px] opacity-40">
                            COMPANY STAMP
                          </div>
                        )}
                      </div>

                      <div className="border-t border-black w-48 max-w-[90%]"></div>
                      <div className="mt-1 font-semibold text-[10px] text-center w-full">
                        Authorised Signature
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Content on All Pages */}
              <div className="mt-auto">
                {appSettings?.footerImage ? (
                  <div className="pt-2 mt-2">
                     <img src={appSettings.footerImage} alt="Quotation Footer" className="w-full h-auto object-contain object-bottom" />
                  </div>
                ) : (
                  <div className="pt-1.5 mt-2 border-t border-blue-800 flex justify-between text-[9px] font-bold text-slate-800/80 uppercase tracking-wider">
                    <div>VADO</div>
                    <div>Jaquar</div>
                    <div>ITALIAN STANDARDS</div>
                    <div>NOURK</div>
                    <div>SANIT</div>
                    <div>KLUDI RAK</div>
                    <div>SONET</div>
                  </div>
                )}
              </div>

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
