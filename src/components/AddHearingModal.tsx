import React, { useState, useEffect } from 'react';
import { 
  X, 
  PlusCircle, 
  Folder, 
  ChevronDown, 
  ShieldAlert, 
  UserCheck, 
  Calendar, 
  Clock,
  Gavel,
  User as UserIcon,
  Building
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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn">
      <div 
        className="bg-[#091528] border-2 border-[#D4A84F]/40 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] w-[95%] sm:w-full max-w-xl max-h-[90vh] flex flex-col text-right my-auto animate-scaleUp overflow-hidden text-slate-100"
        dir="rtl"
      >
        {/* Header - Fixed Header with Deep Navy & Gold Accent */}
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b-2 border-[#D4A84F]/30 bg-gradient-to-r from-[#0B192C] via-[#11233E] to-[#0B192C] shrink-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border-2 border-[#D4A84F]/60 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
              <Gavel className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>إضافة وتسجيل جلسة جديدة بالأجندة</span>
              </h3>
              <p className="text-xs text-amber-300/80 font-bold mt-0.5">
                جدولة ومتابعة رول المحاكمة - مؤسسة رميح للمحاماة
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 bg-slate-800 hover:bg-rose-600/30 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-400 rounded-xl transition-all cursor-pointer shrink-0"
            aria-label="إغلاق"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-0 text-slate-100 custom-scrollbar">
            
            {/* 1. اختر القضية */}
            <div>
              <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-amber-400" />
                <span>اختر القضية المعنية</span>
              </label>
              <div className="relative w-full border-2 border-slate-700 bg-[#0D1A2D] hover:border-amber-400/80 rounded-2xl p-3 flex items-center justify-between gap-2 transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 shadow-inner">
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseChange(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-black text-white outline-none cursor-pointer appearance-none pr-1 pl-7 text-right truncate"
                >
                  {activeCases.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0D1A2D] text-white font-bold py-2">
                      قضية {c.caseNumberFirstInstance} / {c.caseYearFirstInstance} {c.court || 'القاهرة الجديدة'} ({c.clientName})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-amber-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* 2. Toggles Card (تجديد حبس احتياطي / جلسة خبراء) */}
            <div className="bg-[#0E1D33] border-2 border-slate-700/80 rounded-2xl p-4 space-y-4 shadow-md">
              
              {/* Toggle 1: تجديد حبس احتياطي */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-black text-white truncate">تفعيل جلسة تجديد حبس احتياطي</span>
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
                  className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 border border-slate-600 ${
                    isDetention ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <div 
                    className={`w-5.5 h-5.5 bg-slate-950 rounded-full shadow-md transform transition-transform border border-amber-300 ${
                      isDetention ? '-translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-options for Detention Renewal */}
              {isDetention && (
                <div className="pt-3 border-t border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1">جهة التجديد</label>
                    <select
                      value={detentionAuthority}
                      onChange={(e) => setDetentionAuthority(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-xl text-xs sm:text-sm font-black text-white outline-none focus:border-amber-400 shadow-inner"
                    >
                      <option value="النيابة العامة" className="bg-[#0D1A2D] text-white">النيابة العامة</option>
                      <option value="تجديد جزئي (قاضي المعارضات)" className="bg-[#0D1A2D] text-white">تجديد جزئي (قاضي المعارضات)</option>
                      <option value="تجديد غرفة المشورة" className="bg-[#0D1A2D] text-white">تجديد غرفة المشورة</option>
                      <option value="تجديد محكمة الجنايات" className="bg-[#0D1A2D] text-white">تجديد محكمة الجنايات</option>
                      <option value="استئناف أمر الحبس" className="bg-[#0D1A2D] text-white">استئناف أمر الحبس</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1">المدة (أيام)</label>
                    <select
                      value={detentionDuration}
                      onChange={(e) => setDetentionDuration(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-xl text-xs sm:text-sm font-black text-white outline-none focus:border-amber-400 shadow-inner"
                    >
                      <option value={15} className="bg-[#0D1A2D] text-white">15 يوماً</option>
                      <option value={30} className="bg-[#0D1A2D] text-white">30 يوماً</option>
                      <option value={45} className="bg-[#0D1A2D] text-white">45 يوماً</option>
                      <option value={4} className="bg-[#0D1A2D] text-white">4 أيام (تحقيق نيابة)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-700/60" />

              {/* Toggle 2: جلسة خبراء */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-black text-white truncate">تفعيل جلسة خبراء</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExpert(!isExpert)}
                  className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 border border-slate-600 ${
                    isExpert ? 'bg-indigo-500' : 'bg-slate-800'
                  }`}
                >
                  <div 
                    className={`w-5.5 h-5.5 bg-slate-950 rounded-full shadow-md transform transition-transform border border-indigo-300 ${
                      isExpert ? '-translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-options for Experts */}
              {isExpert && (
                <div className="pt-3 border-t border-slate-700/80 space-y-2 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1">جهة أو مكتب الخبراء</label>
                    <input
                      type="text"
                      value={expertOffice}
                      onChange={(e) => setExpertOffice(e.target.value)}
                      placeholder="مثال: مكتب خبراء شمال القاهرة"
                      className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-xl text-xs sm:text-sm font-bold text-white placeholder:text-slate-400 outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* 3. المحكمة / الدائرة / القاعة */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* المحكمة */}
              <div>
                <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>المحكمة</span>
                </label>
                <div className="relative w-full">
                  <CourtSelect
                    value={court}
                    onChange={setCourt}
                    placeholder="تحديد المحكمة يدوياً"
                    className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-2xl text-xs sm:text-sm font-black text-white focus:border-amber-400 outline-none shadow-inner text-right"
                  />
                </div>
                {court === 'تحديد المحكمة يدوياً' && (
                  <input
                    type="text"
                    value={customCourtBadge}
                    onChange={(e) => setCustomCourtBadge(e.target.value)}
                    placeholder="اسم المحكمة أو المأمورية"
                    className="w-full mt-2 px-3 py-2 bg-[#0D1A2D] border-2 border-slate-700 rounded-xl text-xs font-black text-amber-300 text-center focus:border-amber-400 outline-none shadow-inner"
                  />
                )}
              </div>

              {/* الدائرة (يدوياً) */}
              <div>
                <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5">الدائرة</label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={circuit}
                    onChange={(e) => setCircuit(e.target.value)}
                    placeholder="14 مدني"
                    className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-2xl text-xs sm:text-sm font-black text-white text-center focus:border-amber-400 outline-none shadow-inner"
                  />
                </div>
              </div>

              {/* القاعة (اختياري) */}
              <div>
                <label className="block text-xs sm:text-sm font-black text-slate-300 mb-1.5">القاعة (اختياري)</label>
                <div className="relative w-full">
                  <input
                    type="text"
                    value={hall}
                    onChange={(e) => setHall(e.target.value)}
                    placeholder="اختر القاعة"
                    className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-2xl text-xs sm:text-sm font-black text-white text-center focus:border-amber-400 outline-none shadow-inner placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* 4. تاريخ الجلسة & توقيت الجلسة (الساعة) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* تاريخ الجلسة */}
              <div>
                <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>تاريخ الجلسة</span>
                </label>
                <div className="relative flex items-center border-2 border-slate-700 bg-[#0D1A2D] rounded-2xl px-3 py-2.5 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all shadow-inner">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full min-w-0 bg-transparent text-xs sm:text-sm font-mono font-black text-amber-300 outline-none text-center"
                  />
                </div>
              </div>

              {/* توقيت الجلسة (الساعة) */}
              <div>
                <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>توقيت الجلسة (الساعة)</span>
                </label>
                <div className="relative flex items-center border-2 border-slate-700 bg-[#0D1A2D] rounded-2xl px-3 py-2.5 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all shadow-inner">
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full min-w-0 bg-transparent text-xs sm:text-sm font-mono font-black text-amber-300 outline-none text-center"
                  />
                  <select
                    value={timeAmPm}
                    onChange={(e) => setTimeAmPm(e.target.value)}
                    className="bg-slate-800 text-amber-300 font-black text-xs px-2 py-1 rounded-lg border border-slate-600 outline-none cursor-pointer shrink-0 mr-1"
                  >
                    <option value="ص" className="bg-[#0D1A2D] text-white">ص</option>
                    <option value="م" className="bg-[#0D1A2D] text-white">م</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 5. موضوع الجلسة والطلبات المطلوبة */}
            <div>
              <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center gap-1.5">
                <span className="text-amber-400">📌</span>
                <span>موضوع الجلسة والطلبات المطلوبة</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: مرافعة الدفاع وتقديم مذكرة الرد والمستندات"
                className="w-full border-2 border-slate-600 bg-[#091528] rounded-2xl px-4 py-3 text-xs sm:text-sm font-black text-white placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 outline-none transition-all shadow-inner"
              />
            </div>

            {/* 6. المحامي المسؤول والمكلف بالحضور */}
            <div>
              <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-amber-400" />
                <span>المحامي المسؤول والمكلف بالحضور</span>
              </label>
              <div className="relative border-2 border-slate-700 bg-[#0D1A2D] hover:border-amber-400/80 rounded-2xl p-3 flex items-center justify-between focus-within:border-amber-400 shadow-inner">
                <select
                  value={assignedLawyerId}
                  onChange={(e) => setAssignedLawyerId(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-black text-white outline-none cursor-pointer appearance-none text-right pr-1 pl-7 truncate"
                >
                  <option value="" className="bg-[#0D1A2D] text-slate-400">اختر محامياً مكلفاً بالحضور...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#0D1A2D] text-white font-bold py-1.5">
                      {u.fullName} ({u.role === 'admin' ? 'مدير النظام' : 'محامي بالمؤسسة'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-amber-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

          </div>

          {/* Fixed Footer with Equal-Width Action Buttons */}
          <div className="px-4 py-4 sm:px-6 sm:py-4 border-t-2 border-[#D4A84F]/30 bg-[#08111F] shrink-0 flex items-center justify-between gap-3 z-10">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black text-xs sm:text-sm md:text-base py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 shadow-lg border-2 border-amber-200 transition-all cursor-pointer disabled:opacity-50 min-w-0"
            >
              <PlusCircle className="w-5 h-5 text-slate-950 stroke-[2.5] shrink-0" />
              <span className="truncate">جدولة الجلسة بالرول</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 active:scale-[0.98] text-slate-200 font-extrabold text-xs sm:text-sm md:text-base py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer min-w-0"
            >
              <X className="w-4 h-4 text-slate-300 shrink-0" />
              <span className="truncate">إلغاء</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
