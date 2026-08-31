/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Case, Client, HearingSession, Company, User } from '../types';
import { 
  Gavel, Users, Archive, Landmark, Calendar, Clock, AlertCircle, FileSpreadsheet, 
  FileText, Printer, ChevronLeft, Plus, Download, CreditCard, ArrowLeftRight, X, Camera, Edit
} from 'lucide-react';
import { toAr } from '../utils/arabicNumbers';
import { CourtSelect } from '../utils/courts';
import { useBackHandler } from '../utils/navigationManager';
import SessionCard, { isExpertSession, isDetentionSession } from './SessionCard';

interface DashboardProps {
  cases: Case[];
  clients: Client[];
  companies: Company[];
  sessions: HearingSession[];
  currentUser: User;
  onNavigateToTab: (tab: string) => void;
  onOpenSessionDecisionModal?: (session: HearingSession) => void;
  onAddSession?: (session: HearingSession) => void;
  users?: User[];
  onUpdateSession?: (session: HearingSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onSearchCase?: (query: string) => void;
  onOpenCaseFile?: (caseId: string) => void;
}

export default function Dashboard({ 
  cases, clients, companies, sessions, currentUser, onNavigateToTab, 
  onOpenSessionDecisionModal, onAddSession, users, onUpdateSession,
  onDeleteSession, onSearchCase, onOpenCaseFile
}: DashboardProps) {
  const [liveDateTime, setLiveDateTime] = useState<Date>(new Date());

  const getDynamicDateString = (date: Date, options: Intl.DateTimeFormatOptions) => {
    const system = localStorage.getItem('romeih_numbering_system') || 'arabic';
    const numberingSystem = system === 'english' ? 'latn' : 'arab';
    return date.toLocaleDateString('ar-EG', { ...options, timeZone: 'Africa/Cairo', numberingSystem });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Outcome Modal State for Quick updates from Dashboard
  const [outcomeSession, setOutcomeSession] = useState<HearingSession | null>(null);

  useBackHandler(!!outcomeSession, () => setOutcomeSession(null));
  const [decision, setDecision] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [requirements, setRequirements] = useState('');
  const [rollPhotoName, setRollPhotoName] = useState('');
  const [isRollUploaded, setIsRollUploaded] = useState(false);
  const [outcomeCourt, setOutcomeCourt] = useState('');
  const [outcomeCircuit, setOutcomeCircuit] = useState('');

  const handleOpenOutcome = (s: HearingSession) => {
    setOutcomeSession(s);
    setDecision(s.decision || '');
    setNextHearingDate(s.nextHearingDate || '');
    setWhatHappened(s.whatHappened || '');
    setRequirements(s.requirements || '');
    setRollPhotoName(s.rollPhotoUrl ? 'صورة رول الجلسة المرفوعة' : '');
    setIsRollUploaded(!!s.rollPhotoUrl);
    setOutcomeCourt(s.court || '');
    setOutcomeCircuit(s.circuit || '');
  };

  const handleOutcomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeSession || !onUpdateSession) return;

    const updated: HearingSession = {
      ...outcomeSession,
      status: 'completed',
      court: outcomeCourt || outcomeSession.court,
      circuit: outcomeCircuit || outcomeSession.circuit,
      decision,
      nextHearingDate: nextHearingDate || undefined,
      whatHappened,
      requirements,
      rollPhotoUrl: isRollUploaded ? 'roll_attached_url' : undefined
    };

    onUpdateSession(updated);
    setOutcomeSession(null);
    alert('تم تسجيل قرار المحكمة وتحديث أجندة الجلسات بنجاح!');
  };

  // Edit Session State for Quick updates from Dashboard
  const [editingSession, setEditingSession] = useState<HearingSession | null>(null);
  const [editSessionCourt, setEditSessionCourt] = useState('');
  const [editSessionCircuit, setEditSessionCircuit] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionTime, setEditSessionTime] = useState('');
  const [editSessionSubject, setEditSessionSubject] = useState('');
  const [editSessionLawyer, setEditSessionLawyer] = useState('');

  const handleOpenEditSession = (s: HearingSession) => {
    setEditingSession(s);
    setEditSessionCourt(s.court || '');
    setEditSessionCircuit(s.circuit || '');
    setEditSessionDate(s.date || getLocalYYYYMMDD(liveDateTime));
    setEditSessionTime(s.time || '09:00');
    setEditSessionSubject(s.subject || '');
    setEditSessionLawyer(s.assignedLawyerId || '');
  };

  const handleEditSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !onUpdateSession) return;

    const assignedUser = users?.find(u => u.id === editSessionLawyer);

    const updated: HearingSession = {
      ...editingSession,
      court: editSessionCourt,
      circuit: editSessionCircuit,
      date: editSessionDate,
      time: editSessionTime,
      subject: editSessionSubject,
      assignedLawyerId: editSessionLawyer || undefined,
      assignedLawyerName: assignedUser ? assignedUser.fullName : undefined
    };

    onUpdateSession(updated);
    setEditingSession(null);
    alert('تم تعديل بيانات الجلسة بنجاح!');
  };

  // Calculations
  const activeCases = cases.filter(c => !c.isArchived);
  const archivedCases = cases.filter(c => c.isArchived);
  const totalClients = clients.length + companies.filter(co => !co.isArchived).length;

  const totalOutstandingFees = activeCases.reduce((sum, c) => sum + (c.remainingFees || 0), 0);

  // Timezone-safe local YYYY-MM-DD
  const getLocalYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filter sessions for today and tomorrow, matching calendar's active filter rules (excluding archived/completed cases)
  const todayStr = getLocalYYYYMMDD(liveDateTime);
  const tomorrowStr = (() => {
    const tom = new Date(liveDateTime);
    tom.setDate(tom.getDate() + 1);
    return getLocalYYYYMMDD(tom);
  })();

  const filterSessionWithActiveCase = (s: HearingSession) => {
    const parentCase = cases.find(c => c.id === s.caseId);
    if (parentCase) {
      if (parentCase.isArchived) return false;
      const finishedKeywords = ['منتهية', 'انتهت', 'مغلقة', 'مؤرشفة', 'شطب', 'محكومة'];
      if (finishedKeywords.some(kw => parentCase.status?.includes(kw))) {
        return false;
      }
    }
    return true;
  };

  const todaySessions = sessions.filter(s => s.date === todayStr && filterSessionWithActiveCase(s));
  const tomorrowSessions = sessions.filter(s => s.date === tomorrowStr && filterSessionWithActiveCase(s));

  // Delayed cases: any active case whose status contains "مؤجلة", "متأخرة", "تأجيل", "تأجلت"
  const delayedCases = activeCases.filter(c => 
    c.status.includes('متأخر') || 
    c.status.includes('مؤجل') || 
    c.status.includes('تأجل') || 
    c.status.includes('تأجيل')
  );

  // Detailed Sessions & Decisions Statistics
  const totalSessionsCount = sessions.length;
  const completedSessionsCount = sessions.filter(s => s.status === 'completed' || !!s.decision).length;
  const pendingSessionsCount = sessions.filter(s => s.status === 'pending' && !s.decision).length;
  const postponedSessionsCount = sessions.filter(s => s.status === 'postponed' || (s.status === 'completed' && s.nextHearingDate)).length;
  const resolutionPercent = totalSessionsCount > 0 ? Math.round((completedSessionsCount / totalSessionsCount) * 100) : 0;

  // Retrieve the latest 3 synced court decisions for real-time visual logging
  const latestDecisions = [...sessions]
    .filter(s => s.decision && s.decision.trim() !== '')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Glowing atmospheric gold light */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/[0.04] to-transparent pointer-events-none" />
        
        {/* Subtle official logo watermark inside banner */}
        <div className="absolute left-8 -bottom-8 opacity-[0.06] pointer-events-none select-none hidden md:block">
          <img src="/icon-192.png" alt="شعار المؤسسة" className="w-36 h-36 object-contain" referrerPolicy="no-referrer" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Elegant Avatar with glowing border and custom initials */}
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-[1.5px] shadow-lg shadow-amber-500/10 shrink-0 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center font-sans text-lg md:text-xl font-black text-amber-600">
              {currentUser.fullName ? currentUser.fullName.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join(' ') : 'م'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight">مرحباً بك، {currentUser.fullName}</h2>
              <span className="bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {currentUser.title || (currentUser.role === 'admin' ? 'مدير النظام الكلي' : 'عضو المؤسسة')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              لوحة الإشراف الإداري والمالي الكلي - مؤسسة رميح العريقة
            </p>
          </div>
        </div>
        <div className="relative z-10 bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-2xl text-xs text-slate-600 flex flex-col sm:flex-row items-center gap-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500 animate-bounce" />
            <span className="font-medium text-slate-500">التاريخ والوقت الفعلي:</span>
          </div>
          <span className="font-mono text-slate-700 font-extrabold flex items-center gap-2">
            <span>{getDynamicDateString(liveDateTime, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200/60 font-black">{liveDateTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Cairo', numberingSystem: (localStorage.getItem('romeih_numbering_system') || 'arabic') === 'english' ? 'latn' : 'arab' })}</span>
          </span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Active Cases */}
        <div 
          onClick={() => onNavigateToTab('cases')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_-6px_rgba(245,176,65,0.15)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-amber-500" />
          {/* Soft background glow */}
          <div className="absolute -right-12 -top-12 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors duration-300 pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 block tracking-wide">القضايا المتداولة والنشطة</span>
              <span className="text-4xl font-black text-slate-800 font-mono mt-1.5 block group-hover:text-amber-600 transition-colors">
                {toAr(activeCases.length)}
              </span>
            </div>
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100/50 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-300 shadow-sm">
              <Gavel className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100/90 pt-3.5 relative z-10">
            <span className="font-semibold text-slate-400">من أصل <strong className="text-slate-600">{toAr(cases.length)}</strong> قضية كلية</span>
            <span className="text-amber-600 font-extrabold flex items-center gap-0.5 group-hover:translate-x-[-4px] transition-transform">
              عرض الكل <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
 
        {/* KPI: Clients */}
        <div 
          onClick={() => onNavigateToTab('clients')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_-6px_rgba(37,99,235,0.15)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-blue-600" />
          {/* Soft background glow */}
          <div className="absolute -right-12 -top-12 w-28 h-28 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/10 transition-colors duration-300 pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 block tracking-wide">الموكلون والشركات</span>
              <span className="text-4xl font-black text-slate-800 font-mono mt-1.5 block group-hover:text-blue-600 transition-colors">
                {toAr(totalClients)}
              </span>
            </div>
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100/50 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100/90 pt-3.5 relative z-10">
            <span className="font-semibold text-slate-400">تشمل كبرى المؤسسات التجارية</span>
            <span className="text-blue-600 font-extrabold flex items-center gap-0.5 group-hover:translate-x-[-4px] transition-transform">
              عرض الكل <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
 
        {/* KPI: Financials Out */}
        <div 
          onClick={() => onNavigateToTab('fees')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_-6px_rgba(244,63,94,0.15)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-rose-500" />
          {/* Soft background glow */}
          <div className="absolute -right-12 -top-12 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors duration-300 pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 block tracking-wide">الأتعاب المتبقية والمستحقة</span>
              <span className="text-3xl font-black text-rose-600 font-mono mt-1.5 block">
                {toAr(totalOutstandingFees.toLocaleString())} <span className="text-xs font-extrabold text-rose-500/80">ج.م</span>
              </span>
            </div>
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100/50 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white group-hover:border-rose-500 transition-all duration-300 shadow-sm">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100/90 pt-3.5 relative z-10">
            <span className="font-semibold text-slate-400">مستحقات واجبة السداد فوراً</span>
            <span className="text-rose-600 font-extrabold flex items-center gap-0.5 group-hover:translate-x-[-4px] transition-transform">
              سندات القبض <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
 
        {/* KPI: Archived */}
        <div 
          onClick={() => onNavigateToTab('archive')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_30px_-6px_rgba(16,185,129,0.15)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-emerald-500" />
          {/* Soft background glow */}
          <div className="absolute -right-12 -top-12 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors duration-300 pointer-events-none" />
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 block tracking-wide">الملفات بالأرشيف المغلق</span>
              <span className="text-4xl font-black text-slate-800 font-mono mt-1.5 block group-hover:text-emerald-600 transition-colors">
                {toAr(archivedCases.length)}
              </span>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/50 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all duration-300 shadow-sm">
              <Archive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100/90 pt-3.5 relative z-10">
            <span className="font-semibold text-slate-400">مستندات مؤمنة بالكامل</span>
            <span className="text-emerald-600 font-extrabold flex items-center gap-0.5 group-hover:translate-x-[-4px] transition-transform">
              الأرشيف <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
 
      </div>

      {/* Detailed Sessions & Decisions Statistics Section */}
      <div className="bg-slate-900/95 border border-[#F5B041]/20 p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1/4 bg-radial from-[#F5B041]/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <span className="p-1.5 bg-[#F5B041]/10 rounded-lg text-[#F5B041]">
                <Gavel className="w-5 h-5 animate-pulse" />
              </span>
              لوحة مراقبة قرارات المحكمة وجلسات الرول (مزامنة فورية)
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              مؤشرات الأداء التفاعلية للجلسات المنعقدة، المؤجلة، ونسب حسم القرارات القضائية بالربط المباشر مع قاعدة البيانات.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-1.5 rounded-full font-bold flex items-center gap-1.5 self-start sm:self-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            تحديث ومزامنة البيانات مفعّل
          </div>
        </div>

        {/* 4 Cards Grid specifically for Session Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#081528]/85 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">إجمالي الجلسات بالأجندة</span>
              <span className="text-2xl font-extrabold text-white font-mono mt-1 block">{toAr(totalSessionsCount)}</span>
            </div>
            <div className="p-2.5 bg-slate-800/60 rounded-xl text-slate-300">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#081528]/85 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 block">جلسات صدر بها قرار</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-1 block">{toAr(completedSessionsCount)}</span>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Gavel className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#081528]/85 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-bold text-amber-400 block">جلسات تم تأجيلها</span>
              <span className="text-2xl font-extrabold text-amber-400 font-mono mt-1 block">{toAr(postponedSessionsCount)}</span>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#081528]/85 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-[10px] font-bold text-blue-400 block">جلسات قيد المتابعة والانتظار</span>
              <span className="text-2xl font-extrabold text-blue-400 font-mono mt-1 block">{toAr(pendingSessionsCount)}</span>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Resolution Rate & Latest Synced Decisions Log */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Progress Bar Container */}
          <div className="md:col-span-6 bg-[#081528]/50 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-white block">معدل حسم وإنجاز قرارات الجلسات</span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">نسبة الجلسات التي صدر بها منطوق حكم أو قرار نهائي/تمهيدي</span>
              </div>
              <span className="text-xl font-black text-[#F5B041] font-mono">{toAr(resolutionPercent)}٪</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3.5 border border-slate-800 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-[#F5B041] h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${resolutionPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              ✓ بمجرد الضغط على زر <strong className="text-amber-400">"تسجيل قرار المحكمة"</strong> وتدوين القرار، يرتفع هذا المؤشر تلقائيًا ليعكس الأداء الفعلي في الصفحة الرئيسية.
            </p>
          </div>

          {/* Latest Synced Decisions List */}
          <div className="md:col-span-6 bg-[#081528]/50 border border-slate-800 p-4 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              أحدث قرارات الجلسات المرصودة تلقائيًا بالجداول
            </h4>
            
            {latestDecisions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800/80 rounded-xl">
                لا توجد قرارات مسجلة مؤخراً. قم بتسجيل قرار لتجربة المزامنة.
              </div>
            ) : (
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {latestDecisions.map(s => (
                  <div key={s.id} className="p-2.5 bg-[#0a1931]/80 rounded-xl border border-emerald-500/15 flex items-start justify-between gap-2.5 text-xs animate-fadeIn">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-black font-mono">قضية {toAr(s.caseNumber)}</span>
                        <span className="font-semibold text-slate-200">{s.clientName}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        ⚖️ القرار: <strong className="text-amber-300 font-bold">{s.decision}</strong>
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-900 shrink-0">{toAr(s.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Sessions & Delayed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sessions column */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              أجندة الجلسات القضائية القريبة
            </h3>
            <button 
              onClick={() => onNavigateToTab('agenda')}
              className="text-xs text-amber-600 hover:underline font-semibold"
            >
              عرض التقويم الشهري الكامل
            </button>
          </div>

          {/* Today Sessions */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              جلسات اليوم ({getDynamicDateString(liveDateTime, { day: 'numeric', month: 'long' })})
            </h4>
            {todaySessions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                لا توجد جلسات مجدولة لليوم القضائي الحالي.
              </div>
            ) : (
              <div className="space-y-3.5">
                {todaySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    cases={cases}
                    currentUser={currentUser}
                    todayStr={todayStr}
                    sessions={sessions}
                    onOpenOutcome={(s) => {
                      if (onOpenSessionDecisionModal) {
                        onOpenSessionDecisionModal(s);
                      } else {
                        handleOpenOutcome(s);
                      }
                    }}
                    onOpenEditSession={handleOpenEditSession}
                    onDeleteSession={onDeleteSession}
                    onSearchCase={onSearchCase}
                    onNavigateToTab={onNavigateToTab}
                    onOpenCaseFile={onOpenCaseFile}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Tomorrow Sessions */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              جلسات غداً ({(() => {
                const tom = new Date(liveDateTime);
                tom.setDate(tom.getDate() + 1);
                return getDynamicDateString(tom, { day: 'numeric', month: 'long' });
              })()})
            </h4>
            {tomorrowSessions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                لا توجد جلسات مجدولة ليوم الغد.
              </div>
            ) : (
              <div className="space-y-3.5">
                {tomorrowSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    cases={cases}
                    currentUser={currentUser}
                    todayStr={todayStr}
                    sessions={sessions}
                    onOpenOutcome={(s) => {
                      if (onOpenSessionDecisionModal) {
                        onOpenSessionDecisionModal(s);
                      } else {
                        handleOpenOutcome(s);
                      }
                    }}
                    onOpenEditSession={handleOpenEditSession}
                    onDeleteSession={onDeleteSession}
                    onSearchCase={onSearchCase}
                    onNavigateToTab={onNavigateToTab}
                    onOpenCaseFile={onOpenCaseFile}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Quick Utilities, Delayed and Alerts */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Active Alerts */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-amber-800 flex items-center gap-2 uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              نظام التنبيهات الذكي للرول والقرارات
            </h3>
            <div className="space-y-2.5 text-xs text-amber-900/90 leading-relaxed">
              {todaySessions.length > 0 ? (
                todaySessions.slice(0, 2).map(s => (
                  <div key={s.id} className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-3xs">
                    🚨 <strong>جلسة اليوم:</strong> توجد جلسة ({s.type}) هامة في {s.court} ({s.subject}) للجلسة رقم {toAr(s.caseNumber)}.
                  </div>
                ))
              ) : (
                <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-3xs">
                  🚨 <strong>تنبيه اليوم:</strong> لا توجد جلسات مرافعة مجدولة لليوم القضائي الحالي.
                </div>
              )}
              {tomorrowSessions.length > 0 ? (
                tomorrowSessions.slice(0, 2).map(s => (
                  <div key={s.id} className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-3xs">
                    📅 <strong>جلسة غداً:</strong> {s.subject} في {s.court} - الدائرة {s.circuit}.
                  </div>
                ))
              ) : (
                <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-3xs">
                  📅 <strong>تنبيه الغد:</strong> جدول الغد خالي من الجلسات والالتزامات القضائية المباشرة.
                </div>
              )}
              {totalOutstandingFees > 0 && (
                <div className="bg-white p-2.5 rounded-lg border border-amber-100 shadow-3xs text-[11px]">
                  💰 <strong>الأتعاب المعلقة:</strong> هناك مستحقات معلقة للمؤسسة بقيمة إجمالية تبلغ {toAr(totalOutstandingFees.toLocaleString())} ج.م.
                </div>
              )}
            </div>
          </div>

          {/* Delayed/Overdue Litigations list */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-red-500" />
              القضايا والطعون المتأخرة
            </h3>
            {delayedCases.length === 0 ? (
              <p className="text-xs text-slate-400 italic">لا توجد قضايا متأخرة أو معلقة حالياً.</p>
            ) : (
              <div className="space-y-3">
                {delayedCases.slice(0, 3).map((c) => (
                  <div key={c.id} className="p-3 bg-red-50/40 rounded-lg border border-red-100">
                    <p className="text-xs font-bold text-slate-800">
                      قضية رقم {toAr(c.caseNumberFirstInstance)} لسنة {toAr(c.caseYearFirstInstance)} ({c.type})
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      <strong>الموكل:</strong> {c.clientName}
                    </p>
                    <p className="text-[11px] text-red-700 font-semibold mt-1">
                      ⚠️ {c.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Outcome Update Modal (تسجيل قرار الجلسة من لوحة الإحصاء) */}
      {outcomeSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Gavel className="w-5 h-5 text-amber-500" />
                {isExpertSession(outcomeSession)
                  ? `نموذج إثبات إجراء وقرار جلسة الخبير (قضية رقم ${outcomeSession.caseNumber})`
                  : `نموذج قرار الجلسة والطعن (قضية رقم ${outcomeSession.caseNumber})`}
              </h3>
              <button
                onClick={() => setOutcomeSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOutcomeSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isExpertSession(outcomeSession) ? 'مكتب أو جهة الخبراء' : 'المحكمة'}
                  </label>
                  <CourtSelect
                    value={outcomeCourt}
                    onChange={setOutcomeCourt}
                    placeholder={isExpertSession(outcomeSession) ? 'مكتب الخبراء المختص' : 'المحكمة المنعقدة أمامها'}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-right font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isExpertSession(outcomeSession) ? 'مكان أو مقر المباشرة' : 'الدائرة (يدوياً)'}
                  </label>
                  <input
                    type="text"
                    value={outcomeCircuit}
                    onChange={(e) => setOutcomeCircuit(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                    placeholder={isExpertSession(outcomeSession) ? 'مقر الخبير أو موقع المعاينة' : 'الدائرة القضائية'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isExpertSession(outcomeSession)
                    ? 'القرار أو الإجراء المتخذ بجلسة الخبير'
                    : isDetentionSession(outcomeSession)
                    ? 'قرار سلطة التحقيق / المحكمة'
                    : 'منطوق قرار المحكمة (رول الجلسة)'}
                </label>
                <textarea
                  placeholder={
                    isExpertSession(outcomeSession)
                      ? 'مثال: تم إيداع المستندات وتأجيل المباشرة للانتقال والمعاينة الميدانية...'
                      : 'مثال: التأجيل لجلسة 2 يوليو لتقديم المستندات والطب الشرعي أو الحكم التمهيدي...'
                  }
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  required
                  rows={2.5}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isExpertSession(outcomeSession) ? 'موعد جلسة الخبير القادمة (إن وجد)' : 'تاريخ الجلسة القادمة (إن وجد)'}
                  </label>
                  <input
                    type="date"
                    value={nextHearingDate}
                    onChange={(e) => setNextHearingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الجلسة الحالية</label>
                  <div className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200 font-bold">
                    {isExpertSession(outcomeSession) ? '✓ سيتم قيدها كـ "جلسة خبرة منجزة ومسجلة"' : '✓ سيتم قيدها كـ "مكتملة ومؤرشفة بالرول"'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isExpertSession(outcomeSession) ? 'ما تم تفصيلاً أمام الخبير والمناقشة' : 'ما تم تفصيلاً في جلسة اليوم ومرافعتنا'}
                </label>
                <textarea
                  placeholder={
                    isExpertSession(outcomeSession)
                      ? 'اكتب ما تم من معاينات، سماع أقوال، أو تقديم مستندات أمام الخبير...'
                      : 'اكتب تفاصيل مرافعة الدفاع ودفوع الخصوم بالجلسة...'
                  }
                  value={whatHappened}
                  onChange={(e) => setWhatHappened(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isExpertSession(outcomeSession)
                    ? 'المستندات أو المذكرات المطلوبة لتقديمها للخبير'
                    : 'المطلوب تجهيزه وصياغته قبل الجلسة القادمة'}
                </label>
                <textarea
                  placeholder={
                    isExpertSession(outcomeSession)
                      ? 'مثال: تقديم أصول العقود، إعداد مذكرة حسابية فنية، تقديم إفادة السجل العيني...'
                      : 'مثال: كتابة مذكرة الرد على تقرير الخبير، تقديم شهادة وفاة...'
                  }
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Upload roll photo simulation */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center">
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">
                  {isExpertSession(outcomeSession) ? 'إرفاق صورة محضر جلسة الخبير أو قرار المعاينة' : 'إرفاق صورة رول الجلسة أو منطوق الحكم'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isExpertSession(outcomeSession) ? 'اضغط لمحاكاة التقاط صورة محضر الخبير أو الرفع' : 'اضغط لمحاكاة التقاط الصورة بالهاتف المحمول أو الرفع'}
                </p>
                
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    type="text"
                    placeholder="مثال: roll_session_26_6.jpg"
                    value={rollPhotoName}
                    onChange={(e) => setRollPhotoName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono w-56"
                  />
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
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] px-3 py-1.5 rounded-lg font-bold"
                  >
                    محاكاة الرفع
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOutcomeSession(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs px-5 py-2 rounded-lg font-bold shadow-md shadow-amber-500/10"
                >
                  تحديث وإغلاق الجلسة
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto text-right animate-fadeIn" dir="rtl">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <Edit className="w-4 h-4 text-amber-800" />
                </div>
                <span>تعديل بيانات الجلسة يدوياً (قضية رقم {editingSession.caseNumber})</span>
              </h3>
              <button
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSessionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 text-right">المحكمة</label>
                  <CourtSelect
                    value={editSessionCourt}
                    onChange={setEditSessionCourt}
                    placeholder="مثال: محكمة أسرة التجمع الخامس"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-right font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 text-right">الدائرة (يدوياً)</label>
                  <input
                    type="text"
                    value={editSessionCircuit}
                    onChange={(e) => setEditSessionCircuit(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-right"
                    placeholder="مثال: الدائرة 3 إيجارات"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 text-right">تاريخ الجلسة</label>
                  <input
                    type="date"
                    value={editSessionDate}
                    onChange={(e) => setEditSessionDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 text-right">توقيت الجلسة (الساعة)</label>
                  <input
                    type="time"
                    value={editSessionTime}
                    onChange={(e) => setEditSessionTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 text-right">موضوع الجلسة والطلبات المطلوبة</label>
                <input
                  type="text"
                  value={editSessionSubject}
                  onChange={(e) => setEditSessionSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-right font-medium"
                  placeholder="مثال: إيداع تقرير الخبير، تقديم مذكرات الدفاع..."
                />
              </div>

              {users && users.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 text-right">المحامي المكلف بالحضور</label>
                  <select
                    value={editSessionLawyer}
                    onChange={(e) => setEditSessionLawyer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-right font-bold"
                  >
                    <option value="">-- اختار المحامي --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-5 py-2 rounded-xl shadow-md cursor-pointer active:scale-95"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
