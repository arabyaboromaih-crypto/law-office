import React, { useState, useEffect, useRef } from 'react';
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
  Building,
  ListFilter,
  Check,
  Scale,
  Lock,
  Layers
} from 'lucide-react';
import { Case, User, HearingSession, HearingSessionType } from '../types';
import { CourtSelect } from '../utils/courts';
import { getEffectiveStageInfo } from '../utils/stageUtils';
import { getDetentionSessionId, normalizeHearingDate } from '../utils/hearingSync';

interface AddHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: Case[];
  defaultCaseId?: string;
  users: User[];
  onAddSession: (session: HearingSession, detentionMeta?: { isDetention: boolean; authority: string; duration: number; renewalId?: string }) => Promise<void> | void;
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
  const [sessionType, setSessionType] = useState<HearingSessionType>('جلسة محكمة');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState<boolean>(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close type dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };
    if (isTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeDropdownOpen]);

  // Sync selected case when defaultCaseId changes or modal opens
  useEffect(() => {
    if (defaultCaseId) {
      setSelectedCaseId(defaultCaseId);
      const targetCase = cases.find(c => c.id === defaultCaseId);
      if (targetCase) {
        if (!targetCase.isInvestigationActive && sessionType === 'جلسة تجديد حبس') {
          // Keep selection unless not intended
        }
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

  // Handle changing session type from dropdown or selection icon
  const handleSelectSessionType = (newType: 'جلسة محكمة' | 'جلسة عادية' | 'جلسة تجديد حبس' | 'جلسة خبراء') => {
    setSessionType(newType);
    setIsTypeDropdownOpen(false);

    if (newType === 'جلسة محكمة' || newType === 'جلسة عادية') {
      setIsDetention(false);
      setIsExpert(false);
      const targetCase = cases.find(c => c.id === selectedCaseId);
      if (targetCase) {
        const eff = getEffectiveStageInfo(targetCase);
        setCourt(eff.court || targetCase.court || 'تحديد المحكمة يدوياً');
        setCircuit(eff.circuit || targetCase.circuit || 'الدائرة المختصة');
      }
    } else if (newType === 'جلسة تجديد حبس') {
      setIsDetention(true);
      setIsExpert(false);
      setCourt('محكمة الجنايات / غرفة المشورة');
      setCircuit('دائرة تجديد الحبس');
    } else if (newType === 'جلسة خبراء') {
      setIsExpert(true);
      setIsDetention(false);
      setCourt('مكتب خبراء وزارة العدل');
      setCircuit('مكتب الخبراء');
    }
  };

  // Update court/circuit when selected case changes
  const handleCaseChange = (caseId: string) => {
    setSelectedCaseId(caseId);
    const targetCase = cases.find(c => c.id === caseId);
    if (targetCase) {
      if (sessionType === 'جلسة محكمة' || sessionType === 'جلسة عادية') {
        const eff = getEffectiveStageInfo(targetCase);
        setCourt(eff.court || targetCase.court || 'تحديد المحكمة يدوياً');
        setCircuit(eff.circuit || targetCase.circuit || 'الدائرة المختصة');
      }
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
      
      const isCourtSession = sessionType === 'جلسة محكمة' || sessionType === 'جلسة عادية';
      const effectiveIsDetention = !isCourtSession && (sessionType === 'جلسة تجديد حبس' || isDetention);
      const effectiveIsExpert = !isCourtSession && (sessionType === 'جلسة خبراء' || isExpert);

      // Determine final subject
      let finalSubject = subject;
      if (!finalSubject) {
        if (effectiveIsDetention) {
          finalSubject = `جلسة تجديد حبس احتياطي (${detentionAuthority})`;
        } else if (effectiveIsExpert) {
          finalSubject = `جلسة خبراء (${expertOffice})`;
        } else {
          finalSubject = 'جلسة نظر دعوى ومرافعة أمام المحكمة';
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
      const normDate = normalizeHearingDate(date) || date;
      const existingRen = targetCase.detentionRenewals?.find(r => normalizeHearingDate(r.date || r.renewalDate) === normDate);
      const renId = existingRen?.id || `ren-${targetCase.id}-${normDate}`;
      const sessionId = effectiveIsDetention 
        ? getDetentionSessionId(targetCase.id, normDate)
        : effectiveIsExpert
        ? `session-expert-${targetCase.id}-${Date.now()}`
        : `session-court-manual-${targetCase.id}-${normDate}-${Date.now()}`;

      const newSess: HearingSession = {
        id: sessionId,
        caseId: targetCase.id,
        caseNumber: effectiveIsDetention && targetCase.investigationNumber ? targetCase.investigationNumber : (eff.caseNumber || targetCase.caseNumberFirstInstance),
        caseYear: effectiveIsDetention && targetCase.investigationYear ? targetCase.investigationYear : (eff.caseYear || targetCase.caseYearFirstInstance),
        clientName: targetCase.clientName,
        opponentName: effectiveIsDetention ? (targetCase.investigationAuthority || 'النيابة العامة') : (targetCase.opponent?.name || (targetCase.opponentsList && targetCase.opponentsList[0]?.name) || 'غير محدد'),
        court: finalCourt || (effectiveIsDetention ? (detentionAuthority || 'النيابة العامة') : (effectiveIsExpert ? (expertOffice || 'مكتب الخبراء') : (targetCase.court || 'المحكمة المختصة'))),
        circuit: circuit || (effectiveIsDetention ? 'غرفة المشورة / التجديدات' : (effectiveIsExpert ? 'مكتب الخبراء' : (targetCase.circuit || 'الدائرة المختصة'))),
        type: targetCase.type,
        date: date,
        time: finalTime,
        subject: finalSubject,
        status: 'pending',
        sessionType: isCourtSession ? 'جلسة محكمة' : sessionType, // حفظ نوع الجلسة مع بيانات الجلسة
        assignedLawyerId: assignedLawyerId || undefined,
        assignedLawyerName: assignedUser ? assignedUser.fullName : undefined,
        isDetentionRenewal: effectiveIsDetention,
        detentionAuthority: effectiveIsDetention ? detentionAuthority : undefined,
        detentionDurationDays: effectiveIsDetention ? detentionDuration : undefined,
        detentionRenewalId: effectiveIsDetention ? renId : undefined,
        isExpertSession: effectiveIsExpert,
        expertOffice: effectiveIsExpert ? expertOffice : undefined
      };

      await onAddSession(newSess, {
        isDetention: effectiveIsDetention,
        authority: effectiveIsDetention ? detentionAuthority : undefined,
        duration: effectiveIsDetention ? detentionDuration : undefined,
        renewalId: effectiveIsDetention ? renId : undefined
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

            {/* 2. خانة: تحديد جلسة مع أيقونة اختيار تفتح قائمة بأنواع الجلسات */}
            <div className="relative" ref={typeDropdownRef}>
              <label className="block text-xs sm:text-sm font-black text-amber-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>تحديد جلسة</span>
                </span>
                <span className="text-[11px] text-amber-400/80 font-bold">
                  نوع الجلسة المجدولة بالرول
                </span>
              </label>

              {/* Selector Box */}
              <div className="relative w-full border-2 border-slate-700 bg-[#0D1A2D] hover:border-amber-400/80 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 transition-all focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 shadow-inner">
                {/* Visual badge and title of the selected session type */}
                <div 
                  onClick={() => setIsTypeDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2.5 flex-1 cursor-pointer select-none text-right"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    sessionType === 'جلسة تجديد حبس'
                      ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                      : sessionType === 'جلسة خبراء'
                      ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-300'
                      : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  }`}>
                    {sessionType === 'جلسة تجديد حبس' ? (
                      <Lock className="w-4 h-4 text-rose-400" />
                    ) : sessionType === 'جلسة خبراء' ? (
                      <Scale className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Gavel className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-black text-white block">
                      {sessionType === 'جلسة عادية' ? 'جلسة محكمة' : sessionType}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {sessionType === 'جلسة تجديد حبس'
                        ? 'جلسة لنظر أمر تجديد الحبس الاحتياطي'
                        : sessionType === 'جلسة خبراء'
                        ? 'مباشرة مأمورية أو مناقشة بمكتب الخبراء'
                        : 'جلسة مرافعة ونظر دعوى أمام هيئة المحكمة (جلسة عادية)'}
                    </span>
                  </div>
                </div>

                {/* أيقونة اختيار تفتح قائمة بأنواع الجلسات */}
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(prev => !prev)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isTypeDropdownOpen
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-400/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-600 hover:border-amber-400/60'
                  }`}
                  title="أيقونة اختيار: فتح قائمة أنواع الجلسات"
                  aria-label="أيقونة اختيار نوع الجلسة"
                >
                  <ListFilter className="w-4 h-4" />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* القائمة المنسدلة بأنواع الجلسات الثلاث */}
              {isTypeDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-[#0B1728] border-2 border-amber-400/60 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-40 p-2 space-y-1.5 animate-scaleUp">
                  <div className="px-3 py-1.5 text-[11px] font-black text-amber-300/80 border-b border-slate-700/60 flex items-center justify-between">
                    <span>اختر نوع الجلسة من القائمة:</span>
                    <span className="text-[10px] text-slate-400 font-mono">3 أنواع</span>
                  </div>

                  {/* 1. جلسة محكمة */}
                  <button
                    type="button"
                    onClick={() => handleSelectSessionType('جلسة محكمة')}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer text-right ${
                      sessionType === 'جلسة محكمة' || sessionType === 'جلسة عادية'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <Gavel className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black text-white">جلسة محكمة</div>
                        <div className="text-[10px] text-slate-400 font-medium">جلسة مرافعة ونظر دعوى أمام المحكمة (جلسة عادية)</div>
                      </div>
                    </div>
                    {(sessionType === 'جلسة محكمة' || sessionType === 'جلسة عادية') && (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>

                  {/* 2. جلسة تجديد حبس */}
                  <button
                    type="button"
                    onClick={() => handleSelectSessionType('جلسة تجديد حبس')}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer text-right ${
                      sessionType === 'جلسة تجديد حبس'
                        ? 'bg-rose-500/25 border-rose-400 text-rose-100 ring-1 ring-rose-400/40'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0">
                        <Lock className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>جلسة تجديد حبس</span>
                          <span className="text-[9px] bg-rose-500/40 text-rose-200 px-1.5 py-0.5 rounded font-bold">🔒 تجديد حبس احتياطي</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">نظر أمر مد أو استئناف الحبس الاحتياطي</div>
                      </div>
                    </div>
                    {sessionType === 'جلسة تجديد حبس' && (
                      <Check className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </button>

                  {/* 3. جلسة خبراء */}
                  <button
                    type="button"
                    onClick={() => handleSelectSessionType('جلسة خبراء')}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer text-right ${
                      sessionType === 'جلسة خبراء'
                        ? 'bg-indigo-500/25 border-indigo-400 text-indigo-100 ring-1 ring-indigo-400/40'
                        : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
                        <Scale className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>جلسة خبراء</span>
                          <span className="text-[9px] bg-indigo-500/40 text-indigo-200 px-1.5 py-0.5 rounded font-bold">⚖️ وزارة العدل</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">مباشرة مأمورية فنية أو جلسة مناقشة وتقديم مستندات</div>
                      </div>
                    </div>
                    {sessionType === 'جلسة خبراء' && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                  </button>

                </div>
              )}
            </div>

            {/* تفاصيل جلسة تجديد الحبس الاحتياطي (تظهر عند اختيار جلسة تجديد حبس) */}
            {sessionType === 'جلسة تجديد حبس' && (
              <div className="bg-[#0E1D33] border-2 border-rose-500/40 rounded-2xl p-4 space-y-3 shadow-md animate-fadeIn">
                <div className="flex items-center gap-2 text-rose-300 font-black text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>بيانات تجديد الحبس الاحتياطي</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1">جهة التجديد</label>
                    <select
                      value={detentionAuthority}
                      onChange={(e) => setDetentionAuthority(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0D1A2D] border-2 border-slate-700 rounded-xl text-xs sm:text-sm font-black text-white outline-none focus:border-amber-400 shadow-inner"
                    >
                      <option value="النيابة العامة" className="bg-[#0D1A2D] text-white">النيابة العامة</option>
                      <option value="تجديد جزئي" className="bg-[#0D1A2D] text-white">تجديد جزئي (قاضي المعارضات)</option>
                      <option value="تجديد غرفة مشورة" className="bg-[#0D1A2D] text-white">تجديد غرفة مشورة</option>
                      <option value="تجديد جنايات" className="bg-[#0D1A2D] text-white">تجديد جنايات</option>
                      <option value="تجديد جنايات غرفة" className="bg-[#0D1A2D] text-white">تجديد جنايات غرفة</option>
                      <option value="تجديد 150 يوم" className="bg-[#0D1A2D] text-white">تجديد 150 يوم</option>
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
              </div>
            )}

            {/* تفاصيل جلسة الخبراء (تظهر عند اختيار جلسة خبراء) */}
            {sessionType === 'جلسة خبراء' && (
              <div className="bg-[#0E1D33] border-2 border-indigo-500/40 rounded-2xl p-4 space-y-3 shadow-md animate-fadeIn">
                <div className="flex items-center gap-2 text-indigo-300 font-black text-xs sm:text-sm">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  <span>بيانات جلسة الخبراء</span>
                </div>
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
