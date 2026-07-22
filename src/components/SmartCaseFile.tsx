import React, { useState, useEffect, useRef } from 'react';
import { 
  Scale, Calendar, DollarSign, FileText, Activity, User, Users, 
  CheckCircle2, AlertCircle, Printer, Share2, Sparkles, Plus, 
  Trash2, Download, Eye, Gavel, Clock, ArrowRight, Edit3, 
  Upload, X, Send, FilePlus, Receipt, Coins, MessageSquare, AlertTriangle, File,
  UserCheck, CheckCircle, Search, ChevronDown, PlusCircle, UserPlus, ShieldAlert,
  Camera, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, HearingSession, PaymentReceipt, CaseClient, Opponent, User as AppUser, CaseFile, Client, LitigationDegree } from '../types';
import { getFileFromIndexedDB, getProxiedUrl } from '../utils/fileStorage';
import MultiUploadManager from './MultiUploadManager';
import { CourtSelect } from '../utils/courts';
import { BaseModal, FormCard, FormGrid, FormField, PrimaryButton, SecondaryButton } from './FormComponents';

interface SmartCaseFileProps {
  caseData: Case;
  currentUser: AppUser;
  users: AppUser[];
  sessions: HearingSession[];
  onUpdateCase: (updated: Case) => Promise<void> | void;
  onAddSession: (sess: HearingSession) => Promise<void> | void;
  onUpdateSession: (sess: HearingSession) => Promise<void> | void;
  onClose: () => void;
  clients?: Client[];
}

export default function SmartCaseFile({
  caseData,
  currentUser,
  users,
  sessions,
  onUpdateCase,
  onAddSession,
  onUpdateSession,
  onClose,
  clients = []
}: SmartCaseFileProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'documents' | 'financials' | 'ai' | 'timeline'>('overview');
  const [localCase, setLocalCase] = useState<Case>(caseData);
  const [showReportPreview, setShowReportPreview] = useState(false);

  // Synchronize local state with real-time updates from prop
  useEffect(() => {
    setLocalCase(caseData);
  }, [caseData]);

  // Filter sessions related to this case
  const caseSessions = sessions.filter(s => s.caseId === localCase.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 1. Audit Log/Timeline Helper
  const logAction = async (action: string, details: string) => {
    const logEntry = {
      username: currentUser.username || currentUser.fullName,
      fullName: currentUser.fullName,
      timestamp: new Date().toISOString(),
      action,
      details
    };
    const updatedLogs = [...(localCase as any).auditTrail || [], logEntry];
    const updatedCase = { ...localCase, auditTrail: updatedLogs };
    await onUpdateCase(updatedCase);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 md:p-4 text-right" dir="rtl">
      <div className="w-full h-full md:h-[95vh] md:max-w-6xl bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header section */}
        <div className="bg-[#0f172a] text-white p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/20 no-print flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-slate-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-amber-400">{localCase.clientName}</span>
                  <span className="text-slate-400 text-sm md:text-base font-normal">ضد</span>
                  <span className="text-rose-400">{localCase.opponent.name}</span>
                </h1>
                <span className="bg-amber-500/10 text-amber-400 text-[10px] md:text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {localCase.degree}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>ملف مكتب رقم: <strong className="text-slate-200">{localCase.officeFileNo || 'غير محدد'}</strong></span>
                <span>•</span>
                <span>أول درجة: <strong className="text-slate-200">{localCase.caseNumberFirstInstance} لسنة {localCase.caseYearFirstInstance}</strong></span>
                <span>•</span>
                <span>نوع النزاع: <strong className="text-slate-200">{localCase.type}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => setShowReportPreview(true)}
              className="p-2 md:px-3 md:py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span className="hidden md:inline">تقرير PDF</span>
            </button>
            <button
              onClick={async () => {
                const summary = `📁 ملف القضية الذكي: ${localCase.clientName} ضد ${localCase.opponent.name}
⚖️ القضية رقم ${localCase.caseNumberFirstInstance} لسنة ${localCase.caseYearFirstInstance} أمام محكمة ${localCase.court}
📅 الجلسة القادمة: ${localCase.nextHearingDate || 'غير مجدولة'}
💰 المتبقي المالي: ${localCase.totalFees - localCase.paidFees} ج.م.`;
                await navigator.clipboard.writeText(summary);
                alert('📋 تم نسخ ملخص القضية للتصدير والمشاركة بنجاح!');
                logAction('مشاركة', 'تم نسخ ملخص القضية للمشاركة');
              }}
              className="p-2 md:px-3 md:py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">مشاركة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 rounded-xl cursor-pointer transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigator */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-4 flex items-center overflow-x-auto gap-2 no-print flex-shrink-0">
          {[
            { id: 'overview', label: 'ملف القضية', icon: FileText },
            { id: 'sessions', label: 'الجلسات والقرارات', icon: Gavel },
            { id: 'documents', label: 'الأوراق والمرفقات', icon: FilePlus },
            { id: 'financials', label: 'الماليات والأرصدة', icon: Coins },
            { id: 'ai', label: 'المساعد القانوني AI', icon: Sparkles },
            { id: 'timeline', label: 'السجل والنشاط', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 border-b-2 text-xs font-black flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                  active 
                    ? 'border-amber-500 text-amber-600 bg-amber-500/5' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/55'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Printable Area (for standard PDF print layout) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100/55">
          <PrintableReport caseData={localCase} sessions={caseSessions} />
          
          <div className="no-print h-full">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <OverviewTab 
                  localCase={localCase} 
                  users={users} 
                  currentUser={currentUser}
                  clients={clients}
                  onUpdate={async (val) => {
                    setLocalCase(val);
                    await onUpdateCase(val);
                  }}
                  logAction={logAction}
                />
              )}
              {activeTab === 'sessions' && (
                <SessionsTab 
                  localCase={localCase} 
                  caseSessions={caseSessions}
                  users={users}
                  currentUser={currentUser}
                  onAddSession={onAddSession}
                  onUpdateSession={onUpdateSession}
                  onUpdateCase={onUpdateCase}
                  logAction={logAction}
                />
              )}
              {activeTab === 'documents' && (
                <DocumentsTab 
                  localCase={localCase}
                  currentUser={currentUser}
                  onUpdateCase={onUpdateCase}
                  logAction={logAction}
                />
              )}
              {activeTab === 'financials' && (
                <FinancialsTab 
                  localCase={localCase}
                  onUpdateCase={onUpdateCase}
                  logAction={logAction}
                />
              )}
              {activeTab === 'ai' && (
                <AiAssistantTab localCase={localCase} />
              )}
              {activeTab === 'timeline' && (
                <TimelineTab localCase={localCase} caseSessions={caseSessions} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* PDF Report Preview Modal */}
      {showReportPreview && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4 no-print animate-in fade-in duration-200" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-500 hidden sm:block">
                  <Printer className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-slate-100 tracking-tight flex items-center gap-1.5 flex-wrap">
                      <span>📁 ملف القضية:</span>
                      <span className="text-amber-400">{localCase.clientName}</span>
                      <span className="text-slate-400 text-sm font-normal">ضد</span>
                      <span className="text-rose-400">{localCase.opponent.name}</span>
                    </h3>
                    <span className="bg-amber-500 text-slate-950 text-[10px] md:text-xs font-black px-2.5 py-0.5 rounded-md shadow-sm">
                      رقم القضية: {localCase.caseNumberFirstInstance || localCase.officeFileNo || 'غير محدد'}
                    </span>
                  </div>
                  <p className="text-[10px] md:text-xs text-amber-400 font-medium mt-1">
                    مؤسسة رميح للمحاماة • معاينة وتدقيق تقرير ملف القضية المعتمد لدرجة ({localCase.degree})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    logAction('طباعة التقرير', 'تمت طباعة تقرير ملف القضية من نافذة المعاينة');
                    window.print();
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  طباعة التقرير الآن 🖨️
                </button>
                <button
                  onClick={() => setShowReportPreview(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  إغلاق المعاينة
                </button>
              </div>
            </div>
            
            {/* Sheet Canvas Preview Container */}
            <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-950/50 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl border border-slate-100 p-6 md:p-10 text-black">
                <PrintableReport caseData={localCase} sessions={caseSessions} isPreview={true} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== HELPER COMPONENTS & CONSTANTS ========================
const capacityOptions = [
  'مدعي',
  'مدعى عليه',
  'مستأنف',
  'مستأنف ضده',
  'منفذ',
  'منفذ ضده',
  'شاكي',
  'مشكو في حقه',
  'متهم',
  'مجني عليه'
];

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "اختر...",
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full text-right" dir="rtl">
      <div 
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={`w-full px-3 py-2 bg-slate-50 border ${required && !value ? 'border-red-300' : 'border-slate-200'} rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-between hover:bg-white hover:border-amber-400 transition-all duration-200 h-[38px]`}
      >
        <span className={value ? 'text-slate-800 font-black' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن الصفة..."
              className="w-full bg-transparent text-xs text-slate-800 focus:outline-none py-0.5 text-right"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {search && (
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch('');
                }}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold px-1"
              >
                مسح
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-3.5 text-center text-slate-400 text-[11px] font-medium">
                لا توجد نتائج مطابقة
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    value === opt 
                      ? 'bg-amber-500/10 text-amber-700 font-extrabold' 
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt}</span>
                  {value === opt && <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ======================== SUB COMPONENT: OVERVIEW TAB ========================
function OverviewTab({ 
  localCase, 
  users, 
  currentUser,
  clients = [],
  onUpdate,
  logAction 
}: { 
  localCase: Case; 
  users: AppUser[]; 
  currentUser: AppUser;
  clients?: Client[];
  onUpdate: (val: Case) => Promise<void>;
  logAction: (act: string, det: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'judicial' | 'litigants'>('judicial');

  const [degree, setDegree] = useState<LitigationDegree>(localCase.degree || 'أول درجة');
  
  // Standard list of types, check if type is there
  const standardTypes = ['جنائي', 'جنح', 'ادارى', 'مخالفات', 'مدني', 'إيجارات', 'تجارى', 'عمال', 'أحوال شخصية', 'صحة توقيع', 'مجلس الدولة', 'تنفيذ', 'إشكالات', 'منازعات تنفيذ'];
  const [caseType, setCaseType] = useState<string>(() => {
    if (standardTypes.includes(localCase.type)) return localCase.type;
    return 'أخرى';
  });
  const [customCaseType, setCustomCaseType] = useState<string>(() => {
    if (standardTypes.includes(localCase.type)) return '';
    return localCase.type || '';
  });

  const [officeFileNo, setOfficeFileNo] = useState(localCase.officeFileNo || '');
  const [court, setCourt] = useState(localCase.court || '');
  const [circuit, setCircuit] = useState(localCase.circuit || '');

  const [showAppealSection, setShowAppealSection] = useState(
    !!(localCase.courtSecondInstance || localCase.caseNumberSecondInstance || localCase.degree === 'استئناف' || localCase.degree === 'نقض')
  );
  const [showCassationSection, setShowCassationSection] = useState(
    !!(localCase.courtCassation || localCase.cassationNumber || localCase.degree === 'نقض')
  );

  const [court1st, setCourt1st] = useState(localCase.courtFirstInstance || '');
  const [venue1st, setVenue1st] = useState(localCase.venueFirstInstance || '');
  const [circuit1st, setCircuit1st] = useState(localCase.circuitFirstInstance || '');
  const [caseNo1st, setCaseNo1st] = useState(localCase.caseNumberFirstInstance || '');
  const [caseYear1st, setCaseYear1st] = useState(localCase.caseYearFirstInstance || '');

  const [court2nd, setCourt2nd] = useState(localCase.courtSecondInstance || '');
  const [venue2nd, setVenue2nd] = useState(localCase.venueSecondInstance || '');
  const [circuit2nd, setCircuit2nd] = useState(localCase.circuitSecondInstance || '');
  const [caseNo2nd, setCaseNo2nd] = useState(localCase.caseNumberSecondInstance || '');
  const [caseYear2nd, setCaseYear2nd] = useState(localCase.caseYearSecondInstance || '');

  const [courtCass, setCourtCass] = useState(localCase.courtCassation || '');
  const [venueCass, setVenueCass] = useState(localCase.venueCassation || '');
  const [circuitCass, setCircuitCass] = useState(localCase.circuitCassation || '');
  const [cassationNumber, setCassationNumber] = useState(localCase.cassationNumber || '');
  const [cassationYear, setCassationYear] = useState(localCase.cassationYear || '');

  const [nextHearing, setNextHearing] = useState(localCase.nextHearingDate || '');
  const [nextHearingTime, setNextHearingTime] = useState(localCase.nextHearingTime || '');
  const [status, setStatus] = useState(localCase.status || '');
  const [enforcementNo, setEnforcementNo] = useState(localCase.enforcementNumber || '');
  const [prosecutor, setProsecutor] = useState(localCase.prosecutorName || '');
  const [caseSubject, setCaseSubject] = useState(localCase.subject || '');
  const [notes, setNotes] = useState(localCase.notes || '');
  const [assignedLawyerId, setAssignedLawyerId] = useState(localCase.assignedLawyerId || '');
  const [courtBench, setCourtBench] = useState((localCase as any).courtBench || '');

  const [formClients, setFormClients] = useState<CaseClient[]>(() => {
    if (localCase.clientsList && localCase.clientsList.length > 0) {
      return localCase.clientsList;
    }
    return [{
      id: localCase.clientId || `client-${Date.now()}`,
      name: localCase.clientName || '',
      role: 'موكل/مدعي'
    }];
  });

  const [formOpponents, setFormOpponents] = useState<Opponent[]>(() => {
    if (localCase.opponentsList && localCase.opponentsList.length > 0) {
      return localCase.opponentsList;
    }
    if (localCase.opponent) {
      return [localCase.opponent];
    }
    return [{
      id: `opp-${Date.now()}`,
      name: '',
      role: 'مدعى عليه',
      address: '',
      lawyer: '',
      phone: ''
    }];
  });

  // Keep state updated if localCase changes
  useEffect(() => {
    if (!editing) {
      setDegree(localCase.degree || 'أول درجة');
      if (standardTypes.includes(localCase.type)) {
        setCaseType(localCase.type);
        setCustomCaseType('');
      } else {
        setCaseType('أخرى');
        setCustomCaseType(localCase.type || '');
      }
      setOfficeFileNo(localCase.officeFileNo || '');
      setCourt(localCase.court || '');
      setCircuit(localCase.circuit || '');
      setShowAppealSection(!!(localCase.courtSecondInstance || localCase.caseNumberSecondInstance || localCase.degree === 'استئناف' || localCase.degree === 'نقض'));
      setShowCassationSection(!!(localCase.courtCassation || localCase.cassationNumber || localCase.degree === 'نقض'));
      setCourt1st(localCase.courtFirstInstance || '');
      setVenue1st(localCase.venueFirstInstance || '');
      setCircuit1st(localCase.circuitFirstInstance || '');
      setCaseNo1st(localCase.caseNumberFirstInstance || '');
      setCaseYear1st(localCase.caseYearFirstInstance || '');
      setCourt2nd(localCase.courtSecondInstance || '');
      setVenue2nd(localCase.venueSecondInstance || '');
      setCircuit2nd(localCase.circuitSecondInstance || '');
      setCaseNo2nd(localCase.caseNumberSecondInstance || '');
      setCaseYear2nd(localCase.caseYearSecondInstance || '');
      setCourtCass(localCase.courtCassation || '');
      setVenueCass(localCase.venueCassation || '');
      setCircuitCass(localCase.circuitCassation || '');
      setCassationNumber(localCase.cassationNumber || '');
      setCassationYear(localCase.cassationYear || '');
      setNextHearing(localCase.nextHearingDate || '');
      setNextHearingTime(localCase.nextHearingTime || '');
      setStatus(localCase.status || '');
      setEnforcementNo(localCase.enforcementNumber || '');
      setProsecutor(localCase.prosecutorName || '');
      setCaseSubject(localCase.subject || '');
      setNotes(localCase.notes || '');
      setAssignedLawyerId(localCase.assignedLawyerId || '');
      setCourtBench((localCase as any).courtBench || '');
      
      if (localCase.clientsList && localCase.clientsList.length > 0) {
        setFormClients(localCase.clientsList);
      } else {
        setFormClients([{
          id: localCase.clientId || `client-${Date.now()}`,
          name: localCase.clientName || '',
          role: 'موكل/مدعي'
        }]);
      }

      if (localCase.opponentsList && localCase.opponentsList.length > 0) {
        setFormOpponents(localCase.opponentsList);
      } else if (localCase.opponent) {
        setFormOpponents([localCase.opponent]);
      } else {
        setFormOpponents([{
          id: `opp-${Date.now()}`,
          name: '',
          role: 'مدعى عليه',
          address: '',
          lawyer: '',
          phone: ''
        }]);
      }
    }
  }, [localCase, editing]);

  const addFormClient = () => {
    setFormClients([...formClients, { id: `client-${Date.now()}-${Math.random()}`, name: '', role: 'موكل/مدعي' }]);
  };
  const removeFormClient = (index: number) => {
    setFormClients(formClients.filter((_, idx) => idx !== index));
  };
  const updateFormClient = (index: number, fields: Partial<CaseClient>) => {
    setFormClients(formClients.map((cl, idx) => idx === index ? { ...cl, ...fields } : cl));
  };

  const addFormOpponent = () => {
    setFormOpponents([...formOpponents, { id: `opp-${Date.now()}-${Math.random()}`, name: '', role: 'مدعى عليه', address: '', lawyer: '', phone: '' }]);
  };
  const removeFormOpponent = (index: number) => {
    setFormOpponents(formOpponents.filter((_, idx) => idx !== index));
  };
  const updateFormOpponent = (index: number, fields: Partial<Opponent>) => {
    setFormOpponents(formOpponents.map((opp, idx) => idx === index ? { ...opp, ...fields } : opp));
  };

  const handleSave = async () => {
    if (!caseNo1st.trim()) {
      setActiveFormTab('judicial');
      alert('يرجى كتابة رقم القضية في مرحلة أول درجة للتمكن من الحفظ.');
      return;
    }
    if (!caseYear1st.trim()) {
      setActiveFormTab('judicial');
      alert('يرجى كتابة سنة القضية في مرحلة أول درجة للتمكن من الحفظ.');
      return;
    }

    const activeClients = formClients.filter(cl => cl.name && cl.name.trim() !== '');
    if (activeClients.length === 0) {
      setActiveFormTab('litigants');
      alert('يرجى إضافة واسم موكل واحد على الأقل للمتابعة.');
      return;
    }
    for (let idx = 0; idx < formClients.length; idx++) {
      if (!formClients[idx].name.trim()) {
        setActiveFormTab('litigants');
        alert(`يرجى كتابة الاسم الكامل للموكل رقم ${idx + 1}.`);
        return;
      }
      if (!formClients[idx].role || !formClients[idx].role.trim()) {
        setActiveFormTab('litigants');
        alert(`يرجى تحديد صفة الموكل رقم ${idx + 1} بالدعوى.`);
        return;
      }
    }
    
    const activeOpponents = formOpponents.filter(opp => opp.name && opp.name.trim() !== '');
    if (activeOpponents.length === 0) {
      setActiveFormTab('litigants');
      alert('يرجى إضافة واسم خصم واحد على الأقل للمتابعة.');
      return;
    }
    for (let idx = 0; idx < formOpponents.length; idx++) {
      if (!formOpponents[idx].name.trim()) {
        setActiveFormTab('litigants');
        alert(`يرجى كتابة اسم الخصم رقم ${idx + 1}.`);
        return;
      }
      if (!formOpponents[idx].role || !formOpponents[idx].role.trim()) {
        setActiveFormTab('litigants');
        alert(`يرجى تحديد صفة الخصم رقم ${idx + 1} بالدعوى.`);
        return;
      }
    }

    const firstClient = activeClients[0];
    const firstOpponent = activeOpponents[0];

    const actualCaseType = caseType === 'أخرى' && customCaseType ? customCaseType : caseType;

    let primaryCourt = court;
    let primaryCircuit = circuit;

    if (degree === 'أول درجة') {
      primaryCourt = court1st;
      primaryCircuit = circuit1st;
    } else if (degree === 'استئناف') {
      primaryCourt = court2nd;
      primaryCircuit = circuit2nd;
    } else if (degree === 'نقض') {
      primaryCourt = courtCass;
      primaryCircuit = circuitCass;
    }

    const updated: Case = {
      ...localCase,
      officeFileNo: officeFileNo || undefined,
      caseNumberFirstInstance: caseNo1st,
      caseYearFirstInstance: caseYear1st,
      caseNumberSecondInstance: caseNo2nd || undefined,
      caseYearSecondInstance: caseYear2nd || undefined,
      cassationNumber: cassationNumber || undefined,
      cassationYear: cassationYear || undefined,
      courtFirstInstance: court1st || undefined,
      venueFirstInstance: venue1st || undefined,
      circuitFirstInstance: circuit1st || undefined,
      courtSecondInstance: court2nd || undefined,
      venueSecondInstance: venue2nd || undefined,
      circuitSecondInstance: circuit2nd || undefined,
      courtCassation: courtCass || undefined,
      venueCassation: venueCass || undefined,
      circuitCassation: circuitCass || undefined,
      type: actualCaseType as any,
      court: primaryCourt,
      circuit: primaryCircuit,
      nextHearingDate: nextHearing || undefined,
      nextHearingTime: nextHearingTime || undefined,
      status,
      clientName: firstClient.name,
      clientId: firstClient.id || localCase.clientId,
      opponent: {
        name: firstOpponent.name || 'غير محدد',
        role: firstOpponent.role || 'مدعى عليه',
        address: firstOpponent.address || '',
        lawyer: firstOpponent.lawyer || '',
        phone: firstOpponent.phone || '',
        lawyerPhone: firstOpponent.lawyerPhone || ''
      },
      clientsList: activeClients,
      opponentsList: activeOpponents,
      notes: notes || undefined,
      subject: caseSubject || undefined,
      prosecutorName: prosecutor || undefined,
      enforcementNumber: enforcementNo || undefined,
      degree,
      assignedLawyerId: assignedLawyerId || undefined
    };
    (updated as any).courtBench = courtBench;

    await onUpdate(updated);
    setEditing(false);
    await logAction('تعديل ملف', 'تم تحديث البيانات القضائية وأطراف الدعوى والخصوم عبر نافذة تعديل البيانات المطورة');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* Grid of Main Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl"><Gavel className="w-5 h-5" /></div>
          <div>
            <h4 className="text-[10px] text-slate-400 font-bold">المحكمة والدائرة</h4>
            <p className="text-xs font-black text-slate-800 mt-1">{localCase.court || 'غير محدد'} / {localCase.circuit || 'غير محدد'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl"><User className="w-5 h-5" /></div>
          <div>
            <h4 className="text-[10px] text-slate-400 font-bold">المحامي المسؤول</h4>
            <p className="text-xs font-black text-slate-800 mt-1">
              {users.find(u => u.id === localCase.assignedLawyerId)?.fullName || 'لم يتم التعيين'}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl"><Clock className="w-5 h-5" /></div>
          <div>
            <h4 className="text-[10px] text-slate-400 font-bold">حالة القضية</h4>
            <p className="text-xs font-black text-emerald-600 mt-1">{localCase.status || 'نشطة/متداولة'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl"><DollarSign className="w-5 h-5" /></div>
          <div>
            <h4 className="text-[10px] text-slate-400 font-bold">الرصيد المالي المتبقي</h4>
            <p className="text-xs font-black text-rose-600 mt-1">{localCase.totalFees - localCase.paidFees} ج.م.</p>
          </div>
        </div>
      </div>

      {/* Main Form/Details Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-500" />
            تفاصيل وموضوع الدعوى القضائية
          </h3>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h4 className="text-xs font-black text-amber-600 border-b border-amber-100 pb-1.5">⚖️ الموقف القضائي والأطراف</h4>
              <div className="text-xs space-y-2 text-slate-700">
                <p><strong>موضوع الدعوى:</strong> {localCase.subject || 'لم يدون موضوع الدعوى القضائية بعد.'}</p>
                <p><strong>درجة التقاضي الحالية:</strong> {localCase.degree || 'غير محدد'}</p>
                <p><strong>نوع القضية:</strong> {localCase.type || 'غير محدد'}</p>
                <p><strong>الموكل الرئيسي:</strong> {localCase.clientName}</p>
                <p><strong>الخصم الحالي:</strong> {localCase.opponent?.name || 'غير متوفر'}</p>
                {localCase.opponent?.lawyer && <p><strong>محامي الخصم:</strong> {localCase.opponent.lawyer}</p>}
                {localCase.opponent?.phone && <p><strong>هاتف الخصم:</strong> {localCase.opponent.phone}</p>}
              </div>
            </div>

            <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h4 className="text-xs font-black text-amber-600 border-b border-amber-100 pb-1.5">🏢 هيئة ومقر المحكمة</h4>
              <div className="text-xs space-y-2 text-slate-700">
                <p><strong>جهة المحكمة:</strong> {localCase.court || 'غير محدد'}</p>
                <p><strong>الدائرة:</strong> {localCase.circuit || 'غير محدد'}</p>
                <p><strong>هيئة المحكمة (القضاة):</strong> {(localCase as any).courtBench || 'غير محدد'}</p>
                <p><strong>المحامي المسؤول بالملف:</strong> {users.find(u => u.id === localCase.assignedLawyerId)?.fullName || 'لم يتم تحديد مسؤول'}</p>
              </div>
            </div>
          </div>

          {localCase.notes && (
            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
              <h4 className="text-xs font-black text-amber-800 flex items-center gap-1 mb-2">💡 الملاحظات والإجراءات القانونية</h4>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">{localCase.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stepper Edit Form Modal */}
      <BaseModal
        isOpen={editing}
        onClose={() => setEditing(false)}
        title="تعديل بيانات ملف القضية"
        description="تعديل البيانات القانونية لملف القضية الحالي ومراجعة الأطراف والخصوم"
        icon={Gavel}
        size="4xl"
      >
        {/* Stepper Navigation */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none mb-6" dir="rtl">
          {[
            { id: 'judicial', label: 'البيانات القضائية', desc: 'المحكمة والدائرة', icon: Gavel },
            { id: 'litigants', label: 'أطراف الدعوى', desc: 'الموكلين والخصوم', icon: UserCheck }
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeFormTab === step.id;
            const isCompleted = activeFormTab === 'litigants' && idx === 0;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setActiveFormTab(step.id as any);
                }}
                className={`flex items-center gap-2.5 text-right transition-all duration-200 outline-none ${
                  isActive ? 'opacity-100 scale-[1.02]' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-slate-900 text-amber-400 shadow-sm ring-4 ring-slate-100' :
                  isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                  'bg-white text-slate-400 border border-slate-200'
                }`}>
                  {isCompleted ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="hidden md:block">
                  <p className={`text-[11px] font-black leading-tight ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold">
                    {step.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Content depending on activeFormTab */}
        <div className="space-y-6 text-right" dir="rtl">
          {activeFormTab === 'judicial' && (
            <div className="space-y-6 animate-fadeIn">
              <FormCard title="بيانات درجة التقاضي ونوع الدعوى" icon={Gavel}>
                <FormGrid cols={3}>
                  <FormField label="درجة التقاضي الحالية" required>
                    <select
                      value={degree}
                      onChange={(e) => {
                        const val = e.target.value as LitigationDegree;
                        setDegree(val);
                        if (val === 'استئناف') {
                          setShowAppealSection(true);
                        } else if (val === 'نقض') {
                          setShowAppealSection(true);
                          setShowCassationSection(true);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans cursor-pointer"
                    >
                      <option value="أول درجة">أول درجة</option>
                      <option value="استئناف">استئناف</option>
                      <option value="نقض">نقض</option>
                    </select>
                  </FormField>

                  <FormField label="نوع القضية" required>
                    <select
                      value={caseType}
                      onChange={(e) => setCaseType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans cursor-pointer"
                    >
                      <option value="جنائي">جنائي</option>
                      <option value="جنح">جنح</option>
                      <option value="ادارى">ادارى</option>
                      <option value="مخالفات">مخالفات</option>
                      <option value="مدني">مدني</option>
                      <option value="إيجارات">إيجارات</option>
                      <option value="تجارى">تجارى</option>
                      <option value="عمال">عمال</option>
                      <option value="أحوال شخصية">أحوال شخصية</option>
                      <option value="صحة توقيع">صحة توقيع</option>
                      <option value="مجلس الدولة">مجلس الدولة</option>
                      <option value="تنفيذ">تنفيذ</option>
                      <option value="إشكالات">إشكالات</option>
                      <option value="منازعات تنفيذ">منازعات تنفيذ</option>
                      <option value="أخرى">أخرى (أدخل بالأسفل)</option>
                    </select>
                  </FormField>

                  <FormField label="رقم الملف بالمكتب (اختياري)" isMono>
                    <div className="relative">
                      <span className="absolute right-3 top-2.5 text-slate-400">
                        <File className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="مثال: م-2026/15"
                        value={officeFileNo}
                        onChange={(e) => setOfficeFileNo(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </FormField>
                </FormGrid>

                <div className="flex items-center gap-6 mt-4 pt-2.5 border-t border-slate-100/60">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showAppealSection}
                      onChange={(e) => {
                        setShowAppealSection(e.target.checked);
                        if (!e.target.checked && degree === 'استئناف') {
                          setDegree('أول درجة');
                        }
                      }}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700">تفعيل مرحلة الاستئناف</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showCassationSection}
                      onChange={(e) => {
                        setShowCassationSection(e.target.checked);
                        if (!e.target.checked && degree === 'نقض') {
                          setDegree(showAppealSection ? 'استئناف' : 'أول درجة');
                        }
                      }}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700">تفعيل مرحلة الطعن بالنقض</span>
                  </label>
                </div>

                {caseType === 'أخرى' && (
                  <div className="mt-4">
                    <FormField label="اكتب نوع القضية المخصص" required>
                      <input
                        type="text"
                        placeholder="مثال: تحكيم هندسي، استثمار"
                        value={customCaseType}
                        onChange={(e) => setCustomCaseType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                      />
                    </FormField>
                  </div>
                )}
              </FormCard>

              <FormCard title="أولاً: مرحلة أول درجة" icon={Gavel}>
                <FormGrid cols={5}>
                  <FormField label="المحكمة">
                    <CourtSelect
                      value={court1st}
                      onChange={setCourt1st}
                      placeholder="مثال: محكمة أسرة التجمع"
                    />
                  </FormField>
                  <FormField label="مقر الانعقاد">
                    <input
                      type="text"
                      placeholder="مثال: القاهرة الجديدة"
                      value={venue1st}
                      onChange={(e) => setVenue1st(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all"
                    />
                  </FormField>
                  <FormField label="الدائرة">
                    <input
                      type="text"
                      placeholder="مثال: الدائرة 3 إيجارات"
                      value={circuit1st}
                      onChange={(e) => setCircuit1st(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all"
                    />
                  </FormField>
                  <FormField label="رقم القضية" required isMono>
                    <input
                      type="text"
                      placeholder="رقم الدعوى"
                      value={caseNo1st}
                      onChange={(e) => setCaseNo1st(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all text-left font-mono"
                      dir="ltr"
                    />
                  </FormField>
                  <FormField label="سنة القضية" required isMono>
                    <input
                      type="text"
                      placeholder="2026"
                      value={caseYear1st}
                      onChange={(e) => setCaseYear1st(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all text-left font-mono"
                      dir="ltr"
                    />
                  </FormField>
                </FormGrid>
              </FormCard>

              {showAppealSection && (
                <FormCard title="ثانياً: مرحلة الاستئناف" icon={Gavel}>
                  <div className="absolute top-4 left-4">
                    {degree !== 'استئناف' && degree !== 'نقض' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAppealSection(false);
                          setCaseNo2nd('');
                          setCaseYear2nd('');
                          setCourt2nd('');
                          setVenue2nd('');
                          setCircuit2nd('');
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-bold cursor-pointer"
                      >
                        إلغاء التفعيل وحذف البيانات
                      </button>
                    )}
                  </div>
                  <FormGrid cols={5}>
                    <FormField label="المحكمة">
                      <CourtSelect
                        value={court2nd}
                        onChange={setCourt2nd}
                        placeholder="مثال: استئناف عالي شمال"
                      />
                    </FormField>
                    <FormField label="مقر الانعقاد">
                      <input
                        type="text"
                        placeholder="مثال: العباسية"
                        value={venue2nd}
                        onChange={(e) => setVenue2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="الدائرة">
                      <input
                        type="text"
                        placeholder="الدائرة 5 مستأنف"
                        value={circuit2nd}
                        onChange={(e) => setCircuit2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="رقم الاستئناف" isMono>
                      <input
                        type="text"
                        placeholder="رقم الاستئناف"
                        value={caseNo2nd}
                        onChange={(e) => setCaseNo2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                    <FormField label="سنة الاستئناف" isMono>
                      <input
                        type="text"
                        placeholder="السنة"
                        value={caseYear2nd}
                        onChange={(e) => setCaseYear2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                  </FormGrid>
                </FormCard>
              )}

              {showCassationSection && (
                <FormCard title="ثالثاً: مرحلة الطعن بالنقض" icon={Gavel}>
                  <div className="absolute top-4 left-4">
                    {degree !== 'نقض' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCassationSection(false);
                          setCassationNumber('');
                          setCassationYear('');
                          setCourtCass('');
                          setVenueCass('');
                          setCircuitCass('');
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-bold cursor-pointer"
                      >
                        إلغاء التفعيل وحذف البيانات
                      </button>
                    )}
                  </div>
                  <FormGrid cols={5}>
                    <FormField label="محكمة النقض (أو المختصة)">
                      <CourtSelect
                        value={courtCass}
                        onChange={setCourtCass}
                        placeholder="مثال: محكمة النقض العليا"
                      />
                    </FormField>
                    <FormField label="مقر الانعقاد">
                      <input
                        type="text"
                        placeholder="مثال: دار القضاء العالي"
                        value={venueCass}
                        onChange={(e) => setVenueCass(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="الدائرة">
                      <input
                        type="text"
                        placeholder="مثال: الدائرة الجنائية"
                        value={circuitCass}
                        onChange={(e) => setCircuitCass(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="رقم الطعن" isMono>
                      <input
                        type="text"
                        placeholder="رقم الطعن"
                        value={cassationNumber}
                        onChange={(e) => setCassationNumber(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                    <FormField label="سنة الطعن" isMono>
                      <input
                        type="text"
                        placeholder="السنة"
                        value={cassationYear}
                        onChange={(e) => setCassationYear(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                  </FormGrid>
                </FormCard>
              )}

              <FormCard title="المتابعة وتاريخ الجلسة القادمة" icon={Calendar}>
                <FormGrid cols={4}>
                  <FormField label="تاريخ الجلسة القادمة" isMono>
                    <input
                      type="date"
                      value={nextHearing}
                      onChange={(e) => setNextHearing(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>
                  <FormField label="ساعة انعقاد الجلسة" isMono>
                    <input
                      type="time"
                      value={nextHearingTime}
                      onChange={(e) => setNextHearingTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>
                  <FormField label="حالة رول الجلسة والدعوى">
                    <input
                      type="text"
                      placeholder="مثال: مؤجلة للاطلاع..."
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                    />
                  </FormField>
                  <FormField label="رقم الحصر (إن وجد)">
                    <input
                      type="text"
                      placeholder="حصر التنفيذ أو الحصر العقاري"
                      value={enforcementNo}
                      onChange={(e) => setEnforcementNo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                    />
                  </FormField>
                </FormGrid>

                {(caseType === 'جنائي' || caseType === 'جنح' || caseType === 'ادارى' || caseType === 'مخالفات') && (
                  <div className="mt-4">
                    <FormField label="اسم السيد عضو النيابة العامة المسؤول عن المحضر">
                      <input
                        type="text"
                        placeholder="الأستاذ وكيل النيابة أو رئيس النيابة"
                        value={prosecutor}
                        onChange={(e) => setProsecutor(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  <FormField label="موضوع الدعوى">
                    <textarea
                      placeholder="اكتب موضوع القضية أو عريضة الدعوى بشكل واضح هنا..."
                      value={caseSubject}
                      onChange={(e) => setCaseSubject(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 transition-all font-sans text-right"
                    />
                  </FormField>

                  <FormField label="هيئة المحكمة (القضاة)">
                    <input
                      type="text"
                      placeholder="مثال: المستشار رئيس الدائرة وعضوية السادة الأجلاء"
                      value={courtBench}
                      onChange={(e) => setCourtBench(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                    />
                  </FormField>

                  <FormField label="المحامي المسؤول بالملف والمرافعة" required>
                    <select
                      value={assignedLawyerId}
                      onChange={(e) => setAssignedLawyerId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 transition-all font-sans cursor-pointer"
                    >
                      <option value="">اختر المحامي المسؤول...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.title})</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="ملاحظات ودفوع جوهرية بالملف">
                    <textarea
                      placeholder="اكتب أية دفوع أو ثغرات أو تعليمات للمرافعة هنا..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 transition-all font-sans text-right"
                    />
                  </FormField>
                </div>
              </FormCard>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (!caseNo1st.trim()) {
                      alert('يرجى كتابة رقم القضية في مرحلة أول درجة للتمكن من المتابعة.');
                      return;
                    }
                    if (!caseYear1st.trim()) {
                      alert('يرجى كتابة سنة القضية في مرحلة أول درجة للتمكن من المتابعة.');
                      return;
                    }
                    setActiveFormTab('litigants');
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 animate-pulse"
                >
                  <span>الخطوة التالية: أطراف الدعوى</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {activeFormTab === 'litigants' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl mb-4">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 select-none">
                  <PlusCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                  إجراءات سريعة لإضافة الأطراف:
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={addFormClient}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-amber-300 text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    إضافة موكل جديد 👤
                  </button>
                  <button
                    type="button"
                    onClick={addFormOpponent}
                    className="px-3.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-50 hover:text-amber-200 text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    إضافة خصم جديد ⚖️
                  </button>
                </div>
              </div>

              <FormCard title="الموكلين وأصحاب الشأن (الطرف الأول)" icon={UserCheck}>
                <div className="absolute top-4 left-4">
                  <PrimaryButton
                    type="button"
                    onClick={addFormClient}
                    className="px-3 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    إضافة موكل جديد
                  </PrimaryButton>
                </div>

                <div className="space-y-4 pt-2">
                  {formClients.map((cl, idx) => (
                    <div key={idx} className="bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-xl p-4 transition-all duration-200 relative">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                        <span className="bg-slate-900 text-slate-100 text-[10px] font-black px-2.5 py-1 rounded-md">
                          الموكل رقم {idx + 1}
                        </span>
                        {formClients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFormClient(idx)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer"
                            title="حذف هذا الموكل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <FormGrid cols={4}>
                        <FormField label="اختر موكل مسجل بالنظام (اختياري)">
                          <select
                            value={clients && clients.some(c => c.name === cl.name) ? cl.name : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const found = clients?.find(c => c.name === val);
                                if (found) {
                                  updateFormClient(idx, {
                                    name: found.name,
                                    phone: found.phone || '',
                                    email: found.email || '',
                                    id: found.id
                                  });
                                }
                              } else {
                                updateFormClient(idx, { name: '', phone: '', email: '', id: '' });
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer"
                          >
                            <option value="">-- اختيار موكل مسجل --</option>
                            {clients?.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="الاسم بالكامل (مطلوب)" required>
                          <input
                            type="text"
                            placeholder="مثال: أحمد محمد علي"
                            value={cl.name}
                            onChange={(e) => updateFormClient(idx, { name: e.target.value })}
                            required
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          />
                        </FormField>

                        <FormField label="الصفة بالدعوى (مطلوب)" required>
                          <SearchableDropdown
                            value={cl.role || ''}
                            onChange={(val) => updateFormClient(idx, { role: val })}
                            options={capacityOptions}
                            placeholder="اختر الصفة بالدعوى (مطلوب)"
                            required
                          />
                        </FormField>

                        <FormField label="رقم الهاتف (اختياري)" isMono>
                          <input
                            type="tel"
                            placeholder="مثال: 01xxxxxxxxx"
                            value={cl.phone}
                            onChange={(e) => updateFormClient(idx, { phone: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </FormGrid>

                      <div className="mt-3">
                        <FormField label="البريد الإلكتروني (اختياري)" isMono>
                          <input
                            type="email"
                            placeholder="example@mail.com"
                            value={cl.email}
                            onChange={(e) => updateFormClient(idx, { email: e.target.value })}
                            className="w-full max-w-md px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </div>
                    </div>
                  ))}
                </div>
              </FormCard>

              <FormCard title="الخصوم وأطراف النزاع (الطرف الثاني)" icon={ShieldAlert}>
                <div className="absolute top-4 left-4">
                  <PrimaryButton
                    type="button"
                    onClick={addFormOpponent}
                    className="px-3 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4 text-amber-400" />
                    إضافة خصم جديد
                  </PrimaryButton>
                </div>

                <div className="space-y-4 pt-2">
                  {formOpponents.map((opp, idx) => (
                    <div key={idx} className="bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-xl p-4 transition-all duration-200 relative">
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                        <span className="bg-red-950 text-red-100 text-[10px] font-black px-2.5 py-1 rounded-md">
                          الخصم رقم {idx + 1}
                        </span>
                        {formOpponents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFormOpponent(idx)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer"
                            title="حذف هذا الخصم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <FormGrid cols={3}>
                        <FormField label="اسم الخصم بالكامل (مطلوب)" required>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="الاسم بالكامل أو اسم الشركة الخصم"
                              value={opp.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const isPublicProsecution = newName.trim() === 'النيابة العامة';
                                const updatedFields: Partial<Opponent> = { name: newName };
                                if (!isPublicProsecution && opp.role === 'سلطة اتهام') {
                                  updatedFields.role = 'مدعى عليه';
                                }
                                updateFormOpponent(idx, updatedFields);
                              }}
                              required
                              className="w-full px-3 py-1.5 pl-24 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-right"
                            />
                            <button
                              type="button"
                              onClick={() => updateFormOpponent(idx, { name: 'النيابة العامة', role: 'سلطة اتهام' })}
                              className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-200 hover:border-amber-500 text-[10px] text-amber-700 font-extrabold px-2.5 py-1 rounded-md transition-all duration-150 cursor-pointer shadow-sm"
                              title="اختيار النيابة العامة كخصم وتحديد صفتها كـ سلطة اتهام"
                            >
                              النيابة العامة
                            </button>
                          </div>
                        </FormField>

                        <FormField label="الصفة بالدعوى (مطلوب)" required>
                          <SearchableDropdown
                            value={opp.role || ''}
                            onChange={(val) => updateFormOpponent(idx, { role: val })}
                            options={opp.name && opp.name.trim() === 'النيابة العامة' ? [...capacityOptions, 'سلطة اتهام'] : capacityOptions}
                            placeholder="اختر الصفة بالدعوى (مطلوب)"
                            required
                          />
                        </FormField>

                        <FormField label="هاتف الخصم (اختياري)" isMono>
                          <input
                            type="tel"
                            placeholder="رقم الهاتف"
                            value={opp.phone}
                            onChange={(e) => updateFormOpponent(idx, { phone: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </FormGrid>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                        <div className="md:col-span-2">
                          <FormField label="عنوان الخصم لإعلان الصحيفة (اختياري)">
                            <input
                              type="text"
                              placeholder="العنوان التفصيلي لإعلان المحضرين"
                              value={opp.address || ''}
                              onChange={(e) => updateFormOpponent(idx, { address: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </FormField>
                        </div>
                        <FormField label="الزميل محامي الخصم والمكتب (اختياري)">
                          <input
                            type="text"
                            placeholder="الأستاذ محامي الطرف الثاني"
                            value={opp.lawyer || ''}
                            onChange={(e) => updateFormOpponent(idx, { lawyer: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </FormField>
                      </div>
                    </div>
                  ))}
                </div>
              </FormCard>

              <div className="flex justify-between items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveFormTab('judicial')}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>الخطوة السابقة</span>
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وتحديث بيانات الملف</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </BaseModal>
    </motion.div>
  );
}

// ======================== SUB COMPONENT: SESSIONS TAB ========================
function SessionsTab({ 
  localCase, 
  caseSessions, 
  users, 
  currentUser,
  onAddSession,
  onUpdateSession,
  onUpdateCase,
  logAction
}: { 
  localCase: Case; 
  caseSessions: HearingSession[]; 
  users: AppUser[];
  currentUser: AppUser;
  onAddSession: (sess: HearingSession) => Promise<void> | void;
  onUpdateSession: (sess: HearingSession) => Promise<void> | void;
  onUpdateCase: (updated: Case) => Promise<void> | void;
  logAction: (act: string, det: string) => Promise<void> | void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [sessDate, setSessDate] = useState('');
  const [sessTime, setSessTime] = useState('09:00');
  const [sessSubject, setSessSubject] = useState('');
  const [assignedLawyerId, setAssignedLawyerId] = useState('');

  // Editing session decision states aligned with Agenda Panel
  const [editingSession, setEditingSession] = useState<HearingSession | null>(null);
  const [decision, setDecision] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'pending' | 'completed' | 'postponed'>('pending');
  const [outcomeCourt, setOutcomeCourt] = useState('');
  const [outcomeCircuit, setOutcomeCircuit] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [requirements, setRequirements] = useState('');
  const [rollPhotoName, setRollPhotoName] = useState('');
  const [isRollUploaded, setIsRollUploaded] = useState(false);

  const isModalReadOnly = !!editingSession && (!!editingSession.decision || editingSession.status === 'completed') && !currentUser?.permissions?.editSessionDecision;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessDate || !sessSubject) return;

    const newSess: HearingSession = {
      id: `session-${Date.now()}`,
      caseId: localCase.id,
      caseNumber: localCase.caseNumberFirstInstance,
      caseYear: localCase.caseYearFirstInstance,
      clientName: localCase.clientName,
      opponentName: localCase.opponent?.name || '',
      court: localCase.court,
      circuit: localCase.circuit,
      type: localCase.type,
      date: sessDate,
      time: sessTime,
      subject: sessSubject,
      status: 'pending',
      assignedLawyerId,
      assignedLawyerName: users.find(u => u.id === assignedLawyerId)?.fullName || ''
    };

    await onAddSession(newSess);
    // Auto update nextHearingDate in Case object if earlier or missing
    if (!localCase.nextHearingDate || new Date(sessDate) > new Date()) {
      await onUpdateCase({
        ...localCase,
        nextHearingDate: sessDate,
        nextHearingTime: sessTime
      });
    }

    setShowAddForm(false);
    setSessDate('');
    setSessSubject('');
    await logAction('إضافة جلسة', `تمت جدولة جلسة جديدة بتاريخ ${sessDate}`);
  };

  const handleSaveDecision = async () => {
    if (!editingSession) return;
    const updatedSess: HearingSession = {
      ...editingSession,
      status: sessionStatus,
      court: outcomeCourt || editingSession.court,
      circuit: outcomeCircuit || editingSession.circuit,
      decision,
      nextHearingDate: nextHearingDate || undefined,
      whatHappened: whatHappened || undefined,
      requirements: requirements || undefined,
      rollPhotoUrl: isRollUploaded ? 'roll_attached_url' : undefined
    };
    await onUpdateSession(updatedSess);

    // If session postponed and has next date, update case nextHearingDate
    if (sessionStatus === 'postponed' && nextHearingDate) {
      await onUpdateCase({
        ...localCase,
        nextHearingDate,
        status: `مؤجلة للقرار: ${decision || 'بدون منطوق حالياً'}`
      });
    } else if (sessionStatus === 'completed') {
      await onUpdateCase({
        ...localCase,
        status: decision ? `صدر القرار: ${decision}` : 'انتهت ومحسوم القرار'
      });
    }

    setEditingSession(null);
    await logAction('تسجيل قرار', `تم رصد قرار جلسة ${editingSession.date}: ${decision}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
          <Gavel className="w-5 h-5 text-amber-500" />
          جلسات ومواعيد المحاكمة ({caseSessions.length})
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إضافة جلسة جديدة
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-5 rounded-3xl border-2 border-amber-400 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b pb-2.5">
            <h4 className="text-xs font-black text-slate-800">جدولة جلسة قضائية جديدة</h4>
            <button onClick={() => setShowAddForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">تاريخ الجلسة</label>
              <input type="date" required value={sessDate} onChange={e => setSessDate(e.target.value)} className="w-full p-2 border rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">ساعة الحضور</label>
              <input type="time" required value={sessTime} onChange={e => setSessTime(e.target.value)} className="w-full p-2 border rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">المحامي الحاضر</label>
              <select value={assignedLawyerId} onChange={e => setAssignedLawyerId(e.target.value)} className="w-full p-2 border rounded-xl text-xs font-bold">
                <option value="">اختر محامياً...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 block mb-1">موضوع/مطلوب الجلسة</label>
              <input type="text" required value={sessSubject} onChange={e => setSessSubject(e.target.value)} placeholder="تقديم مذكرات، مستندات..." className="w-full p-2 border rounded-xl text-xs font-bold" />
            </div>
            <div className="col-span-1 md:col-span-4 flex justify-end gap-2">
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black cursor-pointer">تثبيت الجلسة 🚀</button>
            </div>
          </form>
        </div>
      )}

      {/* Editing session modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto text-right" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Gavel className="w-5 h-5 text-amber-500" />
                {isModalReadOnly ? 'تفاصيل قرار الجلسة والمنطوق المعتمد' : 'رصد وإثبات قرار الجلسة المنعقدة بتاريخ ' + editingSession.date}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveDecision(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المحكمة</label>
                  {isModalReadOnly ? (
                    <input
                      type="text"
                      value={outcomeCourt}
                      readOnly
                      className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-right font-semibold text-slate-600"
                    />
                  ) : (
                    <CourtSelect
                      value={outcomeCourt}
                      onChange={setOutcomeCourt}
                      placeholder="المحكمة المنعقدة أمامها"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-right font-semibold"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الدائرة (يدوياً)</label>
                  <input
                    type="text"
                    value={outcomeCircuit}
                    onChange={(e) => setOutcomeCircuit(e.target.value)}
                    required
                    disabled={isModalReadOnly}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-right disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="الدائرة القضائية"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">منطوق قرار المحكمة (رول الجلسة)</label>
                <textarea
                  placeholder="مثال: التأجيل لجلسة 2 يوليو لتقديم المستندات والطب الشرعي أو الحكم التمهيدي..."
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  required
                  rows={2.5}
                  disabled={isModalReadOnly}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الجلسة القادمة (إن وجد)</label>
                  <input
                    type="date"
                    value={nextHearingDate}
                    onChange={(e) => setNextHearingDate(e.target.value)}
                    disabled={isModalReadOnly}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-right disabled:bg-slate-100 disabled:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الجلسة الحالية</label>
                  <select
                    value={sessionStatus}
                    onChange={e => setSessionStatus(e.target.value as any)}
                    disabled={isModalReadOnly}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-right disabled:bg-slate-100 disabled:text-slate-600"
                  >
                    <option value="pending">لم تبدأ بعد</option>
                    <option value="completed">تمت بنجاح وحكم بها</option>
                    <option value="postponed">تأجلت لجلسة قادمة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ما تم تفصيلاً في جلسة اليوم ومرافعتنا</label>
                <textarea
                  placeholder="اكتب تفاصيل مرافعة الدفاع ودفوع الخصوم بالجلسة..."
                  value={whatHappened}
                  onChange={(e) => setWhatHappened(e.target.value)}
                  rows={2}
                  disabled={isModalReadOnly}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المطلوب تجهيزه وصياغته قبل الجلسة القادمة</label>
                <textarea
                  placeholder="مثال: كتابة مذكرة الرد على تقرير الخبير، تقديم شهادة وفاة..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={2}
                  disabled={isModalReadOnly}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              {/* Upload roll photo simulation */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center">
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">إرفاق صورة رول الجلسة أو منطوق الحكم</p>
                {!isModalReadOnly && (
                  <p className="text-[10px] text-slate-400 mt-1">اضغط لمحاكاة التقاط الصورة بالهاتف المحمول أو الرفع</p>
                )}
                
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    type="text"
                    placeholder="مثال: roll_session_26_6.jpg"
                    value={rollPhotoName}
                    onChange={(e) => setRollPhotoName(e.target.value)}
                    disabled={isModalReadOnly}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono w-56 text-right disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {!isModalReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!rollPhotoName) {
                          alert('يرجى تحديد اسم للصورة المراد إرفاقها');
                          return;
                        }
                        setIsRollUploaded(true);
                        alert('تمت محاكاة رفع صورة رول الجلسة وإرفاقها بالمنطوق.');
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-3 rounded-lg cursor-pointer"
                    >
                      إرفاق الصورة
                    </button>
                  )}
                </div>

                {(isRollUploaded || (isModalReadOnly && rollPhotoName)) && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-2">✓ تم إرفاق رول الجلسة وصورة القرار بنجاح.</p>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                {isModalReadOnly ? (
                  <span className="text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                    <span>🔒 المنطوق معتمد في السجل القضائي</span>
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingSession(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    {isModalReadOnly ? 'إغلاق' : 'إلغاء'}
                  </button>
                  {!isModalReadOnly && (
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-md cursor-pointer"
                    >
                      حفظ وتحديث ملف القضية التلقائي
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions list */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {caseSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">لم يتم جدولة أي جلسات قضائية لهذا الملف حتى الآن.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {caseSessions.map((sess) => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = sess.date === todayStr;
              const isPast = sess.date < todayStr;
              const isFuture = sess.date > todayStr;
              const isDecisionRecorded = !!sess.decision || sess.status === 'completed';
              const isPostponed = sess.status === 'postponed' || (sess.decision && sess.nextHearingDate);

              // Status Badge (Exact same style as AgendaPanel)
              let statusBadge = null;
              if (isDecisionRecorded) {
                statusBadge = (
                  <span className="text-xs text-emerald-600 font-bold bg-emerald-100/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>🟢 تم تسجيل القرار</span>
                  </span>
                );
              } else if (isPostponed) {
                statusBadge = (
                  <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-300">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>⚪ جلسة مؤجلة</span>
                  </span>
                );
              } else if (isToday) {
                statusBadge = (
                  <span className="text-xs text-amber-600 font-bold bg-amber-100/80 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>🟡 الجلسة اليوم (يمكن تسجيل القرار)</span>
                  </span>
                );
              } else if (isFuture) {
                statusBadge = (
                  <span className="text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-blue-200">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>🔵 جلسة مستقبلية</span>
                  </span>
                );
              } else if (isPast) {
                statusBadge = (
                  <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-300">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span>⚪ جلسة سابقة (بانتظار تسجيل القرار)</span>
                  </span>
                );
              }

              return (
                <div key={sess.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/55 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 font-mono">
                        📅 {sess.date} ({sess.time})
                      </span>
                      {statusBadge}
                    </div>
                    <p className="text-xs font-black text-slate-800">مطلوب الجلسة: {sess.subject}</p>
                    {sess.decision && (
                      <p className="text-xs font-medium text-amber-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                        <strong>قرار المحكمة:</strong> {sess.decision}
                        {sess.nextHearingDate && ` (مؤجل لجلسة: ${sess.nextHearingDate})`}
                      </p>
                    )}
                    {sess.assignedLawyerName && (
                      <p className="text-[10px] text-slate-400 font-bold">المحامي الحاضر: {sess.assignedLawyerName}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-wrap items-center gap-2 self-end md:self-center">
                    {/* 1. Edit button: show if permissions allow (identical to AgendaPanel) */}
                    {currentUser?.permissions?.editSession && (
                      <button
                        onClick={() => {
                          setEditingSession(sess);
                          setDecision(sess.decision || '');
                          setNextHearingDate(sess.nextHearingDate || '');
                          setSessionStatus(sess.status || 'pending');
                          setOutcomeCourt(sess.court || localCase.court || '');
                          setOutcomeCircuit(sess.circuit || localCase.circuit || '');
                          setWhatHappened(sess.whatHappened || '');
                          setRequirements(sess.requirements || '');
                          setRollPhotoName(sess.rollPhotoUrl ? `صورة رول وقرار جلسة ${sess.date}.jpg` : '');
                          setIsRollUploaded(!!sess.rollPhotoUrl);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="تعديل تفاصيل الجلسة يدوياً"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        تعديل الجلسة
                      </button>
                    )}

                    {/* 2. Record or View Decision Button (identical to AgendaPanel) */}
                    {(() => {
                      if (isDecisionRecorded) {
                        return (
                          <button
                            onClick={() => {
                              setEditingSession(sess);
                              setDecision(sess.decision || '');
                              setNextHearingDate(sess.nextHearingDate || '');
                              setSessionStatus(sess.status || 'pending');
                              setOutcomeCourt(sess.court || localCase.court || '');
                              setOutcomeCircuit(sess.circuit || localCase.circuit || '');
                              setWhatHappened(sess.whatHappened || '');
                              setRequirements(sess.requirements || '');
                              setRollPhotoName(sess.rollPhotoUrl ? `صورة رول وقرار جلسة ${sess.date}.jpg` : '');
                              setIsRollUploaded(!!sess.rollPhotoUrl);
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="عرض واستعراض قرار الجلسة وتفاصيله"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            استعراض القرار
                          </button>
                        );
                      } else if (isToday || isPast) {
                        return currentUser?.permissions?.recordSessionDecision ? (
                          <button
                            onClick={() => {
                              setEditingSession(sess);
                              setDecision(sess.decision || '');
                              setNextHearingDate(sess.nextHearingDate || '');
                              setSessionStatus(sess.status || 'pending');
                              setOutcomeCourt(sess.court || localCase.court || '');
                              setOutcomeCircuit(sess.circuit || localCase.circuit || '');
                              setWhatHappened(sess.whatHappened || '');
                              setRequirements(sess.requirements || '');
                              setRollPhotoName(sess.rollPhotoUrl ? `صورة رول وقرار جلسة ${sess.date}.jpg` : '');
                              setIsRollUploaded(!!sess.rollPhotoUrl);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            تسجيل قرار الجلسة
                          </button>
                        ) : null;
                      } else {
                        return (
                          <span className="text-xs text-slate-400 font-medium bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <span>⏳ لم يحن موعد الجلسة بعد</span>
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ======================== SUB COMPONENT: DOCUMENTS TAB ========================
function DocumentsTab({ 
  localCase, 
  currentUser, 
  onUpdateCase,
  logAction
}: { 
  localCase: Case; 
  currentUser: AppUser; 
  onUpdateCase: (updated: Case) => Promise<void> | void;
  logAction: (act: string, det: string) => Promise<void> | void;
}) {

  // Unified extremely fast file viewer that opens files in an independent, dedicated popup/new window.
  // This replaces all old modals, iframes, and loading delays.
  const handleViewFile = async (file: CaseFile) => {
    let fileUrl = file.downloadURL || file.fileUrl;

    // Check if we have this file stored in our permanent IndexedDB database first!
    if (file.id) {
      const dbBlob = await getFileFromIndexedDB(file.id);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    } else if (file.fileUrl && file.fileUrl.startsWith('blob:')) {
      const dbBlob = await getFileFromIndexedDB(file.fileUrl);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    }

    const finalFileUrl = !fileUrl || fileUrl === '#'
      ? (file.type === 'pdf'
          ? '/sample.pdf'
          : file.type === 'image'
            ? 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80'
            : '')
      : fileUrl;

    // A. If it is a real online URL, proxy it to bypass ISP blocking!
    if (finalFileUrl && finalFileUrl.startsWith('http')) {
      const targetUrl = getProxiedUrl(finalFileUrl);
      const newWin = window.open(targetUrl, '_blank');
      if (newWin) {
        newWin.focus();
      } else {
        alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
      }
      return;
    }

    const isBlob = finalFileUrl.startsWith('blob:');
    
    // 1. If it's a blob (local browser file)
    if (isBlob) {
      // Verify if blob is valid on this specific device/session
      let isValidBlob = false;
      try {
        const response = await fetch(finalFileUrl, { method: 'HEAD' });
        if (response.ok) isValidBlob = true;
      } catch (e) {
        isValidBlob = false;
      }

      if (!isValidBlob) {
        alert('⚠️ عذراً، هذا الملف تم حفظه محلياً فقط على الجهاز الآخر الذي قام برفع أول مرة ولم يكتمل رفعه بعد إلى السحابة بسبب ضعف الاتصال على ذلك الجهاز.');
        return;
      }

      if (file.type === 'pdf') {
        const targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(file.name)}&fileId=${file.id || ''}`;
        const newWin = window.open(targetUrl, '_blank', 'width=1100,height=850,scrollbars=yes,status=yes,resizable=yes');
        if (newWin) {
          newWin.focus();
        } else {
          alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
        }
      } else {
        const newWin = window.open(finalFileUrl, '_blank');
        if (newWin) {
          newWin.focus();
        } else {
          alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
        }
      }
      return;
    }

    // 2. If it's a simulated/placeholder document (no actual online file) or word document
    if (!fileUrl || fileUrl === '#' || file.type === 'word') {
      // Open a beautiful independent window that renders the legal document simulation cleanly
      const newWin = window.open('', '_blank', 'width=900,height=800,scrollbars=yes,resizable=yes');
      if (newWin) {
        const title = file.category === 'أحكام' || file.category === 'حكم' ? 'حكــم قضائي صادر باسم الشَّعْب' : 
                      file.category === 'مذكرات' || file.category === 'مذكرة دفاع' ? 'مذكرة بدفاع ودفوع السيد الموكل القانونية' : 
                      file.category === 'صحف الدعاوى' || file.category === 'صحيفة دعوى' ? 'صحيفة افتتاح دعوى قضائية رسمية' : 
                      'مستند رسمي ومرفق قانوني معتمد';
        let bodyHtml = '';
        if (file.category === 'أحكام' || file.category === 'حكم') {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">حكم صادر باسم الشعب</h4>
            <p>أصدرت الدائرة المدنية بمحكمة الاستئناف العالي الحكم التالي في الدعوى المقيدة برقم الاستئناف المذكور أعلاه، المقامة من المستأنف ضد المستأنف ضده، وبعد تلاوة تقرير التلخيص ومسودة الحكم وسماع المرافعة القانونية الشفهية والاطلاع على الأوراق والمداولة قانوناً:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0;">
              <strong>المحكمة:</strong>
              <p>حيث إن وقائع التداعي تخلص في أن المستأنف قد أقام دعواه بطلب القضاء له بالطلبات الواردة بأصل صحيفة الدعوى. وحيث إن الحكم المستأنف قد قضى في منطوقه برفض الدعوى وإلزام رافعها بالمصروفات. وحيث إن هذا القضاء لم يلقَ قبولاً لدى المستأنف فأقام طعنه الماثل بموجب صحيفة استئنافية أودعت قلم كتاب هذه المحكمة استند فيها إلى أسباب حاصلها الخطأ في تطبيق القانون وقصور التسبيب الفعلي وفساد الاستدلال بمستندات الملف.</p>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold; color: #1e293b;">فلهذه الأسباب، قررت المحكمة:</p>
              <ol style="padding-right: 20px; line-height: 1.8;">
                <li>قبول الاستئناف شكلاً لتقديمه في الميعاد القانوني المستقر عليه.</li>
                <li>وفي الموضوع، بإلغاء الحكم المستأنف والقضاء مجدداً بإلغاء الحكم المستأنف وإلزام المستأنف ضده بكامل الحقوق والمطالبات والتعويضات المقررة لموكلنا، ومصروفات المحاماة المحددة.</li>
              </ol>
            </div>
          `;
        } else if (file.category === 'مذكرات' || file.category === 'مذكرة دفاع') {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">مذكرة بدفوع ودفاع</h4>
            <p style="font-weight: bold; text-align: center; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">مقدمة من مكتب الأستاذ أبو رميح للمحاماة بصفتنا وكلاء عن المتهم / المدعي.</p>
            <p>نلتمس من الهيئة الموقرة القضاء وبحق بطلباتنا الجوهرية تأسيساً على الدفوع القانونية والدستورية التالية التي نبديها دفاعاً عن الموكل في الجلسة المقررة:</p>
            <ul style="padding-right: 20px; line-height: 2;">
              <li><strong>أولاً:</strong> الدفع ببطلان إجراءات الضبط والتحقيق لانتفاء حالة التلبس ولعدم وجود إذن مسبق من النيابة العامة.</li>
              <li><strong>ثانياً:</strong> الدفع بانتفاء الركن المادي والمعنوي للجريمة المنسوبة للموكل لعدم صحة الإسناد الفعلي للأدلة المرفقة.</li>
              <li><strong>ثالثاً:</strong> كيدية الاتهام وتلفيقه واستحالة تصور حدوث الواقعة وفق التصوير الوارد بمحضر جمع الاستدلالات.</li>
              <li><strong>رابعاً:</strong> القصور الواضح في محضر التحريات وعدم جديتها واعتمادها على مصادر مجهولة ومبهمة لا تصلح لإدانة متهم.</li>
            </ul>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold;">بناء عليه:</p>
              <p style="font-weight: bold; color: #b45309;">نلتمس أصلياً البراءة التامة لصالح موكلنا ورفض الدعوى المدنية التبعية وإلزام رافعها بالمصاريف القانونية ومقابل أتعاب المحاماة الفعلية.</p>
            </div>
          `;
        } else if (file.category === 'صحف الدعاوى' || file.category === 'صحيفة دعوى') {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">صحيفة افتتاح دعوى قضائية</h4>
            <p>إنه في يوم الموافق / / بناء على طلب السيد الموكل المقيم في القاهرة وموطنه المختار مكتب الأستاذ أبو رميح للمحاماة، أنا محضر محكمة قد انتقلت وأعلنت السيد المدعى عليه المقيم في العنوان الموضح بملف الدعوى مخاطباً معه:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0;">
              <strong>الموضوع:</strong>
              <p>يطالب الطالب بموجب هذه الصحيفة الحكم بإلزام المعلن إليه بأداء كافة الالتزامات التعاقدية والتعويضات الجبرية الناتجة عن الإخلال ببنود الاتفاق المبرم بينهما والمؤرخ في تاريخ الواقعة، وذلك نظراً لثبوت الضرر المادي والأدبي البالغ الواقع على الطالب جراء هذا الامتناع غير المبرر.</p>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold;">بناء عليه:</p>
              <p>أنا المحضر سالف الذكر قد انتقلت وأعلنت المعلن إليه بصورة من هذه العريضة وكلفته بالحضور أمام محكمة القضاء المختصة بجلستها المقامة في الميعاد المحدد لسماع الحكم بطلبات المدعي كاملة المصاريف والرسوم ومقابل الأتعاب المحددة بنظام المؤسسة.</p>
            </div>
          `;
        } else {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">مستند رسمي ومرفق قانوني</h4>
            <p>يقر مكتب الأستاذ أبو رميح للمحاماة والاستشارات القانونية بصحة وإرفاق هذا المستند المودع بالملف الإلكتروني والمسجل تحت مسمى <strong>"${file.name}"</strong> المصنف كوثيقة من نوع <strong>"${file.category}"</strong>.</p>
            <p>تم فحص هذا المستند ومطابقته لأصل الملف القانوني بمعرفة المحامي المكلف والمرافع أمام الدائرة القضائية المختصة، ويعد المستند جزءاً لا يتجزأ من ملف الدفاع وأدلة الإثبات المعتمدة في تداول الجلسات والطعون والاستئنافات المقررة لهذه القضية.</p>
          `;
        }

        newWin.document.write(`
          <html dir="rtl">
            <head>
              <title>${file.name} - عارض المستندات السريع</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body {
                  font-family: 'Cairo', sans-serif;
                  background-color: #f8fafc;
                  color: #1e293b;
                  padding: 40px;
                  margin: 0;
                  direction: rtl;
                  text-align: right;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                  border: 1px solid #e2e8f0;
                  min-height: 600px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #b45309;
                  padding-bottom: 15px;
                  margin-bottom: 30px;
                  font-size: 12px;
                  color: #475569;
                }
                .footer {
                  border-top: 1px solid #e2e8f0;
                  padding-top: 20px;
                  margin-top: 40px;
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  color: #64748b;
                }
                .btn-print {
                  background-color: #b45309;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 6px;
                  font-family: 'Cairo', sans-serif;
                  font-weight: bold;
                  cursor: pointer;
                  margin-bottom: 20px;
                }
                .btn-print:hover {
                  background-color: #92400e;
                }
                @media print {
                  body { background: white; padding: 0; }
                  .container { box-shadow: none; border: none; padding: 0; }
                  .btn-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div style="text-align: left; max-width: 800px; margin: 0 auto;">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة المستند</button>
              </div>
              <div class="container">
                <div>
                  <div class="header">
                    <div>
                      <strong>مؤسسة رميح للمحاماة والاستشارات القانونية</strong><br/>
                      <span>تأسيس وخبرة قانونية عريقة</span>
                    </div>
                    <div style="text-align: left;">
                      <span>تاريخ الرفع: ${file.uploadDate || 'غير متوفر'}</span><br/>
                      <span>الرافع: ${file.uploadedBy || 'المكتب الرئيسي'}</span>
                    </div>
                  </div>
                  <div style="line-height: 1.8; font-size: 14px;">
                    ${bodyHtml}
                  </div>
                </div>
                <div class="footer">
                  <div>بوابة الإدارة الرقمية المتكاملة لمؤسسة رميح القانونية © 2026</div>
                  <div style="font-weight: bold; color: #e11d48;">مستند معتمد إلكترونياً</div>
                </div>
              </div>
            </body>
          </html>
        `);
        newWin.document.close();
      } else {
        alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية المستند.');
      }
      return;
    }

    // 3. For public/online URLs (e.g. PDFs, Images, etc.)
    const absoluteFileUrl = fileUrl.startsWith('http') 
      ? fileUrl 
      : `${window.location.origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;

    let targetUrl = '';
    if (file.type === 'image') {
      targetUrl = absoluteFileUrl; // Direct image URL opens beautifully and natively in browser
    } else if (file.type === 'pdf') {
      targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(file.name)}&fileId=${file.id || ''}`;
    } else {
      // PDF or general document: Open with official Google Docs Viewer
      targetUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteFileUrl)}&hl=ar`;
    }

    const newWin = window.open(targetUrl, '_blank', 'width=1100,height=850,scrollbars=yes,status=yes,resizable=yes');
    if (newWin) {
      newWin.focus();
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  const filteredFiles = localCase.files || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* Document grid */}
      <div>
        <div className="flex items-center justify-between pb-3">
          <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <FileText className="w-5 h-5 text-amber-500" />
            المستندات والمرفقات الشاملة بملف الدعوى ({filteredFiles.length})
          </span>
          <span className="text-[10px] text-slate-400 font-bold">عرض فقط • بوابة مؤسسة رميح للمحاماة الرقمية</span>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-xs text-slate-400 italic">لا توجد مستندات أو مرفقات مضافة بملف الدعوى حتى الآن.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.map((file) => {
              const fileTypeLower = (file.type || '').toLowerCase();
              const isPdf = fileTypeLower === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
              const isWord = fileTypeLower === 'word' || fileTypeLower === 'doc' || fileTypeLower === 'docx' || file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');
              
              const formatConfig = 
                isPdf ? { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200/60', color: 'bg-rose-500' } :
                isWord ? { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200/60', color: 'bg-blue-500' } :
                { label: 'IMAGE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', color: 'bg-emerald-500' };

              return (
                <div 
                  key={file.id} 
                  className="bg-white border border-slate-200 hover:border-amber-400/50 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group text-right"
                  dir="rtl"
                >
                  {/* Left status accent strip matching file type */}
                  <div className={`absolute top-0 bottom-0 right-0 w-1 ${formatConfig.color}`} />

                  <div className="space-y-3 pr-2">
                    {/* Header: name + format badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate flex-1">
                        <h6 className="text-[11px] font-black text-slate-950 truncate" title={file.name}>
                          📄 {file.name}
                        </h6>
                      </div>
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border leading-none ${formatConfig.bg}`}>
                        {formatConfig.label}
                      </span>
                    </div>

                    {/* 4 Organized Fields Grid (Evenly spaced) */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] border-t border-slate-150 pt-2.5">
                      <div>
                        <span className="text-slate-400 block text-[9px] font-medium">نوع المستند القضائي:</span>
                        <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded text-[9px] inline-block mt-0.5">
                          💼 {file.category || 'غير محدد'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] font-medium">حجم الملف:</span>
                        <span className="font-mono font-bold text-slate-700 inline-block mt-1">
                          💾 {file.size || 'غير متوفر'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] font-medium">تاريخ الرفع والضم:</span>
                        <span className="font-mono font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                          📅 {file.uploadDate || 'غير متوفر'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] font-medium">بواسطة الزميل:</span>
                        <span className="font-bold text-slate-700 truncate block mt-0.5" title={file.uploadedBy || 'المدير العام'}>
                          👤 {file.uploadedBy || 'المدير العام'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 mt-3 pr-2">
                    <button
                      type="button"
                      onClick={() => handleViewFile(file)}
                      className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      👁️ عرض المستند
                    </button>
                    <a
                      href={file.fileUrl || file.downloadURL}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      title="تحميل"
                    >
                      📥 تحميل
                    </a>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ======================== SUB COMPONENT: FINANCIALS TAB ========================
function FinancialsTab({ 
  localCase, 
  onUpdateCase,
  logAction
}: { 
  localCase: Case; 
  onUpdateCase: (updated: Case) => Promise<void> | void;
  logAction: (act: string, det: string) => Promise<void> | void;
}) {
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expReason, setExpReason] = useState('');

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const newPayment: PaymentReceipt = {
      id: `pay-${Date.now()}`,
      amount: amountNum,
      date: new Date().toISOString().split('T')[0],
      receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
      notes: payNotes
    };

    const updatedPayments = [...(localCase.payments || []), newPayment];
    const newPaid = (localCase.paidFees || 0) + amountNum;
    await onUpdateCase({
      ...localCase,
      payments: updatedPayments,
      paidFees: newPaid,
      remainingFees: localCase.totalFees - newPaid
    });

    setShowAddPayment(false);
    setPayAmount('');
    setPayNotes('');
    await logAction('سند قبض', `تم قبض دفعة مالية بقيمة ${amountNum} ج.م. سند رقم: ${newPayment.receiptNumber}`);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expAmount);
    if (isNaN(amountNum) || amountNum <= 0 || !expReason) return;

    const newExpense = {
      id: `exp-${Date.now()}`,
      amount: amountNum,
      date: new Date().toISOString().split('T')[0],
      reason: expReason
    };

    const updatedExpenses = [...(localCase as any).expenses || [], newExpense];
    await onUpdateCase({
      ...localCase,
      expenses: updatedExpenses
    } as any);

    setShowAddExpense(false);
    setExpAmount('');
    setExpReason('');
    await logAction('تسجيل مصروفات', `تم تسجيل مصروف قضائي بقيمة ${amountNum} ج.م. لغرض: ${expReason}`);
  };

  const expensesList: any[] = (localCase as any).expenses || [];
  const totalExpenses = expensesList.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* Financial stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <h4 className="text-[10px] text-slate-400 font-bold">إجمالي الأتعاب المقررة</h4>
          <p className="text-sm font-black text-slate-800 mt-1">{localCase.totalFees || 0} ج.م.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <h4 className="text-[10px] text-slate-400 font-bold">إجمالي المبالغ المدفوعة</h4>
          <p className="text-sm font-black text-emerald-600 mt-1">{localCase.paidFees || 0} ج.m.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <h4 className="text-[10px] text-slate-400 font-bold">المصروفات القضائية الفعلية</h4>
          <p className="text-sm font-black text-amber-600 mt-1">{totalExpenses} ج.م.</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
          <h4 className="text-[10px] text-slate-400 font-bold">صافي الرصيد المتبقي</h4>
          <p className="text-sm font-black text-rose-600 mt-1">{localCase.totalFees - localCase.paidFees} ج.م.</p>
        </div>
      </div>

      {/* Grid of panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Payments Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Receipt className="w-5 h-5 text-emerald-500" />
              سندات القبض والدفعات المسجلة
            </h3>
            <button
              onClick={() => setShowAddPayment(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer"
            >
              + قبض دفعة
            </button>
          </div>

          {showAddPayment && (
            <form onSubmit={handleAddPayment} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">المبلغ (ج.م)</label>
                  <input type="number" required value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" className="w-full p-2 border rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">البيان/ملاحظات</label>
                  <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="الدفعة الثانية، مقدم أتعاب" className="w-full p-2 border rounded-xl text-xs font-bold" />
                </div>
              </div>
              <div className="flex justify-end gap-1.5">
                <button type="submit" className="bg-emerald-600 text-white font-black px-4 py-1.5 rounded-xl text-[10px] cursor-pointer">تأكيد القبض</button>
                <button type="button" onClick={() => setShowAddPayment(false)} className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-[10px]">إلغاء</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-150">
            {(localCase.payments || []).length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-bold">لم تسجل أي دفعات مالية حتى الآن.</div>
            ) : (
              (localCase.payments || []).map(p => (
                <div key={p.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-black text-slate-800">{p.amount} ج.م.</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">سند رقم: {p.receiptNumber} • تاريخ: {p.date}</p>
                  </div>
                  {p.notes && <span className="text-[10px] text-slate-500 font-semibold">{p.notes}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expenses Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Coins className="w-5 h-5 text-amber-500" />
              المصروفات والرسوم القضائية والدمغات
            </h3>
            <button
              onClick={() => setShowAddExpense(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer"
            >
              + تسجيل مصروف
            </button>
          </div>

          {showAddExpense && (
            <form onSubmit={handleAddExpense} className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">المبلغ (ج.م)</label>
                  <input type="number" required value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00" className="w-full p-2 border rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">سبب الصرف</label>
                  <input type="text" required value={expReason} onChange={e => setExpReason(e.target.value)} placeholder="رسوم قيد، انتقالات، دمغات" className="w-full p-2 border rounded-xl text-xs font-bold" />
                </div>
              </div>
              <div className="flex justify-end gap-1.5">
                <button type="submit" className="bg-amber-600 text-slate-950 font-black px-4 py-1.5 rounded-xl text-[10px] cursor-pointer">تأكيد الصرف</button>
                <button type="button" onClick={() => setShowAddExpense(false)} className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-[10px]">إلغاء</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-150">
            {expensesList.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-bold">لم تسجل أي مصروفات قضائية لهذا الملف حتى الآن.</div>
            ) : (
              expensesList.map(exp => (
                <div key={exp.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-black text-slate-800">{exp.amount} ج.م.</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">التاريخ: {exp.date}</p>
                  </div>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{exp.reason}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// ======================== SUB COMPONENT: AI ASSISTANT TAB ========================
function AiAssistantTab({ localCase }: { localCase: Case }) {
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [currentAction, setCurrentAction] = useState<'summary' | 'strategy' | 'chat'>('summary');
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'ai', text: string }>>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const triggerAi = async (action: 'summarize' | 'strategy' | 'chat', customQuery?: string) => {
    setLoading(true);
    if (action !== 'chat') {
      setAiResponse('');
    }
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          caseData: localCase,
          query: customQuery || ''
        })
      });
      const data = await res.json();
      if (data.error) {
        if (action === 'chat') {
          setChatHistory(prev => [...prev, { role: 'ai', text: data.error }]);
        } else {
          setAiResponse(data.error);
        }
      } else {
        const textResult = data.response;
        if (action === 'chat') {
          setChatHistory(prev => [...prev, { role: 'ai', text: textResult }]);
        } else {
          setAiResponse(textResult);
        }
      }
    } catch (e: any) {
      const errMsg = '⚠️ عذراً، فشل الاتصال بخدمات تحليل الذكاء الاصطناعي. يرجى مراجعة شبكتك أو مفتاح الربط سحابة Gemini.';
      if (action === 'chat') {
        setChatHistory(prev => [...prev, { role: 'ai', text: errMsg }]);
      } else {
        setAiResponse(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentAction === 'summary' && !aiResponse) {
      triggerAi('summarize');
    }
  }, [currentAction]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || loading) return;
    const userMsg = chatQuery;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatQuery('');
    triggerAi('chat', userMsg);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full min-h-[500px]">
      
      {/* Side menu control panel */}
      <div className="md:col-span-1 bg-white p-4 rounded-3xl border border-slate-200 flex flex-col gap-2.5 shadow-xs">
        <h3 className="text-xs font-black text-slate-800 border-b pb-2 mb-1 flex items-center gap-1">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          مساعد رميح القانوني AI
        </h3>
        <button
          onClick={() => {
            setCurrentAction('summary');
            setAiResponse('');
            triggerAi('summarize');
          }}
          className={`w-full py-2.5 px-3 text-right rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
            currentAction === 'summary' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          الملخص التنفيذي الذكي
        </button>
        <button
          onClick={() => {
            setCurrentAction('strategy');
            setAiResponse('');
            triggerAi('strategy');
          }}
          className={`w-full py-2.5 px-3 text-right rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
            currentAction === 'strategy' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Gavel className="w-4 h-4" />
          استراتيجية الدفاع والدفوع
        </button>
        <button
          onClick={() => setCurrentAction('chat')}
          className={`w-full py-2.5 px-3 text-right rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
            currentAction === 'chat' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          دردشة واستجواب الملف
        </button>
      </div>

      {/* Main interaction display area */}
      <div className="md:col-span-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden relative">
        {currentAction !== 'chat' ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center space-y-3">
                <Sparkles className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-xs text-slate-400 font-bold animate-pulse">جاري التحليل القانوني الذكي لقضيتك سحابياً بواسطة Gemini...</p>
              </div>
            ) : (
              <div className="prose max-w-none text-xs text-slate-800 leading-relaxed font-medium">
                <FormattedMarkdown text={aiResponse} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between gap-4">
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] p-2 bg-slate-50 rounded-2xl border border-slate-150">
              {chatHistory.length === 0 && (
                <div className="h-32 flex flex-col items-center justify-center text-center p-4">
                  <Sparkles className="w-6 h-6 text-amber-500 mb-1.5" />
                  <p className="text-xs font-black text-slate-800">اسألني أي شيء حول تفاصيل ملف القضية الحالي</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">مثلاً: "ما هو مقدار الأقساط الباقية على الموكل؟" أو "متى جلسة الحكم وتاريخها؟"</p>
                </div>
              )}
              {chatHistory.map((chat, idx) => (
                <div key={idx} className={`p-3 rounded-2xl max-w-[85%] text-xs font-semibold ${
                  chat.role === 'user' 
                    ? 'mr-auto bg-amber-500/10 text-amber-900 border border-amber-200' 
                    : 'ml-auto bg-white text-slate-800 border border-slate-200 shadow-xs'
                }`}>
                  <p className="text-[9px] text-slate-400 font-bold mb-1">{chat.role === 'user' ? 'المحامي' : 'مساعد رميح الذكي'}</p>
                  <FormattedMarkdown text={chat.text} />
                </div>
              ))}
              {loading && (
                <div className="ml-auto bg-slate-100 p-3 rounded-2xl border border-slate-200 flex items-center gap-2 animate-pulse text-xs text-slate-500 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                  جاري التفكير وصياغة الرد...
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="flex gap-2 border-t pt-3.5 no-print">
              <input
                type="text"
                value={chatQuery}
                onChange={e => setChatQuery(e.target.value)}
                placeholder="اكتب سؤالك هنا للبحث داخل المستندات والتحليل الذكي..."
                className="flex-1 px-4 py-2 border rounded-xl text-xs font-bold"
                disabled={loading}
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2 rounded-xl text-xs font-black shadow-sm flex items-center gap-1"
                disabled={loading}
              >
                <Send className="w-3.5 h-3.5" />
                إرسال
              </button>
            </form>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Simple Helper to Render Basic Markdown elements gracefully inside Tailwind
function FormattedMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-right font-medium text-slate-800" dir="rtl">
      {lines.map((line, i) => {
        let clean = line.trim();
        // Headers
        if (clean.startsWith('###')) {
          return <h4 key={i} className="text-xs font-black text-amber-800 mt-3 border-b border-slate-100 pb-1">{clean.replace('###', '')}</h4>;
        }
        if (clean.startsWith('##')) {
          return <h3 key={i} className="text-sm font-black text-amber-900 mt-4 border-b-2 border-amber-100 pb-1">{clean.replace('##', '')}</h3>;
        }
        if (clean.startsWith('#')) {
          return <h2 key={i} className="text-sm font-black text-amber-950 mt-4">{clean.replace('#', '')}</h2>;
        }
        // Bullet list item
        if (clean.startsWith('* ') || clean.startsWith('- ')) {
          return <li key={i} className="list-disc list-inside mr-2 text-slate-700 mt-1">{clean.substring(2)}</li>;
        }
        // Strong tags
        if (clean.includes('**')) {
          const parts = clean.split('**');
          return (
            <p key={i} className="text-slate-700 leading-relaxed font-medium">
              {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} className="font-extrabold text-slate-950">{part}</strong> : part)}
            </p>
          );
        }
        return <p key={i} className="text-slate-700 leading-relaxed font-semibold">{clean}</p>;
      })}
    </div>
  );
}

// ======================== SUB COMPONENT: TIMELINE & ACTIVITY TAB ========================
function TimelineTab({ localCase, caseSessions }: { localCase: Case, caseSessions: HearingSession[] }) {
  const [filterType, setFilterType] = useState<'all' | 'sessions' | 'finance' | 'files' | 'audit'>('all');

  const timelineEvents: Array<{ date: string, title: string, category: 'sessions' | 'finance' | 'files' | 'audit', details: string }> = [];

  // 1. Sessions
  caseSessions.forEach(sess => {
    timelineEvents.push({
      date: sess.date,
      title: `📅 انعقاد جلسة محاكمة`,
      category: 'sessions',
      details: `المطلوب: ${sess.subject} ${sess.decision ? `| القرار: ${sess.decision}` : ''}`
    });
  });

  // 2. Financials
  (localCase.payments || []).forEach(p => {
    timelineEvents.push({
      date: p.date,
      title: `💰 دفعة مالية مقبوضة`,
      category: 'finance',
      details: `استلام مبلغ ${p.amount} ج.م. سند رقم: ${p.receiptNumber} (${p.notes || ''})`
    });
  });

  const expensesList: any[] = (localCase as any).expenses || [];
  expensesList.forEach(exp => {
    timelineEvents.push({
      date: exp.date,
      title: `💸 تسجيل رسوم/مصروف قضائي`,
      category: 'finance',
      details: `صرف مبلغ ${exp.amount} ج.م. غرض الصرف: ${exp.reason}`
    });
  });

  // 3. Files
  (localCase.files || []).forEach(f => {
    timelineEvents.push({
      date: f.uploadDate,
      title: `📁 رفع مستند قضائي`,
      category: 'files',
      details: `اسم الملف: ${f.name} | التصنيف: ${f.category}`
    });
  });

  // 4. Audit trail
  const auditLogs: any[] = (localCase as any).auditTrail || [];
  auditLogs.forEach(log => {
    timelineEvents.push({
      date: log.timestamp.split('T')[0],
      title: `👤 نشاط المستخدم: ${log.fullName}`,
      category: 'audit',
      details: `${log.action}: ${log.details}`
    });
  });

  // Sort events chronologically (latest first)
  const sortedEvents = timelineEvents
    .filter(evt => filterType === 'all' || evt.category === filterType)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      
      {/* Category Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
        {[
          { id: 'all', label: 'كل الأحداث والنشاطات' },
          { id: 'sessions', label: 'جلسات المحكمة' },
          { id: 'finance', label: 'الحسابات والمعاملات' },
          { id: 'files', label: 'الأوراق والمرفقات' },
          { id: 'audit', label: 'سجل نشاط المستخدمين' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setFilterType(item.id as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap cursor-pointer transition-all ${
              filterType === item.id 
                ? 'bg-amber-500 text-slate-950 font-black border border-amber-500' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Visual vertical timeline */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
        {sortedEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-bold">لا يوجد أحداث مسجلة تندرج تحت هذا التصنيف بعد.</div>
        ) : (
          <div className="relative border-r-2 border-amber-500/30 mr-4 pr-6 space-y-6">
            {sortedEvents.map((evt, idx) => (
              <div key={idx} className="relative">
                {/* Visual marker */}
                <div className="absolute -right-[29px] top-1 w-4 h-4 rounded-full bg-white border-2 border-amber-500 flex items-center justify-center shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1 hover:bg-slate-100/55 transition-colors">
                  <span className="text-[10px] text-slate-400 font-extrabold">{evt.date}</span>
                  <h4 className="text-xs font-black text-slate-800">{evt.title}</h4>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">{evt.details}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ======================== PRINT COMPONENT: FULL REPORT LAYOUT ========================
function PrintableReport({ caseData, sessions, isPreview = false }: { caseData: Case; sessions: HearingSession[]; isPreview?: boolean }) {
  const expensesList: any[] = (caseData as any).expenses || [];
  const totalExpenses = expensesList.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className={`${isPreview ? 'block' : 'hidden print:block'} bg-white text-black p-8 font-sans`} dir="rtl">
      
      {/* Decorative Title/Letterhead */}
      <div className="text-center border-b-4 border-slate-900 pb-5 mb-8 space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">مؤسسة رميح للمحاماة والاستشارات القانونية</h1>
        <p className="text-xs font-bold text-slate-500">مكتب الأستاذ عربي رميح • تقرير حالة ملف دعوى قضائية رسمي ومعتمد</p>
        <p className="text-[10px] text-slate-400">تاريخ إصدار التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      <div className="space-y-6">
        
        {/* Section 1: Case Meta Data */}
        <div className="border border-slate-300 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-black bg-slate-100 p-2 rounded">📂 بيانات القضية الأساسية</h3>
          <table className="w-full text-xs text-right border-collapse">
            <tbody>
              <tr>
                <td className="p-1.5 font-black border-b border-slate-200">اسم الموكل:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.clientName}</td>
                <td className="p-1.5 font-black border-b border-slate-200">الخصم وأطرافه:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.opponent?.name}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-black border-b border-slate-200">جهة المحكمة:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.court}</td>
                <td className="p-1.5 font-black border-b border-slate-200 font-sans">رقم الدعوى:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.caseNumberFirstInstance} لسنة {caseData.caseYearFirstInstance}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-black border-b border-slate-200">درجة التقاضي:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.degree}</td>
                <td className="p-1.5 font-black border-b border-slate-200">نوع الدعوى:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.type}</td>
              </tr>
              <tr>
                <td className="p-1.5 font-black border-b border-slate-200">مقر الدائرة:</td>
                <td className="p-1.5 border-b border-slate-200">{caseData.circuit || 'الدائرة المدنية الكلية'}</td>
                <td className="p-1.5 font-black border-b border-slate-200">هيئة المحكمة:</td>
                <td className="p-1.5 border-b border-slate-200">{(caseData as any).courtBench || 'غير محدد'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Financial summary */}
        <div className="border border-slate-300 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-black bg-slate-100 p-2 rounded">💰 التصفية والتقرير المالي للملف</h3>
          <table className="w-full text-xs text-right border-collapse">
            <tbody>
              <tr>
                <td className="p-1.5 font-black border-b">إجمالي الأتعاب المقررة بالاتفاق:</td>
                <td className="p-1.5 border-b">{caseData.totalFees} ج.م.</td>
                <td className="p-1.5 font-black border-b">إجمالي المدفوع حتى تاريخه:</td>
                <td className="p-1.5 border-b">{caseData.paidFees} ج.م.</td>
              </tr>
              <tr>
                <td className="p-1.5 font-black border-b">رسوم ومصروفات المحاكم الفعلية:</td>
                <td className="p-1.5 border-b">{totalExpenses} ج.م.</td>
                <td className="p-1.5 font-black border-b">صافي الرصيد المتبقي مستحق الدفع:</td>
                <td className="p-1.5 border-b font-extrabold text-slate-900">{caseData.totalFees - caseData.paidFees} ج.م.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Subject & Notes */}
        {caseData.subject && (
          <div className="border border-slate-300 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-black bg-slate-100 p-2 rounded">📝 موضوع الدعوى والطلبات القانونية</h3>
            <p className="text-xs text-slate-800 leading-relaxed">{caseData.subject}</p>
          </div>
        )}

        {/* Section 4: Sessions schedule */}
        <div className="border border-slate-300 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-black bg-slate-100 p-2 rounded">📅 مواعيد الجلسات والقرارات المثبتة</h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 p-2">لا توجد جلسات قضائية مجدولة.</p>
          ) : (
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-2 border border-slate-300">التاريخ</th>
                  <th className="p-2 border border-slate-300">مطلوب الجلسة</th>
                  <th className="p-2 border border-slate-300">قرار هيئة المحكمة</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(sess => (
                  <tr key={sess.id}>
                    <td className="p-2 border border-slate-300 font-bold">{sess.date} ({sess.time})</td>
                    <td className="p-2 border border-slate-300">{sess.subject}</td>
                    <td className="p-2 border border-slate-300 font-semibold text-slate-800">{sess.decision || 'بانتظار القرار'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      <div className="mt-12 flex justify-between items-center text-xs">
        <div>
          <p className="font-black">توقيع المستشار المسؤول:</p>
          <p className="mt-6 font-semibold">المحامي / عربي رميح</p>
        </div>
        <div className="text-left">
          <p className="font-bold">مؤسسة رميح للمحاماة</p>
          <p className="text-[10px] text-slate-400">ختم المؤسسة الرسمي معتمد سحابياً</p>
        </div>
      </div>
    </div>
  );
}
