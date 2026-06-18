import { useState, useEffect } from 'react';
import type { Customer } from '../types';
import { Plus, Search, Building2, Phone, Mail } from 'lucide-react';
import { getCustomers } from '../lib/firebase';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomers().then(data => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  const filtered = customers.filter(c => {
    const s = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(s)) || 
      (c.companyName && c.companyName.toLowerCase().includes(s)) ||
      (c.mobile && c.mobile.toLowerCase().includes(s)) ||
      (c.trn && c.trn.toLowerCase().includes(s)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your clients and their details</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-sm transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">All Customers</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Customer Info</th>
                <th className="px-6 py-3">Contact Details</th>
                <th className="px-6 py-3">TRN Number</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {customer.companyName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{customer.companyName}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          {customer.address}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-800">{customer.contactPerson}</p>
                    <div className="text-[11px] text-slate-500 space-y-1 mt-1">
                      <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.mobile}</p>
                      <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{customer.trn}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[11px] text-blue-600 font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 text-sm">
                    No customers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
