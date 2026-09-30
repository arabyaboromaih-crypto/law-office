import React from 'react';
import { 
  User, Building, Calendar, Coins, CheckCircle2, 
  CreditCard, DollarSign, AlertCircle, Sparkles, 
  FileText, RefreshCw, Plus, Trash2, CalendarPlus, 
  AlertTriangle, ArrowLeft, ShieldCheck, Check
} from 'lucide-react';
import { ReRentDue, ReTenant, ReUnit, ReProperty, ReOwner, ReCollectionReceipt } from '../../types';
import { getDueCollectionStatus, getMatchingCollectionReceipts } from './RealEstateData';
import { formatMonthYearAr } from './AddCollectionReceiptModal';

interface PrepaymentSectionProps {
  currentTenant: ReTenant | null;
  primaryInitialDue: ReRentDue | null;
  currentProperty: ReProperty | null;
  currentUnit: ReUnit | null;
  currentOwner: ReOwner | null;
  actualRentAmount: number;
  todayISO: string;
  currentMonthISO: string;
  collections: ReCollectionReceipt[];
  addedPrepaidDues: ReRentDue[];
  futureTenantDues: ReRentDue[];
  selectedDueIds: string[];
  prepaySelectedMonth: string;
  setPrepaySelectedMonth: (m: string) => void;
  prepayRentAmount: number | string;
  setPrepayRentAmount: (amt: number | string) => void;
  prepayInlineError: string | null;
  setPrepayInlineError: (e: string | null) => void;
  prepayInlineSuccess: string | null;
  setPrepayInlineSuccess: (s: string | null) => void;
  handleAddPrepaidMonth: (targetMonth?: string, customRent?: number) => void;
  handleAddMultiplePrepaidMonths: (count: number) => void;
  handleRemovePrepaidDue: (dueId: string) => void;
  handleToggleDue: (due: ReRentDue) => void;
  uncollectedArrearsCount: number;
  totalUncollectedArrearsAmount: number;
  onSwitchToArrears: () => void;
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

export const PrepaymentSection: React.FC<PrepaymentSectionProps> = ({
  currentTenant,
  primaryInitialDue,
  currentProperty,
  currentUnit,
  currentOwner,
  actualRentAmount,
  todayISO,
  currentMonthISO,
  collections,
  addedPrepaidDues,
  futureTenantDues,
  selectedDueIds,
  prepaySelectedMonth,
  setPrepaySelectedMonth,
  prepayRentAmount,
  setPrepayRentAmount,
  prepayInlineError,
  setPrepayInlineError,
  prepayInlineSuccess,
  setPrepayInlineSuccess,
  handleAddPrepaidMonth,
  handleAddMultiplePrepaidMonths,
  handleRemovePrepaidDue,
  handleToggleDue,
  uncollectedArrearsCount,
  totalUncollectedArrearsAmount,
  onSwitchToArrears,
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
  const totalAddedPrepaidAmount = addedPrepaidDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);

  return (
    <div className="space-y-6 sm:space-y-7 animate-fadeIn" id="prepayment-active-view">
      {/* 1. Tenant & Property Summary Strip */}
      <div className="bg-[#0A1424] border-2 border-purple-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-purple-300">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>بيانات المستأجر وعقد الإيجار للدفع المسبق</span>
          </div>
          {addedPrepaidDues.length > 0 ? (
            <span className="text-xs font-black text-purple-200 bg-purple-950/70 border border-purple-400/50 px-3.5 py-1 rounded-xl shadow-inner">
              الأشهر المضافة للدفع المسبق: {addedPrepaidDues.length} أشهر ({totalAddedPrepaidAmount.toLocaleString('ar-EG')} ج.م)
            </span>
          ) : (
            <span className="text-xs font-black text-purple-300 bg-purple-950/50 border border-purple-500/30 px-3 py-1 rounded-xl">
              إضافة وسداد أشهر قادمة مقدماً
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Tenant */}
          <div className="p-3.5 rounded-xl bg-[#0F1D30] border border-white/10 space-y-1.5">
            <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-purple-400" />
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
              <Building className="w-3.5 h-3.5 text-purple-400" />
              العقار والوحدة
            </span>
            <p className="text-sm sm:text-base font-black text-white truncate">
              {currentProperty?.name || primaryInitialDue?.propertyName || 'العقار'}
              {' - '}
              <span className="text-purple-400">وحدة {currentUnit?.unitNumber || primaryInitialDue?.unitNumber || '—'}</span>
            </p>
            {currentOwner?.name && (
              <p className="text-xs text-slate-400 truncate">المالك: {currentOwner.name}</p>
            )}
          </div>

          {/* Added Prepaid Months Count */}
          <div className="p-3.5 rounded-xl bg-[#0F1D30] border border-purple-500/30 space-y-1.5">
            <span className="text-xs text-purple-300 font-bold flex items-center gap-1.5">
              <CalendarPlus className="w-3.5 h-3.5 text-purple-400" />
              الأشهر المسبقة في هذه الجلسة
            </span>
            <p className="text-sm sm:text-base font-black text-purple-200 truncate">
              {addedPrepaidDues.length} أشهر مستقبلية
            </p>
            <p className="text-xs text-slate-400 font-mono font-black">{totalAddedPrepaidAmount.toLocaleString('ar-EG')} ج.م</p>
          </div>

          {/* Actual Monthly Rent */}
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

      {/* 2. Prepayment Workspace (Month Picker, Quick Add, Added Months List) */}
      <div 
        className="bg-gradient-to-br from-[#150F2E] via-[#0A1424] to-[#181033] border-2 border-purple-400/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 space-y-5 shadow-2xl relative overflow-hidden"
        id="section-prepayment-workspace"
      >
        {/* Accent glow background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/30 pb-4 relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-purple-500/25 text-purple-200 border border-purple-400/60 shadow-md">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2">
                <span>تخطيط وإضافة الدفع المسبق للأشهر المستقبلية</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/50">
                  أشهر مستقبلية
                </span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-200 font-medium mt-0.5">
                إضافة شهر أو عدة أشهر قادمة وسدادها مقدماً مع ربطها تلقائياً بالموكل والوحدة وتحديث العقد
              </p>
            </div>
          </div>

          <div className="text-xs sm:text-sm font-bold bg-purple-950/70 border border-purple-400/50 px-3.5 py-1.5 rounded-xl text-purple-200 shadow-inner">
            الإيجار الفعلي للوحدة: <span className="text-emerald-300 font-mono font-black">{actualRentAmount.toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>

        {/* Arrears Notice if tenant has overdue months */}
        {uncollectedArrearsCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-950/60 border-2 border-amber-500/60 text-amber-200 text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3 shadow-lg relative">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                تنبيه: يوجد على المستأجر <strong>({uncollectedArrearsCount}) أشهر متأخرة سابقة</strong> بقيمة <strong>({totalUncollectedArrearsAmount.toLocaleString('ar-EG')} ج.م)</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={onSwitchToArrears}
              className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <span>الانتقال لسداد المتأخرات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Linking Context Banner */}
        <div className="p-3.5 rounded-xl bg-[#08111F]/95 border border-purple-400/30 text-xs sm:text-sm text-slate-200 flex flex-wrap items-center justify-between gap-2.5 relative">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              الربط التلقائي: 
              <strong className="text-white mx-1">{currentTenant?.fullName || primaryInitialDue?.tenantName}</strong>
              — وحدة: <strong className="text-amber-300">{currentUnit?.unitNumber || primaryInitialDue?.unitNumber}</strong>
              {' '}({currentProperty?.name || primaryInitialDue?.propertyName})
            </span>
          </div>
          <span className="text-[11px] font-bold text-purple-300 bg-purple-950/50 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
            يتم التحقق لمنع تكرار أي شهر مسجل
          </span>
        </div>

        {/* Inline Alerts for Prepayment */}
        {prepayInlineError && (
          <div className="p-3.5 rounded-xl bg-rose-500/20 border-2 border-rose-500/50 text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-md">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{prepayInlineError}</span>
          </div>
        )}

        {prepayInlineSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-md">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{prepayInlineSuccess}</span>
          </div>
        )}

        {/* Action Row: Month Picker + Rent Amount + ADD Button */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end bg-[#0A1424] p-4 sm:p-5 rounded-2xl border-2 border-purple-500/40 shadow-md relative">
          {/* Select Month */}
          <div className="sm:col-span-5 space-y-1.5">
            <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-1.5">
              <CalendarPlus className="w-4 h-4 text-purple-400" />
              <span>الشهر المستقبلي المراد سداده مقدماً</span>
            </label>
            <input
              type="month"
              value={prepaySelectedMonth}
              onChange={(e) => {
                setPrepaySelectedMonth(e.target.value);
                setPrepayInlineError(null);
                setPrepayInlineSuccess(null);
              }}
              className="w-full bg-[#0F1D30] border-2 border-purple-400/40 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-bold font-mono focus:outline-none focus:border-purple-400 transition-all"
              id="input-prepay-month"
            />
          </div>

          {/* Rent Amount */}
          <div className="sm:col-span-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>قيمة إيجار الشهر</span>
              </label>
              {prepayRentAmount !== '' && Number(prepayRentAmount) !== actualRentAmount && (
                <button
                  type="button"
                  onClick={() => setPrepayRentAmount(actualRentAmount)}
                  className="text-[11px] text-purple-300 hover:underline cursor-pointer font-bold"
                >
                  استعادة الفعلي ({actualRentAmount.toLocaleString('ar-EG')})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="any"
                value={prepayRentAmount}
                onChange={(e) => {
                  setPrepayRentAmount(e.target.value === '' ? '' : Number(e.target.value));
                  setPrepayInlineError(null);
                }}
                placeholder={String(actualRentAmount)}
                className="w-full bg-[#0F1D30] border-2 border-purple-400/40 rounded-xl px-4 py-3 pl-14 text-sm sm:text-base text-emerald-400 font-mono font-black focus:outline-none focus:border-purple-400 transition-all text-left"
                id="input-prepay-rent"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                ج.م
              </span>
            </div>
          </div>

          {/* Add Month Button */}
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={() => handleAddPrepaidMonth()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 border border-purple-400/50 transition-all active:scale-95 cursor-pointer"
              id="btn-add-prepaid-month"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              <span>إضافة الشهر</span>
            </button>
          </div>
        </div>

        {/* Quick Multi-month Addition Buttons */}
        <div className="space-y-2 relative">
          <span className="text-xs text-slate-300 font-bold block">إضافة سريعة لعدة أشهر متتالية:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => handleAddMultiplePrepaidMonths(1)}
              className="px-3.5 py-2.5 rounded-xl bg-[#0F1D30] hover:bg-purple-900/40 border border-purple-400/40 text-purple-200 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              id="btn-quick-add-1-month"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>الشهر القادم مباشرة</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddMultiplePrepaidMonths(3)}
              className="px-3.5 py-2.5 rounded-xl bg-[#0F1D30] hover:bg-purple-900/40 border border-purple-400/40 text-purple-200 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              id="btn-quick-add-3-months"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>+ 3 أشهر (ربع سنوي)</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddMultiplePrepaidMonths(6)}
              className="px-3.5 py-2.5 rounded-xl bg-[#0F1D30] hover:bg-purple-900/40 border border-purple-400/40 text-purple-200 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              id="btn-quick-add-6-months"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>+ 6 أشهر (نصف سنوي)</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddMultiplePrepaidMonths(12)}
              className="px-3.5 py-2.5 rounded-xl bg-[#0F1D30] hover:bg-purple-900/40 border border-purple-400/40 text-purple-200 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              id="btn-quick-add-12-months"
            >
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>+ سنة كاملة (12 شهر)</span>
            </button>
          </div>
        </div>

        {/* List of Added Prepaid Months in this session */}
        {addedPrepaidDues.length > 0 && (
          <div className="space-y-3 pt-2 relative border-t border-purple-500/25">
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-200">
              <span>الأشهر المضافة للدفع المسبق حالياً ({addedPrepaidDues.length}):</span>
              <span className="text-emerald-300 font-mono font-black">
                إجمالي الدفع المسبق: {totalAddedPrepaidAmount.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {addedPrepaidDues.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl bg-[#0F1D30] border-2 border-purple-400/50 flex items-center justify-between gap-2 shadow-md"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black text-white">
                        {d.monthNameAr || formatMonthYearAr(d.forMonthYear)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-200 font-bold border border-purple-500/40">
                        مسبق
                      </span>
                    </div>
                    <p className="text-xs font-mono font-black text-emerald-300">
                      {(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemovePrepaidDue(d.id)}
                    className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 rounded-lg transition-all cursor-pointer border border-rose-500/30"
                    title="حذف هذا الشهر من قائمة الدفع المسبق"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Future Dues in System */}
        {futureTenantDues.length > 0 && (
          <div className="space-y-2 pt-2 relative border-t border-white/10">
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 font-bold">
              <span>أشهر مستقبلية أخرى مسجلة بالفعل في النظام:</span>
              <span className="text-slate-400 text-xs">{futureTenantDues.length} شهر</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {futureTenantDues.map(d => {
                const isSel = selectedDueIds.includes(d.id);
                const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                const isPaid = cStatus === 'collected' || cStatus === 'prepaid' || getMatchingCollectionReceipts(d, collections).length > 0;
                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={isPaid}
                    onClick={() => handleToggleDue(d)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                      isPaid
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 opacity-60 cursor-not-allowed'
                        : isSel
                          ? 'bg-purple-500/30 border-purple-400 text-white shadow-md ring-2 ring-purple-400/50'
                          : 'bg-[#0F1D30] border-white/10 text-slate-300 hover:border-purple-400/40'
                    }`}
                  >
                    {isSel && <Check className="w-3.5 h-3.5 text-purple-300" />}
                    <span>{d.monthNameAr || formatMonthYearAr(d.forMonthYear)}</span>
                    <span className="font-mono text-emerald-400">{(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م</span>
                    {isPaid && <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">مسدد</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Financial Summary Equation for Prepayment */}
      <div className="bg-[#0A1424] border-2 border-purple-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-purple-300">
            <DollarSign className="w-5 h-5 text-purple-400" />
            <span>ملخص مبالغ الدفع المسبق والحساب</span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            المعادلة المالية للدفع المسبق
          </span>
        </div>

        {/* Equation Box */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 items-center text-center">
          {/* Required */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-[#0F1D30] border border-white/10 space-y-1">
            <span className="text-xs sm:text-sm text-slate-300 font-bold block">
              إجمالي الدفع المسبق المطلوب
            </span>
            <p className="text-base sm:text-xl md:text-2xl font-black text-purple-300 font-mono">
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
              <span>سداد جزئي: متبقي {remainingAmount.toLocaleString('ar-EG')} ج.م</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <span>سداد فائض: دفعة زيادة بقيمة {Math.abs(remainingAmount).toLocaleString('ar-EG')} ج.م</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Payment & Receipt Details for Prepayment */}
      <div className="bg-[#0A1424] border-2 border-purple-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-purple-300">
            <CreditCard className="w-5 h-5 text-purple-400" />
            <span>بيانات سند التحصيل والدفع المسبق</span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            بيانات العملية المالية
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Paid Date */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>تاريخ التحصيل <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              required
              className="w-full bg-[#0F1D30] border-2 border-purple-500/30 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-bold focus:outline-none focus:border-purple-400 font-mono transition-all"
              id="input-prepayment-date"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>طريقة السداد <span className="text-rose-400">*</span></span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full bg-[#0F1D30] border-2 border-purple-500/30 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-bold focus:outline-none focus:border-purple-400 transition-all cursor-pointer"
              id="select-prepayment-payment-method"
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
                <FileText className="w-4 h-4 text-purple-400" />
                <span>رقم سند التحصيل <span className="text-rose-400">*</span></span>
              </label>
              <button
                type="button"
                onClick={() => setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                className="text-xs text-purple-300 hover:underline font-bold flex items-center gap-1 cursor-pointer"
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
              className="w-full bg-[#0F1D30] border-2 border-purple-500/30 rounded-xl px-4 py-3 text-sm sm:text-base text-white font-mono font-bold focus:outline-none focus:border-purple-400 transition-all"
              id="input-prepayment-receipt-no"
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
                id="input-prepayment-amount"
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
            className="w-full bg-[#0F1D30] border-2 border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-purple-400 transition-all"
            id="input-prepayment-notes"
          />
        </div>
      </div>
    </div>
  );
};
