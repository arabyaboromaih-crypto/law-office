import React from 'react';
import { 
  User, Building, Calendar, Coins, CheckCircle2, 
  CreditCard, DollarSign, AlertCircle, Sparkles, 
  Clock, FileText, RefreshCw, Check, Edit3, History
} from 'lucide-react';
import { ReRentDue, ReTenant, ReUnit, ReProperty, ReOwner, ReCollectionReceipt } from '../../types';
import { getDueCollectionStatus, getMatchingCollectionReceipts } from './RealEstateData';
import { formatMonthYearAr } from './AddCollectionReceiptModal';

interface ArrearsPaymentSectionProps {
  currentTenant: ReTenant | null;
  primaryInitialDue: ReRentDue | null;
  currentProperty: ReProperty | null;
  currentUnit: ReUnit | null;
  currentOwner: ReOwner | null;
  actualRentAmount: number;
  todayISO: string;
  currentMonthISO: string;
  collections: ReCollectionReceipt[];
  arrearsDues: ReRentDue[];
  selectedDueIds: string[];
  selectedDues: ReRentDue[];
  selectionMode: 'single' | 'multi';
  handleSwitchMode: (mode: 'single' | 'multi') => void;
  handleToggleDue: (due: ReRentDue) => void;
  handleOpenEditRent: (due: ReRentDue) => void;
  periodDisplayText: string;
  alreadyPaidDues: Array<{ due: ReRentDue; receipt: ReCollectionReceipt }>;
  uncollectedArrearsCount: number;
  totalUncollectedArrearsAmount: number;
  onSwitchToPrepayment: () => void;
  // Financial & Receipt Form fields
  paidDate: string;
  setPaidDate: (val: string) => void;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  receiptNumber: string;
  setReceiptNumber: (val: string) => void;
  collectedAmount: number | string;
  setCollectedAmount: (val: number | string) => void;
  notes: string;
  setNotes: (val: string) => void;
  totalRequiredRent: number;
  numericCollected: number;
  remainingAmount: number;
  handleFillFullAmount: () => void;
}

export const ArrearsPaymentSection: React.FC<ArrearsPaymentSectionProps> = ({
  currentTenant,
  primaryInitialDue,
  currentProperty,
  currentUnit,
  currentOwner,
  actualRentAmount,
  todayISO,
  currentMonthISO,
  collections,
  arrearsDues,
  selectedDueIds,
  selectedDues,
  selectionMode,
  handleSwitchMode,
  handleToggleDue,
  handleOpenEditRent,
  periodDisplayText,
  alreadyPaidDues,
  uncollectedArrearsCount,
  totalUncollectedArrearsAmount,
  onSwitchToPrepayment,
  paidDate,
  setPaidDate,
  paymentMethod,
  setPaymentMethod,
  receiptNumber,
  setReceiptNumber,
  collectedAmount,
  setCollectedAmount,
  notes,
  setNotes,
  totalRequiredRent,
  numericCollected,
  remainingAmount,
  handleFillFullAmount,
}) => {
  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn" id="arrears-active-view">
      {/* 1. Tenant & Property Summary Strip */}
      <div className="bg-[#0A1424] border-2 border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-amber-300">
            <User className="w-5 h-5 text-amber-400" />
            <span>بيانات المستأجر وعقد الإيجار للمتأخرات</span>
          </div>
          {uncollectedArrearsCount > 0 ? (
            <span className="text-xs font-black text-rose-300 bg-rose-950/60 border border-rose-500/40 px-3 py-1 rounded-xl">
              متأخرات مسجلة: {uncollectedArrearsCount} أشهر ({totalUncollectedArrearsAmount.toLocaleString('ar-EG')} ج.م)
            </span>
          ) : (
            <span className="text-xs font-black text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>لا توجد متأخرات سابقة مسجلة</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Tenant */}
          <div className="p-3.5 rounded-xl bg-[#0F1D30] border border-white/10 space-y-1.5">
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              المستأجر
            </span>
            <p className="text-sm sm:text-base font-black text-white truncate" title={currentTenant?.fullName || primaryInitialDue?.tenantName || ''}>
              {currentTenant?.fullName || primaryInitialDue?.tenantName || '—'}
            </p>
            {currentTenant?.phone && (
              <p className="text-xs text-slate-400 font-mono">{currentTenant.phone}</p>
            )}
          </div>

          {/* Property & Unit */}
          <div className="p-3.5 rounded-xl bg-[#0F1D30] border border-white/10 space-y-1.5">
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-400" />
              العقار والوحدة
            </span>
            <p className="text-sm sm:text-base font-black text-white truncate">
              {currentProperty?.name || primaryInitialDue?.propertyName || 'العقار'}
              {' - '}
              <span className="text-amber-400">وحدة {currentUnit?.unitNumber || primaryInitialDue?.unitNumber || '—'}</span>
            </p>
            {currentOwner?.name && (
              <p className="text-xs text-slate-400 truncate">المالك: {currentOwner.name}</p>
            )}
          </div>

          {/* Period */}
          <div className="p-3.5 rounded-xl bg-[#0F1D30] border border-white/10 space-y-1.5">
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              فترة السداد المحددة
            </span>
            <p className="text-sm sm:text-base font-black text-amber-300 truncate" title={periodDisplayText}>
              {periodDisplayText}
            </p>
            <p className="text-xs text-slate-400">{selectedDues.length} شهر محدد</p>
          </div>

          {/* Actual Rent */}
          <div className="p-3.5 rounded-xl bg-[#0F1D30] border border-emerald-500/30 space-y-1.5">
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              الإيجار الشهري التعاقدي
            </span>
            <p className="text-sm sm:text-base font-black text-emerald-400 font-mono truncate">
              {actualRentAmount.toLocaleString('ar-EG')} ج.م
            </p>
            <p className="text-[11px] text-emerald-300/80">القيمة التعاقدية للوحدة</p>
          </div>
        </div>
      </div>

      {/* 2. Arrears Workspace (Month Selection & Management) */}
      <div className="bg-[#0A1424] border-2 border-amber-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 space-y-5 shadow-xl relative overflow-hidden" id="section-arrears-workspace">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-md">
              <History className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2">
                <span>جدول الإيجارات المتأخرة والمستحقة</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  سداد وتحصيل
                </span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                تحديد واختيار الشهور المتأخرة والمستحقة لسدادها وإصدار سند التحصيل المالي
              </p>
            </div>
          </div>

          {/* Mode Toggle: Single vs Multi */}
          <div className="flex items-center bg-[#0F1D30] p-1.5 rounded-xl border border-white/15 gap-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => handleSwitchMode('single')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                selectionMode === 'single'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              id="btn-mode-single-month"
            >
              شهر واحد
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('multi')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                selectionMode === 'multi'
                  ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
              id="btn-mode-multi-months"
            >
              عدة أشهر متأخرة
            </button>
          </div>
        </div>

        {/* If NO arrears exist, show helpful state with direct button to Prepayment */}
        {arrearsDues.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0F1D30] border-2 border-emerald-500/40 text-center space-y-3.5 shadow-inner">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base sm:text-lg md:text-xl font-black text-emerald-300">
              جميع الإيجارات السابقة والحالية مسددة بالكامل
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              لا توجد أي متأخرات سابقة مسجلة على هذا المستأجر. يمكنك الانتقال إلى قسم «الدفع المسبق» لسداد أشهر مستقبلية مقدماً.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onSwitchToPrepayment}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm inline-flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>الانتقال إلى قسم «الدفع المسبق»</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-200 font-bold">
              <span>انقر لتحديد الأشهر المراد سدادها في هذا السند:</span>
              <span className="text-amber-300 font-mono font-black">
                ({selectedDues.length} شهر محدد — الإجمالي: {totalRequiredRent.toLocaleString('ar-EG')} ج.م)
              </span>
            </div>

            {/* Months List */}
            <div className="flex flex-wrap gap-2.5 max-h-56 overflow-y-auto p-3.5 custom-scrollbar bg-[#08111F] rounded-2xl border-2 border-white/10">
              {arrearsDues.map((d) => {
                const isSelected = selectedDueIds.includes(d.id);
                const isPast = (d.forMonthYear || '') < currentMonthISO;
                const isCurrent = d.forMonthYear === currentMonthISO;
                const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                const matchingReceipts = getMatchingCollectionReceipts(d, collections);
                const isAlreadyCollected = matchingReceipts.length > 0 || cStatus === 'collected';

                return (
                  <div
                    key={d.id}
                    className={`rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center border ${
                      isSelected
                        ? isAlreadyCollected
                          ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50 shadow-md'
                          : 'bg-gradient-to-r from-amber-500/30 to-amber-600/25 border-amber-400 text-white shadow-md ring-2 ring-amber-400/60'
                        : isAlreadyCollected
                          ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40'
                          : 'bg-[#0F1D30] border-white/15 text-slate-200 hover:text-white hover:border-amber-400/50'
                    }`}
                  >
                    {/* Main Selection Area */}
                    <button
                      type="button"
                      onClick={() => handleToggleDue(d)}
                      className="px-3.5 py-2.5 flex items-center gap-2.5 cursor-pointer text-right outline-none flex-1"
                    >
                      <div className="flex items-center gap-1.5">
                        {isSelected ? (
                          isAlreadyCollected ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                          )
                        ) : isAlreadyCollected ? (
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-white/40 shrink-0" />
                        )}
                        <span className="font-extrabold text-white text-xs sm:text-sm">
                          {d.monthNameAr || formatMonthYearAr(d.forMonthYear)}
                        </span>
                      </div>

                      <span className="font-mono text-xs sm:text-sm text-amber-300 font-black border-r border-white/10 pr-2">
                        {(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                      </span>

                      {d.isAdjusted && (
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded bg-amber-500/30 text-amber-200 border border-amber-500/50 font-bold shadow-sm"
                          title={`تم تعديل قيمة إيجار هذا الشهر بشكل مستقل (الأصل: ${(d.originalRentAmount || actualRentAmount).toLocaleString('ar-EG')} ج.م)`}
                        >
                          معدّل
                        </span>
                      )}

                      {isAlreadyCollected ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-bold">
                          مسدد بسند
                        </span>
                      ) : isPast ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-500/40 font-bold">
                          متأخر
                        </span>
                      ) : isCurrent ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-500/40 font-bold">
                          الحالي
                        </span>
                      ) : null}
                    </button>

                    {/* Quick Edit Rent Icon for this Month */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditRent(d);
                      }}
                      className="px-2.5 py-2.5 text-amber-400 hover:text-amber-300 hover:bg-amber-400/20 rounded-l-xl transition-all cursor-pointer border-r border-white/10 flex items-center justify-center shrink-0"
                      title="تعديل القيمة الإيجارية التعاقدية ابتداءً من هذا الشهر وما بعده"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Single-month selected detail card with edit button */}
            {selectionMode === 'single' && selectedDues.length === 1 && (
              <div className="mt-3 p-4 rounded-xl bg-[#0F1D30] border-2 border-amber-400/40 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300 font-bold">الشهر المحدد للسداد:</span>
                    <span className="text-sm sm:text-base font-black text-white">
                      {selectedDues[0].monthNameAr || formatMonthYearAr(selectedDues[0].forMonthYear)}
                    </span>
                    {selectedDues[0].isAdjusted && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black">
                        قيمة معدلة تعاقدياً
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    قيمة الإيجار المستحق: <strong className="text-amber-400 font-mono font-black text-sm">{(selectedDues[0].rentAmount || 0).toLocaleString('ar-EG')} ج.م</strong>
                    {selectedDues[0].originalRentAmount && selectedDues[0].isAdjusted && (
                      <span className="text-slate-400 line-through mr-2">({(selectedDues[0].originalRentAmount || 0).toLocaleString('ar-EG')} ج.م)</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditRent(selectedDues[0])}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="تعديل القيمة الإيجارية التعاقدية ابتداءً من هذا الشهر وما بعده"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الإيجار التعاقدي</span>
                </button>
              </div>
            )}

            {/* Multiple months selected detail breakdown */}
            {selectionMode === 'multi' && selectedDues.length > 1 && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#0F1D30] border border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-300">
                  <span>الأشهر المحددة للسداد ({selectedDues.length}):</span>
                  <span className="text-amber-300 font-mono font-black">{totalRequiredRent.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDues.map(d => (
                    <span key={d.id} className="px-2 py-1 rounded bg-[#08111F] text-white border border-white/10 flex items-center gap-1">
                      <span>{d.monthNameAr || formatMonthYearAr(d.forMonthYear)}</span>
                      <strong className="text-amber-300 font-mono">({(d.rentAmount || 0).toLocaleString('ar-EG')})</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Warning if any selected due already has a collection receipt */}
            {alreadyPaidDues.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-950/60 border-2 border-amber-500/50 text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-md">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  تنبيه: {alreadyPaidDues.length === 1 
                    ? `شهر (${alreadyPaidDues[0].due.monthNameAr || formatMonthYearAr(alreadyPaidDues[0].due.forMonthYear)}) مسدد بالفعل ومسجل له سند تحصيل في المنظومة (رقم: ${alreadyPaidDues[0].receipt.receiptNumber || '—'}).` 
                    : `يوجد (${alreadyPaidDues.length}) أشهر محددة مسددة بالفعل. يمنع تكرار التحصيل لنفس الشهر.`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Financial Summary Equation for Arrears */}
      <div className="bg-[#0A1424] border-2 border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-amber-300">
            <DollarSign className="w-5 h-5 text-amber-400" />
            <span>ملخص مبالغ المتأخرات والحساب</span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            المعادلة المالية لسداد المتأخرات
          </span>
        </div>

        {/* Equation Box */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 items-center text-center">
          {/* Required */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-[#0F1D30] border border-white/10 space-y-1">
            <span className="text-xs sm:text-sm text-slate-300 font-bold block">
              الإيجار المستحق
            </span>
            <p className="text-base sm:text-xl md:text-2xl font-black text-amber-300 font-mono">
              {totalRequiredRent.toLocaleString('ar-EG')} <span className="text-xs text-slate-400">ج.م</span>
            </p>
          </div>

          {/* Collected */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-1">
            <span className="text-xs sm:text-sm text-emerald-400 font-bold block">
              المبلغ المحصل
            </span>
            <p className="text-base sm:text-xl md:text-2xl font-black text-emerald-400 font-mono">
              {numericCollected.toLocaleString('ar-EG')} <span className="text-xs text-emerald-400/80">ج.م</span>
            </p>
          </div>

          {/* Remaining */}
          <div className={`p-3.5 sm:p-5 rounded-2xl border space-y-1 ${
            remainingAmount === 0
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : remainingAmount > 0
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                : 'bg-sky-950/30 border-sky-500/40 text-sky-300'
          }`}>
            <span className="text-xs sm:text-sm font-bold block">
              {remainingAmount < 0 ? 'سداد فائض (زيادة)' : 'المتبقي'}
            </span>
            <p className="text-base sm:text-xl md:text-2xl font-black font-mono">
              {Math.abs(remainingAmount).toLocaleString('ar-EG')} <span className="text-xs opacity-80">ج.م</span>
            </p>
          </div>
        </div>

        {/* Status Message Pill */}
        <div className="pt-1">
          {remainingAmount === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>تم إدخال المبلغ كاملاً ومطابقة قيمة السند بنسبة 100%</span>
            </div>
          ) : remainingAmount > 0 ? (
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>سداد جزئي: متبقي على المستأجر {remainingAmount.toLocaleString('ar-EG')} ج.م سيظهر كمتأخر في كشف الحساب</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <span>سداد فائض: دفعة زيادة بقيمة {Math.abs(remainingAmount).toLocaleString('ar-EG')} ج.م</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Payment & Receipt Details for Arrears */}
      <div className="bg-[#0A1424] border-2 border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-amber-300">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <span>بيانات سند التحصيل والدفع للمتأخرات</span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            بيانات العملية المالية
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Paid Date */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>تاريخ التحصيل <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
              className="w-full bg-[#0F1D30] border-2 border-amber-500/30 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-bold focus:outline-none focus:border-amber-400 font-mono transition-all"
              id="input-arrears-date"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>طريقة السداد <span className="text-rose-400">*</span></span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full bg-[#0F1D30] border-2 border-amber-500/30 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-bold focus:outline-none focus:border-amber-400 transition-all cursor-pointer"
              id="select-arrears-payment-method"
            >
              <option value="نقداً">نقداً بالخزينة (كاش)</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
              <option value="إنستاباي">إنستاباي رقمي (InstaPay)</option>
              <option value="فودافون كاش">فودافون كاش / محفظة إلكترونية</option>
              <option value="شيك بنكي">شيك بنكي</option>
            </select>
          </div>

          {/* Receipt Number */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>رقم سند التحصيل <span className="text-rose-400">*</span></span>
              </label>
              <button
                type="button"
                onClick={() => setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                className="text-xs text-amber-300 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                title="توليد رقم سند جديد"
              >
                <RefreshCw className="w-3 h-3" />
                توليد تلقائي
              </button>
            </div>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              required
              placeholder="REC-2026-XXXX"
              className="w-full bg-[#0F1D30] border-2 border-amber-500/30 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-mono font-bold focus:outline-none focus:border-amber-400 transition-all"
              id="input-arrears-receipt-no"
            />
          </div>

          {/* Collected Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>المبلغ المحصل فعلياً <span className="text-rose-400">*</span></span>
              </label>
              <button
                type="button"
                onClick={handleFillFullAmount}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500/35 border border-emerald-500/40 font-bold transition-all cursor-pointer"
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
                className="w-full bg-[#0F1D30] border-2 border-emerald-500/50 rounded-xl px-4 py-3 pl-14 text-sm sm:text-base text-emerald-400 font-mono font-black focus:outline-none focus:border-emerald-400 transition-all text-left"
                id="input-arrears-amount"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm text-slate-200 font-bold block">
            ملاحظات أو الرقم المرجعي للتحويل (اختياري)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اكتب أي ملاحظات إضافية أو رقم الحوالة أو الشيك..."
            className="w-full bg-[#0F1D30] border-2 border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-amber-400 transition-all"
            id="input-arrears-notes"
          />
        </div>
      </div>
    </div>
  );
};
