import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, User, Building, AlertTriangle, ShieldAlert, 
  CheckCircle2, X, AlertCircle, Lock, Calendar, DollarSign,
  Loader2
} from 'lucide-react';
import { ReRentDue, ReTenant, ReUnit, ReProperty, ReOwner } from '../../types';

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

function formatPaymentMethod(method?: string): string {
  if (!method) return 'نقداً';
  switch (method) {
    case 'cash': return 'نقداً';
    case 'bank_transfer': return 'تحويل بنكي';
    case 'cheque': return 'شيك';
    case 'online': return 'دفع إلكتروني';
    default: return method;
  }
}

export interface RevertModalData {
  tenant: ReTenant;
  unitObj?: ReUnit;
  propObj?: ReProperty;
  ownerObj?: ReOwner;
  collectedDues: ReRentDue[];
  latestBatchDues: ReRentDue[];
  olderDues: ReRentDue[];
  isPrepaymentRevert?: boolean;
  latestBatchInfo?: {
    receiptNumber?: string;
    date?: string;
    count: number;
  };
}

interface RevertCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: RevertModalData;
  selectedDueIds: string[];
  setSelectedDueIds: React.Dispatch<React.SetStateAction<string[]>>;
  isProcessing: boolean;
  onConfirmRevert: () => Promise<void>;
}

export default function RevertCollectionModal({
  isOpen,
  onClose,
  data,
  selectedDueIds,
  setSelectedDueIds,
  isProcessing,
  onConfirmRevert
}: RevertCollectionModalProps) {
  if (!isOpen || !data) return null;

  const {
    tenant,
    unitObj,
    propObj,
    latestBatchDues,
    olderDues,
    isPrepaymentRevert,
    latestBatchInfo
  } = data;

  const validLatestIds = new Set(latestBatchDues.map(d => d.id));

  const toggleDue = (id: string) => {
    if (!validLatestIds.has(id)) return;
    setSelectedDueIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllLatest = () => {
    setSelectedDueIds(latestBatchDues.map(d => d.id));
  };

  const handleDeselectAll = () => {
    setSelectedDueIds([]);
  };

  // Calculate selected total
  const selectedDues = latestBatchDues.filter(d => selectedDueIds.includes(d.id));
  const totalAmountToRevert = selectedDues.reduce(
    (sum, d) => sum + (d.collectedAmount || d.rentAmount || 0),
    0
  );

  return (
    <div className="fixed inset-0 bg-[#08111F]/80 backdrop-blur-md z-[110] flex items-center justify-center p-3 sm:p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#132238] border border-amber-500/30 rounded-3xl w-full max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-5 sm:p-7 space-y-5 relative overflow-hidden text-[#F8F9FB] max-h-[90vh] flex flex-col"
      >
        {/* Accent background glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-amber-500/20 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#F8F9FB] flex items-center gap-2">
                <span>{isPrepaymentRevert ? 'الرجوع عن الدفع المسبق' : 'الرجوع عن تحصيل الإيجار'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold">
                  {isPrepaymentRevert ? 'دفع مسبق' : 'تحصيل إيجار'}
                </span>
              </h3>
              <div className="text-xs text-[#9EA7B8] font-bold flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="inline-flex items-center gap-1 text-[#F8F9FB]">
                  <User className="w-3.5 h-3.5 text-[#D4A84F]" />
                  <span>{tenant.fullName}</span>
                </span>
                {propObj && (
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{propObj.name}</span>
                  </span>
                )}
                {unitObj && (
                  <span className="text-amber-300 font-mono">
                    وحدة ({unitObj.unitNumber})
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#08111F]/60 border border-white/10 text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-bold leading-relaxed shrink-0 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            {isPrepaymentRevert ? (
              <span>
                سيتم إلغاء تسجيل السداد المسبق للأشهر المستقبلية المحددة وإعادتها كأشهر غير مدفوعة (لن تظهر كمتأخرات إلا بحلول موعدها الفعلي).
              </span>
            ) : (
              <span>
                سيتم إلغاء تحصيل الأشهر المحددة وإعادتها فوراً إلى قائمة المتأخرات وغير المحصلة وتحديث السجلات والتقارير المالية ذات الصلة.
              </span>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 pl-1 flex-1">
          {/* Latest Batch Information */}
          {latestBatchInfo && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#08111F]/60 border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">أحدث عملية سداد:</span>
                {latestBatchInfo.receiptNumber && (
                  <span className="font-mono font-bold text-[#D4A84F] bg-[#132238] px-2 py-0.5 rounded border border-[#D4A84F]/30">
                    {latestBatchInfo.receiptNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-slate-300 font-mono">
                {latestBatchInfo.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{latestBatchInfo.date}</span>
                  </span>
                )}
                <span className="text-amber-300 font-extrabold">
                  ({latestBatchInfo.count} أشهر)
                </span>
              </div>
            </div>
          )}

          {/* Dues Available for Revert */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-[#F8F9FB] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>حدد الأشهر المطلوب الرجوع عنها:</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={handleSelectAllLatest}
                  className="text-amber-400 hover:underline cursor-pointer"
                >
                  تحديد الكل
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {latestBatchDues.map(due => {
                const isSelected = selectedDueIds.includes(due.id);
                const amount = due.collectedAmount || due.rentAmount || 0;
                return (
                  <div
                    key={due.id}
                    onClick={() => toggleDue(due.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-[#F8F9FB]'
                        : 'bg-[#08111F]/40 border-white/10 text-slate-300 hover:bg-[#08111F]/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDue(due.id)}
                        className="w-4 h-4 rounded border-amber-500/40 text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                        onClick={e => e.stopPropagation()}
                      />
                      <div>
                        <div className="font-extrabold text-xs text-[#F8F9FB]">
                          {due.monthNameAr || formatMonthYearAr(due.forMonthYear)}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {due.receiptNumber && <span>سند: {due.receiptNumber}</span>}
                          {due.paidDate && <span>بتاريخ: {due.paidDate}</span>}
                          {due.paymentMethod && <span>({formatPaymentMethod(due.paymentMethod)})</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <div className="font-black text-xs text-amber-300">
                        {amount.toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Older Dues (Locked due to LIFO consistency rule) */}
          {olderDues.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>عمليات سداد أقدم ({olderDues.length} أشهر - غير متاح الرجوع عنها حالياً):</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed bg-[#08111F]/40 p-2.5 rounded-xl border border-white/5">
                وفقاً لقواعد المحاسبة والتسلسل الزمني للقيود، يجب الرجوع عن أحدث عملية سداد أولاً قبل الرجوع عن العمليات الأقدم.
              </p>
              <div className="space-y-1 opacity-60">
                {olderDues.map(due => (
                  <div
                    key={due.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#08111F]/20 border border-white/5 text-xs text-slate-400 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-slate-600" />
                      <span>{due.monthNameAr || formatMonthYearAr(due.forMonthYear)}</span>
                      {due.receiptNumber && <span className="text-[10px]">({due.receiptNumber})</span>}
                    </div>
                    <div className="font-mono text-[11px]">
                      {(due.collectedAmount || due.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-bold text-slate-300">
            <span>المحدد للرجوع: </span>
            <span className="font-extrabold text-amber-300 font-mono">
              ({selectedDueIds.length}) أشهر
            </span>
            <span className="mx-2 text-slate-600">|</span>
            <span>الإجمالي: </span>
            <span className="font-black text-[#F8F9FB] font-mono">
              {totalAmountToRevert.toLocaleString('ar-EG')} ج.م
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#08111F]/80 hover:bg-[#08111F] text-slate-300 border border-white/10 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={onConfirmRevert}
              disabled={isProcessing || selectedDueIds.length === 0}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-slate-950 text-xs font-black hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جارٍ المعالجة...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تأكيد الرجوع عن التحصيل</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
