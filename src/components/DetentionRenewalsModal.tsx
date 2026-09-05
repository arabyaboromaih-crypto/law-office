import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Lock, 
  Calendar, 
  Gavel, 
  CheckCircle, 
  Clock, 
  ChevronDown, 
  History,
  Building2,
  Scale,
  Edit2,
  Plus
} from 'lucide-react';
import { Case, DetentionRenewalRecord, User as AppUser } from '../types';

export const DETENTION_DECISION_OPTIONS = [
  'حبس ٤ أيام',
  'حبس ١٥ يوم',
  'حبس ٤٥ يوم',
  'إخلاء سبيل بكفالة',
  'إخلاء سبيل بضمان محل إقامته',
  'تعذر حضور المتهم',
  'لم تنظر'
] as const;

export const NEXT_AUTHORITY_OPTIONS = [
  'النيابة العامة',
  'قاضي جزئي',
  'غرفة مشورة',
  'محكمة جنايات أول درجة',
  'محكمة جنايات مستأنفة',
  'تجديد ١٥٠ يوم'
] as const;

export const CURRENT_AUTHORITY_OPTIONS = [
  'النيابة العامة',
  'قاضي جزئي',
  'غرفة مشورة',
  'محكمة جنايات أول درجة',
  'محكمة جنايات مستأنفة',
  'تجديد ١٥٠ يوم'
] as const;

interface DetentionRenewalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: Case;
  onUpdateCase: (updated: Case) => Promise<void> | void;
  currentUser?: AppUser;
  initialDate?: string;
}

// Helper: Add days safely to date string (YYYY-MM-DD)
const addDaysToDate = (dateStr: string, days: number): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DetentionRenewalsModal: React.FC<DetentionRenewalsModalProps> = ({
  isOpen,
  onClose,
  caseData,
  onUpdateCase,
  currentUser,
  initialDate
}) => {
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Today's fallback date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Session Date being recorded
  const [sessionDate, setSessionDate] = useState<string>(initialDate || todayStr);

  // 1. سلطة التجديد الحالية (تُجلب تلقائياً من بيانات الجلسة السابقة)
  const [currentAuthority, setCurrentAuthority] = useState<string>('النيابة العامة');
  const [isCustomAuthority, setIsCustomAuthority] = useState(false);

  // 2. قرار سلطة التجديد وما تم في الجلسة
  const [decision, setDecision] = useState<string>(DETENTION_DECISION_OPTIONS[1]); // Default 'حبس ١٥ يوم'
  const [bailAmount, setBailAmount] = useState<string>('');

  // 3. تاريخ جلسة التجديد القادمة
  const [nextRenewalDate, setNextRenewalDate] = useState<string>('');

  // 4. الجهة المنظور أمامها التجديد القادم
  const [nextAuthority, setNextAuthority] = useState<string>(NEXT_AUTHORITY_OPTIONS[1]); // Default 'قاضي جزئي'

  // View state: show history list or form
  const [showHistorySection, setShowHistorySection] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // All renewals sorted chronologically
  const sortedRenewals = useMemo(() => {
    return [...(caseData.detentionRenewals || [])].sort((a, b) => {
      const da = a.date || a.renewalDate || '';
      const db = b.date || b.renewalDate || '';
      return da.localeCompare(db);
    });
  }, [caseData.detentionRenewals]);

  // Determine previous renewal data based on the current session date or editing record
  const previousRenewal = useMemo(() => {
    if (editingRecordId) {
      const idx = sortedRenewals.findIndex(r => r.id === editingRecordId);
      return idx > 0 ? sortedRenewals[idx - 1] : null;
    }
    // Find latest renewal strictly prior to sessionDate
    const prior = sortedRenewals.filter(r => (r.date || r.renewalDate) < sessionDate);
    if (prior.length > 0) return prior[prior.length - 1];
    // If none strictly prior, check if there are renewals before the last one
    if (sortedRenewals.length > 0) return sortedRenewals[sortedRenewals.length - 1];
    return null;
  }, [sortedRenewals, editingRecordId, sessionDate]);

  // Auto-populate Current Authority from previous renewal whenever sessionDate/previousRenewal changes (unless editing existing record)
  useEffect(() => {
    if (editingRecordId) {
      const rec = sortedRenewals.find(r => r.id === editingRecordId);
      if (rec) {
        setCurrentAuthority(rec.authority || 'النيابة العامة');
        setDecision(rec.decision || DETENTION_DECISION_OPTIONS[1]);
        setNextRenewalDate(rec.nextRenewalDate || '');
        setNextAuthority(rec.nextAuthority || NEXT_AUTHORITY_OPTIONS[0]);
      }
      return;
    }

    // New entry: Auto-fetch current authority from previous session
    if (previousRenewal) {
      // In the previous session, "nextAuthority" was set -> it becomes "currentAuthority" for today!
      const inherited = previousRenewal.nextAuthority || previousRenewal.authority || 'النيابة العامة';
      setCurrentAuthority(inherited);
    } else {
      // First session: default to النيابة العامة
      setCurrentAuthority('النيابة العامة');
    }

    // Default next date based on default decision (حبس ١٥ يوم)
    const defDate = addDaysToDate(sessionDate, 15);
    setNextRenewalDate(defDate);
  }, [sessionDate, editingRecordId, previousRenewal]);

  // Handle when initialDate changes on modal open
  useEffect(() => {
    if (isOpen) {
      const targetDate = initialDate || todayStr;
      setSessionDate(targetDate);
      setEditingRecordId(null);
      setBailAmount('');
      setSuccessMessage(null);
    }
  }, [isOpen, initialDate, todayStr]);

  if (!isOpen) return null;

  // Handle decision change
  const handleSelectDecision = (opt: string) => {
    setDecision(opt);
    if (opt === 'حبس ٤ أيام') {
      setNextRenewalDate(addDaysToDate(sessionDate, 4));
    } else if (opt === 'حبس ١٥ يوم') {
      setNextRenewalDate(addDaysToDate(sessionDate, 15));
    } else if (opt === 'حبس ٤٥ يوم') {
      setNextRenewalDate(addDaysToDate(sessionDate, 45));
    } else if (opt === 'إخلاء سبيل بكفالة' || opt === 'إخلاء سبيل بضمان محل إقامته') {
      setNextRenewalDate('');
    }
  };

  // Switch to editing an earlier session
  const handleEditPastSession = (rec: DetentionRenewalRecord) => {
    setEditingRecordId(rec.id);
    setSessionDate(rec.date || rec.renewalDate || todayStr);
    setCurrentAuthority(rec.authority || 'النيابة العامة');
    setDecision(rec.decision || DETENTION_DECISION_OPTIONS[1]);
    setNextRenewalDate(rec.nextRenewalDate || '');
    setNextAuthority(rec.nextAuthority || NEXT_AUTHORITY_OPTIONS[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to new session recording
  const handleStartNewSession = () => {
    setEditingRecordId(null);
    setSessionDate(todayStr);
    setDecision(DETENTION_DECISION_OPTIONS[1]);
    setBailAmount('');
    const defNext = addDaysToDate(todayStr, 15);
    setNextRenewalDate(defNext);
  };

  // Submit and save record preserving all historical data
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionDate) {
      alert('يرجى تحديد تاريخ جلسة التجديد');
      return;
    }
    if (!decision) {
      alert('يرجى اختيار قرار سلطة التجديد وما تم في الجلسة');
      return;
    }

    setIsSaving(true);
    try {
      let finalDecision = decision;
      if (decision === 'إخلاء سبيل بكفالة' && bailAmount.trim()) {
        finalDecision = `إخلاء سبيل بكفالة قدرها ${bailAmount.trim()} ج.م`;
      }

      const durationDays = decision === 'حبس ٤ أيام' ? 4 : decision === 'حبس ١٥ يوم' ? 15 : decision === 'حبس ٤٥ يوم' ? 45 : undefined;
      const duration = durationDays ? `${durationDays} يوم` : undefined;

      const recordId = editingRecordId || `ren-${Date.now()}`;
      
      const newRecord: DetentionRenewalRecord = {
        id: recordId,
        date: sessionDate,
        renewalDate: sessionDate,
        authority: currentAuthority,
        decision: finalDecision,
        durationDays,
        duration,
        nextRenewalDate: nextRenewalDate ? nextRenewalDate.trim() : undefined,
        nextAuthority: nextAuthority ? nextAuthority.trim() : undefined,
        court: caseData.court || caseData.courtFirstInstance || 'النيابة العامة / المحكمة المختصة',
        renewalNumber: editingRecordId
          ? (sortedRenewals.find(r => r.id === editingRecordId)?.renewalNumber || sortedRenewals.length)
          : sortedRenewals.length + 1
      };

      // Preserve all previous records without overwriting or deleting!
      let updatedRenewals: DetentionRenewalRecord[];
      if (editingRecordId) {
        updatedRenewals = (caseData.detentionRenewals || []).map(r => r.id === editingRecordId ? newRecord : r);
      } else {
        // If there is already a record on the exact same date and authority, update it; otherwise append
        const existingIdx = (caseData.detentionRenewals || []).findIndex(r => (r.date || r.renewalDate) === sessionDate);
        if (existingIdx >= 0) {
          updatedRenewals = [...(caseData.detentionRenewals || [])];
          updatedRenewals[existingIdx] = newRecord;
        } else {
          updatedRenewals = [...(caseData.detentionRenewals || []), newRecord];
        }
      }

      // Sort chronologically
      updatedRenewals.sort((a, b) => {
        const da = a.date || a.renewalDate || '';
        const db = b.date || b.renewalDate || '';
        return da.localeCompare(db);
      });

      // Update case
      const updatedCase: Case = {
        ...caseData,
        isInvestigationActive: true,
        detentionRenewals: updatedRenewals,
        // If nextRenewalDate is set, update case nextHearingDate
        ...(nextRenewalDate ? {
          nextHearingDate: nextRenewalDate,
          nextHearingTime: '09:00',
          nextHearingSubject: `جلسة تجديد حبس احتياطي (${nextAuthority})`
        } : {})
      };

      await onUpdateCase(updatedCase);
      setSuccessMessage('تم حفظ قرار جلسة التجديد وتحديث الأجندة بنجاح');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 850);
    } catch (err) {
      console.error('Error saving detention renewal:', err);
      alert('حدث خطأ أثناء حفظ التجديد، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      dir="rtl"
    >
      <div 
        id="detention-renewal-modal-content"
        className="bg-white rounded-2xl shadow-2xl border border-rose-200/80 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] transition-all animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-700/80 border border-rose-400/40 flex items-center justify-center text-white shadow-inner">
              <Lock className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  جلسة تجديد الحبس الاحتياطي
                </h3>
                {editingRecordId ? (
                  <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md">
                    تعديل جلسة مسجلة
                  </span>
                ) : (
                  <span className="bg-rose-500/80 border border-rose-300/40 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                    تسجيل قرار الجلسة
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-200 mt-0.5 font-medium line-clamp-1">
                قضية رقم: {caseData.caseNumberFirstInstance || caseData.investigationNumber || 'غير محدد'} | الموكل: {caseData.clientName || 'غير محدد'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 flex items-center justify-center gap-2 text-emerald-800 text-xs sm:text-sm font-black">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-right">
          
          {/* Header Sub-bar: Session Date */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-700 shrink-0" />
              <span className="text-xs font-black text-slate-800">تاريخ جلسة التجديد الحالية:</span>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-rose-500 outline-none"
              />
            </div>
            {editingRecordId && (
              <button
                type="button"
                onClick={handleStartNewSession}
                className="text-xs font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-rose-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>العودة لتسجيل جلسة جديدة</span>
              </button>
            )}
          </div>

          <form id="detention-renewal-form" onSubmit={handleSaveRecord} className="space-y-5">
            
            {/* ================= 1. بيانات التجديد السابق + سلطة التجديد الحالية ================= */}
            <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-700 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                    ١
                  </span>
                  <h4 className="text-sm font-black text-rose-950">
                    بيانات التجديد السابق
                  </h4>
                </div>
                {previousRenewal ? (
                  <span className="text-[11px] font-bold text-rose-900 bg-rose-100/90 border border-rose-300/80 px-2.5 py-0.5 rounded-full">
                    جلسة سابقة مسجلة بتاريخ: {previousRenewal.date || previousRenewal.renewalDate}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    أول جلسة تجديد في القضية
                  </span>
                )}
              </div>

              {/* Previous Renewal Summary Card */}
              {previousRenewal ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white border border-rose-200/70 rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-slate-500 block font-medium">سلطة الجلسة السابقة:</span>
                    <span className="font-black text-slate-800">{previousRenewal.authority || 'النيابة العامة'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">قرار الجلسة السابقة:</span>
                    <span className="font-black text-rose-900">{previousRenewal.decision || 'غير مسجل'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">الجهة المحددة للتجديد:</span>
                    <span className="font-black text-emerald-800">{previousRenewal.nextAuthority || previousRenewal.authority || 'النيابة العامة'}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 font-medium">
                  لا توجد جلسات تجديد سابقة مسجلة لهذه القضية (هذه هي أول جلسة تجديد مقيدة).
                </div>
              )}

              {/* Sub-item: سلطة التجديد الحالية (تُجلب تلقائياً من بيانات الجلسة السابقة) */}
              <div className="pt-2 border-t border-rose-200/60">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-rose-700" />
                    <span>سلطة التجديد الحالية:</span>
                  </label>
                  {previousRenewal && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-3xs">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>تُجلب تلقائيًا من بيانات الجلسة السابقة</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <select
                    id="current-authority-select"
                    value={currentAuthority}
                    onChange={(e) => setCurrentAuthority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-rose-300 rounded-xl text-xs sm:text-sm font-black text-slate-900 focus:border-rose-600 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
                  >
                    {CURRENT_AUTHORITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-600 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* ================= 2. قرار سلطة التجديد وما تم في الجلسة ================= */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                  ٢
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  قرار سلطة التجديد وما تم في الجلسة
                </h4>
                <span className="text-rose-600 font-bold text-sm">*</span>
              </div>

              {/* Quick-select Badges for the 7 Options */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {DETENTION_DECISION_OPTIONS.map((opt) => {
                  const isSelected = decision === opt || (opt === 'إخلاء سبيل بكفالة' && decision.startsWith('إخلاء سبيل بكفالة'));
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectDecision(opt)}
                      className={`p-2 rounded-xl text-xs font-black text-center transition-all cursor-pointer border shadow-3xs active:scale-95 ${
                        isSelected
                          ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-400/40'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-rose-300 hover:bg-rose-50/50'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Dropdown for decision */}
              <div className="relative pt-1">
                <select
                  id="detention-decision-select"
                  value={decision.startsWith('إخلاء سبيل بكفالة') ? 'إخلاء سبيل بكفالة' : decision}
                  onChange={(e) => handleSelectDecision(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-black text-slate-900 focus:border-rose-500 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
                >
                  {DETENTION_DECISION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-4 pointer-events-none" />
              </div>

              {/* Optional Bail Amount input if bail is selected */}
              {decision.startsWith('إخلاء سبيل بكفالة') && (
                <div className="pt-2 flex items-center gap-2">
                  <label className="text-xs font-black text-slate-700 shrink-0">مبلغ الكفالة (ج.م):</label>
                  <input
                    type="number"
                    value={bailAmount}
                    onChange={(e) => setBailAmount(e.target.value)}
                    placeholder="مثال: 5000"
                    className="w-36 px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-rose-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* ================= 3. تاريخ جلسة التجديد القادمة ================= */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                    ٣
                  </span>
                  <h4 className="text-sm font-black text-slate-900">
                    تاريخ جلسة التجديد القادمة
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  اختيار التاريخ من التقويم
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative w-full sm:w-72">
                  <input
                    id="next-renewal-date-input"
                    type="date"
                    value={nextRenewalDate}
                    onChange={(e) => setNextRenewalDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-rose-200 rounded-xl text-xs sm:text-sm font-mono font-black text-rose-950 focus:border-rose-600 outline-none shadow-2xs"
                  />
                </div>

                {/* Quick adjustments */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNextRenewalDate(addDaysToDate(sessionDate, 4))}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-3xs"
                  >
                    +٤ أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextRenewalDate(addDaysToDate(sessionDate, 15))}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-3xs"
                  >
                    +١٥ يوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextRenewalDate(addDaysToDate(sessionDate, 45))}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-3xs"
                  >
                    +٤٥ يوم
                  </button>
                  {nextRenewalDate && (
                    <button
                      type="button"
                      onClick={() => setNextRenewalDate('')}
                      className="px-2 py-1 text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                      title="إلغاء التاريخ (في حال إخلاء السبيل)"
                    >
                      مسح
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ================= 4. الجهة المنظور أمامها التجديد القادم ================= */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <span className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                  ٤
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  الجهة المنظور أمامها التجديد القادم
                </h4>
              </div>

              {/* Quick Pills for Next Authority */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {NEXT_AUTHORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNextAuthority(opt)}
                    className={`p-2 rounded-xl text-xs font-black text-center transition-all cursor-pointer border shadow-3xs active:scale-95 ${
                      nextAuthority === opt
                        ? 'bg-slate-900 text-white border-slate-950 ring-2 ring-slate-400/40'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {/* Dropdown for Next Authority */}
              <div className="relative pt-1">
                <select
                  id="next-authority-select"
                  value={nextAuthority}
                  onChange={(e) => setNextAuthority(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-black text-slate-900 focus:border-slate-800 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
                >
                  {NEXT_AUTHORITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-4 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:flex-1 py-3 px-6 bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700 hover:from-rose-600 hover:to-rose-500 text-white font-black text-sm rounded-xl shadow-md cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2 border border-rose-500"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSaving ? 'جاري حفظ التجديد...' : (editingRecordId ? 'تحديث قرار جلسة التجديد' : 'حفظ قرار جلسة التجديد وتحديث الأجندة')}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-28 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>

          {/* ================= سجل جلسات التجديد السابقة (محفوظة بالكامل) ================= */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-rose-700" />
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  سجل جلسات وقرارات التجديد السابقة ({sortedRenewals.length} جلسة محفوظة)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowHistorySection(!showHistorySection)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {showHistorySection ? 'إخفاء السجل' : 'عرض السجل'}
              </button>
            </div>

            {showHistorySection && (
              <div className="space-y-2">
                {sortedRenewals.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                    لا توجد جلسات تجديد سابقة مسجلة في ملف هذه القضية حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedRenewals.map((rec, idx) => {
                      const isCurrentEditing = editingRecordId === rec.id;
                      return (
                        <div 
                          key={rec.id || idx}
                          className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCurrentEditing 
                              ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-rose-950 bg-rose-100/80 px-2 py-0.5 rounded-md text-[11px]">
                                📅 {rec.date || rec.renewalDate}
                              </span>
                              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                سلطة التجديد: {rec.authority}
                              </span>
                              <span className="font-black text-slate-900">
                                القرار: <span className="text-rose-700">{rec.decision || 'لم يسجل'}</span>
                              </span>
                            </div>
                            {rec.nextRenewalDate && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                                <span>التجديد القادم:</span>
                                <span className="font-mono font-bold text-slate-800">{rec.nextRenewalDate}</span>
                                <span>أمام:</span>
                                <span className="font-bold text-emerald-800">{rec.nextAuthority || 'النيابة العامة'}</span>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditPastSession(rec)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg cursor-pointer flex items-center gap-1 transition-colors"
                            >
                              <Edit2 className="w-3 h-3 text-slate-600" />
                              <span>استعراض / تعديل</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default DetentionRenewalsModal;
