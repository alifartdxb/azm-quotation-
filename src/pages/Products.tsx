import { useState, useEffect } from 'react';
import type { Product } from '../types';
import { Plus, Search, Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
  }, []);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">Manage inventory and pricing</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-sm transition-all active:scale-95">
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">All Products</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by SKU or name..." 
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
                <th className="px-6 py-3 w-24">Image</th>
                <th className="px-6 py-3">SKU / Product Info</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3 text-right">Unit Price</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded border border-slate-200" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs text-blue-600 font-bold mb-0.5">{product.sku}</p>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{product.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Brand: {product.brand}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-sm font-medium text-slate-900">{formatCurrency(product.price)}</span>
                    <span className="text-slate-400 font-normal text-xs ml-1">/ {product.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[11px] text-blue-600 font-semibold hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                 <tr>
                 <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                   No products found matching your search.
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
