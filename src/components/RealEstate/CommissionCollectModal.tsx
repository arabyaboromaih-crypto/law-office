import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins, X, CheckCircle, Building2, User, DollarSign,
  AlertTriangle, Calendar, FileText, Clock, ShieldCheck,
  CreditCard, Hash, CheckCheck, RotateCcw, Lock
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

const AR_MONTHS_MAP: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
};

const formatMonthYearArabic = (myStr: string): string => {
  if (!myStr) return '-';
  const parts = myStr.split('-');
  if (parts.length === 2) {
    const y = parts[0];
    const m = parts[1];
    const mName = AR_MONTHS_MAP[m] || m;
    return `${mName} ${y}`;
  }
  return myStr;
};

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

  // Local list of statements
  const [statementsList, setStatementsList] = useState<CommissionStatementItem[]>([]);
  // Target scope: 'all' (entire remaining for property) or a specific statement ID
  const [collectionScope, setCollectionScope] = useState<'all' | string>('all');

  // Form states
  const [collectionAmount, setCollectionAmount] = useState<number | ''>('');
  const [collectionDate, setCollectionDate] = useState<string>(todayISO);
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isLocalSaving, setIsLocalSaving] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard scrolling support (Arrow keys, PageUp, PageDown, Home, End)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      return;
    }
    if (scrollContainerRef.current) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollContainerRef.current.scrollBy({ top: 60, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollContainerRef.current.scrollBy({ top: -60, behavior: 'smooth' });
      } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        scrollContainerRef.current.scrollBy({ top: 240, behavior: 'smooth' });
      } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        scrollContainerRef.current.scrollBy({ top: -240, behavior: 'smooth' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  // Sync incoming statement or group
  useEffect(() => {
    if (!isOpen) return;

    let initialStatements: CommissionStatementItem[] = [];
    if (group?.statements && group.statements.length > 0) {
      initialStatements = [...group.statements].sort((a, b) => (a.forMonthYear || '').localeCompare(b.forMonthYear || ''));
    } else if (statement) {
      initialStatements = [statement];
    }
    setStatementsList(initialStatements);

    // If opened with a specific statement, default scope to that statement ID
    if (statement && statement.id) {
      setCollectionScope(statement.id);
      const rem = statement.remainingCommission > 0 ? statement.remainingCommission : statement.earnedCommission;
      setCollectionAmount(rem > 0 ? rem : '');
    } else {
      // Default scope to 'all' (entire property remaining)
      setCollectionScope('all');
      const totalRem = initialStatements.reduce((sum, s) => sum + Math.max(0, s.remainingCommission ?? s.earnedCommission), 0);
      setCollectionAmount(totalRem > 0 ? totalRem : '');
    }

    setCollectionDate(todayISO);
    setPaymentMethod('نقدي');
    setReferenceNumber('');
    setNotes('');
    setValidationError('');
    setSuccessMsg('');
    setIsLocalSaving(false);

    // Auto-focus the scroll container so keyboard arrows and PageUp/PageDown work immediately
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.focus({ preventScroll: true });
      }
    }, 120);
  }, [isOpen, statement, group, todayISO]);

  useBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  const propertyName = statement?.propertyName || group?.propertyName || 'العقار المحدد';
  const ownerName = statement?.ownerName || group?.ownerName || 'المالك';
  const rateText = statement?.commissionRateText || group?.commissionRateText || '';

  // Aggregate totals
  const totalEarned = statementsList.reduce((sum, s) => sum + (s.earnedCommission || 0), 0);
  const totalCollected = statementsList.reduce((sum, s) => sum + (s.amountCollectedFromOwner || 0), 0);
  const totalRemaining = Math.max(0, statementsList.reduce((sum, s) => sum + Math.max(0, s.remainingCommission || 0), 0));
  const isFullyCollected = totalRemaining <= 0 && totalEarned > 0;

  // Unpaid statements
  const unpaidStatements = statementsList.filter(s => (s.remainingCommission > 0 || s.status !== 'collected'));

  // Active target statement if a single month is chosen
  const selectedStatement = collectionScope !== 'all' 
    ? statementsList.find(s => s.id === collectionScope) || null
    : null;

  // Remaining for currently chosen scope
  const currentScopeRemaining = selectedStatement
    ? Math.max(0, selectedStatement.remainingCommission > 0 ? selectedStatement.remainingCommission : selectedStatement.earnedCommission)
    : totalRemaining;

  // When scope changes, update the collection amount to match scope remaining
  const handleScopeChange = (newScope: 'all' | string) => {
    setCollectionScope(newScope);
    setValidationError('');
    setSuccessMsg('');

    if (newScope === 'all') {
      setCollectionAmount(totalRemaining > 0 ? totalRemaining : '');
    } else {
      const stmt = statementsList.find(s => s.id === newScope);
      if (stmt) {
        const rem = stmt.remainingCommission > 0 ? stmt.remainingCommission : stmt.earnedCommission;
        setCollectionAmount(rem > 0 ? rem : '');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMsg('');

    // Safety check: Prevent duplicate collection if already completed
    if (isFullyCollected || currentScopeRemaining <= 0) {
      setValidationError('تم تحصيل عمولة هذا العقار بالكامل مسبقاً، ولا يوجد رصيد متبقي للتحصيل لمنع تكرار العملية.');
      return;
    }

    const numAmount = Number(collectionAmount);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      setValidationError('يرجى إدخال مبلغ تحصيل صحيح أكبر من صفر');
      return;
    }

    if (numAmount > currentScopeRemaining) {
      setValidationError(`المبلغ المدخل (${numAmount.toLocaleString('ar-EG')} ج.م) يتجاوز الرصيد المتبقي للتحصيل (${currentScopeRemaining.toLocaleString('ar-EG')} ج.م).`);
      return;
    }

    setIsLocalSaving(true);
    const nowStr = new Date().toISOString().slice(0, 10);
    const updatedByName = currentUser?.fullName || currentUser?.username || 'المسؤول';
    const propertyId = statement?.propertyId || group?.propertyId || (statementsList[0]?.propertyId) || '';
    const ownerId = statement?.ownerId || group?.ownerId || (statementsList[0]?.ownerId) || '';

    try {
      const recordsToSave: ReCommissionStatus[] = [];

      const userRef = referenceNumber.trim();
      const generatedReceiptNo = `COM-${nowStr.replace(/-/g, '').slice(0, 6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const effectiveReceiptNumber = userRef || generatedReceiptNo;

      if (selectedStatement) {
        // Collect for a specific month
        const prevCollected = selectedStatement.amountCollectedFromOwner || 0;
        const newTotalCollected = prevCollected + numAmount;
        const isFullyPaid = newTotalCollected >= selectedStatement.earnedCommission && selectedStatement.earnedCommission > 0;

        let docId = selectedStatement.id ? String(selectedStatement.id).trim() : '';
        if (!docId || docId === 'all') {
          docId = `${selectedStatement.propertyId}_${selectedStatement.forMonthYear}`;
        }

        const singleReceipt = {
          id: `rec_comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          receiptNumber: effectiveReceiptNumber,
          propertyId: selectedStatement.propertyId,
          propertyName: selectedStatement.propertyName,
          ownerId: selectedStatement.ownerId || ownerId,
          ownerName: selectedStatement.ownerName || ownerName,
          forMonthYear: selectedStatement.forMonthYear,
          amount: numAmount,
          date: collectionDate || todayISO,
          paymentMethod: paymentMethod || 'نقدي',
          referenceNumber: effectiveReceiptNumber,
          notes: notes.trim(),
          collectedBy: updatedByName,
          createdAt: new Date().toISOString()
        };

        const rec: ReCommissionStatus = {
          id: docId,
          propertyId: selectedStatement.propertyId,
          propertyName: selectedStatement.propertyName,
          ownerId: selectedStatement.ownerId || ownerId,
          ownerName: selectedStatement.ownerName || ownerName,
          forMonthYear: selectedStatement.forMonthYear,
          status: isFullyPaid ? 'collected' : 'claimed',
          isCollectedFromOwner: true,
          amountCollectedFromOwner: newTotalCollected,
          collectionDate: collectionDate || todayISO,
          paymentMethod: paymentMethod || 'نقدي',
          referenceNumber: effectiveReceiptNumber,
          notes: notes.trim(),
          updatedAt: nowStr,
          updatedBy: updatedByName,
          receipts: [singleReceipt]
        };
        recordsToSave.push(rec);

      } else {
        // Collect across unpaid statements chronologically (oldest to newest)
        let amountLeft = numAmount;
        const targetList = unpaidStatements.length > 0 ? unpaidStatements : statementsList;

        if (targetList.length === 0) {
          // If no statements found, save a general property record
          const singleReceipt = {
            id: `rec_comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            receiptNumber: effectiveReceiptNumber,
            propertyId,
            propertyName,
            ownerId,
            ownerName,
            forMonthYear: 'حساب إجمالي شامل',
            amount: numAmount,
            date: collectionDate || todayISO,
            paymentMethod: paymentMethod || 'نقدي',
            referenceNumber: effectiveReceiptNumber,
            notes: notes.trim(),
            collectedBy: updatedByName,
            createdAt: new Date().toISOString()
          };

          recordsToSave.push({
            id: `${propertyId}_all`,
            propertyId,
            propertyName,
            ownerId,
            ownerName,
            forMonthYear: 'حساب إجمالي شامل',
            status: 'collected',
            isCollectedFromOwner: true,
            amountCollectedFromOwner: numAmount,
            collectionDate: collectionDate || todayISO,
            paymentMethod: paymentMethod || 'نقدي',
            referenceNumber: effectiveReceiptNumber,
            notes: notes.trim(),
            updatedAt: nowStr,
            updatedBy: updatedByName,
            receipts: [singleReceipt]
          });
        } else {
          for (let i = 0; i < targetList.length; i++) {
            const stmt = targetList[i];
            const stmtRemaining = stmt.remainingCommission > 0 ? stmt.remainingCommission : stmt.earnedCommission;
            
            // Allocate chunk to this statement
            const chunk = (i === targetList.length - 1)
              ? amountLeft
              : Math.min(amountLeft, stmtRemaining);
            
            amountLeft = Math.max(0, amountLeft - chunk);

            const prevCollected = stmt.amountCollectedFromOwner || 0;
            const newTotalCollected = prevCollected + chunk;
            const isFullyPaid = newTotalCollected >= stmt.earnedCommission && stmt.earnedCommission > 0;

            let docId = stmt.id ? String(stmt.id).trim() : '';
            if (!docId || docId === 'all') {
              docId = `${stmt.propertyId}_${stmt.forMonthYear}`;
            }

            const singleReceipt = {
              id: `rec_comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              receiptNumber: effectiveReceiptNumber,
              propertyId: stmt.propertyId,
              propertyName: stmt.propertyName,
              ownerId: stmt.ownerId || ownerId,
              ownerName: stmt.ownerName || ownerName,
              forMonthYear: stmt.forMonthYear,
              amount: chunk,
              date: collectionDate || todayISO,
              paymentMethod: paymentMethod || 'نقدي',
              referenceNumber: effectiveReceiptNumber,
              notes: notes.trim(),
              collectedBy: updatedByName,
              createdAt: new Date().toISOString()
            };

            recordsToSave.push({
              id: docId,
              propertyId: stmt.propertyId,
              propertyName: stmt.propertyName,
              ownerId: stmt.ownerId || ownerId,
              ownerName: stmt.ownerName || ownerName,
              forMonthYear: stmt.forMonthYear,
              status: isFullyPaid ? 'collected' : 'claimed',
              isCollectedFromOwner: true,
              amountCollectedFromOwner: newTotalCollected,
              collectionDate: collectionDate || todayISO,
              paymentMethod: paymentMethod || 'نقدي',
              referenceNumber: effectiveReceiptNumber,
              notes: notes.trim(),
              updatedAt: nowStr,
              updatedBy: updatedByName,
              receipts: [singleReceipt]
            });

            if (amountLeft <= 0) break;
          }
        }
      }

      // Persist to database via parent handler
      await onConfirmCollect(recordsToSave);

      // Update local statement list to reflect changes immediately
      setStatementsList(prev => prev.map(st => {
        const saved = recordsToSave.find(r => r.id === st.id || r.forMonthYear === st.forMonthYear);
        if (saved) {
          const newCollected = saved.amountCollectedFromOwner || 0;
          return {
            ...st,
            status: saved.status,
            amountCollectedFromOwner: newCollected,
            remainingCommission: Math.max(0, st.earnedCommission - newCollected),
            collectionDate: saved.collectionDate,
            paymentMethod: saved.paymentMethod,
            referenceNumber: saved.referenceNumber,
            notes: saved.notes
          };
        }
        return st;
      }));

      setSuccessMsg(`تم بنجاح تحصيل وحفظ مبلغ (${numAmount.toLocaleString('ar-EG')} ج.م) في قاعدة البيانات وتحديث حالة العمولة.`);
      
      // Auto-close modal after brief confirmation so user sees the success
      setTimeout(() => {
        onClose();
      }, 1400);

    } catch (err: any) {
      console.error('Error saving commission collection:', err);
      setValidationError(`حدث خطأ أثناء حفظ التحصيل في قاعدة البيانات: ${err?.message || err}`);
    } finally {
      setIsLocalSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-2 sm:p-3 md:p-4 pt-1 sm:pt-2 md:pt-2 lg:pt-2 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isLocalSaving) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -8 }}
        transition={{ duration: 0.2 }}
        className="bg-gradient-to-b from-[#0F1C2E] via-[#0A1320] to-[#060D17] border-2 border-[#D4A84F]/50 rounded-3xl w-full max-w-4xl shadow-2xl relative text-[#F8F9FB] mt-0 sm:mt-1 md:mt-1 lg:mt-1 mb-2 sm:mb-4 flex flex-col max-h-[96vh] sm:max-h-[95vh] md:max-h-[94vh] lg:max-h-[93vh] overflow-hidden"
      >
        {/* Pinned / Sticky Modal Header */}
        <div className="sticky top-0 z-30 bg-[#0F1C2E] border-b border-[#D4A84F]/30 px-4 sm:px-6 pt-3.5 sm:pt-4 pb-3 sm:pb-3.5 shadow-md rounded-t-3xl flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-400/60 text-amber-300 shadow-lg shadow-emerald-950/50 shrink-0">
              <Coins className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-white tracking-wide">
                  تحصيل عمولة إدارة العقار
                </h2>
                {rateText && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black font-mono">
                    {rateText}
                  </span>
                )}
                {isFullyCollected && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 inline-flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تم تحصيل كامل العمولات</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs font-bold text-slate-300 flex-wrap">
                <span className="flex items-center gap-1.5 text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                  <Building2 className="w-3.5 h-3.5 text-[#D4A84F]" />
                  {propertyName}
                </span>
                <span className="flex items-center gap-1.5 text-[#D4A84F]">
                  <User className="w-3.5 h-3.5 text-[#D4A84F]" />
                  المالك: {ownerName}
                </span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isLocalSaving}
            className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/20 active:scale-95 disabled:opacity-50 shrink-0"
            title="إغلاق النافذة (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container wrapping Scrollable Body & Sticky Footer */}
        <form onSubmit={handleSubmit} id="commission-collect-form" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Modal Content (Mouse, Keyboard, Touch) */}
          <div
            ref={scrollContainerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4 focus:outline-none focus:ring-1 focus:ring-[#D4A84F]/30 scroll-smooth touch-pan-y"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}
          >
            {/* Success Alert Banner */}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-200 text-xs sm:text-sm font-black flex items-center justify-between gap-2 shadow-lg"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMsg('')}
                  className="text-emerald-300 hover:text-white text-xs underline cursor-pointer"
                >
                  إغلاق
                </button>
              </motion.div>
            )}

            {/* Financial KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3 rounded-2xl bg-[#091423] border border-white/10 text-center">
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">عدد الشهور المسجلة</span>
                <span className="text-sm font-black text-white font-mono">{statementsList.length} شهر</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#091423] border border-amber-500/20 text-center">
                <span className="text-[10px] text-amber-300 font-bold block mb-0.5">إجمالي عمولة المكتب</span>
                <span className="text-sm font-black text-amber-300 font-mono">
                  {totalEarned.toLocaleString('ar-EG')} <span className="text-[10px] font-sans">ج.م</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#091423] border border-emerald-500/20 text-center">
                <span className="text-[10px] text-emerald-300 font-bold block mb-0.5">المحصل سابقاً من المالك</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {totalCollected.toLocaleString('ar-EG')} <span className="text-[10px] font-sans">ج.م</span>
                </span>
              </div>

              <div className={`p-3 rounded-2xl border text-center ${totalRemaining > 0 ? 'bg-rose-950/30 border-rose-500/40' : 'bg-emerald-950/30 border-emerald-500/40'}`}>
                <span className={`text-[10px] font-bold block mb-0.5 ${totalRemaining > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  المتبقي للتحصيل
                </span>
                <span className={`text-sm font-black font-mono ${totalRemaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {totalRemaining.toLocaleString('ar-EG')} <span className="text-[10px] font-sans">ج.م</span>
                </span>
              </div>
            </div>

            {/* COLLECTION FORM SECTION OR FULLY PAID BANNER */}
            {isFullyCollected ? (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-[#0A1B2A] border-2 border-emerald-500/50 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center mx-auto text-emerald-300">
                  <Lock className="w-6 h-6 text-emerald-400" />
                </div>
                <h4 className="text-base font-black text-white">
                  تم تحصيل عمولة هذا العقار بالكامل مسبقاً بنجاح ✅
                </h4>
                <p className="text-xs text-emerald-200/80 font-bold max-w-md mx-auto">
                  جميع العمولات والشهور المسجلة لهذا العقار محصلة بالكامل، وتم قفل زر التحصيل تلقائياً لمنع تكرار تحصيل نفس العمولة.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#091524] border-2 border-emerald-500/40 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-xs sm:text-sm font-black text-white">
                      تسجيل عملية تحصيل العمولة
                    </h3>
                  </div>
                  <span className="text-[11px] text-amber-300 font-bold font-mono">
                    المتبقي: {currentScopeRemaining.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>

                {validationError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="space-y-3.5">
                  {/* Scope Selector: When multiple unpaid statements exist */}
                  {unpaidStatements.length > 1 && (
                    <div className="bg-[#050C16] p-3 rounded-xl border border-white/10 space-y-2">
                      <label className="text-xs text-slate-300 font-extrabold block">
                        نطاق التحصيل:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleScopeChange('all')}
                          className={`p-2.5 rounded-xl text-xs font-black text-right border transition-all cursor-pointer flex items-center justify-between ${
                            collectionScope === 'all'
                              ? 'bg-emerald-600/30 border-emerald-400 text-white shadow-md'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <CheckCircle className={`w-4 h-4 ${collectionScope === 'all' ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span>كامل المتبقي للعقار ({unpaidStatements.length} شهور)</span>
                          </span>
                          <span className="font-mono text-amber-300">{totalRemaining.toLocaleString('ar-EG')} ج.م</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <select
                            value={collectionScope === 'all' ? '' : collectionScope}
                            onChange={e => {
                              if (e.target.value) {
                                handleScopeChange(e.target.value);
                              } else {
                                handleScopeChange('all');
                              }
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold border transition-all outline-none ${
                              collectionScope !== 'all'
                                ? 'bg-emerald-600/30 border-emerald-400 text-white'
                                : 'bg-white/5 border-white/15 text-slate-300'
                            }`}
                          >
                            <option value="">أو اختر شهراً محدداً للتحصيل...</option>
                            {unpaidStatements.map(st => (
                              <option key={st.id} value={st.id}>
                                {formatMonthYearArabic(st.forMonthYear)} ({st.forMonthYear}) - متبقي {(st.remainingCommission || st.earnedCommission).toLocaleString('ar-EG')} ج.م
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Input Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. المبلغ */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-white font-extrabold flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          المبلغ المحصل (ج.م) <span className="text-rose-400">*</span>
                        </label>
                        {currentScopeRemaining > 0 && (
                          <button
                            type="button"
                            onClick={() => setCollectionAmount(currentScopeRemaining)}
                            className="text-[10px] text-emerald-300 hover:underline font-bold cursor-pointer"
                          >
                            كامل المتبقي ({currentScopeRemaining.toLocaleString('ar-EG')})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max={currentScopeRemaining}
                        step="any"
                        value={collectionAmount}
                        onChange={e => setCollectionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="أدخل المبلغ المحصل..."
                        required
                        className="w-full px-3 py-2.5 rounded-xl bg-[#050C16] border-2 border-emerald-500/60 text-white text-sm font-black font-mono focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
                      />
                    </div>

                    {/* 2. التاريخ */}
                    <div>
                      <label className="text-xs text-white font-extrabold flex items-center gap-1 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        تاريخ التحصيل <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={collectionDate}
                        onChange={e => setCollectionDate(e.target.value)}
                        required
                        className="w-full px-3 py-2.5 rounded-xl bg-[#050C16] border-2 border-white/20 text-white text-xs font-black font-mono focus:border-emerald-400 outline-none transition-all"
                      />
                    </div>

                    {/* 3. طريقة التحصيل */}
                    <div>
                      <label className="text-xs text-white font-extrabold flex items-center gap-1 mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                        طريقة التحصيل / الدفع <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#050C16] border-2 border-white/20 text-white text-xs font-black focus:border-emerald-400 outline-none transition-all"
                      >
                        {PAYMENT_METHODS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* 4. رقم المرجع / السند */}
                    <div>
                      <label className="text-xs text-white font-extrabold flex items-center gap-1 mb-1">
                        <Hash className="w-3.5 h-3.5 text-purple-400" />
                        رقم السند / الإيصال / المرجع
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={e => setReferenceNumber(e.target.value)}
                        placeholder="رقم الإيصال أو التحويل..."
                        className="w-full px-3 py-2.5 rounded-xl bg-[#050C16] border-2 border-white/20 text-white text-xs font-bold focus:border-emerald-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* ملاحظات */}
                  <div>
                    <label className="text-xs text-white font-extrabold flex items-center gap-1 mb-1">
                      <FileText className="w-3.5 h-3.5 text-amber-300" />
                      ملاحظات التحصيل (اختياري)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="ملاحظات حول سداد العمولة..."
                      className="w-full px-3 py-2 rounded-xl bg-[#050C16] border-2 border-white/20 text-white text-xs font-medium focus:border-emerald-400 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* DETAILED STATEMENTS BREAKDOWN TABLE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 px-1">
                <h4 className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>بيانات وسجلات فترات هذا العقار ({statementsList.length} فترة)</span>
                </h4>
                <span className="text-[10px] text-slate-400">
                  يتم تحديث الحالة فوراً وبشكل دائم في قاعدة البيانات السحابية
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/15 bg-[#070E18]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#111E30] text-slate-200 font-black border-b border-white/15 text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5">الفترة / الشهر</th>
                      <th className="p-2.5 text-center">إيجار الفترة</th>
                      <th className="p-2.5 text-center text-amber-300">العمولة المستحقة</th>
                      <th className="p-2.5 text-center text-emerald-400">المحصل</th>
                      <th className="p-2.5 text-center">المتبقي</th>
                      <th className="p-2.5 text-center">الحالة</th>
                      <th className="p-2.5 text-center">بيانات السداد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 font-bold">
                    {statementsList.map((stmt, idx) => {
                      const isStmtFullyPaid = (stmt.remainingCommission || 0) <= 0 && (stmt.earnedCommission || 0) > 0 || stmt.status === 'collected';
                      const isStmtPartial = (stmt.amountCollectedFromOwner || 0) > 0 && (stmt.remainingCommission || 0) > 0;

                      return (
                        <tr
                          key={stmt.id}
                          className={`hover:bg-white/[0.04] transition-colors ${
                            isStmtFullyPaid ? 'bg-[#091523]/50' : 'bg-[#060D17]'
                          }`}
                        >
                          <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono text-white">
                            <span className="font-bold">{formatMonthYearArabic(stmt.forMonthYear)}</span>
                            <span className="text-[10px] text-slate-400 block font-sans">({stmt.forMonthYear})</span>
                          </td>
                          <td className="p-2.5 text-center font-mono text-slate-300">
                            {stmt.totalDueRent.toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="p-2.5 text-center font-mono text-amber-300 font-black">
                            {stmt.earnedCommission.toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="p-2.5 text-center font-mono text-emerald-400 font-black">
                            {(stmt.amountCollectedFromOwner || 0).toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className={`p-2.5 text-center font-mono font-black ${(stmt.remainingCommission || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {(stmt.remainingCommission || 0).toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="p-2.5 text-center">
                            {isStmtFullyPaid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 inline-flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>تم التحصيل ✅</span>
                              </span>
                            ) : isStmtPartial ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>جزئي ⏳</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/50 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                <span>بانتظار التحصيل</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-[10px] text-slate-300">
                            {stmt.collectionDate ? (
                              <div>
                                <span className="font-mono text-white block">{stmt.collectionDate}</span>
                                <span className="text-[#D4A84F]">{stmt.paymentMethod || 'نقدي'}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer with Prominent Actions */}
          <div className="sticky bottom-0 z-30 bg-[#08111D] border-t border-[#D4A84F]/30 px-4 sm:px-6 py-3 sm:py-3.5 rounded-b-3xl shadow-2xl flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
            {isFullyCollected ? (
              <div className="w-full flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  كامل العمولات محصلة ومسجلة في السحابة
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black border border-white/20 transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-300 flex-wrap justify-between w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>المسؤول: {currentUser?.fullName || currentUser?.username || 'المسؤول الحالي'}</span>
                  </div>
                  {collectionAmount ? (
                    <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
                      المطلوب تحصيله: <span className="font-black text-white">{Number(collectionAmount).toLocaleString('ar-EG')}</span> ج.م
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting || isLocalSaving}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs transition-colors cursor-pointer border border-white/20 disabled:opacity-50"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || isLocalSaving || Number(collectionAmount) <= 0 || currentScopeRemaining <= 0}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/60 border-2 border-emerald-400 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting || isLocalSaving ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin text-amber-300" />
                        <span>جاري حفظ التحصيل في السحابة...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          تأكيد وحفظ تحصيل العمولة {collectionAmount ? `(${Number(collectionAmount).toLocaleString('ar-EG')} ج.م)` : ''}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
