import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '../types';
import { Search, ChevronDown, Clock, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface Props {
  products: Product[];
  value: Product | null;
  onChange: (product: Product) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const BRANDS = ['VADO', 'JAQUAR', 'NOURK', 'KLUDI RAK', 'SONET', 'ITALIAN STANDARDS'];
const RECENT_KEY = 'azm_recent_products';

export function SmartProductSelect({ products, value, onChange, onBlur, placeholder = "Search SKU, Name, Brand...", autoFocus = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) {
        setRecentProducts(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Could not load recent products", e);
    }
  }, []);

  const saveRecentProduct = (product: Product) => {
    try {
      let recent = [...recentProducts];
      // Remove if exists
      recent = recent.filter(p => p.id !== product.id);
      // Add to front
      recent.unshift(product);
      // Keep last 20
      if (recent.length > 20) {
        recent = recent.slice(0, 20);
      }
      setRecentProducts(recent);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch (e) {
      console.error("Could not save recent product", e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onBlur]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    let filtered = products;

    if (brandFilter) {
      filtered = filtered.filter(p => p.brand?.toUpperCase() === brandFilter);
    }

    if (!search) {
      if (brandFilter) return filtered.slice(0, 100);
      
      // If no search and no brand, show recents first if available
      if (recentProducts.length > 0) {
        return recentProducts;
      }
      return filtered.slice(0, 50); // Just top 50 if empty
    }

    const term = search.toLowerCase().trim();
    
    // Calculate score for each product
    const scored = filtered.map(p => {
      let score = 0;
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();

      if (sku === term) score = 100;
      else if (sku.startsWith(term)) score = 80;
      else if (name.startsWith(term)) score = 60;
      else if (brand.startsWith(term)) score = 50;
      else if (sku.includes(term)) score = 40;
      else if (name.includes(term)) score = 30;
      else if (brand.includes(term)) score = 20;

      return { product: p, score };
    }).filter(item => item.score > 0);

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 100).map(item => item.product);
  }, [products, search, brandFilter, recentProducts]);

  useEffect(() => {
    setSelectedIndex(0);
    // Scroll list to top
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search, brandFilter]);

  const handleSelect = (product: Product) => {
    onChange(product);
    saveRecentProduct(product);
    setIsOpen(false);
    setSearch('');
    setBrandFilter(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        scrollToIndex(selectedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        scrollToIndex(selectedIndex - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[selectedIndex]) {
          handleSelect(filteredOptions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        if (onBlur) onBlur();
        break;
      case 'Tab':
        setIsOpen(false);
        if (onBlur) onBlur();
        break;
    }
  };

  const scrollToIndex = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.product-option');
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {!isOpen ? (
        <div 
          className="w-full border border-slate-200 bg-white rounded-lg p-2 text-sm focus:border-blue-500 outline-none font-semibold text-slate-800 cursor-text flex justify-between items-center"
          onClick={() => setIsOpen(true)}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <span className="truncate">
            {value ? `${value.sku} - ${value.name}` : <span className="text-slate-400 font-normal">{placeholder}</span>}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 z-50 bg-white border border-blue-500 shadow-2xl rounded-lg overflow-hidden flex flex-col" style={{ minWidth: '400px' }}>
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              className="w-full p-1.5 bg-transparent border-none outline-none text-sm font-medium text-slate-800"
              placeholder="Search SKU, Name, Brand or Initials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {(search || brandFilter) && (
              <button onClick={() => { setSearch(''); setBrandFilter(null); inputRef.current?.focus(); }} className="p-1 hover:bg-slate-200 rounded-full">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>

          <div className="px-2 py-1.5 border-b border-slate-100 bg-white flex gap-1 overflow-x-auto no-scrollbar">
            {BRANDS.map(brand => (
              <button
                key={brand}
                onClick={() => {
                  setBrandFilter(prev => prev === brand ? null : brand);
                  inputRef.current?.focus();
                }}
                className={`whitespace-nowrap px-2 py-0.5 text-[10px] font-bold rounded-full border transition-colors ${brandFilter === brand ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                {brand}
              </button>
            ))}
          </div>

          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">No products found.</div>
            ) : (
              <>
                {!search && !brandFilter && recentProducts.length > 0 && (
                  <div className="px-3 py-1.5 bg-blue-50/50 flex items-center gap-1.5 text-xs font-semibold text-blue-800 border-b border-blue-100">
                    <Clock className="w-3.5 h-3.5" />
                    Recently Added Products
                  </div>
                )}
                {filteredOptions.map((p, idx) => (
                  <div
                    key={`${p.id}-${idx}`}
                    className={`product-option flex items-center p-2.5 border-b border-slate-50 cursor-pointer transition-colors ${selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{p.sku}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">{p.brand || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">{p.name}</div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-bold text-blue-700">{formatCurrency(p.price || 0)}</div>
                      <div className="text-[10px] text-slate-400">{p.unit || 'Pcs'}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
