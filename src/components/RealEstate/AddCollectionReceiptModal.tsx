import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, User, Building, Calendar, Coins, CheckCircle2, 
  CreditCard, DollarSign, X, Save, Loader2, Sparkles, 
  AlertCircle, ShieldCheck, Check, Clock, RefreshCw, FileText, ChevronLeft
} from 'lucide-react';
import { 
  ReRentDue, ReTenant, ReUnit, ReProperty, ReOwner, 
  ReCollectionReceipt, User as AuthUser 
} from '../../types';
import { getDueCollectionStatus, getMatchingCollectionReceipts } from './RealEstateData';

export function formatMonthYearAr(monthKey?: string): string {
  if (!monthKey || typeof monthKey !== 'string') return '';
  const [year, month] = monthKey.split('-');
  const monthMap: Record<string, string> = {
    '01': 'يناير',
    '02': 'فبراير',
    '03': 'مارس',
    '04': 'أبريل',
    '05': 'مايو',
    '06': 'يونيو',
    '07': 'يوليو',
    '08': 'أغسطس',
    '09': 'سبتمبر',
    '10': 'أكتوبر',
    '11': 'نوفمبر',
    '12': 'ديسمبر'
  };
  return month && monthMap[month] ? `${monthMap[month]} ${year}` : monthKey;
}

interface AddCollectionReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDues: ReRentDue[];
  allDues: ReRentDue[];
  tenants: ReTenant[];
  units: ReUnit[];
  properties: ReProperty[];
  owners?: ReOwner[];
  collections: ReCollectionReceipt[];
  currentUser?: AuthUser;
  onSaveReceipt: (params: {
    duesToProcess: ReRentDue[];
    collectForm: {
      paidDate: string;
      collectedAmount: number;
      paymentMethod: string;
      receiptNumber: string;
      notes: string;
    };
  }) => Promise<void>;
}

export default function AddCollectionReceiptModal({
  isOpen,
  onClose,
  initialDues,
  allDues,
  tenants,
  units,
  properties,
  owners,
  collections,
  currentUser,
  onSaveReceipt
}: AddCollectionReceiptModalProps) {
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthISO = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Primary due to derive tenant / unit / property
  const primaryInitialDue = initialDues[0] || null;

  // Selected Dues State
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single');

  // Form State
  const [paidDate, setPaidDate] = useState<string>(todayISO);
  const [paymentMethod, setPaymentMethod] = useState<string>('نقداً');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [collectedAmount, setCollectedAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState<string>('');

  // UI Feedback State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset when initialDues changes
  useEffect(() => {
    if (isOpen && initialDues && initialDues.length > 0) {
      const ids = initialDues.map(d => d.id);
      setSelectedDueIds(ids);
      setSelectionMode(ids.length > 1 ? 'multi' : 'single');

      const autoReceiptNo = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setReceiptNumber(autoReceiptNo);
      setPaidDate(todayISO);
      setPaymentMethod('نقداً');
      setNotes('');
      setErrorMessage(null);
      setSuccessToast(null);

      // Default amount
      const totalDue = initialDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
      setCollectedAmount(totalDue);
    }
  }, [isOpen, initialDues, todayISO]);

  // Find matching tenant, unit, property
  const currentTenant = useMemo(() => {
    if (!primaryInitialDue) return null;
    return tenants.find(t => t.id === primaryInitialDue.tenantId || (t.fullName && t.fullName.trim() === (primaryInitialDue.tenantName || '').trim())) || null;
  }, [primaryInitialDue, tenants]);

  const currentUnit = useMemo(() => {
    if (!primaryInitialDue) return null;
    return units.find(u => u.id === primaryInitialDue.unitId || (u.unitNumber && u.unitNumber === primaryInitialDue.unitNumber)) || null;
  }, [primaryInitialDue, units]);

  const currentProperty = useMemo(() => {
    if (!primaryInitialDue) return null;
    return properties.find(p => p.id === primaryInitialDue.propertyId || (currentUnit && p.id === currentUnit.propertyId)) || null;
  }, [primaryInitialDue, properties, currentUnit]);

  // Available dues for THIS tenant across all months to allow smooth switching or multi-selection
  const availableTenantDues = useMemo(() => {
    if (!primaryInitialDue) return [];
    const tenantId = primaryInitialDue.tenantId;
    const tenantName = primaryInitialDue.tenantName;

    // Filter dues for this tenant
    const duesForTenant = allDues.filter(d => {
      const matchTId = tenantId && d.tenantId === tenantId;
      const matchTName = tenantName && d.tenantName && d.tenantName.trim() === tenantName.trim();
      return matchTId || matchTName;
    });

    // Deduplicate by forMonthYear
    const uniqueMap = new Map<string, ReRentDue>();
    duesForTenant.forEach(d => {
      const key = d.forMonthYear || d.id;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, d);
      }
    });

    // Sort by forMonthYear ascending (oldest to newest)
    return Array.from(uniqueMap.values()).sort((a, b) => (a.forMonthYear || '').localeCompare(b.forMonthYear || ''));
  }, [primaryInitialDue, allDues]);

  // Active selected dues objects
  const selectedDues = useMemo(() => {
    return availableTenantDues.filter(d => selectedDueIds.includes(d.id));
  }, [availableTenantDues, selectedDueIds]);

  // Breakdown of selected dues into already paid (with existing receipt) vs payable
  const { alreadyPaidDues, payableDues } = useMemo(() => {
    const paid: Array<{ due: ReRentDue; receipt: ReCollectionReceipt }> = [];
    const payable: ReRentDue[] = [];

    selectedDues.forEach(due => {
      const matchingReceipts = getMatchingCollectionReceipts(due, collections);
      if (matchingReceipts.length > 0) {
        paid.push({ due, receipt: matchingReceipts[0] });
      } else {
        payable.push(due);
      }
    });

    return { alreadyPaidDues: paid, payableDues: payable };
  }, [selectedDues, collections]);

  const hasAlreadyPaidSelected = alreadyPaidDues.length > 0;

  // Calculate Required Rent Sum only for payable dues
  const totalRequiredRent = useMemo(() => {
    return payableDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
  }, [payableDues]);

  // Update collectedAmount automatically when user toggles dues IF collectedAmount matches previous total
  const handleToggleDue = (due: ReRentDue) => {
    if (selectionMode === 'single') {
      setSelectedDueIds([due.id]);
      const matching = getMatchingCollectionReceipts(due, collections);
      setCollectedAmount(matching.length > 0 ? 0 : (due.rentAmount || 0));
    } else {
      let nextIds: string[];
      if (selectedDueIds.includes(due.id)) {
        nextIds = selectedDueIds.filter(id => id !== due.id);
      } else {
        nextIds = [...selectedDueIds, due.id];
      }
      setSelectedDueIds(nextIds);
      const nextTotal = availableTenantDues
        .filter(d => nextIds.includes(d.id) && getMatchingCollectionReceipts(d, collections).length === 0)
        .reduce((sum, d) => sum + (d.rentAmount || 0), 0);
      setCollectedAmount(nextTotal);
    }
  };

  // Switch Mode handler
  const handleSwitchMode = (mode: 'single' | 'multi') => {
    setSelectionMode(mode);
    if (mode === 'single' && selectedDues.length > 1) {
      const firstId = selectedDues[0]?.id;
      if (firstId) {
        setSelectedDueIds([firstId]);
        const d = availableTenantDues.find(item => item.id === firstId);
        if (d) {
          const matching = getMatchingCollectionReceipts(d, collections);
          setCollectedAmount(matching.length > 0 ? 0 : (d.rentAmount || 0));
        }
      }
    }
  };

  // Remaining calculation
  const numericCollected = Number(collectedAmount) || 0;
  const remainingAmount = totalRequiredRent - numericCollected;

  // Handle Quick Fill full amount
  const handleFillFullAmount = () => {
    setCollectedAmount(totalRequiredRent);
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Strict Validation: Check if single or all selected dues already have a collection receipt
    if (selectedDues.length === 1 && hasAlreadyPaidSelected) {
      const paidItem = alreadyPaidDues[0];
      const mName = paidItem.due.monthNameAr || formatMonthYearAr(paidItem.due.forMonthYear);
      const rNum = paidItem.receipt.receiptNumber ? ` (رقم السند: ${paidItem.receipt.receiptNumber})` : '';
      setErrorMessage(`هذا الشهر (${mName}) مسدد بالفعل وله سند تحصيل محفوظ${rNum}. لا يمكن حفظ دفعة مكررة.`);
      return;
    }

    if (payableDues.length === 0) {
      setErrorMessage('جميع الأشهر المحددة مسددة بالفعل ولها سندات تحصيل محفوظة في قاعدة البيانات.');
      return;
    }

    if (numericCollected <= 0) {
      setErrorMessage('يرجى إدخال مبلغ محصل صحيح أكبر من الصفر للأشهر المستحقة.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await onSaveReceipt({
        duesToProcess: payableDues,
        collectForm: {
          paidDate,
          collectedAmount: numericCollected,
          paymentMethod,
          receiptNumber: receiptNumber.trim() || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          notes
        }
      });

      // Show success toast
      setSuccessToast(
        payableDues.length === 1
          ? `تم حفظ سند التحصيل لشهر ${payableDues[0].monthNameAr || formatMonthYearAr(payableDues[0].forMonthYear)} بنجاح`
          : `تم حفظ سند التحصيل لـ (${payableDues.length}) أشهر بنجاح`
      );
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setIsSaving(false);
      setErrorMessage(err?.message || 'حدث خطأ أثناء حفظ سند التحصيل. يرجى المحاولة مرة أخرى.');
    }
  };

  if (!isOpen || !primaryInitialDue) return null;

  // Display Period text
  const periodDisplayText = selectedDues.length === 1 
    ? (selectedDues[0].monthNameAr || formatMonthYearAr(selectedDues[0].forMonthYear))
    : `${selectedDues.length} أشهر (${selectedDues.map(d => d.monthNameAr || formatMonthYearAr(d.forMonthYear)).join('، ')})`;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
        dir="rtl"
        id="add-collection-receipt-overlay"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0F1D30] border border-[#D4A84F]/30 rounded-2xl sm:rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.7)] text-right text-[#F8F9FB] relative overflow-hidden my-auto"
          id="add-collection-receipt-modal"
        >
          {/* SUCCESS TOAST OVERLAY */}
          <AnimatePresence>
            {successToast && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute inset-x-0 top-4 z-50 flex justify-center px-4"
              >
                <div className="bg-emerald-600 border border-emerald-400 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm sm:text-base">
                  <CheckCircle2 className="w-6 h-6 text-white shrink-0 animate-bounce" />
                  <span>{successToast}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HEADER - FIXED TOP */}
          <div className="flex items-center justify-between border-b border-[#D4A84F]/20 p-4 sm:p-5 shrink-0 bg-[#0F1D30]/95 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-2xl bg-[#D4A84F]/15 border border-[#D4A84F]/30 text-[#D4A84F] shrink-0 shadow-inner">
                <Receipt className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-[#F8F9FB] flex items-center gap-2">
                  <span>إضافة سند تحصيل</span>
                  <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30">
                    إيجارات وتحصيل
                  </span>
                </h3>
                <p className="text-xs text-[#9EA7B8] font-medium mt-0.5 truncate">
                  تسجيل دفعة إيجار جديدة وتوليد سند تحصيل مالي رسمي للمستأجر
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#9EA7B8] hover:text-white transition-colors cursor-pointer shrink-0 border border-white/10"
              title="إغلاق النافذة"
              id="btn-close-collection-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* FORM BODY - SCROLLABLE */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">

              {/* ERROR MESSAGE BANNER */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 1: بيانات المستأجر والعقار */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#D4A84F]">
                    <User className="w-4 h-4 text-[#D4A84F]" />
                    <span>بيانات المستأجر والعقار</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#9EA7B8] bg-white/5 px-2.5 py-0.5 rounded-lg">
                    البيانات التعاقدية
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Tenant */}
                  <div className="p-3 rounded-xl bg-[#0F1D30]/90 border border-white/5 space-y-1">
                    <span className="text-[10px] text-[#9EA7B8] font-bold flex items-center gap-1">
                      <User className="w-3 h-3 text-[#D4A84F]" />
                      المستأجر
                    </span>
                    <p className="text-xs sm:text-sm font-black text-[#F8F9FB] truncate" title={currentTenant?.fullName || primaryInitialDue.tenantName}>
                      {currentTenant?.fullName || primaryInitialDue.tenantName || '—'}
                    </p>
                  </div>

                  {/* Property & Unit */}
                  <div className="p-3 rounded-xl bg-[#0F1D30]/90 border border-white/5 space-y-1">
                    <span className="text-[10px] text-[#9EA7B8] font-bold flex items-center gap-1">
                      <Building className="w-3 h-3 text-[#D4A84F]" />
                      العقار / الوحدة
                    </span>
                    <p className="text-xs sm:text-sm font-black text-[#F8F9FB] truncate">
                      {currentProperty?.name || primaryInitialDue.propertyName || 'عقار'}
                      {' - '}
                      <span className="text-[#D4A84F]">وحدة {currentUnit?.unitNumber || primaryInitialDue.unitNumber || '—'}</span>
                    </p>
                  </div>

                  {/* Period */}
                  <div className="p-3 rounded-xl bg-[#0F1D30]/90 border border-white/5 space-y-1">
                    <span className="text-[10px] text-[#9EA7B8] font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-sky-400" />
                      فترة الاستحقاق
                    </span>
                    <p className="text-xs sm:text-sm font-black text-sky-300 truncate" title={periodDisplayText}>
                      {periodDisplayText}
                    </p>
                  </div>

                  {/* Due Rent */}
                  <div className="p-3 rounded-xl bg-[#0F1D30]/90 border border-emerald-500/20 bg-emerald-950/10 space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <Coins className="w-3 h-3 text-emerald-400" />
                      الإيجار المستحق
                    </span>
                    <p className="text-xs sm:text-sm font-black text-emerald-400 font-mono truncate">
                      {totalRequiredRent.toLocaleString('ar-EG')} ج.م
                    </p>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 2: فترة الاستحقاق واختيار الشهور */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#D4A84F]">
                    <Calendar className="w-4 h-4 text-[#D4A84F]" />
                    <span>فترة الاستحقاق واختيار الشهور</span>
                  </div>

                  {/* Mode Toggle: Single vs Multi */}
                  <div className="flex items-center bg-[#0F1D30] p-1 rounded-xl border border-white/10 gap-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('single')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectionMode === 'single'
                          ? 'bg-[#D4A84F] text-slate-950 shadow-sm font-black'
                          : 'text-[#9EA7B8] hover:text-white'
                      }`}
                    >
                      شهر واحد
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('multi')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectionMode === 'multi'
                          ? 'bg-[#D4A84F] text-slate-950 shadow-sm font-black'
                          : 'text-[#9EA7B8] hover:text-white'
                      }`}
                    >
                      عدة أشهر (سداد مسبق / متأخرات)
                    </button>
                  </div>
                </div>

                {/* Month Chips Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#9EA7B8] font-bold">
                    <span>اختر الشهر المراد سداده:</span>
                    <span className="text-amber-300">
                      ({selectedDues.length} شهر محدد بإجمالي {totalRequiredRent.toLocaleString('ar-EG')} ج.م)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-2 custom-scrollbar bg-[#0F1D30]/60 rounded-xl border border-white/5">
                    {availableTenantDues.map((d) => {
                      const isSelected = selectedDueIds.includes(d.id);
                      const isPast = (d.forMonthYear || '') < currentMonthISO;
                      const isCurrent = d.forMonthYear === currentMonthISO;
                      const isFuture = (d.forMonthYear || '') > currentMonthISO;
                      const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                      const matchingReceipts = getMatchingCollectionReceipts(d, collections);
                      const isAlreadyCollected = matchingReceipts.length > 0 || cStatus === 'collected' || cStatus === 'prepaid';

                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleToggleDue(d)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border text-right ${
                            isSelected
                              ? isAlreadyCollected
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 ring-1 ring-emerald-500/40'
                                : 'bg-gradient-to-r from-[#D4A84F]/25 to-[#C3973E]/20 border-[#D4A84F] text-[#F8F9FB] shadow-md ring-1 ring-[#D4A84F]/40'
                              : isAlreadyCollected
                                ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30'
                                : 'bg-[#08111F] border-white/10 text-[#9EA7B8] hover:text-white hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isSelected ? (
                              isAlreadyCollected ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#D4A84F] shrink-0" />
                              )
                            ) : isAlreadyCollected ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                            )}
                            <span className="font-extrabold text-[#F8F9FB]">
                              {d.monthNameAr || formatMonthYearAr(d.forMonthYear)}
                            </span>
                          </div>

                          <span className="font-mono text-[11px] text-amber-300/90 font-bold border-r border-white/10 pr-2">
                            {(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                          </span>

                          {isAlreadyCollected ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              مسدد بسند
                            </span>
                          ) : isPast ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              متأخر
                            </span>
                          ) : isCurrent ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              الحالي
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              مستقبلي
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Multi-month breakdown message when mixed months selected */}
                  {selectedDues.length > 1 && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#0F1D30] border border-white/10 space-y-2 text-xs">
                      <div className="font-bold text-[#F8F9FB] flex items-center justify-between border-b border-white/5 pb-1.5">
                        <span>تفصيل الأشهر المحددة ({selectedDues.length} شهر):</span>
                        <span className="text-amber-300 font-mono font-bold">
                          المطلوب سداده فعلياً: {totalRequiredRent.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>

                      {hasAlreadyPaidSelected && (
                        <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>أشهر مسددة مسبقاً بسند تحصيل محفوظ ({alreadyPaidDues.length}):</span>
                          </div>
                          <p className="text-[11px] text-emerald-200/90 mr-5 leading-relaxed">
                            {alreadyPaidDues.map(p => `${p.due.monthNameAr || formatMonthYearAr(p.due.forMonthYear)}${p.receipt.receiptNumber ? ` (سند: ${p.receipt.receiptNumber})` : ''}`).join('، ')}
                            {' — '}
                            <span className="text-emerald-400 font-bold">لن يتم تكرار تحصيلها أو مضاعفة سنداتها.</span>
                          </p>
                        </div>
                      )}

                      {payableDues.length > 0 ? (
                        <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>الأشهر المستحقة التي سيتم تحصيلها الآن ({payableDues.length}):</span>
                          </div>
                          <p className="text-[11px] text-amber-200/90 mr-5 leading-relaxed font-mono">
                            {payableDues.map(p => `${p.monthNameAr || formatMonthYearAr(p.forMonthYear)} (${(p.rentAmount || 0).toLocaleString('ar-EG')} ج.م)`).join(' + ')}
                          </p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>جميع الأشهر المحددة مسددة بالفعل ولا توجد أي أشهر متبقية للسداد.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 3: ملخص المبلغ والحساب (المستحق - المحصل = المتبقي) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#D4A84F]">
                    <DollarSign className="w-4 h-4 text-[#D4A84F]" />
                    <span>ملخص المبلغ والحساب</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#9EA7B8]">
                    المعادلة المالية للسند
                  </span>
                </div>

                {/* Equation Box */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 items-center text-center">
                  {/* Required */}
                  <div className="p-3 sm:p-4 rounded-xl bg-[#0F1D30] border border-white/10 space-y-1">
                    <span className="text-[10px] sm:text-xs text-[#9EA7B8] font-bold block">
                      الإيجار المستحق
                    </span>
                    <p className="text-sm sm:text-lg font-black text-amber-300 font-mono">
                      {totalRequiredRent.toLocaleString('ar-EG')} <span className="text-[10px] sm:text-xs text-[#9EA7B8]">ج.م</span>
                    </p>
                  </div>

                  {/* Collected */}
                  <div className="p-3 sm:p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                    <span className="text-[10px] sm:text-xs text-emerald-400 font-bold block">
                      المبلغ المحصل
                    </span>
                    <p className="text-sm sm:text-lg font-black text-emerald-400 font-mono">
                      {numericCollected.toLocaleString('ar-EG')} <span className="text-[10px] sm:text-xs text-emerald-400/80">ج.م</span>
                    </p>
                  </div>

                  {/* Remaining */}
                  <div className={`p-3 sm:p-4 rounded-xl border space-y-1 ${
                    remainingAmount === 0
                      ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-300'
                      : remainingAmount > 0
                        ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                        : 'bg-sky-950/20 border-sky-500/30 text-sky-300'
                  }`}>
                    <span className="text-[10px] sm:text-xs font-bold block">
                      {remainingAmount < 0 ? 'سداد فائض (زيادة)' : 'المتبقي'}
                    </span>
                    <p className="text-sm sm:text-lg font-black font-mono">
                      {Math.abs(remainingAmount).toLocaleString('ar-EG')} <span className="text-[10px] sm:text-xs opacity-80">ج.م</span>
                    </p>
                  </div>
                </div>

                {/* Status Message Pill */}
                <div className="pt-1">
                  {remainingAmount === 0 ? (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>تم إدخال المبلغ بالكامل ومطابقة قيمة السند بنسبة 100%</span>
                    </div>
                  ) : remainingAmount > 0 ? (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>سداد جزئي: متبقي على المستأجر {remainingAmount.toLocaleString('ar-EG')} ج.م سيظهر كمتأخر في كشف الحساب</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>سداد فائض: دفعة زيادة بقيمة {Math.abs(remainingAmount).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 4: بيانات التحصيل والدفع */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#D4A84F]">
                    <CreditCard className="w-4 h-4 text-[#D4A84F]" />
                    <span>بيانات التحصيل والدفع</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#9EA7B8]">
                    بيانات السند المالي
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Paid Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#D4A84F]" />
                      <span>تاريخ التحصيل <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      required
                      className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] font-mono transition-all"
                      id="input-collection-date"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#D4A84F]" />
                      <span>طريقة السداد <span className="text-rose-400">*</span></span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                      className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all cursor-pointer"
                      id="select-collection-payment-method"
                    >
                      <option value="نقداً">نقداً بالخزينة (كاش)</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="إنستاباي">إنستاباي رقمي (InstaPay)</option>
                      <option value="فودافون كاش">فودافون كاش / محفظة إلكترونية</option>
                      <option value="شيك بنكي">شيك بنكي</option>
                    </select>
                  </div>

                  {/* Receipt Number */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#D4A84F]" />
                        <span>رقم سند التحصيل <span className="text-rose-400">*</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                        className="text-[10px] text-[#D4A84F] hover:underline font-bold flex items-center gap-1"
                        title="توليد رقم سند جديد"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        توليد تلقائي
                      </button>
                    </div>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      required
                      placeholder="REC-2026-XXXX"
                      className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#F8F9FB] font-mono font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                      id="input-collection-receipt-no"
                    />
                  </div>

                  {/* Collected Amount */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-emerald-400" />
                        <span>المبلغ المحصل فعلياً <span className="text-rose-400">*</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={handleFillFullAmount}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 font-bold transition-all cursor-pointer"
                        title="تعبئة المبلغ المطلوب كاملاً بضغطة واحدة"
                      >
                        تعبئة المبلغ بالكامل
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={collectedAmount}
                        onChange={(e) => setCollectedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        required
                        placeholder="0"
                        className="w-full bg-[#0F1D30] border border-emerald-500/30 rounded-xl px-3.5 py-2.5 pl-14 text-xs sm:text-sm text-emerald-400 font-mono font-black focus:outline-none focus:border-emerald-400 transition-all text-left"
                        id="input-collection-amount"
                      />
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#9EA7B8]">
                        ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes & Bank Reference */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#9EA7B8] font-bold block">
                    ملاحظات أو الرقم المرجعي للتحويل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب أي ملاحظات إضافية أو رقم الحوالة/الشيك..."
                    className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    id="input-collection-notes"
                  />
                </div>
              </div>

            </div>

            {/* ------------------------------------------------------------- */}
            {/* STICKY FOOTER - FIXED BOTTOM BAR */}
            {/* ------------------------------------------------------------- */}
            <div className="flex items-center justify-between p-3.5 sm:p-5 border-t border-[#D4A84F]/20 bg-[#0A1424] shrink-0 gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#9EA7B8] font-medium">
                <ShieldCheck className="w-4 h-4 text-[#D4A84F] shrink-0" />
                <span>سيتم حفظ سند التحصيل وربطه تلقائياً بالمستأجر والوحدة والعقد</span>
              </div>

              <div className="flex items-center gap-2.5 mr-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 sm:px-5 py-2.5 rounded-xl border border-white/15 text-[#9EA7B8] hover:text-white hover:bg-white/5 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                  id="btn-cancel-collection"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSaving || selectedDues.length === 0 || payableDues.length === 0 || Number(collectedAmount) <= 0}
                  className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#C3973E] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-[#D4A84F]/20 transition-all flex items-center gap-2 cursor-pointer"
                  id="btn-save-collection-receipt"
                  title={
                    selectedDues.length === 1 && hasAlreadyPaidSelected
                      ? 'هذا الشهر مسدد بالفعل وله سند تحصيل'
                      : payableDues.length === 0 && selectedDues.length > 0
                        ? 'جميع الأشهر المحددة مسددة بالفعل ولها سندات تحصيل'
                        : 'حفظ سند التحصيل'
                  }
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-slate-950" />
                      <span>جاري حفظ سند التحصيل...</span>
                    </>
                  ) : selectedDues.length === 1 && hasAlreadyPaidSelected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                      <span>الشهر مسدد بالفعل وله سند تحصيل</span>
                    </>
                  ) : payableDues.length === 0 && selectedDues.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                      <span>الأشهر المحددة مسددة بالفعل</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                      <span>حفظ سند التحصيل ({payableDues.length > 0 ? payableDues.length : 0} شهر)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
