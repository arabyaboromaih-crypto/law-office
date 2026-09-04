import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins, X, CheckCircle, Building2, User, Wallet, DollarSign,
  AlertTriangle, Calendar, FileText, Clock, ShieldCheck, Tag,
  CreditCard, Sparkles, Hash, Check
} from 'lucide-react';
import { ReCommissionStatus, User as AuthUser } from '../../types';
import { useBackHandler } from '../../utils/navigationManager';

export interface CommissionStatementItem {
  id: string;
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  forMonthYear: string;
  totalDueRent: number;
  totalCollectedRent: number;
  commissionRateText: string;
  earnedCommission: number;
  collectedRentCommission: number;
  status: 'not_claimed' | 'claimed' | 'collected' | 'overdue' | string;
  amountCollectedFromOwner: number;
  remainingCommission: number;
  collectionDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  tenantCount?: number;
  tenantNamesList?: string;
}

export interface CommissionPropertySummaryGroup {
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  commissionRateText: string;
  statements: CommissionStatementItem[];
  totalDueRent: number;
  totalCollectedRent: number;
  earnedCommission: number;
  collectedRentCommission: number;
  amountCollectedFromOwner: number;
  remainingCommission: number;
  monthsCount: number;
  collectedMonthsCount: number;
}

interface CommissionCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement?: CommissionStatementItem | null;
  group?: CommissionPropertySummaryGroup | null;
  onConfirmCollect: (records: ReCommissionStatus[]) => Promise<void>;
  currentUser?: AuthUser;
  isSubmitting?: boolean;
}

const PAYMENT_METHODS = [
  'نقدي',
  'تحويل بنكي',
  'إنستاباي InstaPay',
  'فودافون كاش',
  'اتصالات كاش',
  'أورنج كاش',
  'شيك بنكي',
  'خصم تسوية',
  'أخرى'
];

export default function CommissionCollectModal({
  isOpen,
  onClose,
  statement,
  group,
  onConfirmCollect,
  currentUser,
  isSubmitting = false
}: CommissionCollectModalProps) {
  const todayISO = new Date().toISOString().slice(0, 10);

  // Determine statements to work with
  const availableStatements: CommissionStatementItem[] = React.useMemo(() => {
    if (statement) return [statement];
    if (group?.statements && group.statements.length > 0) return group.statements;
    return [];
  }, [statement, group]);

  // Selected statement IDs for collection (default to uncollected statements or the specific statement)
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (statement) {
      setSelectedStatementIds([statement.id]);
    } else if (group?.statements) {
      const uncollected = group.statements.filter(s => (s.remainingCommission || 0) > 0);
      setSelectedStatementIds(uncollected.length > 0 ? uncollected.map(s => s.id) : group.statements.map(s => s.id));
    }
  }, [isOpen, statement, group]);

  // Active targeted statements
  const targetStatements = React.useMemo(() => {
    return availableStatements.filter(s => selectedStatementIds.includes(s.id));
  }, [availableStatements, selectedStatementIds]);

  // Financial totals of targeted statements
  const totals = React.useMemo(() => {
    let earned = 0;
    let prevCollected = 0;
    let remaining = 0;

    targetStatements.forEach(s => {
      earned += (s.earnedCommission || 0);
      prevCollected += (s.amountCollectedFromOwner || 0);
      remaining += (s.remainingCommission || 0);
    });

    return {
      earned,
      prevCollected,
      remaining: Math.max(0, remaining)
    };
  }, [targetStatements]);

  // Form states
  const [collectionAmount, setCollectionAmount] = useState<number | ''>('');
  const [collectionDate, setCollectionDate] = useState<string>(todayISO);
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  // Pre-fill amount when totals change or modal opens
  useEffect(() => {
    if (isOpen) {
      setCollectionAmount(totals.remaining > 0 ? totals.remaining : (statement ? statement.earnedCommission : ''));
      setCollectionDate(todayISO);
      setPaymentMethod(statement?.paymentMethod || 'نقدي');
      setReferenceNumber(statement?.referenceNumber || '');
      setNotes(statement?.notes || '');
      setValidationError('');
    }
  }, [isOpen, totals.remaining, statement, todayISO]);

  useBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  const propertyName = statement?.propertyName || group?.propertyName || 'عقار';
  const ownerName = statement?.ownerName || group?.ownerName || 'المالك';
  const rateText = statement?.commissionRateText || group?.commissionRateText || '';

  const isAlreadyFullyCollected = totals.remaining <= 0 && totals.earned > 0;

  const handleToggleStatement = (id: string) => {
    setSelectedStatementIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedStatementIds(availableStatements.map(s => s.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const numAmount = Number(collectionAmount);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      setValidationError('يرجى إدخال مبلغ تحصيل صحيح أكبر من صفر');
      return;
    }

    if (targetStatements.length === 0) {
      setValidationError('يرجى اختيار شهر أو فترة واحدة على الأقل للتحصيل');
      return;
    }

    // Build status records to update
    const recordsToSave: ReCommissionStatus[] = [];
    const nowStr = new Date().toISOString().slice(0, 10);
    const updatedByName = currentUser?.fullName || currentUser?.username || 'المسؤول';

    if (targetStatements.length === 1) {
      // Single statement collection
      const stmt = targetStatements[0];
      const prevCollected = stmt.amountCollectedFromOwner || 0;
      const newTotalCollected = prevCollected + numAmount;
      const isFullyPaid = newTotalCollected >= stmt.earnedCommission && stmt.earnedCommission > 0;

      const rec: ReCommissionStatus = {
        id: stmt.id,
        propertyId: stmt.propertyId,
        propertyName: stmt.propertyName,
        ownerId: stmt.ownerId,
        ownerName: stmt.ownerName,
        forMonthYear: stmt.forMonthYear,
        status: isFullyPaid ? 'collected' : 'claimed',
        isCollectedFromOwner: true,
        amountCollectedFromOwner: newTotalCollected,
        collectionDate: collectionDate || todayISO,
        paymentMethod: paymentMethod || 'نقدي',
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        updatedAt: nowStr,
        updatedBy: updatedByName
      };
      recordsToSave.push(rec);
    } else {
      // Multi-statement distribution (distribute numAmount across selected statements sequentially)
      let amountLeftToDistribute = numAmount;

      for (let i = 0; i < targetStatements.length; i++) {
        const stmt = targetStatements[i];
        const stmtRemaining = stmt.remainingCommission > 0 ? stmt.remainingCommission : stmt.earnedCommission;
        
        let chunkForThisStmt = 0;
        if (i === targetStatements.length - 1) {
          chunkForThisStmt = amountLeftToDistribute; // Remaining chunk goes to last
        } else {
          chunkForThisStmt = Math.min(amountLeftToDistribute, stmtRemaining);
        }
        amountLeftToDistribute = Math.max(0, amountLeftToDistribute - chunkForThisStmt);

        const prevCollected = stmt.amountCollectedFromOwner || 0;
        const newTotalCollected = prevCollected + chunkForThisStmt;
        const isFullyPaid = newTotalCollected >= stmt.earnedCommission && stmt.earnedCommission > 0;

        const rec: ReCommissionStatus = {
          id: stmt.id,
          propertyId: stmt.propertyId,
          propertyName: stmt.propertyName,
          ownerId: stmt.ownerId,
          ownerName: stmt.ownerName,
          forMonthYear: stmt.forMonthYear,
          status: isFullyPaid ? 'collected' : (newTotalCollected > 0 ? 'claimed' : 'not_claimed'),
          isCollectedFromOwner: newTotalCollected > 0,
          amountCollectedFromOwner: newTotalCollected,
          collectionDate: collectionDate || todayISO,
          paymentMethod: paymentMethod || 'نقدي',
          referenceNumber: referenceNumber.trim(),
          notes: notes.trim(),
          updatedAt: nowStr,
          updatedBy: updatedByName
        };
        recordsToSave.push(rec);
      }
    }

    try {
      await onConfirmCollect(recordsToSave);
      onClose();
    } catch (err: any) {
      console.error('Error saving commission collection:', err);
      setValidationError(`حدث خطأ أثناء حفظ التحصيل: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-gradient-to-b from-[#0F1C2E] to-[#0A121E] border border-[#D4A84F]/40 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative text-[#F8F9FB] my-8"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute left-5 top-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 shadow-lg">
            <Coins className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-[#F8F9FB]">
                تحصيل عمولة إدارة عقارية
              </h2>
              {rateText && (
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono">
                  {rateText}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-[#9EA7B8] font-bold">
              <span className="flex items-center gap-1 text-[#F8F9FB]">
                <Building2 className="w-3.5 h-3.5 text-[#D4A84F]" />
                {propertyName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <User className="w-3.5 h-3.5 text-[#D4A84F]" />
                المالك: {ownerName}
              </span>
            </div>
          </div>
        </div>

        {/* Warning if already fully collected */}
        {isAlreadyFullyCollected && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <p className="font-black text-sm">تم تحصيل كامل العمولة المستحقة مسبقاً لهذا السجل ✅</p>
              <p className="mt-0.5 text-emerald-200/80">المبلغ المحصل: {totals.prevCollected.toLocaleString('ar-EG')} ج.م (المتبقي: 0 ج.م).</p>
            </div>
          </div>
        )}

        {/* Multi-month selection (if group has > 1 statement) */}
        {!statement && availableStatements.length > 1 && (
          <div className="mb-5 p-3.5 rounded-2xl bg-[#132238]/70 border border-[#D4A84F]/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#9EA7B8] font-black flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#D4A84F]" />
                حدد الشهور / الفترات المراد تحصيل عمولتها:
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-[#D4A84F] hover:underline font-bold"
              >
                تحديد الكل ({availableStatements.length})
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
              {availableStatements.map(stmt => {
                const isSelected = selectedStatementIds.includes(stmt.id);
                const isStmtPaid = (stmt.remainingCommission || 0) <= 0;
                return (
                  <button
                    key={stmt.id}
                    type="button"
                    onClick={() => handleToggleStatement(stmt.id)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-right flex items-center justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                        : 'bg-[#08111F]/70 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <span className="block font-mono text-[11px]">{stmt.forMonthYear}</span>
                      <span className="text-[10px] text-[#9EA7B8]">
                        المتبقي: {(stmt.remainingCommission || 0).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-2xl bg-[#132238]/90 border border-white/10 text-center">
            <span className="text-[11px] text-[#9EA7B8] block font-bold mb-1">العمولة المستحقة</span>
            <span className="text-sm sm:text-base font-black font-mono text-amber-300">
              {totals.earned.toLocaleString('ar-EG')} <span className="text-[10px] font-sans">ج.م</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#132238]/90 border border-white/10 text-center">
            <span className="text-[11px] text-[#9EA7B8] block font-bold mb-1">المحصل سابقاً</span>
            <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
              {totals.prevCollected.toLocaleString('ar-EG')} <span className="text-[10px] font-sans">ج.م</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-center">
            <span className="text-[11px] text-emerald-300 block font-bold mb-1">المتبقي للتحصيل</span>
            <span className="text-sm sm:text-base font-black font-mono text-emerald-300">
              {totals.remaining.toLocaleString('ar-EG')} <span className="text-[10px] font-sans">ج.م</span>
            </span>
          </div>
        </div>

        {/* Collection Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Collection Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-200 font-extrabold flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  مبلغ التحصيل (ج.م) <span className="text-rose-400">*</span>
                </label>
                {totals.remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setCollectionAmount(totals.remaining)}
                    className="text-[10px] text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    كامل المتبقي ({totals.remaining.toLocaleString('ar-EG')} ج.م)
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                step="any"
                value={collectionAmount}
                onChange={e => setCollectionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="أدخل المبلغ المحصل..."
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-white text-sm font-black font-mono focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
              />
            </div>

            {/* 2. Collection Date */}
            <div>
              <label className="text-xs text-slate-200 font-extrabold flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                تاريخ التحصيل <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={collectionDate}
                onChange={e => setCollectionDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-white text-xs font-black font-mono focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
              />
            </div>

            {/* 3. Payment Method */}
            <div>
              <label className="text-xs text-slate-200 font-extrabold flex items-center gap-1.5 mb-1.5">
                <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                طريقة التحصيل / الدفع <span className="text-rose-400">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-white text-xs font-black focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* 4. Reference Number */}
            <div>
              <label className="text-xs text-slate-200 font-extrabold flex items-center gap-1.5 mb-1.5">
                <Hash className="w-3.5 h-3.5 text-purple-400" />
                رقم السند / رقم التحويل / المرجع
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="رقم الإيصال أو التحويل البنكي..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-white text-xs font-bold focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
              />
            </div>
          </div>

          {/* 5. Notes */}
          <div>
            <label className="text-xs text-slate-200 font-extrabold flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-300" />
              ملاحظات التحصيل (اختياري)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="أي ملاحظات حول طريقة أو سبب السداد..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-white text-xs font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all resize-none"
            />
          </div>

          {/* Logged by Info */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-[#9EA7B8]">
            <span className="flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              المسؤول عن التسجيل: {currentUser?.fullName || currentUser?.username || 'المسؤول الحالي'}
            </span>
            <span className="text-[10px] text-amber-300/80">
              يتم حفظ السند تلقائياً في السحابة ومطابقة الحسابات
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-white/10"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSubmitting || Number(collectionAmount) <= 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-emerald-900/30 border border-emerald-400/40 transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02] active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري الحفظ والمطابقة...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>تأكيد وحفظ تحصيل العمولة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
