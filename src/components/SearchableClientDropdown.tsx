import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, User, Phone, Check, ChevronDown, UserPlus } from 'lucide-react';
import { Client } from '../types';

export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SearchableClientDropdownProps {
  clients: Client[];
  selectedName?: string;
  selectedId?: string;
  onSelect: (client: Client | null) => void;
  onOpenManualModal?: () => void;
  placeholder?: string;
  hasError?: boolean;
}

export default function SearchableClientDropdown({
  clients = [],
  selectedName = '',
  selectedId = '',
  onSelect,
  onOpenManualModal,
  placeholder = '🔍 ابحث باسم الموكل أو اختر من القائمة...',
  hasError = false
}: SearchableClientDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find currently selected client
  const selectedClient = useMemo(() => {
    if (!clients || clients.length === 0) return null;
    if (selectedId) {
      const byId = clients.find(c => c && c.id === selectedId);
      if (byId) return byId;
    }
    if (selectedName) {
      return clients.find(c => c && c.name?.trim() === selectedName.trim()) || null;
    }
    return null;
  }, [clients, selectedId, selectedName]);

  // Filter clients based on search term (full name or partial match, phone, national ID)
  const filteredClients = useMemo(() => {
    if (!clients || clients.length === 0) return [];
    const term = searchTerm.trim();
    if (!term) return clients;

    const normQuery = normalizeArabicText(term);
    const cleanQuery = term.toLowerCase();

    return clients.filter(c => {
      if (!c) return false;
      const cName = c.name || '';
      const cPhone = c.phone || '';
      const cSecondaryPhone = c.secondaryPhone || '';
      const cNatId = c.nationalId || '';

      // Match full or partial name (with or without Arabic normalization)
      const normName = normalizeArabicText(cName);
      if (normName.includes(normQuery) || cName.toLowerCase().includes(cleanQuery)) {
        return true;
      }

      // Match phone numbers
      if (cPhone.includes(term) || cSecondaryPhone.includes(term)) {
        return true;
      }

      // Match national ID
      if (cNatId && cNatId.includes(term)) {
        return true;
      }

      return false;
    });
  }, [clients, searchTerm]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearchTerm('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full text-right" dir="rtl">
      {/* Search Input Bar / Trigger */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full min-h-[38px] px-2.5 py-1.5 bg-white border rounded-lg text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
          hasError && !selectedName
            ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20'
            : isOpen
            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
            : 'border-slate-200 hover:border-amber-400'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Search className={`w-3.5 h-3.5 shrink-0 ${isOpen ? 'text-amber-600' : 'text-slate-400'}`} />
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={selectedClient ? `المحدد: ${selectedClient.name} (اكتب اسمًا آخر للبحث...)` : placeholder}
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden placeholder:text-slate-400 placeholder:font-normal"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : selectedClient ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-black text-slate-900 truncate">
                {selectedClient.name}
              </span>
              {selectedClient.phone && (
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  ({selectedClient.phone})
                </span>
              )}
            </div>
          ) : selectedName ? (
            <span className="font-black text-slate-900 truncate">
              {selectedName}
            </span>
          ) : (
            <span className="text-slate-400 truncate font-normal">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(selectedClient || selectedName || searchTerm) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
              title="إلغاء التحديد ومسح البحث"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(prev => !prev);
              if (!isOpen) {
                setTimeout(() => inputRef.current?.focus(), 50);
              }
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header Info */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-150 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span>
              {searchTerm ? `نتائج البحث المطابقة لـ "${searchTerm}":` : 'اختر موكل مسجل بالنظام:'}
            </span>
            <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full font-mono text-slate-700">
              {filteredClients.length} موكل
            </span>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto max-h-52 divide-y divide-slate-100">
            {filteredClients.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-slate-600 text-xs font-bold mb-1">
                  لا يوجد موكل مسجل مطابق لـ "{searchTerm}"
                </p>
                <p className="text-[10px] text-slate-400 mb-2">
                  يدعم البحث الاسم كاملًا أو جزءًا منه أو رقم الهاتف.
                </p>
                {onOpenManualModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenManualModal();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إضافة هذا الموكل للنظام الآن</span>
                  </button>
                )}
              </div>
            ) : (
              filteredClients.map((client) => {
                if (!client) return null;
                const isSelected = selectedClient?.id === client.id || selectedName === client.name;
                return (
                  <div
                    key={client.id || client.name}
                    onClick={() => handleSelect(client)}
                    className={`px-3 py-2 flex items-center justify-between gap-2 hover:bg-amber-50/80 cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-50/90 font-black text-amber-950 border-r-4 border-amber-500' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <User className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span className="text-xs truncate font-bold">
                          {client.name}
                        </span>
                        {client.job && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium truncate">
                            {client.job}
                          </span>
                        )}
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono mt-0.5 pr-5">
                          <Phone className="w-2.5 h-2.5 text-slate-400" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Footer for Manual Add */}
          {onOpenManualModal && (
            <div className="p-2 border-t border-slate-150 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenManualModal();
                }}
                className="text-[11px] font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ تسجيل موكل جديد يدويًا</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
