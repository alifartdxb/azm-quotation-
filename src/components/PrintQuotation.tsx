import React from 'react';
import type { Quotation } from '../types';
import { formatCurrency, parseDate } from '../lib/utils';
import { format } from 'date-fns';

interface Props {
  quotation: Quotation;
}

export const PrintQuotation = React.forwardRef<HTMLDivElement, Props>(({ quotation }, ref) => {
  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm] text-[12px] font-sans">
      
      {/* Header */}
      <div className="mb-6">
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
        <div className="text-center text-blue-800 text-sm font-medium">
          Tel: +971 4 28 444 52 | Add.: Shop No. 12, Building Materials Mall, Dubai, U.A.E | Email: office@alzahrabm.com
        </div>
      </div>

      {/* Meta Tables */}
      <div className="flex gap-4 mb-6">
        {/* Customer Info */}
        <div className="flex-1">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th colSpan={2} className="bg-[#1e8d98] text-white text-center py-1.5 uppercase tracking-widest text-sm rounded-t-lg">
                  Customer Info
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 [&>tr>td]:p-1.5 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
              <tr>
                <td className="w-1/3 font-bold bg-slate-100">Company Name:</td>
                <td>{quotation.customer?.companyName}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Customer Name:</td>
                <td>{quotation.customer?.customerName}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Contact Person:</td>
                <td>{quotation.customer?.contactPerson}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Contact No.:</td>
                <td>{quotation.customer?.mobile}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Email:</td>
                <td>{quotation.customer?.email}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Project Name:</td>
                <td>{quotation.customer?.projectName}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Site Location:</td>
                <td>{quotation.customer?.siteLocation}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Address:</td>
                <td>{quotation.customer?.address}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Subject:</td>
                <td>{quotation.subject}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100 rounded-bl-lg">Customer TRN:</td>
                <td className="rounded-br-lg">{quotation.customer?.trn}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Quotation Info */}
        <div className="w-[35%]">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th colSpan={2} className="bg-blue-800 text-white text-center py-1.5 uppercase tracking-widest text-sm rounded-t-lg">
                  Quotation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300 [&>tr>td]:p-1.5 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
              <tr>
                <td className="w-1/3 font-bold bg-slate-100">No.:</td>
                <td className="font-bold">{quotation.quoteNo}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Date:</td>
                <td>{format(parseDate(quotation.createdAt), 'dd MMM yyyy')}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Validity:</td>
                <td>{quotation.validityDays} Days</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">TRN:</td>
                <td>1002 5994 2900 003</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100">Reference:</td>
                <td>{quotation.customer?.reference}</td>
              </tr>
              <tr>
                <td className="font-bold bg-slate-100 rounded-bl-lg">Salesperson:</td>
                <td className="rounded-br-lg">{quotation.salesperson}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-gray-300 mb-6 text-center">
        <thead>
          <tr className="bg-slate-100 border-b border-gray-300 [&>th]:p-2 [&>th]:border-x [&>th]:border-gray-300 [&>th]:font-bold text-sm">
            <th className="w-12">Sr. No.</th>
            <th className="text-left w-1/3">Item Description</th>
            <th className="w-24">Picture</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Unit Price</th>
            <th>Discount</th>
            <th>Total Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-300 [&>tr>td]:p-2 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
          {quotation.items.map((item, index) => (
            <tr key={item.id} className="page-break-inside-avoid">
              <td>{index + 1}</td>
              <td className="text-left">
                <div className="font-bold text-gray-800">{item.product.sku}</div>
                <div className="text-gray-600">{item.product.name}</div>
              </td>
              <td className="p-1">
                {item.product.image ? (
                  <img src={item.product.image} alt={item.product.sku} className="w-16 h-16 object-contain m-auto" />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 m-auto text-gray-400 text-xs flex items-center justify-center">No Img</div>
                )}
              </td>
              <td>{item.qty}</td>
              <td>{item.product.unit}</td>
              <td className="text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="text-right">{item.discountAmt > 0 ? formatCurrency(item.discountAmt) : '-'}</td>
              <td className="text-right font-medium">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Area */}
      <div className="flex gap-6 mb-8 page-break-inside-avoid">
        {/* Bank Details */}
        <div className="flex-1">
          <h4 className="font-bold text-sm mb-1 uppercase text-gray-900">Bank Details:</h4>
          <div className="text-[11px] leading-tight space-y-0.5 text-gray-800">
            <p><span className="font-bold">Bank Name:</span> Dubai Islamic Bank</p>
            <p><span className="font-bold">Account:</span> AZM Group LLC</p>
            <p><span className="font-bold">Account Number:</span> 0000000000000000</p>
            <p><span className="font-bold">IBAN Number:</span> AE0000000000000000</p>
          </div>
        </div>

        {/* Totals */}
        <div className="w-[35%]">
           <table className="w-full border-collapse border border-gray-300 text-right">
             <tbody className="divide-y divide-gray-300 [&>tr>td]:p-2 [&>tr>td]:border-x [&>tr>td]:border-gray-300">
                <tr>
                  <td className="font-bold w-1/2">Sub Total</td>
                  <td className="font-bold">{formatCurrency(quotation.subTotal)}</td>
                </tr>
                {quotation.discountTotal > 0 && (
                  <tr>
                    <td className="font-bold text-red-600">Discount</td>
                    <td className="font-bold text-red-600">-{formatCurrency(quotation.discountTotal)}</td>
                  </tr>
                )}
                <tr>
                  <td className="font-bold bg-slate-100">VAT 5%</td>
                  <td className="bg-slate-100">{formatCurrency(quotation.vatAmount)}</td>
                </tr>
                <tr>
                  <td className="font-bold bg-blue-800 text-white">Grand Total</td>
                  <td className="font-bold bg-slate-100">{formatCurrency(quotation.grandTotal)}</td>
                </tr>
             </tbody>
           </table>
        </div>
      </div>

      {/* Terms & Signatures */}
      <div className="flex justify-between items-end page-break-inside-avoid">
        <div className="w-[60%]">
          <h4 className="font-bold text-sm mb-2 text-gray-900">Terms & Conditions:</h4>
          <ol className="list-decimal list-inside text-[11px] text-gray-800 space-y-1">
            <li>The above prices are in Dirhams (AED) quoted based on the quantities requested.</li>
            <li>Payment Terms 100% advance against order confirmation.</li>
            <li>Delivery time to be confirmed upon order confirmation.</li>
            <li>Local delivery charges are not included within this quotation.</li>
            <li>Customized items eg. counter tops/vanity cannot be cancelled or exchange after order confirmation.</li>
          </ol>
          <div className="mt-8 border-t border-black w-64 pt-1 font-medium text-center">
             Customer's Signature
          </div>
        </div>
        <div className="w-[30%] text-center">
            <div className="text-[11px] mb-2">
              <span className="italic">For</span> <span className="font-bold text-blue-800 text-xs">AL ZAHRA AL MALAKIA</span><br/>
              Building Materials Trading LLC
            </div>
            {/* Mock Stamp Placeholder */}
            <div className="w-32 h-32 m-auto border-2 border-blue-800 rounded-full flex items-center justify-center text-blue-800/20 rotate-[-15deg] font-bold opacity-30 mb-2">
               COMPANY STAMP
            </div>
            <div className="border-t border-black w-full pt-1 font-medium">
               Authorised Signature
            </div>
        </div>
      </div>

      {/* Bottom Brands Placeholder */}
      <div className="mt-8 pt-4 border-t-4 border-blue-800 flex gap-4 text-xs font-bold text-slate-900 justify-between items-center opacity-70">
        <div>VADO</div>
        <div>Jaquar</div>
        <div>ITALIAN STANDARDS</div>
        <div>NOURK</div>
        <div>SANIT</div>
        <div>KLUDI RAK</div>
        <div>SONET</div>
      </div>

    </div>
  );
});
PrintQuotation.displayName = 'PrintQuotation';
