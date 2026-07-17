import { getTenantCollection, getTenantDoc } from '../lib/tenant';
import { useState, useEffect, useRef } from 'react';
import type { Product } from '../types';
import { Plus, Search, Image as ImageIcon, Upload, FileSpreadsheet, X, Save, Pencil, Trash2, CheckCircle, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { getProducts, db, logActivity } from '../lib/firebase';
import { collection, writeBatch, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sorting Mode State
  const [sortBy, setSortBy] = useState<'sku-asc' | 'sku-desc' | 'name-asc' | 'name-desc'>('sku-asc');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Delete States
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    sku: '', name: '', brand: '', price: 0, unit: 'Pcs', category: '', image: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  // Auto-dismiss success banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => {
        setSuccessBanner(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  const loadProducts = () => {
    setLoading(true);
    getProducts().then(data => {
      setProducts(data);
      setLoading(false);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        complete: async (results) => {
          await processImport(results.data);
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        await processImport(data);
      };
      reader.readAsBinaryString(file);
    } else {
      alert("Please upload a .csv or .xlsx file.");
      setIsImporting(false);
    }
  };

  const processImport = async (data: any[]) => {
    try {
      const batch = writeBatch(db);
      let count = 0;

      for (const row of data) {
        if (!row.sku || !row.name) continue;
        
        const productData = {
          sku: row.sku || row.SKU,
          name: row.name || row.Product || row['Product Name'],
          brand: row.brand || row.Brand || 'Generic',
          price: parseFloat(row.price || row.Price || row.SellingPrice || '0'),
          unit: row.unit || row.Unit || 'Pcs',
          category: row.category || row.Category || 'General',
          image: row.image || row.Image || 'https://upload.wikimedia.org/wikipedia/commons/f/fc/No_picture_available.png'
        };

        const newDocRef = doc(getTenantCollection('products'));
        batch.set(newDocRef, productData);
        count++;
      }

      await batch.commit();
      alert(`Successfully imported ${count} products.`);
      loadProducts();
    } catch (error) {
      console.error("Import error:", error);
      alert("There was an error importing the products.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      sku: 'SKU-001',
      name: 'Sample Product',
      brand: 'AZM',
      price: 150,
      unit: 'Pcs',
      category: 'Sanitary',
      image: 'https://images.unsplash.com/photo-1585058173693-010bd71a067a'
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "products_import_template.xlsx");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async () => {
    if (!newProduct.sku || !newProduct.name || !newProduct.price) {
      setFormError("Please fill required fields: SKU, Name, Price");
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateDoc(getTenantDoc('products', editingId), {
          sku: newProduct.sku,
          name: newProduct.name,
          brand: newProduct.brand || 'Generic',
          price: Number(newProduct.price),
          unit: newProduct.unit || 'Pcs',
          category: newProduct.category || 'General',
          image: newProduct.image || ''
        });
        await logActivity('Update Product', 'System', editingId, `Updated product SKU: ${newProduct.sku}, Name: ${newProduct.name}`);
      } else {
        const docRef = await addDoc(getTenantCollection('products'), {
          sku: newProduct.sku,
          name: newProduct.name,
          brand: newProduct.brand || 'Generic',
          price: Number(newProduct.price),
          unit: newProduct.unit || 'Pcs',
          category: newProduct.category || 'General',
          image: newProduct.image || ''
        });
        await logActivity('Create Product', 'System', docRef.id, `Created product SKU: ${newProduct.sku}, Name: ${newProduct.name}`);
      }
      setIsModalOpen(false);
      setNewProduct({ sku: '', name: '', brand: '', price: 0, unit: 'Pcs', category: '', image: '' });
      setEditingId(null);
      setFormError('');
      loadProducts();
    } catch (error) {
       console.error(error);
       setFormError("Failed to save product. Please try again.");
    } finally {
       setIsSaving(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setNewProduct({
      sku: product.sku || '',
      name: product.name || '',
      brand: product.brand || 'Generic',
      price: product.price || 0,
      unit: product.unit || 'Pcs',
      category: product.category || 'General',
      image: product.image || ''
    });
    setEditingId(product.id);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    setProductToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsSaving(true);
    try {
      await deleteDoc(getTenantDoc('products', productToDelete.id));
      await logActivity('Delete Product', 'System', productToDelete.id, `Deleted product: ${productToDelete.name}`);
      
      // Remove deleted item from potential multi-selection set
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(productToDelete.id);
        return next;
      });

      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      setSuccessBanner(`Successfully deleted product.`);
      loadProducts();
    } catch (error) {
      console.error(error);
      alert("Failed to delete product from database.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmBulkDelete = async () => {
    setIsDeletingBulk(true);
    setBulkDeleteError(null);
    try {
      const batch = writeBatch(db);
      const selectedIdsArray = Array.from(selectedIds);
      
      selectedIdsArray.forEach(id => {
        batch.delete(getTenantDoc('products', id));
      });
      
      await batch.commit();

      // Log bulk delete event
      await logActivity('Bulk Delete Products', 'System', 'Multiple', `Deleted ${selectedIdsArray.length} products dynamically.`);

      // Product images are cached inline as base64/URLs inside Firestore documents. 
      // Deleting product documents naturally cleans up these fields without any secondary storage requirements.

      setSuccessBanner(`Successfully deleted ${selectedIdsArray.length} products.`);
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      loadProducts();
    } catch (error: any) {
      console.error("Bulk deletion failed:", error);
      setBulkDeleteError("Failed to delete selected products. Please try again.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const filtered = products.filter(p => {
    const s = search.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(s)) || 
      (p.sku && p.sku.toLowerCase().includes(s)) ||
      (p.brand && p.brand.toLowerCase().includes(s)) ||
      (p.category && p.category.toLowerCase().includes(s))
    );
  });

  // Automatically sort by selected option using natural sort for SKU and case-insensitive matching for name
  const sortedAndFiltered = [...filtered].sort((a, b) => {
    if (sortBy === 'sku-asc' || sortBy === 'sku-desc') {
      const skuA = (a.sku || '').trim();
      const skuB = (b.sku || '').trim();
      // Natural sort handles numbers like SKU-2 before SKU-10 beautifully!
      const comp = skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
      return sortBy === 'sku-asc' ? comp : -comp;
    } else {
      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      const comp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      return sortBy === 'name-asc' ? comp : -comp;
    }
  });

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in shrink-0">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-[#509AA3] hover:text-[#3f7a81] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">Manage inventory and pricing</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv, .xlsx" 
            className="hidden" 
          />
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Template
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importing...' : 'Import'}
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewProduct({ sku: '', name: '', brand: '', price: 0, unit: 'Pcs', category: '', image: '' });
              setIsModalOpen(true);
            }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
               {formError && (
                 <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-semibold">
                   {formError}
                 </div>
               )}
               <div className="flex justify-center">
                 <div className="relative w-32 h-32 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer flex items-center justify-center bg-slate-50 group">
                    {newProduct.image ? (
                      <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1 group-hover:text-blue-500" />
                        <span className="text-[10px] text-slate-500 font-medium px-2">Upload Image</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                 </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">SKU *</label>
                   <input type="text" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. TILE-001" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
                   <input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Polished Porcelain Slab" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                   <input type="text" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Porcelain" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Brand</label>
                   <input type="text" value={newProduct.brand} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. AZM" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Unit Price (AED) *</label>
                   <input type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Unit of Measure</label>
                   <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                     <option value="Pcs">Pcs</option>
                     <option value="Sqm">Sqm</option>
                     <option value="Box">Box</option>
                     <option value="Meter">Meter</option>
                   </select>
                 </div>
               </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 rounded-b-xl bg-slate-50">
               <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
               <button disabled={isSaving} onClick={handleSaveProduct} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
                 {isSaving ? "Saving..." : <><Save className="w-4 h-4" /> Save Product</>}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && productToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Product</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete <span className="font-semibold text-slate-800">"{productToDelete.name}"</span>? This action cannot be undone and will remove the product permanently from your catalog.
              </p>
              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setProductToDelete(null);
                  }} 
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSaving}
                  onClick={confirmDeleteProduct} 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "Deleting..." : "Delete Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-slate-800">All Products</h3>
          <div className="flex flex-wrap items-center gap-3">
            {/* Sorting Controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-[#509AA3] cursor-pointer"
              >
                <option value="sku-asc">SKU ↑ (Default)</option>
                <option value="sku-desc">SKU ↓</option>
                <option value="name-asc">Product Name A–Z</option>
                <option value="name-desc">Product Name Z–A</option>
              </select>
            </div>

            {/* Search Input Filter */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by SKU or name..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#509AA3] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Multi-Select Floating Bulk Action Strip */}
        {selectedIds.size > 0 && (
          <div className="bg-amber-50/80 border-b border-amber-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {selectedIds.size} Selected
              </span>
              <p className="text-sm text-slate-600">
                You have selected <span className="font-semibold text-slate-800">{selectedIds.size}</span> products for bulk deletion
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkDeleteError(null);
                  setIsBulkDeleteModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-8 text-center text-slate-500">Loading products...</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-[#509AA3] text-white text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-[#509AA3] focus:ring-[#509AA3] h-4 w-4 cursor-pointer"
                      checked={sortedAndFiltered.length > 0 && sortedAndFiltered.every(p => selectedIds.has(p.id))}
                      onChange={() => {
                        const visibleIds = sortedAndFiltered.map(p => p.id);
                        const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (allVisibleSelected) {
                            visibleIds.forEach(id => next.delete(id));
                          } else {
                            visibleIds.forEach(id => next.add(id));
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th className="px-6 py-3 w-24">Image</th>
                  <th className="px-6 py-3">SKU / Product Info</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Unit Price</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAndFiltered.map(product => {
                  const isSelected = selectedIds.has(product.id);
                  return (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-slate-50/70 border-l-2 border-l-[#509AA3]' : ''}`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox"
                          className="rounded border-slate-300 text-[#509AA3] focus:ring-[#509AA3] h-4 w-4 cursor-pointer"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(product.id)) {
                                next.delete(product.id);
                              } else {
                                next.add(product.id);
                              }
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 animate-fade-in">
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
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => handleEditProduct(product)}
                            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95"
                            title="Edit product"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95"
                            title="Delete product"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedAndFiltered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 text-sm">
                      No products found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="p-6 text-center border-b border-slate-100">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Bulk Delete Products</h3>
              <p className="text-sm text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-semibold text-slate-800">{selectedIds.size}</span> selected products?
              </p>
            </div>
            
            {/* Scrollable list of products to delete */}
            <div className="p-5 flex-1 overflow-y-auto bg-slate-50/50 max-h-40 divide-y divide-slate-100 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Products Selected for Deletion:</p>
              {products.filter(p => p.id && selectedIds.has(p.id)).map(p => (
                <div key={p.id} className="py-2 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{p.sku}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 shrink-0 uppercase">{p.category}</span>
                </div>
              ))}
            </div>

            {bulkDeleteError && (
              <div className="p-4 bg-red-50 border-b border-red-100 text-red-600 text-xs font-semibold">
                {bulkDeleteError}
              </div>
            )}

            <div className="p-4 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button 
                type="button"
                disabled={isDeletingBulk}
                onClick={() => {
                  setIsBulkDeleteModalOpen(false);
                  setBulkDeleteError(null);
                }} 
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                disabled={isDeletingBulk}
                onClick={confirmBulkDelete} 
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingBulk ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Deleting {selectedIds.size}...</span>
                  </>
                ) : (
                  <span>Confirm Bulk Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
