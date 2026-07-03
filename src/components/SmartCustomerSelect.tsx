import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CrmCustomer } from '../types';
import { Search, ChevronDown, Clock, X, Building } from 'lucide-react';

interface Props {
  customers: CrmCustomer[];
  value: string;
  onChange: (companyName: string, customer?: CrmCustomer) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const RECENT_KEY = 'azm_recent_customers';

export function SmartCustomerSelect({ customers, value, onChange, onBlur, placeholder = "Search Company, Name, Mobile...", autoFocus = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCustomers, setRecentCustomers] = useState<CrmCustomer[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) {
        setRecentCustomers(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Could not load recent customers", e);
    }
  }, []);

  const saveRecentCustomer = (customer: CrmCustomer) => {
    try {
      let recent = [...recentCustomers];
      // Remove if exists
      recent = recent.filter(c => c.id !== customer.id);
      // Add to front
      recent.unshift(customer);
      // Keep last 10
      if (recent.length > 10) {
        recent = recent.slice(0, 10);
      }
      setRecentCustomers(recent);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch (e) {
      console.error("Could not save recent customer", e);
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
      setSearch(value || '');
    }
  }, [isOpen, value]);

  const filteredOptions = useMemo(() => {
    if (!search) {
      if (recentCustomers.length > 0) {
        return recentCustomers;
      }
      return customers.slice(0, 20); // Top 20 if empty
    }

    const term = search.toLowerCase().trim();
    
    // Calculate score for each customer
    const scored = customers.map(c => {
      let score = 0;
      const company = (c.companyName || '').toLowerCase();
      const name = (c.customerName || '').toLowerCase();
      const mobile = (c.mobile || '').toLowerCase();

      if (company === term) score = 100;
      else if (company.startsWith(term)) score = 80;
      else if (mobile.includes(term)) score = 70;
      else if (name.startsWith(term)) score = 60;
      else if (company.includes(term)) score = 40;
      else if (name.includes(term)) score = 30;

      return { customer: c, score };
    }).filter(item => item.score > 0);

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 20).map(item => item.customer);
  }, [customers, search, recentCustomers]);

  useEffect(() => {
    setSelectedIndex(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search]);

  const handleSelect = (customer: CrmCustomer | null, manualValue: string) => {
    if (customer) {
      onChange(customer.companyName || customer.customerName, customer);
      saveRecentCustomer(customer);
    } else {
      onChange(manualValue);
    }
    setIsOpen(false);
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
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length));
        scrollToIndex(selectedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        scrollToIndex(selectedIndex - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex === 0 && search) {
            handleSelect(null, search);
        } else if (filteredOptions[selectedIndex - (search ? 1 : 0)]) {
            handleSelect(filteredOptions[selectedIndex - (search ? 1 : 0)], '');
        } else {
            handleSelect(null, search);
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
    const items = listRef.current.querySelectorAll('.customer-option');
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {!isOpen ? (
        <div 
          className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-sm focus:border-blue-500 outline-none font-semibold text-slate-800 cursor-text flex justify-between items-center"
          onClick={() => setIsOpen(true)}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <span className="truncate">
            {value ? value : <span className="text-slate-400 font-normal">{placeholder}</span>}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        </div>
      ) : (
        <div className="absolute top-0 left-0 right-0 z-50 bg-white border border-blue-500 shadow-2xl rounded-lg overflow-hidden flex flex-col" style={{ minWidth: '350px' }}>
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              className="w-full p-1.5 bg-transparent border-none outline-none text-sm font-medium text-slate-800"
              placeholder={placeholder}
              value={search}
              onChange={e => {
                  setSearch(e.target.value);
                  onChange(e.target.value); // Also update the manual string as they type
              }}
              onKeyDown={handleKeyDown}
              autoFocus={autoFocus || true}
            />
            {search && (
              <button onClick={() => { setSearch(''); inputRef.current?.focus(); }} className="p-1 hover:bg-slate-200 rounded-full">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>

          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {search && (
              <div
                className={`customer-option flex items-center p-2.5 border-b border-slate-50 cursor-pointer transition-colors ${selectedIndex === 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                onClick={() => handleSelect(null, search)}
                onMouseEnter={() => setSelectedIndex(0)}
              >
                 <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-blue-700 truncate">Use "{search}"</div>
                 </div>
              </div>
            )}
            
            {!search && recentCustomers.length > 0 && (
              <div className="px-3 py-1.5 bg-blue-50/50 flex items-center gap-1.5 text-xs font-semibold text-blue-800 border-b border-blue-100">
                <Clock className="w-3.5 h-3.5" />
                Recent Customers
              </div>
            )}

            {filteredOptions.length === 0 && !search ? (
              <div className="p-4 text-center text-sm text-slate-500">No customers found.</div>
            ) : (
              filteredOptions.map((c, idx) => {
                const listIdx = search ? idx + 1 : idx;
                return (
                  <div
                    key={`${c.id}-${idx}`}
                    className={`customer-option flex items-center p-2.5 border-b border-slate-50 cursor-pointer transition-colors ${selectedIndex === listIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    onClick={() => handleSelect(c, '')}
                    onMouseEnter={() => setSelectedIndex(listIdx)}
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                         <div className="text-sm font-bold text-slate-900 truncate">{c.companyName || c.customerName}</div>
                         <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                           <span>{c.customerName !== c.companyName ? c.customerName : ''}</span>
                           {c.mobile && <span className="font-mono">{c.mobile}</span>}
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
