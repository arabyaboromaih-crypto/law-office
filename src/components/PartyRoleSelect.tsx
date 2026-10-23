/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useId } from 'react';
import { 
  ChevronDown, Search, Plus, CheckCircle2, Scale, X, 
  Layers
} from 'lucide-react';

/**
 * Standard legal capacity/role options for litigants in Egyptian and Arab courts.
 * Includes plaintiff, defendant, appellant, appellee, cassation appellant/respondent,
 * enforcement petitioner/respondent, complainant, accused, and execution disputants (مستشكل / مستشكل ضده).
 */
export const capacityOptions: string[] = [
  'مدعي',
  'مدعى عليه',
  'مستأنف',
  'مستأنف ضده',
  'طاعن',
  'مطعون ضده',
  'مستشكل',
  'مستشكل ضده',
  'منفذ',
  'منفذ ضده',
  'شاكي',
  'مشكو في حقه',
  'شاكي ومشكو في حقه',
  'متهم',
  'مجني عليه',
  'متهم ومجني عليه'
];

export interface PartyRoleSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

// Aliased for backward compatibility with SearchableDropdown
export type SearchableDropdownProps = PartyRoleSelectProps;

export const PartyRoleSelect: React.FC<PartyRoleSelectProps> = ({
  value,
  onChange,
  options = capacityOptions,
  placeholder = "اختر الصفة بالدعوى...",
  required = false,
  className = "",
  disabled = false,
  id,
  name
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [openUpwards, setOpenUpwards] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const generatedId = useId();
  const selectId = id || generatedId;

  // Ensure current value is included in options if it's a custom string
  const allOptions = React.useMemo(() => {
    const list = [...options];
    if (value && !list.includes(value)) {
      list.unshift(value);
    }
    return list;
  }, [options, value]);

  // Filter options based on user search
  const filtered = React.useMemo(() => {
    const trimmed = (search || '').trim().toLowerCase();
    if (!trimmed) return allOptions;
    return allOptions.filter(opt => (opt || '').toLowerCase().includes(trimmed));
  }, [allOptions, search]);

  // Reset highlight index when filtered list changes
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = filtered.findIndex(opt => opt === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, filtered, value]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Calculate opening direction (upwards or downwards) based on viewport clearance
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Dropdown total height is roughly 270px (search header 50px + 200px 5-items + paddings)
      if (spaceBelow < 275 && spaceAbove > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
      // Focus search input on open
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll highlighted item into view automatically
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      const el = itemRefs.current[highlightedIndex];
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, isOpen]);

  // Toggle open
  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) return;
    e.preventDefault();
    if (!isOpen) {
      setIsOpen(true);
      setSearch('');
    } else {
      setIsOpen(false);
    }
  };

  const handleSelectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setSearch('');
    triggerRef.current?.focus();
  };

  // Keyboard navigation handler
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
        setHighlightedIndex(prev => {
          if (filtered.length === 0) return -1;
          const next = prev + 1;
          return next >= filtered.length ? 0 : next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => {
          if (filtered.length === 0) return -1;
          const next = prev - 1;
          return next < 0 ? filtered.length - 1 : next;
        });
        break;

      case 'Home':
        e.preventDefault();
        if (filtered.length > 0) setHighlightedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        if (filtered.length > 0) setHighlightedIndex(filtered.length - 1);
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          handleSelectOption(filtered[highlightedIndex]);
        } else if (search.trim()) {
          handleSelectOption(search.trim());
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        triggerRef.current?.focus();
        break;

      case 'Tab':
        setIsOpen(false);
        break;

      default:
        break;
    }
  };

  // Prevent parent scroll chaining during mouse wheel navigation inside the list
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  // Badge label helper for specific legal roles
  const getRoleCategoryBadge = (roleName: string) => {
    if (roleName === 'مستشكل' || roleName === 'مستشكل ضده') {
      return (
        <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md border border-indigo-200/80">
          إشكال تنفيذ
        </span>
      );
    }
    if (roleName === 'طاعن' || roleName === 'مطعون ضده') {
      return (
        <span className="text-[9px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-md">
          نقض
        </span>
      );
    }
    if (roleName === 'مستأنف' || roleName === 'مستأنف ضده') {
      return (
        <span className="text-[9px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-md">
          استئناف
        </span>
      );
    }
    if (roleName === 'سلطة اتهام') {
      return (
        <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded-md">
          نيابة عامة
        </span>
      );
    }
    return null;
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full text-right ${className}`} 
      dir="rtl"
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for standard form submission if needed */}
      {name && <input type="hidden" name={name} value={value || ''} />}

      {/* Main Trigger Button */}
      <div
        id={selectId}
        ref={triggerRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        className={`w-full px-3 py-2 bg-gradient-to-r from-indigo-50/40 via-white to-indigo-50/20 border ${
          required && !value 
            ? 'border-red-300 ring-2 ring-red-100' 
            : isOpen 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm' 
              : 'border-indigo-200/90 hover:border-indigo-400'
        } rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-between hover:bg-white transition-all duration-200 h-[40px] select-none ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {/* Distinctive Party Capacity Icon (Indigo/Blue Theme) */}
          <div className="w-5 h-5 rounded-md bg-indigo-600/10 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-700">
            <Scale className="w-3 h-3" />
          </div>

          <span className={`truncate ${value ? 'text-indigo-950 font-black text-[12.5px]' : 'text-slate-400'}`}>
            {value || placeholder}
          </span>

          {value && getRoleCategoryBadge(value)}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 mr-1">
          {value && (
            <span className="w-2 h-2 rounded-full bg-indigo-500" title="صفة محددة" />
          )}
          <ChevronDown 
            className={`w-4 h-4 text-indigo-600 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-700' : ''}`} 
          />
        </div>
      </div>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div 
          className={`absolute z-50 w-full bg-white border border-indigo-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 animate-in fade-in zoom-in-95 ${
            openUpwards 
              ? 'bottom-full mb-2 origin-bottom' 
              : 'top-full mt-1.5 origin-top'
          }`}
          style={{ minWidth: '220px' }}
        >
          {/* Header Search Box with Distinct Indigo Legal Styling */}
          <div className="p-2.5 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/80 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-indigo-200/80 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all">
              <Search className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث أو اكتب صفة جديدة..."
                className="w-full bg-transparent text-xs text-indigo-950 placeholder-indigo-300 focus:outline-none py-0.5 text-right font-medium"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch('');
                    searchInputRef.current?.focus();
                  }}
                  className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                  title="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick helper counter & instructions banner */}
            <div className="flex items-center justify-between px-1 text-[10px] text-indigo-700 font-semibold select-none">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>٥ خيارات ظاهرة • اسحب أو استخدم العجلة للمزيد</span>
              </span>
              <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">
                {filtered.length} صفة
              </span>
            </div>
          </div>

          {/* 
            Options List:
            Exactly 5 options visible at once (5 rows * 40px each = 200px viewport).
            Supports Mouse Wheel, Touch Swipe (touch-action: pan-y), and Keyboard Arrow navigation.
          */}
          <div 
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            onWheel={handleWheel}
            style={{ 
              maxHeight: '200px',
              height: filtered.length >= 5 ? '200px' : 'auto',
              overscrollBehavior: 'contain',
              touchAction: 'pan-y',
              WebkitOverflowScrolling: 'touch'
            }}
            className="overflow-y-auto divide-y divide-indigo-50/80 scroll-smooth focus:outline-none"
          >
            {filtered.length === 0 ? (
              <div className="p-3.5 text-center">
                <p className="text-slate-500 text-xs mb-2.5 font-medium">لا توجد صفة مطابقة بالخيارات المعتمدة</p>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelectOption(search.trim())}
                    className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>اعتماد: "{search.trim()}" كصفة بالدعوى</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {filtered.map((opt, idx) => {
                  const isSelected = value === opt;
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <div
                      key={opt}
                      ref={(el) => (itemRefs.current[idx] = el)}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      style={{ height: '40px', minHeight: '40px', maxHeight: '40px' }}
                      className={`px-3 text-xs cursor-pointer select-none transition-all duration-150 flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-black border-r-4 border-indigo-900 shadow-xs'
                          : isHighlighted
                            ? 'bg-indigo-50 text-indigo-950 font-bold border-r-4 border-indigo-400'
                            : 'text-slate-700 hover:bg-indigo-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate">{opt}</span>
                        {!isSelected && getRoleCategoryBadge(opt)}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-indigo-100 font-normal">تم الاختيار</span>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {!isSelected && isHighlighted && (
                          <span className="text-[10px] text-indigo-500 font-semibold hidden sm:inline">اضغط للاختيار</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Option to adopt custom typed role when search doesn't strictly match existing item */}
                {search.trim() && !options.includes(search.trim()) && (
                  <div
                    onClick={() => handleSelectOption(search.trim())}
                    style={{ height: '40px', minHeight: '40px', maxHeight: '40px' }}
                    className="px-3 text-xs cursor-pointer select-none transition-colors bg-gradient-to-r from-indigo-50 to-indigo-100/70 hover:from-indigo-100 hover:to-indigo-200 text-indigo-900 font-black border-t-2 border-indigo-200 flex items-center justify-between"
                  >
                    <span className="truncate">استخدام مخصص: "{search.trim()}"</span>
                    <Plus className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer bar with quick navigation hints */}
          <div className="p-1.5 bg-slate-50 border-t border-indigo-100 text-[10px] text-slate-500 flex items-center justify-between px-3 select-none">
            <span className="hidden sm:inline">
              تنقل عبر <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">↓</kbd> ثم اضغط <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Enter</kbd>
            </span>
            <span className="sm:hidden">
              اسحب للتمرير باللمس
            </span>
            <span className="text-indigo-600 font-bold">
              {value ? `الصفة: ${value}` : 'لم تحدد بعد'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Default export as well as SearchableDropdown export for complete seamless drop-in
export const SearchableDropdown = PartyRoleSelect;
export default PartyRoleSelect;
