import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, User } from 'lucide-react';
import { ReTenant, ReProperty, ReUnit } from '../../types';

interface SearchableTenantDropdownProps {
  tenants: ReTenant[];
  properties?: ReProperty[];
  units?: ReUnit[];
  selectedTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  selectedPropertyId?: string;
  label?: string;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  actionButton?: React.ReactNode;
}

export const SearchableTenantDropdown: React.FC<SearchableTenantDropdownProps> = ({
  tenants = [],
  properties = [],
  units = [],
  selectedTenantId = 'all',
  onSelectTenant,
  selectedPropertyId = 'all',
  label = 'اختر المستأجر:',
  placeholder = 'بحث باسم المستأجر...',
  allLabel,
  className = '',
  actionButton,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter available tenants based on selected property
  const availableTenants = useMemo(() => {
    return tenants.filter(t => {
      if (!t) return false;
      if (selectedPropertyId === 'all') return true;
      if (t.propertyId && t.propertyId === selectedPropertyId) return true;
      const u = units.find(unit => unit.id === t.unitId);
      return u?.propertyId === selectedPropertyId;
    });
  }, [tenants, selectedPropertyId, units]);

  // Filter items by search query
  const filteredList = useMemo(() => {
    const defaultAllLabel = allLabel || (
      selectedPropertyId === 'all' 
        ? `جميع المستأجرين (${availableTenants.length})` 
        : `جميع مستأجري العقار (${availableTenants.length})`
    );

    const allOption = {
      id: 'all',
      fullName: defaultAllLabel,
      isAll: true,
    };

    const mappedTenants = availableTenants.map(t => ({
      id: t.id,
      fullName: t.fullName || 'مستأجر بدون اسم',
      isAll: false,
      status: t.status,
    }));

    if (!searchQuery.trim()) {
      return [allOption, ...mappedTenants];
    }

    const q = searchQuery.toLowerCase().trim();
    const matchingTenants = mappedTenants.filter(t => t.fullName.toLowerCase().includes(q));

    return [allOption, ...matchingTenants];
  }, [availableTenants, selectedPropertyId, searchQuery, allLabel]);

  // Currently selected tenant object
  const selectedTenantObj = useMemo(() => {
    if (selectedTenantId === 'all') return null;
    return availableTenants.find(t => t.id === selectedTenantId) || tenants.find(t => t.id === selectedTenantId);
  }, [selectedTenantId, availableTenants, tenants]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens and set initial highlight
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      const curIndex = filteredList.findIndex(item => item.id === selectedTenantId);
      const targetIndex = curIndex >= 0 ? curIndex : 0;
      setHighlightedIndex(targetIndex);

      setTimeout(() => {
        searchInputRef.current?.focus();
        if (itemRefs.current[targetIndex]) {
          itemRefs.current[targetIndex]?.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
    }
  }, [isOpen]);

  // Keep highlighted item in view when highlightedIndex changes
  useEffect(() => {
    if (isOpen && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, isOpen]);

  // Reset highlight index when filter list length changes
  useEffect(() => {
    setHighlightedIndex(prev => Math.min(prev, Math.max(0, filteredList.length - 1)));
  }, [filteredList.length]);

  // Keyboard navigation handler (Arrow Up, Arrow Down, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < filteredList.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredList.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredList[highlightedIndex]) {
          onSelectTenant(filteredList[highlightedIndex].id);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const defaultAllText = allLabel || (
    selectedPropertyId === 'all' 
      ? `جميع المستأجرين (${availableTenants.length})` 
      : `جميع مستأجري العقار (${availableTenants.length})`
  );

  return (
    <div className={`relative ${isOpen ? 'z-[9999]' : 'z-20'} ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {(label || actionButton) && (
        <label className="text-xs text-slate-200 block mb-1 font-extrabold flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            {label && <span>{label}</span>}
            {actionButton}
          </div>
          {selectedTenantId !== 'all' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTenant('all');
              }}
              className="text-[10px] text-[#D4A84F] hover:underline flex items-center gap-0.5 cursor-pointer mr-auto"
            >
              <X className="w-3 h-3" /> إلغاء التحديد
            </button>
          )}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        id="tenant-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border text-right text-xs sm:text-sm font-extrabold focus:outline-none transition-all flex items-center justify-between gap-2 shadow-sm cursor-pointer ${
          isOpen
            ? 'border-[#D4A84F] ring-1 ring-[#D4A84F]'
            : selectedTenantId !== 'all'
            ? 'border-[#D4A84F]/60 text-[#F8F9FB] bg-[#0d1b2d]'
            : 'border-[#D4A84F]/30 text-[#F8F9FB]'
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          <User className={`w-4 h-4 shrink-0 ${selectedTenantId !== 'all' ? 'text-[#D4A84F]' : 'text-slate-400'}`} />
          {selectedTenantObj ? (
            <span className="text-[#F8F9FB] font-black truncate">{selectedTenantObj.fullName}</span>
          ) : (
            <span className="text-slate-300 font-extrabold truncate">{defaultAllText}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedTenantId !== 'all' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTenant('all');
              }}
              className="p-1 hover:text-rose-400 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              title="إعادة التعيين إلى جميع المستأجرين"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-[#D4A84F] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div 
          className="absolute right-0 left-auto z-[99999] mt-1.5 w-full min-w-[260px] bg-[#0A1322] border-2 border-[#D4A84F] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/50"
          style={{ direction: 'rtl' }}
        >
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-[#D4A84F]/30 bg-[#0F1E33] sticky top-0 z-10 shadow-sm">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#D4A84F] absolute right-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full pr-9 pl-8 py-2 rounded-xl bg-[#08111F] border border-[#D4A84F]/40 text-xs text-[#F8F9FB] placeholder:text-slate-400 font-bold focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute left-2.5 p-1 text-slate-400 hover:text-white rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-300 font-bold">
              <span className="text-[#D4A84F] font-black">{filteredList.length - 1} مستأجر</span>
              <span className="text-slate-300 flex items-center gap-1 font-mono">
                <span>أسهم ↑ ↓ للتنقل و Enter للاختيار</span>
              </span>
            </div>
          </div>

          {/* 
            5-Items Height Constrained Scrollable List
            Each item is ~44px, exactly 5 items = 220px max-height with smooth touch & keyboard scroll 
          */}
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-[220px] overflow-y-auto divide-y divide-white/5 overscroll-contain touch-pan-y"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: '#D4A84F #08111F',
            }}
          >
            {filteredList.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-bold">
                لا يوجد مستأجر مطابق للبحث
              </div>
            ) : (
              filteredList.map((item, index) => {
                const isSelected = item.id === selectedTenantId;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={item.id}
                    ref={(el) => { itemRefs.current[index] = el; }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectTenant(item.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full text-right px-3.5 py-2.5 h-[44px] flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#D4A84F]/25 text-[#D4A84F] font-black'
                        : isHighlighted
                        ? 'bg-[#182C48] text-[#F8F9FB] font-extrabold'
                        : 'text-slate-200 hover:bg-[#132238]/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 text-[#D4A84F] flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      
                      <span className="truncate text-xs font-bold">{item.fullName}</span>
                      {item.status === 'suspended' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">معلق</span>
                      )}
                      {item.status === 'expired' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">منتهي</span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#D4A84F] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Helper */}
          <div className="p-2 border-t border-[#D4A84F]/20 bg-[#08111F] flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>تمرير باللمس أو بالفأرة</span>
            <span className="text-[#D4A84F]">عرض 5 مستأجرين</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default SearchableTenantDropdown;
