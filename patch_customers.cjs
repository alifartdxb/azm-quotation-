const fs = require('fs');
let code = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const regex = /<div className="grid grid-cols-1 md:grid-cols-2 gap-4">([\s\S]*?)<\/div>\s*<\/div>\s*<div className="p-4 bg-slate-50 border-t/g;

const formBody = `
                {/* 1. Company Name */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Company / Customer Name *</label>
                  <input 
                    type="text"
                    value={editCustomer.name}
                    onChange={e => setEditCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="E.g., Al Zahra Building Materials"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-bold"
                  />
                </div>
                {/* 2. Contact Person */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Person</label>
                  <input 
                    type="text"
                    value={editCustomer.contactPerson || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, contactPerson: e.target.value }))}
                    placeholder="E.g., Jasim Bin Juma"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>
                {/* 3. Contact No. */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contact No. *</label>
                  <input 
                    type="text"
                    value={editCustomer.mobile}
                    onChange={e => setEditCustomer(prev => {
                      const m = e.target.value;
                      return { ...prev, mobile: m, whatsapp: m };
                    })}
                    placeholder="E.g., +971 55 809 0292"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>
                {/* 4. Email */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                  <input 
                    type="email"
                    value={editCustomer.email}
                    onChange={e => setEditCustomer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="E.g., office@alzahrabm.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>
                {/* 5. TRN Number */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">TRN Number</label>
                  <input 
                    type="text"
                    value={editCustomer.trn}
                    onChange={e => setEditCustomer(prev => ({ ...prev, trn: e.target.value }))}
                    placeholder="15-digit UAE VAT Registration"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all font-mono"
                  />
                </div>
                {/* 6. Emirate */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Emirate</label>
                  <select 
                    value={editCustomer.city || 'Dubai'}
                    onChange={e => setEditCustomer(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs font-semibold"
                  >
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* 7. Project Name */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Project Name</label>
                  <input 
                    type="text"
                    value={editCustomer.projectName || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, projectName: e.target.value }))}
                    placeholder="E.g., Warsan-3 Showroom Fitout"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>
                {/* 8. Customer Category */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Customer Category</label>
                  <select 
                    value={editCustomer.customerType}
                    onChange={e => setEditCustomer(prev => ({ ...prev, customerType: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs font-semibold"
                  >
                    {CUSTOMER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* 9. Tracking Status */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Tracking Status</label>
                  <select 
                    value={editCustomer.tag}
                    onChange={e => setEditCustomer(prev => ({ ...prev, tag: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs font-semibold"
                  >
                    {CUSTOMER_TAGS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* 10. Address */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Address</label>
                  <input 
                    type="text"
                    value={editCustomer.address}
                    onChange={e => setEditCustomer(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="E.g., Warehouse Block B, Sharjah"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs transition-all"
                  />
                </div>
                {/* 11. Internal Notes */}
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Internal Notes</label>
                  <textarea 
                    value={editCustomer.notes || ''}
                    onChange={e => setEditCustomer(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Enter interior design preferences, discount histories, etc."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#1B6B72] focus:bg-white text-xs"
                  />
                </div>
`;

code = code.replace(
  regex, 
  (match, p1) => `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\n${formBody}\n              </div>\n            </div>\n            <div className="p-4 bg-slate-50 border-t`
);

fs.writeFileSync('src/pages/Customers.tsx', code);
