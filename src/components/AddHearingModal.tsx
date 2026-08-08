import React, { useState, useEffect } from 'react';
import { 
  X, 
  PlusCircle, 
  Folder, 
  ChevronDown, 
  ShieldAlert, 
  UserCheck, 
  Calendar, 
  Clock 
} from 'lucide-react';
import { Case, User, HearingSession } from '../types';
import { CourtSelect } from '../utils/courts';
import { getEffectiveStageInfo } from '../utils/stageUtils';

interface AddHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: Case[];
  defaultCaseId?: string;
  users: User[];
  onAddSession: (session: HearingSession, detentionMeta?: { isDetention: boolean; authority: string; duration: number }) => Promise<void> | void;
}

export const AddHearingModal: React.FC<AddHearingModalProps> = ({
  isOpen,
  onClose,
  cases,
  defaultCaseId = '',
  users,
  onAddSession
}) => {
  const activeCases = cases.filter(c => !c.isArchived);

  // Form states
  const [selectedCaseId, setSelectedCaseId] = useState<string>(defaultCaseId || (activeCases[0]?.id || ''));
  const [isDetention, setIsDetention] = useState<boolean>(false);
  const [detentionAuthority, setDetentionAuthority] = useState<string>('النيابة العامة');
  const [detentionDuration, setDetentionDuration] = useState<number>(15);

  const [isExpert, setIsExpert] = useState<boolean>(false);
  const [expertOffice, setExpertOffice] = useState<string>('مكتب خبراء وزارة العدل');

  const [court, setCourt] = useState<string>('تحديد المحكمة يدوياً');
  const [customCourtBadge, setCustomCourtBadge] = useState<string>('محكمه ماموريه شمال اسد');
  const [circuit, setCircuit] = useState<string>('14 مدني');
  const [hall, setHall] = useState<string>('');

  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>('09:00');
  const [timeAmPm, setTimeAmPm] = useState<string>('ص');

  const [subject, setSubject] = useState<string>('');
  const [assignedLawyerId, setAssignedLawyerId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selected case when defaultCaseId changes or modal opens
  useEffect(() => {
    if (defaultCaseId) {
      setSelectedCaseId(defaultCaseId);
      const targetCase = cases.find(c => c.id === defaultCaseId);
      if (targetCase) {
        const eff = getEffectiveStageInfo(targetCase);
        if (eff.court) setCourt(eff.court);
        if (eff.circuit) setCircuit(eff.circuit);
      }
    } else if (activeCases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(activeCases[0].id);
      const eff = getEffectiveStageInfo(activeCases[0]);
      if (eff.court) setCourt(eff.court);
      if (eff.circuit) setCircuit(eff.circuit);
    }
  }, [defaultCaseId, isOpen]);

  // Update court/circuit when selected case changes
  const handleCaseChange = (caseId: string) => {
    setSelectedCaseId(caseId);
    const targetCase = cases.find(c => c.id === caseId);
    if (targetCase) {
      const eff = getEffectiveStageInfo(targetCase);
      setCourt(eff.court || 'تحديد المحكمة يدوياً');
      setCircuit(eff.circuit || 'الدائرة المختصة');
    }
  };

  if (!isOpen) return null;

  const targetCase = cases.find(c => c.id === selectedCaseId) || activeCases[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCase) return;

    setIsSubmitting(true);
    try {
      const assignedUser = users.find(u => u.id === assignedLawyerId);
      
      // Determine final subject
      let finalSubject = subject;
      if (!finalSubject) {
        if (isDetention) {
          finalSubject = `جلسة تجديد حبس احتياطي (${detentionAuthority})`;
        } else if (isExpert) {
          finalSubject = `جلسة خبراء (${expertOffice})`;
        } else {
          finalSubject = 'جلسة نظر دعوى';
        }
      }

      // Determine final court text
      let finalCourt = court;
      if (court === 'تحديد المحكمة يدوياً' && customCourtBadge) {
        finalCourt = customCourtBadge;
      }

      // Time formatting
      const finalTime = `${time} ${timeAmPm}`;

      const eff = getEffectiveStageInfo(targetCase);

      const newSess: HearingSession = {
        id: `sess-${Date.now()}`,
        caseId: targetCase.id,
        caseNumber: isDetention && targetCase.investigationNumber ? targetCase.investigationNumber : (eff.caseNumber || targetCase.caseNumberFirstInstance),
        caseYear: isDetention && targetCase.investigationYear ? targetCase.investigationYear : (eff.caseYear || targetCase.caseYearFirstInstance),
        clientName: targetCase.clientName,
        opponentName: isDetention ? (targetCase.investigationAuthority || 'النيابة العامة') : targetCase.opponent.name,
        court: finalCourt || 'غير محدد',
        circuit: circuit || 'غير محدد',
        type: targetCase.type,
        date: date,
        time: finalTime,
        subject: finalSubject,
        status: 'pending',
        assignedLawyerId: assignedLawyerId || undefined,
        assignedLawyerName: assignedUser ? assignedUser.fullName : undefined,
        isDetentionRenewal: isDetention,
        detentionAuthority: isDetention ? detentionAuthority : undefined,
        detentionDurationDays: isDetention ? detentionDuration : undefined
      };

      await onAddSession(newSess, {
        isDetention,
        authority: detentionAuthority,
        duration: detentionDuration
      });

      onClose();
    } catch (error) {
      console.error('Error adding session:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn">
      <div 
        className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-[95%] sm:w-full max-w-lg max-h-[90vh] flex flex-col text-right my-auto animate-scaleUp overflow-hidden"
        dir="rtl"
      >
        {/* Header - Fixed */}
        <div className="flex justify-between items-center px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 bg-white shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <PlusCircle className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 shrink-0" />
            <h3 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight truncate">
              إضافة جلسة جديدة
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-colors cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 text-slate-800 custom-scrollbar">
            
            {/* 1. اختر القضية */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1.5">اختر القضية</label>
              <div className="relative w-full border border-slate-200 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 transition-all focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseChange(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer appearance-none pr-1 pl-6 text-right truncate"
                >
                  {activeCases.map(c => (
                    <option key={c.id} value={c.id}>
                      قضية {c.caseNumberFirstInstance} / {c.caseYearFirstInstance} {c.court || 'القاهرة الجديدة'} ({c.clientName})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* 2. Toggles Card (تجديد حبس احتياطي / جلسة خبراء) */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 sm:p-4 space-y-3.5">
              
              {/* Toggle 1: تجديد حبس احتياطي */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-5 h-5 text-blue-600 stroke-[2.2] shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">تفعيل جلسة تجديد حبس احتياطي</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isDetention;
                    setIsDetention(nextVal);
                    if (nextVal) {
                      setCourt('محكمة الجنايات / غرفة المشورة');
                      setCircuit('دائرة تجديد الحبس');
                    }
                  }}
                  className={`w-11 sm:w-12 h-6 sm:h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 ${
                    isDetention ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div 
                    className={`w-5 h-5 sm:w-5.5 sm:h-5.5 bg-white rounded-full shadow-md transform transition-transform ${
                      isDetention ? '-translate-x-5 sm:-translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-options for Detention Renewal */}
              {isDetention && (
                <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">جهة التجديد</label>
                    <select
                      value={detentionAuthority}
                      onChange={(e) => setDetentionAuthority(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="النيابة العامة">النيابة العامة</option>
                      <option value="تجديد جزئي (قاضي المعارضات)">تجديد جزئي (قاضي المعارضات)</option>
                      <option value="تجديد غرفة المشورة">تجديد غرفة المشورة</option>
                      <option value="تجديد محكمة الجنايات">تجديد محكمة الجنايات</option>
                      <option value="استئناف أمر الحبس">استئناف أمر الحبس</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المدة (أيام)</label>
                    <select
                      value={detentionDuration}
                      onChange={(e) => setDetentionDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value={15}>15 يوماً</option>
                      <option value={30}>30 يوماً</option>
                      <option value={45}>45 يوماً</option>
                      <option value={4}>4 أيام (تحقيق نيابة)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200/60" />

              {/* Toggle 2: جلسة خبراء */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-5 h-5 text-blue-600 stroke-[2.2] shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">تفعيل جلسة خبراء</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpert(!isExpert)}
                  className={`w-11 sm:w-12 h-6 sm:h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 ${
                    isExpert ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div 
                    className={`w-5 h-5 sm:w-5.5 sm:h-5.5 bg-white rounded-full shadow-md transform transition-transform ${
                      isExpert ? '-translate-x-5 sm:-translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-options for Experts */}
              {isExpert && (
                <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">جهة أو مكتب الخبراء</label>
                    <input
                      type="text"
                      value={expertOffice}
                      onChange={(e) => setExpertOffice(e.target.value)}
                      placeholder="مثال: مكتب خبراء شمال القاهرة"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* 3. المحكمة / الدائرة / القاعة */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* المحكمة */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">المحكمة</label>
                <div className="relative w-full">
                  <CourtSelect
                    value={court}
                    onChange={setCourt}
                    placeholder="تحديد المحكمة يدوياً"
                    className="w-full px-3 py-2 sm:py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs text-right font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
                {court === 'تحديد المحكمة يدوياً' && (
                  <input
                    type="text"
                    value={customCourtBadge}
                    onChange={(e) => setCustomCourtBadge(e.target.value)}
                    placeholder="محكمه ماموريه شمال اسد"
                    className="w-full mt-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:border-blue-500 outline-none"
                  />
                )}
              </div>

              {/* الدائرة (يدوياً) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">الدائرة (يدوياً)</label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={circuit}
                    onChange={(e) => setCircuit(e.target.value)}
                    placeholder="14 مدني"
                    className="w-full px-3 py-2 sm:py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* القاعة (اختياري) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">القاعة (اختياري)</label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={hall}
                    onChange={(e) => setHall(e.target.value)}
                    placeholder="اختر القاعة"
                    className="w-full px-3 py-2 sm:py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl sm:rounded-2xl text-xs font-bold text-slate-800 text-center focus:bg-white focus:border-blue-500 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* 4. تاريخ الجلسة & توقيت الجلسة (الساعة) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* تاريخ الجلسة */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">تاريخ الجلسة</label>
                <div className="relative flex items-center border border-slate-200 bg-slate-50/50 rounded-xl sm:rounded-2xl px-3 py-2 sm:py-2.5 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0 ml-1.5" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full min-w-0 bg-transparent text-xs font-mono font-bold text-slate-800 outline-none text-center"
                  />
                </div>
              </div>

              {/* توقيت الجلسة (الساعة) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">توقيت الجلسة (الساعة)</label>
                <div className="relative flex items-center border border-slate-200 bg-slate-50/50 rounded-xl sm:rounded-2xl px-3 py-2 sm:py-2.5 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0 ml-1.5" />
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full min-w-0 bg-transparent text-xs font-mono font-bold text-slate-800 outline-none text-center"
                  />
                  <select
                    value={timeAmPm}
                    onChange={(e) => setTimeAmPm(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none mr-1 cursor-pointer shrink-0"
                  >
                    <option value="ص">ص</option>
                    <option value="م">م</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 5. موضوع الجلسة والطلبات المطلوبة */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">موضوع الجلسة والطلبات المطلوبة</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: مرافعة الدفاع وتقديم مذكرة الرد"
                className="w-full border border-slate-200 bg-slate-50/30 rounded-xl sm:rounded-2xl px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* 6. المحامي المسؤول والمكلف بالحضور */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1">المحامي المسؤول والمكلف بالحضور</label>
              <div className="relative border border-slate-200 bg-slate-50/50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-center justify-between focus-within:bg-white focus-within:border-blue-500">
                <select
                  value={assignedLawyerId}
                  onChange={(e) => setAssignedLawyerId(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 outline-none cursor-pointer appearance-none text-right pr-1 pl-6 truncate"
                >
                  <option value="">اختر محامياً</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

          </div>

          {/* Fixed Footer with Equal-Width Action Buttons */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-2.5 sm:gap-3 z-10">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-amber-400 hover:bg-amber-500 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm md:text-base px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 min-w-0"
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.2] shrink-0" />
              <span className="truncate">جدولة الجلسة بالرول</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 active:scale-[0.98] text-slate-700 font-bold text-xs sm:text-sm md:text-base px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-w-0"
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-600 shrink-0" />
              <span className="truncate">إلغاء</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
