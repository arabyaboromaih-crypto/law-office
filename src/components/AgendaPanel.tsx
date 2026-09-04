/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HearingSession, Case, User, DetentionRenewalRecord } from '../types';
import { 
  Calendar as CalendarIcon, Clock, Gavel, Search, Printer, 
  ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, RefreshCw, X, FileText, Camera, Plus, Edit, FolderOpen, Trash2,
  Sparkles, Filter, ShieldAlert, CheckCircle, TrendingUp, Layers, MapPin, UserCheck, Scale, Building, Lock
} from 'lucide-react';
import { extractHearingDate } from '../utils/hearingSync';
import { toAr } from '../utils/arabicNumbers';
import { CourtSelect } from '../utils/courts';
import { useBackHandler } from '../utils/navigationManager';
import { AddHearingModal } from './AddHearingModal';
import { getEffectiveStageInfo } from '../utils/stageUtils';
import SessionCard, { isExpertSession, isDetentionSession } from './SessionCard';
import DetentionRenewalsModal from './DetentionRenewalsModal';

interface AgendaPanelProps {
  sessions: HearingSession[];
  cases: Case[];
  users: User[];
  currentUser: User;
  onAddSession: (s: HearingSession) => void;
  onUpdateSession: (s: HearingSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onNavigateToTab?: (tabName: string) => void;
  onSearchCase?: (query: string) => void;
  onOpenCaseFile?: (caseId: string) => void;
  onUpdateCase?: (c: Case) => void;
}

export default function AgendaPanel({ 
  sessions, cases, users, currentUser, onAddSession, onUpdateSession, onDeleteSession, onNavigateToTab, onSearchCase, onOpenCaseFile, onUpdateCase
}: AgendaPanelProps) {
  
  const getDynamicDateString = (date: Date, options: Intl.DateTimeFormatOptions) => {
    const system = localStorage.getItem('romeih_numbering_system') || 'arabic';
    const numberingSystem = system === 'english' ? 'latn' : 'arab';
    return date.toLocaleDateString('ar-EG', { ...options, numberingSystem });
  };

  const getLocalYYYYMMDD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // States
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [currentDateState, setCurrentDateState] = useState(new Date()); // Baseline date
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourt, setFilterCourt] = useState('الكل');
  const [filterLawyer, setFilterLawyer] = useState('الكل');
  const [filterCategory, setFilterCategory] = useState<'all' | 'detention' | 'expert' | 'regular'>('all');

  // Post Session Outcome modal
  const [outcomeSession, setOutcomeSession] = useState<HearingSession | null>(null);
  const [decision, setDecision] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [requirements, setRequirements] = useState('');
  const [rollPhotoName, setRollPhotoName] = useState('');
  const [isRollUploaded, setIsRollUploaded] = useState(false);
  const [outcomeCourt, setOutcomeCourt] = useState('');
  const [outcomeCircuit, setOutcomeCircuit] = useState('');
  const [outcomeDetentionStartDate, setOutcomeDetentionStartDate] = useState('');
  const [outcomeDetentionDurationDays, setOutcomeDetentionDurationDays] = useState(15);
  const [outcomeDetentionRenewalNumber, setOutcomeDetentionRenewalNumber] = useState<number | string>('');
  const [outcomeDetentionDecisionNumber, setOutcomeDetentionDecisionNumber] = useState('');
  const [outcomeDetentionNextAuthority, setOutcomeDetentionNextAuthority] = useState('');
  const [detentionModalCase, setDetentionModalCase] = useState<Case | null>(null);
  const [detentionModalInitialDate, setDetentionModalInitialDate] = useState<string | undefined>(undefined);

  const isModalReadOnly = !!outcomeSession && (!!outcomeSession.decision || outcomeSession.status === 'completed') && !currentUser?.permissions?.editSessionDecision;

  // Edit Session States
  const [editingSession, setEditingSession] = useState<HearingSession | null>(null);
  const [editSessionCourt, setEditSessionCourt] = useState('');
  const [editSessionCircuit, setEditSessionCircuit] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionTime, setEditSessionTime] = useState('');
  const [editSessionSubject, setEditSessionSubject] = useState('');
  const [editSessionLawyer, setEditSessionLawyer] = useState('');
  const [editDetentionDurationDays, setEditDetentionDurationDays] = useState(15);
  const [editDetentionRenewalNumber, setEditDetentionRenewalNumber] = useState<number | string>('');
  const [editDetentionAuthority, setEditDetentionAuthority] = useState('');

  // New Quick Session Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(getLocalYYYYMMDD(new Date()));
  const [newSessionTime, setNewSessionTime] = useState('09:00');
  const [newSessionSubject, setNewSessionSubject] = useState('');
  const [newSessionLawyer, setNewSessionLawyer] = useState('');
  const [newSessionCourt, setNewSessionCourt] = useState('');
  const [newSessionCircuit, setNewSessionCircuit] = useState('');
  
  // Detention Renewal Form State
  const [isNewSessionDetention, setIsNewSessionDetention] = useState(false);
  const [newDetentionAuthority, setNewDetentionAuthority] = useState('النيابة العامة');
  const [newDetentionDuration, setNewDetentionDuration] = useState(15);

  // Back button handlers
  useBackHandler(showAddModal, () => setShowAddModal(false));
  useBackHandler(!!outcomeSession, () => setOutcomeSession(null));
  useBackHandler(!!editingSession, () => setEditingSession(null));

  // Setup Today String
  const todayStr = getLocalYYYYMMDD(new Date());

  const renderSessionCategoryBadge = (session: HearingSession, parentCase?: Case) => {
    const eff = getEffectiveStageInfo(parentCase, session);
    const isDetention = isDetentionSession(session, parentCase);
    const isExpert = isExpertSession(session);

    if (isDetention) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs shrink-0">
          <span className="w-5 h-5 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
            <Lock className="w-3 h-3 text-rose-600" />
          </span>
          <span>تجديد حبس احتياطي</span>
          {session.detentionRenewalNumber && (
            <span className="text-[9px] bg-rose-200 text-rose-950 px-1.5 py-0.2 rounded-md font-black">
              تجديد #{session.detentionRenewalNumber}
            </span>
          )}
          {session.detentionDuration && (
            <span className="text-[9px] bg-rose-100 text-rose-900 border border-rose-200 px-1.5 py-0.2 rounded-md font-bold">
              {session.detentionDuration}
            </span>
          )}
          {session.detentionAuthority && (
            <span className="text-[9px] bg-rose-700 text-white px-2 py-0.5 rounded-full font-bold mr-1">
              {session.detentionAuthority}
            </span>
          )}
        </span>
      );
    }

    if (isExpert) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 shadow-2xs shrink-0">
          <span className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center shrink-0">
            <Scale className="w-3 h-3 text-indigo-600" />
          </span>
          <span>جلسة خبراء</span>
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full border shadow-2xs shrink-0 ${eff.badgeStyle}`}>
        <span className="w-5 h-5 rounded-full bg-white/80 border border-current flex items-center justify-center shrink-0">
          <Gavel className="w-3 h-3 text-current" />
        </span>
        <span>{eff.badgeText}</span>
      </span>
    );
  };

  // Find sessions in files/detention/expert records that are NOT in sessions state
  const discoveredSessions: Array<{
    caseObj: Case;
    file: { id: string; name: string; type: string; category: string; uploadDate: string; size?: string; fileUrl: string };
    fileDate: string;
    suggestedSubject: string;
    isDetention?: boolean;
    detentionAuth?: string;
  }> = [];

  cases.forEach(c => {
    if (c.files) {
      c.files.forEach(file => {
        const fileDate = extractHearingDate(file.name);
        if (!fileDate) return;
        const exists = sessions.some(s => s.caseId === c.id && s.date === fileDate);
        if (!exists) {
          discoveredSessions.push({
            caseObj: c,
            file,
            fileDate,
            suggestedSubject: `جلسة مستخرجة ومزامنة من مستند: ${file.name}`
          });
        }
      });
    }

    // Extract sessions from expert referral history
    if ((c.isReferredToExperts || c.expertReferral?.isReferred) && c.expertReferral?.sessions) {
      c.expertReferral.sessions.forEach(expSess => {
        if (!expSess.date) return;
        const exists = sessions.some(s => s.caseId === c.id && s.date === expSess.date);
        if (!exists) {
          discoveredSessions.push({
            caseObj: c,
            file: { 
              id: expSess.id, 
              name: `جلسة خبراء: ${expSess.sessionType} (${expSess.location || 'مكتب الخبراء'})`, 
              type: 'expert', 
              category: 'expert', 
              uploadDate: expSess.date, 
              fileUrl: '#' 
            },
            fileDate: expSess.date,
            suggestedSubject: `جلسة خبرة (${expSess.sessionType}) - ${expSess.location || c.expertReferral?.expertOffice || 'مكتب الخبراء'}`
          });
        }
      });
    }

    // Extract sessions from detention renewals history (فقط عند تفعيل مرحلة التحقيق)
    if (c.isInvestigationActive && c.detentionRenewals && c.detentionRenewals.length > 0) {
      c.detentionRenewals.forEach((ren, idx) => {
        const renDate = ren.nextRenewalDate || ren.date || ren.renewalDate;
        if (!renDate) return;
        const exists = sessions.some(s => s.caseId === c.id && s.date === renDate);
        if (!exists) {
          discoveredSessions.push({
            caseObj: c,
            file: {
              id: ren.id || `det-ren-${idx}`,
              name: `🔒 جلسة تجديد حبس احتياطي: ${ren.authority || 'النيابة/المحكمة'} (${ren.durationDays || 15} يوم)`,
              type: 'detention',
              category: 'تجديد حبس',
              uploadDate: renDate,
              fileUrl: '#'
            },
            fileDate: renDate,
            suggestedSubject: `جلسة تجديد حبس احتياطي (${ren.nextAuthority || ren.authority || 'جهة التجديد'})`,
            isDetention: true,
            detentionAuth: ren.nextAuthority || ren.authority
          });
        }
      });
    }
  });

  const handleAddSingleDiscoveredSession = (item: typeof discoveredSessions[0]) => {
    const eff = getEffectiveStageInfo(item.caseObj);
    const newSession: HearingSession = {
      id: `session-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      caseId: item.caseObj.id,
      caseNumber: item.isDetention && item.caseObj.investigationNumber ? item.caseObj.investigationNumber : (eff.caseNumber || item.caseObj.caseNumberFirstInstance),
      caseYear: item.isDetention && item.caseObj.investigationYear ? item.caseObj.investigationYear : (eff.caseYear || item.caseObj.caseYearFirstInstance),
      clientName: item.caseObj.clientName,
      opponentName: item.caseObj.opponent.name,
      court: eff.court || item.caseObj.court,
      circuit: eff.circuit || item.caseObj.circuit,
      type: item.caseObj.type,
      date: item.fileDate,
      time: '09:00',
      subject: item.suggestedSubject,
      status: 'pending',
      assignedLawyerId: item.caseObj.assignedLawyerId || undefined,
      assignedLawyerName: users.find(u => u.id === item.caseObj.assignedLawyerId)?.fullName || undefined,
      notes: `تمت الإضافة والضم يدوياً للأجندة من واقع الملف المؤرخ: ${item.file.name}`
    };
    onAddSession(newSession);
    alert(`تم ضم الجلسة المحددة المؤرخة في ${item.fileDate} لأجندة رصد الجلسات بنجاح!`);
  };

  // Distinct Courts & Lawyers for Filter
  const distinctCourts = Array.from(new Set(sessions.map(s => s.court)));
  const distinctLawyers = users.filter(u => u.role === 'lawyer' || u.role === 'admin');

  // Search/Filter Logic
  const filteredSessions = sessions.filter(s => {
    // Hide sessions of archived or ended cases from active agenda panel
    const parentCase = cases.find(c => c.id === s.caseId);
    if (parentCase) {
      if (parentCase.isArchived) return false;
      const finishedKeywords = ['منتهية', 'انتهت', 'مغلقة', 'مؤرشفة', 'شطب', 'محكومة'];
      if (finishedKeywords.some(kw => parentCase.status?.includes(kw))) {
        return false;
      }
    }

    const eff = getEffectiveStageInfo(parentCase, s);

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ? true : (
      (s.clientName && s.clientName.toLowerCase().includes(q)) ||
      (s.opponentName && s.opponentName.toLowerCase().includes(q)) ||
      (s.caseNumber && s.caseNumber.toLowerCase().includes(q)) ||
      (eff.caseNumber && eff.caseNumber.toLowerCase().includes(q)) ||
      (s.caseYear && s.caseYear.toLowerCase().includes(q)) ||
      (eff.court && eff.court.toLowerCase().includes(q)) ||
      (eff.circuit && eff.circuit.toLowerCase().includes(q)) ||
      (parentCase?.caseNumberFirstInstance && parentCase.caseNumberFirstInstance.toLowerCase().includes(q)) ||
      (parentCase?.caseNumberSecondInstance && parentCase.caseNumberSecondInstance.toLowerCase().includes(q)) ||
      (parentCase?.cassationNumber && parentCase.cassationNumber.toLowerCase().includes(q)) ||
      (parentCase?.investigationNumber && parentCase.investigationNumber.toLowerCase().includes(q)) ||
      (s.court && s.court.toLowerCase().includes(q)) ||
      (s.subject && s.subject.toLowerCase().includes(q)) ||
      (s.assignedLawyerName && s.assignedLawyerName.toLowerCase().includes(q)) ||
      (s.date && s.date.includes(q))
    );

    const matchesCourt = filterCourt === 'الكل' || filterCourt.trim() === '' || 
      (s.court && s.court.toLowerCase().includes(filterCourt.toLowerCase().trim())) ||
      (eff.court && eff.court.toLowerCase().includes(filterCourt.toLowerCase().trim()));
    const matchesLawyer = filterLawyer === 'الكل' || s.assignedLawyerId === filterLawyer;

    // Category filter check
    let matchesCategory = true;
    if (filterCategory === 'detention') {
      matchesCategory = isDetentionSession(s);
    } else if (filterCategory === 'expert') {
      matchesCategory = isExpertSession(s);
    } else if (filterCategory === 'regular') {
      matchesCategory = !isDetentionSession(s) && !isExpertSession(s);
    }

    return matchesSearch && matchesCourt && matchesLawyer && matchesCategory;
  });

  const filteredDiscoveredSessions = discoveredSessions.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.caseObj.clientName && item.caseObj.clientName.toLowerCase().includes(q)) ||
      (item.caseObj.opponent && item.caseObj.opponent.name && item.caseObj.opponent.name.toLowerCase().includes(q)) ||
      (item.caseObj.caseNumberFirstInstance && item.caseObj.caseNumberFirstInstance.toLowerCase().includes(q)) ||
      (item.caseObj.court && item.caseObj.court.toLowerCase().includes(q)) ||
      (item.file.name && item.file.name.toLowerCase().includes(q)) ||
      (item.fileDate && item.fileDate.includes(q))
    );
  });

  // KPI Statistics Counters
  const totalSessionsCount = sessions.filter(s => {
    const parentCase = cases.find(c => c.id === s.caseId);
    return !parentCase?.isArchived && !parentCase?.status?.includes('منتهية');
  }).length;
  const detentionSessionsCount = sessions.filter(s => {
    const parentCase = cases.find(c => c.id === s.caseId);
    return !parentCase?.isArchived && isDetentionSession(s);
  }).length;
  const expertSessionsCount = sessions.filter(s => {
    const parentCase = cases.find(c => c.id === s.caseId);
    return !parentCase?.isArchived && isExpertSession(s);
  }).length;

  const todaySessionsCount = filteredSessions.filter(s => s.date === todayStr).length;
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = getLocalYYYYMMDD(tomorrowObj);
  const tomorrowSessionsCount = filteredSessions.filter(s => s.date === tomorrowStr).length;
  const upcomingSessionsCount = filteredSessions.filter(s => s.date > todayStr).length;
  const completedSessionsCount = filteredSessions.filter(s => (!!s.decision && s.decision.trim() !== '') || s.status === 'completed').length;
  const unrecordedSessions = sessions.filter(s => {
    const parentCase = cases.find(c => c.id === s.caseId);
    if (parentCase) {
      if (parentCase.isArchived) return false;
      const finishedKeywords = ['منتهية', 'انتهت', 'مغلقة', 'مؤرشفة', 'شطب', 'محكومة'];
      if (finishedKeywords.some(kw => parentCase.status?.includes(kw))) {
        return false;
      }
    }
    const isEnded = s.date <= todayStr;
    const hasRecordedDecision = (!!s.decision && s.decision.trim() !== '') || s.status === 'completed';
    if (hasRecordedDecision) return false;

    // Also check if another record for the same case on the same date has already recorded a decision
    const hasDecisionOnSameDate = sessions.some(other => 
      other.caseId === s.caseId && 
      other.date === s.date && 
      ((!!other.decision && other.decision.trim() !== '') || other.status === 'completed')
    );
    if (hasDecisionOnSameDate) return false;

    return isEnded;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const unrecordedSessionsCount = unrecordedSessions.length;

  // Navigation handlers
  const handleNext = () => {
    const newDate = new Date(currentDateState);
    if (viewMode === 'daily') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'yearly') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDateState(newDate);
  };

  const handlePrev = () => {
    const newDate = new Date(currentDateState);
    if (viewMode === 'daily') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'yearly') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDateState(newDate);
  };

  const handleGoToToday = () => {
    setCurrentDateState(new Date(todayStr));
  };

  // Daily View Filter
  const dateFormattedStr = getLocalYYYYMMDD(currentDateState);
  const dailySessionsList = filteredSessions.filter(s => s.date === dateFormattedStr);

  // Weekly View Dates Setup
  const getWeekDays = (start: Date) => {
    const days = [];
    const currentDay = start.getDay();
    const diff = start.getDate() - currentDay + (currentDay === 6 ? 0 : -1 - currentDay);
    const sundayStart = new Date(start);
    sundayStart.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(sundayStart);
      day.setDate(sundayStart.getDate() + i);
      days.push(day);
    }
    return days;
  };
  const weekDays = getWeekDays(currentDateState);

  // Monthly View Calendar Cells
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDayIndex = (firstDay.getDay() + 1) % 7;
    
    const cells = [];
    for (let i = 0; i < startingDayIndex; i++) {
      cells.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(year, month, i));
    }
    return cells;
  };
  const monthCells = getMonthDays(currentDateState);

  // Yearly View Calendar Cells
  const getSpecificMonthDays = (year: number, monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDayIndex = (firstDay.getDay() + 1) % 7;
    
    const cells = [];
    for (let i = 0; i < startingDayIndex; i++) {
      cells.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(year, monthIndex, i));
    }
    return cells;
  };

  // Open Outcome Modal
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

    const parentCase = cases.find(c => c.id === s.caseId);
    const isDet = isDetentionSession(s, parentCase);
    setOutcomeDetentionStartDate(s.detentionStartDate || parentCase?.detentionStartDate || '');
    setOutcomeDetentionDurationDays(s.detentionDurationDays || 15);
    setOutcomeDetentionRenewalNumber(s.detentionRenewalNumber || '');
    setOutcomeDetentionDecisionNumber(s.detentionDecisionNumber || '');
    setOutcomeDetentionNextAuthority(s.detentionNextAuthority || s.detentionAuthority || 'غرفة المشورة / النيابة');
  };

  // Submit Outcome
  const handleOutcomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeSession) return;

    const parentCase = cases.find(c => c.id === outcomeSession.caseId);
    const isDet = isDetentionSession(outcomeSession, parentCase);
    const durDays = Number(outcomeDetentionDurationDays) || 15;
    const trimmedDecision = decision ? decision.trim() : '';
    const hasDecision = trimmedDecision !== '';

    const updated: HearingSession = {
      ...outcomeSession,
      status: hasDecision ? 'completed' : (nextHearingDate ? 'postponed' : 'pending'),
      court: outcomeCourt || outcomeSession.court,
      circuit: outcomeCircuit || outcomeSession.circuit,
      decision: hasDecision ? trimmedDecision : undefined,
      nextHearingDate: nextHearingDate ? nextHearingDate.trim() : undefined,
      whatHappened: whatHappened ? whatHappened.trim() : undefined,
      requirements: requirements ? requirements.trim() : undefined,
      rollPhotoUrl: isRollUploaded ? 'roll_attached_url' : undefined,
      isDetentionRenewal: isDet ? true : outcomeSession.isDetentionRenewal,
      detentionStartDate: isDet ? (outcomeDetentionStartDate || outcomeSession.detentionStartDate || parentCase?.detentionStartDate) : undefined,
      detentionDurationDays: isDet ? durDays : undefined,
      detentionDuration: isDet ? `${durDays} يوم` : undefined,
      detentionRenewalNumber: isDet ? (outcomeDetentionRenewalNumber ? Number(outcomeDetentionRenewalNumber) : outcomeSession.detentionRenewalNumber) : undefined,
      detentionDecisionNumber: isDet ? outcomeDetentionDecisionNumber : undefined,
      detentionAuthority: isDet ? (outcomeCourt || outcomeSession.court || outcomeSession.detentionAuthority || 'النيابة العامة') : undefined,
      detentionNextAuthority: isDet ? (outcomeDetentionNextAuthority || 'غرفة المشورة / النيابة') : undefined
    };

    onUpdateSession(updated);

    // Synchronize detention renewal record and next session into parent case
    if (isDet && parentCase && onUpdateCase) {
      const renList = parentCase.detentionRenewals || [];
      const sessionDate = outcomeSession.date;
      const existingRenIndex = renList.findIndex(r => 
        (outcomeSession.detentionRenewalId && r.id === outcomeSession.detentionRenewalId) ||
        (r.date || r.renewalDate) === sessionDate
      );

      const updatedRenRecord: DetentionRenewalRecord = {
        id: existingRenIndex >= 0 ? renList[existingRenIndex].id : (outcomeSession.detentionRenewalId || `ren-${Date.now()}`),
        renewalNumber: (existingRenIndex >= 0 ? renList[existingRenIndex].renewalNumber : undefined) || (outcomeDetentionRenewalNumber ? Number(outcomeDetentionRenewalNumber) : renList.length + 1),
        date: sessionDate,
        renewalDate: sessionDate,
        court: outcomeCourt || outcomeSession.court || parentCase.court,
        circuit: outcomeCircuit || outcomeSession.circuit || parentCase.circuit,
        authority: outcomeCourt || outcomeSession.court || outcomeSession.detentionAuthority || 'النيابة العامة',
        durationDays: durDays,
        decision: decision || undefined,
        decisionNumber: outcomeDetentionDecisionNumber || undefined,
        notes: [whatHappened, requirements].filter(Boolean).join(' | ') || undefined,
        nextRenewalDate: nextHearingDate ? nextHearingDate.trim() : undefined,
        nextAuthority: outcomeDetentionNextAuthority || undefined,
        detentionStartDate: outcomeDetentionStartDate || parentCase.detentionStartDate || undefined
      };

      let newRenewalsList: DetentionRenewalRecord[];
      if (existingRenIndex >= 0) {
        newRenewalsList = renList.map((r, idx) => idx === existingRenIndex ? updatedRenRecord : r);
      } else {
        newRenewalsList = [...renList, updatedRenRecord];
      }

      onUpdateCase({
        ...parentCase,
        isInvestigationActive: true,
        detentionRenewals: newRenewalsList,
        ...(nextHearingDate ? {
          nextHearingDate: nextHearingDate.trim(),
          nextHearingTime: '09:00',
          nextHearingSubject: `جلسة تجديد حبس احتياطي (${outcomeDetentionNextAuthority || 'النيابة العامة'})`
        } : {})
      });
    }

    setOutcomeSession(null);
  };

  // Edit Session Handlers
  const handleOpenEditSession = (s: HearingSession) => {
    const parentCase = cases.find(c => c.id === s.caseId);
    setEditingSession(s);
    setEditSessionCourt(s.court || '');
    setEditSessionCircuit(s.circuit || '');
    setEditSessionDate(s.date || todayStr);
    setEditSessionTime(s.time || '09:00');
    setEditSessionSubject(s.subject || '');
    setEditSessionLawyer(s.assignedLawyerId || '');
    setEditDetentionDurationDays(s.detentionDurationDays || 15);
    setEditDetentionRenewalNumber(s.detentionRenewalNumber || '');
    setEditDetentionAuthority(s.detentionAuthority || s.court || (isDetentionSession(s, parentCase) ? 'النيابة العامة' : ''));
  };

  const handleEditSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    const assignedUser = users.find(u => u.id === editSessionLawyer);
    const parentCase = cases.find(c => c.id === editingSession.caseId);
    const isDet = isDetentionSession(editingSession, parentCase);

    const updated: HearingSession = {
      ...editingSession,
      isDetentionRenewal: isDet ? true : editingSession.isDetentionRenewal,
      detentionAuthority: isDet ? (editDetentionAuthority || editSessionCourt || editingSession.detentionAuthority || 'النيابة العامة') : editingSession.detentionAuthority,
      detentionDurationDays: isDet ? (Number(editDetentionDurationDays) || editingSession.detentionDurationDays || 15) : editingSession.detentionDurationDays,
      detentionRenewalNumber: isDet ? (editDetentionRenewalNumber || editingSession.detentionRenewalNumber) : editingSession.detentionRenewalNumber,
      court: editSessionCourt,
      circuit: editSessionCircuit,
      date: editSessionDate,
      time: editSessionTime,
      subject: editSessionSubject,
      assignedLawyerId: editSessionLawyer || undefined,
      assignedLawyerName: assignedUser ? assignedUser.fullName : undefined
    };

    onUpdateSession(updated);

    // Sync any edits directly into parent case detention renewals to prevent overwrite
    if (isDet && parentCase && onUpdateCase && parentCase.detentionRenewals && parentCase.detentionRenewals.length > 0) {
      const updatedRenewals = parentCase.detentionRenewals.map(r => {
        const isMatch = (editingSession.detentionRenewalId && r.id === editingSession.detentionRenewalId) ||
          ((r.date || r.renewalDate) === editingSession.date);
        if (isMatch) {
          return {
            ...r,
            date: editSessionDate,
            renewalDate: editSessionDate,
            court: editSessionCourt || r.court,
            circuit: editSessionCircuit || r.circuit,
            authority: editDetentionAuthority || r.authority,
            durationDays: Number(editDetentionDurationDays) || r.durationDays,
            notes: editSessionSubject || r.notes
          };
        }
        return r;
      });
      onUpdateCase({
        ...parentCase,
        court: editSessionCourt || parentCase.court,
        circuit: editSessionCircuit || parentCase.circuit,
        detentionRenewals: updatedRenewals
      });
    }

    setEditingSession(null);
  };

  // Full Agenda Print Handler - Comprehensive, Alternating Two-Color Strips with Full Case Details
  const handlePrintAgenda = (scope: string) => {
    let printTitle = '';
    let printSubtitle = '';
    let printData: HearingSession[] = [];

    const formatArabicDateWithDay = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3) {
          const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
          return dateObj.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
      } catch {
        // fallback
      }
      return dateStr;
    };

    if (scope === 'today') {
      const targetDate = viewMode === 'daily' ? getLocalYYYYMMDD(currentDateState) : todayStr;
      const formattedDate = formatArabicDateWithDay(targetDate);
      printTitle = `أجندة رول الجلسات ليوم ${formattedDate}`;
      printSubtitle = `الموافق: ${targetDate}`;
      printData = filteredSessions.filter(s => s.date === targetDate);
    } else if (scope === 'week') {
      const weekStr = weekDays.map(d => getLocalYYYYMMDD(d));
      const fromFormatted = formatArabicDateWithDay(weekStr[0]);
      const toFormatted = formatArabicDateWithDay(weekStr[6]);
      printTitle = `أجندة رول الجلسات الأسبوعية`;
      printSubtitle = `من ${fromFormatted} (${weekStr[0]}) إلى ${toFormatted} (${weekStr[6]})`;
      printData = filteredSessions.filter(s => weekStr.includes(s.date));
    } else {
      const monthName = currentDateState.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
      printTitle = `أجندة رول الجلسات الشهرية`;
      printSubtitle = `عن شهر ${monthName}`;
      printData = filteredSessions.filter(s => {
        const sDate = new Date(s.date);
        return sDate.getMonth() === currentDateState.getMonth() && sDate.getFullYear() === currentDateState.getFullYear();
      });
    }

    // Chronologically sort sessions by date and time
    const sortedPrintData = [...printData].sort((a, b) => {
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const nowStr = new Date().toLocaleString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const totalCount = sortedPrintData.length;
      const regularCount = sortedPrintData.filter(s => !isExpertSession(s) && !isDetentionSession(s)).length;
      const expertCount = sortedPrintData.filter(s => isExpertSession(s)).length;
      const detentionCount = sortedPrintData.filter(s => isDetentionSession(s)).length;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="utf-8" />
            <title>${printTitle} - ${printSubtitle}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 12mm 12mm 14mm 12mm;
              }
              *, *:before, *:after {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                direction: rtl;
                text-align: right;
                background-color: #ffffff;
                color: #0f172a;
                margin: 0;
                padding: 15px;
                line-height: 1.5;
                font-size: 14px;
              }

              /* Top Action Bar for screen */
              .action-bar {
                background: #0f172a;
                color: #ffffff;
                padding: 12px 20px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.15);
              }
              .action-bar button {
                padding: 8px 18px;
                font-size: 14px;
                font-weight: bold;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
              }
              .btn-print {
                background: #f59e0b;
                color: #0f172a;
              }
              .btn-print:hover {
                background: #d97706;
              }
              .btn-close {
                background: #334155;
                color: #ffffff;
              }
              .btn-close:hover {
                background: #475569;
              }

              /* Header */
              .header {
                border-bottom: 2.5px solid #0f172a;
                padding-bottom: 14px;
                margin-bottom: 18px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .header-title-box h1 {
                margin: 0 0 4px 0;
                font-size: 21px;
                font-weight: 900;
                color: #0f172a;
              }
              .header-title-box h2 {
                margin: 0 0 4px 0;
                font-size: 16px;
                font-weight: 800;
                color: #b45309;
              }
              .header-title-box p {
                margin: 0;
                font-size: 13px;
                color: #475569;
                font-weight: 600;
              }
              .header-meta {
                text-align: left;
                font-size: 12.5px;
                color: #334155;
                line-height: 1.4;
              }

              /* Stats Summary Bar */
              .stats-bar {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 18px;
              }
              .stat-box {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 8px 12px;
                text-align: center;
              }
              .stat-box .stat-num {
                font-size: 17px;
                font-weight: 900;
                color: #0f172a;
              }
              .stat-box .stat-label {
                font-size: 12px;
                font-weight: 700;
                color: #475569;
              }

              /* Alternating Session Strips */
              .sessions-container {
                display: flex;
                flex-direction: column;
                gap: 12px;
              }
              .session-strip {
                border-radius: 10px;
                padding: 14px 16px;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                transition: all 0.2s;
              }
              /* Strip Color 1 (Odd rows): White */
              .strip-color-1 {
                background-color: #ffffff;
                border: 1.5px solid #cbd5e1;
                border-right: 6px solid #0f172a;
              }
              /* Strip Color 2 (Even rows): Soft Slate Gray */
              .strip-color-2 {
                background-color: #f1f5f9;
                border: 1.5px solid #94a3b8;
                border-right: 6px solid #475569;
              }

              /* Strip Top Header */
              .strip-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 8px;
                border-bottom: 1px dashed #94a3b8;
                padding-bottom: 8px;
                margin-bottom: 10px;
              }
              .strip-header-right {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
              }
              .seq-badge {
                background: #0f172a;
                color: #ffffff;
                font-size: 13.5px;
                font-weight: 900;
                padding: 3px 10px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
              }
              .date-badge {
                font-size: 14px;
                font-weight: 800;
                color: #0f172a;
                background: #e2e8f0;
                padding: 3px 10px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
              }
              .type-badge {
                font-size: 13px;
                font-weight: 800;
                padding: 3px 10px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: #fed7aa;
                color: #9a3412;
                border: 1px solid #fdba74;
              }
              .type-badge.expert {
                background: #e0e7ff;
                color: #3730a3;
                border: 1px solid #c7d2fe;
              }
              .type-badge.detention {
                background: #fee2e2;
                color: #991b1b;
                border: 1px solid #fca5a5;
              }
              .type-badge.appeal {
                background: #fef3c7;
                color: #92400e;
                border: 1px solid #fde68a;
              }
              .type-badge.cassation {
                background: #f3e8ff;
                color: #6b21a8;
                border: 1px solid #e9d5ff;
              }
              .lawyer-badge {
                font-size: 13px;
                font-weight: 700;
                color: #1e293b;
                background: #e2e8f0;
                padding: 3px 10px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
              }

              /* Strip Body Grid */
              .strip-body {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 14px;
              }
              @media (max-width: 768px) {
                .strip-body {
                  grid-template-columns: 1fr;
                }
              }

              /* Info Cards Inside Strip */
              .info-card {
                background: rgba(255, 255, 255, 0.7);
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 13.5px;
              }
              .strip-color-1 .info-card {
                background: #f8fafc;
              }
              .strip-color-2 .info-card {
                background: #ffffff;
              }

              .card-title {
                font-size: 13.5px;
                font-weight: 800;
                color: #0f172a;
                margin-bottom: 6px;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 4px;
                display: flex;
                align-items: center;
                justify-content: space-between;
              }

              .data-row {
                margin-bottom: 4px;
                display: flex;
                align-items: flex-start;
                gap: 6px;
                line-height: 1.4;
              }
              .data-label {
                font-weight: 800;
                color: #334155;
                min-width: 85px;
                flex-shrink: 0;
              }
              .data-value {
                font-weight: 700;
                color: #0f172a;
                flex-grow: 1;
                word-break: break-word;
              }
              .highlight-case {
                font-size: 14.5px;
                font-weight: 900;
                color: #b45309;
              }

              /* Stage Badges inside card */
              .stage-tag {
                display: inline-block;
                padding: 2px 7px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 800;
                margin-left: 4px;
              }
              .stage-tag-first { background: #e2e8f0; color: #1e293b; border: 1px solid #cbd5e1; }
              .stage-tag-appeal { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
              .stage-tag-cassation { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
              .stage-tag-expert { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }

              /* Bottom Full-Width Section */
              .strip-footer {
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px solid #cbd5e1;
                display: flex;
                flex-direction: column;
                gap: 5px;
                font-size: 13.5px;
              }
              .subject-box {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 8px 10px;
              }
              .strip-color-2 .subject-box {
                background: #ffffff;
              }
              .decision-box {
                background: #ecfdf5;
                border: 1px solid #a7f3d0;
                color: #065f46;
                border-radius: 6px;
                padding: 8px 10px;
                font-weight: 700;
              }

              /* Print Media Rules */
              @media print {
                .action-bar {
                  display: none !important;
                }
                body {
                  padding: 0 !important;
                  background: #ffffff !important;
                }
                .session-strip {
                  margin-bottom: 12px !important;
                  box-shadow: none !important;
                }
              }
            </style>
          </head>
          <body>
            <!-- Action Bar (Hidden in Print) -->
            <div class="action-bar">
              <div>
                <strong style="font-size: 16px;">🖨️ معاينة طباعة رول الأجندة القضائية</strong>
                <span style="margin-right: 12px; font-size: 13px; color: #94a3b8;">(${totalCount} جلسة مدرجة)</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة الرول الآن / حفظ كـ PDF</button>
                <button class="btn-close" onclick="window.close()">✖️ إغلاق النافذة</button>
              </div>
            </div>

            <!-- Report Header -->
            <div class="header">
              <div class="header-title-box">
                <h1>مؤسسة رميح لأعمال المحاماة والاستشارات القانونية</h1>
                <h2>${printTitle}</h2>
                <p>${printSubtitle}</p>
              </div>
              <div class="header-meta">
                <div><strong>تاريخ الاستخراج:</strong> ${nowStr}</div>
                <div><strong>المستخدم:</strong> ${currentUser?.fullName || 'إدارة النظام'}</div>
                <div><strong>إجمالي الجلسات:</strong> ${totalCount} جلسة</div>
              </div>
            </div>

            <!-- Stats Bar -->
            <div class="stats-bar">
              <div class="stat-box">
                <div class="stat-num">${totalCount}</div>
                <div class="stat-label">إجمالي الجلسات</div>
              </div>
              <div class="stat-box">
                <div class="stat-num">${regularCount}</div>
                <div class="stat-label">جلسات المحاكم</div>
              </div>
              <div class="stat-box">
                <div class="stat-num">${expertCount}</div>
                <div class="stat-label">جلسات الخبراء</div>
              </div>
              <div class="stat-box">
                <div class="stat-num">${detentionCount}</div>
                <div class="stat-label">تجديدات الحبس والتحقيق</div>
              </div>
            </div>

            <!-- Sessions Container (Alternating Strips) -->
            <div class="sessions-container">
              ${sortedPrintData.length === 0 ? `
                <div style="text-align:center; padding: 40px; border: 2px dashed #cbd5e1; border-radius: 10px; font-size: 16px; font-weight: bold; color: #64748b;">
                  لا توجد جلسات مدرجة في هذا النطاق الزمني المحدد.
                </div>
              ` : 
                sortedPrintData.map((s, idx) => {
                  const c = cases.find(item => item.id === s.caseId);
                  const eff = getEffectiveStageInfo(c, s);

                  // Strip color class (Two alternating colors only)
                  const stripColorClass = (idx % 2 === 0) ? 'strip-color-1' : 'strip-color-2';

                  // Determine precise session type and badge
                  const isExp = isExpertSession(s);
                  const isDet = isDetentionSession(s) || !!s.isDetentionRenewal;
                  const isCas = (s.court && s.court.includes('نقض')) || (c && c.degree === 'نقض' && !isExp);
                  const isApp = (s.court && (s.court.includes('استئناف') || s.court.includes('مستأنف'))) || (c && c.degree === 'استئناف' && !isExp);

                  let sessionTypeBadge = `<span class="type-badge">⚖️ جلسة محكمة أول درجة</span>`;
                  if (isExp) {
                    sessionTypeBadge = `<span class="type-badge expert">🔍 جلسة خبراء ومباشرة</span>`;
                  } else if (isDet) {
                    sessionTypeBadge = `<span class="type-badge detention">🔒 تجديد حبس احتياطي</span>`;
                  } else if (isCas) {
                    sessionTypeBadge = `<span class="type-badge cassation">🏛️ جلسة طعن بالنقض</span>`;
                  } else if (isApp) {
                    sessionTypeBadge = `<span class="type-badge appeal">📜 جلسة استئناف</span>`;
                  }

                  // 1. First Instance Details
                  const firstNum = c?.caseNumberFirstInstance || s.caseNumber || 'غير مسجل';
                  const firstYear = c?.caseYearFirstInstance || s.caseYear || '';
                  const firstCourt = c?.courtFirstInstance || (c && !c.caseNumberSecondInstance && !c.cassationNumber ? c.court : '') || (s.court || 'المحكمة المختصة');
                  const firstCircuit = c?.circuitFirstInstance || (c && !c.caseNumberSecondInstance && !c.cassationNumber ? c.circuit : '') || (s.circuit || 'الدائرة المختصة');

                  // 2. Appeal Details (if exists)
                  const hasAppeal = !!(c?.caseNumberSecondInstance || c?.courtSecondInstance || (s.court && (s.court.includes('استئناف') || s.court.includes('مستأنف'))));
                  const appealNum = c?.caseNumberSecondInstance || (s.court?.includes('استئناف') ? s.caseNumber : '');
                  const appealYear = c?.caseYearSecondInstance || (s.court?.includes('استئناف') ? s.caseYear : '');
                  const appealCourt = c?.courtSecondInstance || (s.court?.includes('استئناف') ? s.court : 'محكمة الاستئناف');
                  const appealCircuit = c?.circuitSecondInstance || (s.court?.includes('استئناف') ? s.circuit : '');

                  // 3. Cassation Details (if exists)
                  const hasCassation = !!(c?.cassationNumber || c?.courtCassation || (s.court && s.court.includes('نقض')));
                  const cassationNum = c?.cassationNumber || (s.court?.includes('نقض') ? s.caseNumber : '');
                  const cassationYear = c?.cassationYear || (s.court?.includes('نقض') ? s.caseYear : '');
                  const cassationCourt = c?.courtCassation || (s.court?.includes('نقض') ? s.court : 'محكمة النقض');
                  const cassationCircuit = c?.circuitCassation || (s.court?.includes('نقض') ? s.circuit : '');

                  // 4. Investigation Details (if exists)
                  const hasInvestigation = !!(c?.investigationNumber || c?.isInvestigationActive || isDet);
                  const invNum = c?.investigationNumber || '';
                  const invYear = c?.investigationYear || '';
                  const invAuth = s.detentionAuthority || c?.investigationAuthority || '';

                  // 5. Expert Referral Details (if exists)
                  const hasExpertInfo = isExp || !!(c?.isReferredToExperts || c?.expertReferral?.isReferred);
                  const expertOffice = c?.expertReferral?.expertOffice || (isExp ? s.court : '');
                  const expertName = c?.expertReferral?.expertName || '';
                  const expertPhone = c?.expertReferral?.expertPhone || '';

                  // 6. Clients List
                  const mainClientName = s.clientName || c?.clientName || 'غير محدد';
                  const mainClientRole = (c?.clientsList && c.clientsList.length > 0 ? c.clientsList[0].role : '') || 'الموكل';
                  const extraClients = (c?.clientsList || []).filter(cl => cl.name && cl.name.trim() !== mainClientName.trim());

                  // 7. Opponents List (All opponents)
                  const mainOpponentName = s.opponentName || c?.opponent?.name || 'غير محدد';
                  const mainOpponentRole = c?.opponent?.role || 'الخصم';
                  const mainOpponentLawyer = c?.opponent?.lawyer || '';
                  const mainOpponentLawyerPhone = c?.opponent?.lawyerPhone || '';
                  const mainOpponentPhone = c?.opponent?.phone || '';
                  const extraOpponents = (c?.opponentsList || []).filter(op => op.name && op.name.trim() !== mainOpponentName.trim());

                  // Formatted Date and Time
                  const sessionFullDate = formatArabicDateWithDay(s.date);

                  return `
                    <div class="session-strip ${stripColorClass}">
                      <!-- Header Row of Strip -->
                      <div class="strip-header">
                        <div class="strip-header-right">
                          <span class="seq-badge">#${idx + 1}</span>
                          <span class="date-badge">📅 ${sessionFullDate} &nbsp;|&nbsp; ⏰ الساعة ${s.time || '09:00'}</span>
                          ${sessionTypeBadge}
                          ${c?.type ? `<span class="type-badge" style="background:#e2e8f0;color:#0f172a;border-color:#cbd5e1;">📁 نوع الدعوى: ${c.type}</span>` : ''}
                        </div>
                        <div>
                          <span class="lawyer-badge">👤 المحامي المكلف: <strong>${s.assignedLawyerName || 'غير محدد'}</strong></span>
                        </div>
                      </div>

                      <!-- Strip Body: 2 Balanced Columns -->
                      <div class="strip-body">
                        <!-- Right Column: Case Litigation Stages & Courts -->
                        <div class="info-card">
                          <div class="card-title">
                            <span>🏛️ بيانات القيد ومراحل التقاضي</span>
                            ${c?.officeFileNo ? `<span style="color:#b45309;font-size:12.5px;font-weight:900;">ملف مكتب: ${c.officeFileNo}</span>` : ''}
                          </div>

                          <!-- First Instance Block -->
                          <div class="data-row">
                            <span class="data-label"><span class="stage-tag stage-tag-first">أول درجة</span></span>
                            <span class="data-value highlight-case">رقم ${firstNum} لسنة ${firstYear}</span>
                          </div>
                          <div class="data-row" style="margin-bottom: 6px;">
                            <span class="data-label" style="font-size:12px;color:#64748b;">المحكمة والدائرة:</span>
                            <span class="data-value" style="font-size:12.5px;color:#334155;">${firstCourt} - الدائرة: ${firstCircuit}</span>
                          </div>

                          <!-- Appeal Block (if exists) -->
                          ${hasAppeal ? `
                            <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                              <span class="data-label"><span class="stage-tag stage-tag-appeal">الاستئناف</span></span>
                              <span class="data-value highlight-case" style="color:#92400e;">رقم ${appealNum || 'قيد الاستئناف'} لسنة ${appealYear || ''}</span>
                            </div>
                            <div class="data-row" style="margin-bottom: 6px;">
                              <span class="data-label" style="font-size:12px;color:#64748b;">المحكمة والدائرة:</span>
                              <span class="data-value" style="font-size:12.5px;color:#334155;">${appealCourt} - الدائرة: ${appealCircuit || 'غير محدد'}</span>
                            </div>
                          ` : ''}

                          <!-- Cassation Block (if exists) -->
                          ${hasCassation ? `
                            <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                              <span class="data-label"><span class="stage-tag stage-tag-cassation">النقض</span></span>
                              <span class="data-value highlight-case" style="color:#6b21a8;">طعن رقم ${cassationNum || 'قيد الطعن'} لسنة ${cassationYear || ''}</span>
                            </div>
                            <div class="data-row" style="margin-bottom: 6px;">
                              <span class="data-label" style="font-size:12px;color:#64748b;">المحكمة والدائرة:</span>
                              <span class="data-value" style="font-size:12.5px;color:#334155;">${cassationCourt} - الدائرة: ${cassationCircuit || 'غير محدد'}</span>
                            </div>
                          ` : ''}

                          <!-- Investigation Block (if exists) -->
                          ${hasInvestigation ? `
                            <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                              <span class="data-label"><span class="stage-tag stage-tag-first">التحقيق</span></span>
                              <span class="data-value" style="color:#991b1b;font-weight:bold;">محضر رقم ${invNum || 'غير مسجل'} لسنة ${invYear || ''} (${invAuth || 'النيابة العامة'})</span>
                            </div>
                          ` : ''}

                          <!-- Expert Block (if exists) -->
                          ${hasExpertInfo ? `
                            <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                              <span class="data-label"><span class="stage-tag stage-tag-expert">مكتب الخبراء</span></span>
                              <span class="data-value" style="color:#3730a3;font-weight:bold;">${expertOffice || 'مكتب الخبراء المختص'} ${expertName ? `(الخبير: ${expertName}${expertPhone ? ' - هاتف: ' + expertPhone : ''})` : ''}</span>
                            </div>
                          ` : ''}

                          <!-- Current Hearing Location -->
                          <div class="data-row" style="border-top: 1.5px solid #cbd5e1; padding-top: 6px; margin-top: 6px;">
                            <span class="data-label" style="color:#0f172a;font-weight:900;">📍 مقر الجلسة:</span>
                            <span class="data-value" style="color:#0f172a;font-weight:800;">${s.court} &nbsp;|&nbsp; الدائرة: ${s.circuit || 'الرئيسية'}</span>
                          </div>
                        </div>

                        <!-- Left Column: Parties (Clients & All Opponents) -->
                        <div class="info-card">
                          <div class="card-title">
                            <span>👥 أطراف الدعوى والخصوم</span>
                          </div>

                          <!-- Clients Section -->
                          <div class="data-row">
                            <span class="data-label" style="color:#065f46;">👤 الموكل(ون):</span>
                            <div class="data-value">
                              <span style="font-weight:900;color:#065f46;">${mainClientName}</span> 
                              ${mainClientRole ? `<small style="color:#047857;">(${mainClientRole})</small>` : ''}
                              ${extraClients.length > 0 ? `
                                <div style="font-size:12.5px;color:#047857;margin-top:2px;">
                                  ${extraClients.map(ec => `+ ${ec.name} ${ec.role ? '(' + ec.role + ')' : ''}`).join(' ، ')}
                                </div>
                              ` : ''}
                            </div>
                          </div>

                          <!-- Opponents Section (All Opponents with Lawyers) -->
                          <div class="data-row" style="border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 6px;">
                            <span class="data-label" style="color:#991b1b;">⚖️ الخصوم:</span>
                            <div class="data-value">
                              <span style="font-weight:900;color:#991b1b;">${mainOpponentName}</span> 
                              ${mainOpponentRole ? `<small style="color:#b91c1c;">(${mainOpponentRole})</small>` : ''}
                              ${mainOpponentLawyer ? `
                                <div style="font-size:12.5px;color:#7f1d1d;margin-top:2px;">
                                  محامي الخصم: <strong>${mainOpponentLawyer}</strong> ${mainOpponentLawyerPhone ? `(هاتف: ${mainOpponentLawyerPhone})` : ''}
                                </div>
                              ` : ''}
                              ${mainOpponentPhone ? `<div style="font-size:12px;color:#7f1d1d;">هاتف الخصم: ${mainOpponentPhone}</div>` : ''}

                              <!-- Extra Opponents -->
                              ${extraOpponents.length > 0 ? `
                                <div style="font-size:12.5px;color:#991b1b;margin-top:4px;border-top:1px dotted #fca5a5;padding-top:2px;">
                                  ${extraOpponents.map(eop => `
                                    <div>+ <strong>${eop.name}</strong> ${eop.role ? '(' + eop.role + ')' : ''} ${eop.lawyer ? `- محاميه: ${eop.lawyer}` : ''}</div>
                                  `).join('')}
                                </div>
                              ` : ''}
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Bottom Full-Width Details: Subject, Requests, Decisions & Notes -->
                      <div class="strip-footer">
                        <div class="subject-box">
                          <div style="font-weight:800;color:#0f172a;margin-bottom:2px;">
                            🎯 موضوع الجلسة والطلبات المحددة:
                          </div>
                          <div style="font-weight:700;color:#1e293b;line-height:1.4;">
                            ${s.subject || 'حضور ومرافعة وتقديم مذكرات ومستندات'}
                          </div>
                          ${s.requirements ? `
                            <div style="font-size:12.5px;color:#b45309;font-weight:700;margin-top:3px;">
                              📌 المطلوب بالجلسة: ${s.requirements}
                            </div>
                          ` : ''}
                        </div>

                        ${s.decision ? `
                          <div class="decision-box">
                            <div><strong>⚖️ القرار الصادر بالجلسة:</strong> ${s.decision}</div>
                            ${s.nextHearingDate ? `<div style="margin-top:3px;font-size:13px;color:#065f46;"><strong>📅 تأجلت لجلسة:</strong> ${formatArabicDateWithDay(s.nextHearingDate)} (${s.nextHearingDate})</div>` : ''}
                          </div>
                        ` : ''}

                        ${s.notes && s.notes !== s.subject ? `
                          <div style="font-size:12.5px;color:#475569;font-weight:600;padding:2px 4px;">
                            📝 ملاحظات: ${s.notes}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')
              }
            </div>

            <script>
              window.onload = function() {
                // Auto trigger print dialogue
                setTimeout(function() {
                  window.print();
                }, 350);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const renderSessionStatusAndActions = (session: HearingSession) => {
    const isDecisionRecorded = !!session.decision || session.status === 'completed';
    const isToday = session.date === todayStr;
    const isPast = session.date < todayStr;
    const isFuture = session.date > todayStr;
    const isPostponed = session.status === 'postponed' || (session.decision && session.nextHearingDate);

    const hasRecordedDecisionOnSameDate = sessions.some(
      s => s.id !== session.id && s.caseId === session.caseId && s.date === session.date && (!!s.decision || s.status === 'completed')
    );

    // Status Badge
    let statusBadge = null;
    if (isDecisionRecorded) {
      statusBadge = (
        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </span>
          <span>تم تسجيل القرار</span>
        </span>
      );
    } else if (isPostponed) {
      statusBadge = (
        <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
          <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
          </span>
          <span>جلسة مؤجلة</span>
        </span>
      );
    } else if (isToday) {
      statusBadge = (
        <span className="text-xs font-black text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
          <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-800 animate-spin-slow" />
          </span>
          <span>الجلسة اليوم</span>
        </span>
      );
    } else if (isFuture) {
      statusBadge = (
        <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
          <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
          </span>
          <span>جلسة قادمة</span>
        </span>
      );
    } else if (isPast) {
      statusBadge = (
        <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
          <span className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </span>
          <span>جلسة سابقة (بانتظار القرار)</span>
        </span>
      );
    }

    // Buttons/Actions
    return (
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        {/* 1. Status Badge */}
        {statusBadge}

        {/* 2. Edit button */}
        {currentUser?.permissions?.editSession && (
          <button
            onClick={() => handleOpenEditSession(session)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 border border-slate-200/80"
            title="تعديل تفاصيل الجلسة يدوياً"
          >
            <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
              <Edit className="w-3 h-3 text-slate-600" />
            </span>
            <span>تعديل</span>
          </button>
        )}

        {/* 3. Record or View Decision Button */}
        {(() => {
          if (isDecisionRecorded) {
            return (
              <button
                onClick={() => handleOpenOutcome(session)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95"
                title="عرض واستعراض قرار الجلسة وتفاصيله"
              >
                <span className="w-4 h-4 rounded-full bg-emerald-200/80 flex items-center justify-center shrink-0">
                  <FileText className="w-3 h-3 text-emerald-800" />
                </span>
                <span>استعراض القرار</span>
              </button>
            );
          } else if (hasRecordedDecisionOnSameDate) {
            return (
              <span className="text-xs text-amber-900 font-bold bg-amber-50 border border-amber-300/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
                <span>⚠️ تم تسجيل قرار اليوم هذه القضية</span>
              </span>
            );
          } else if (isToday || isPast) {
            return currentUser?.permissions?.recordSessionDecision ? (
              <button
                onClick={() => handleOpenOutcome(session)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <span className="w-4 h-4 rounded-full bg-amber-400/80 flex items-center justify-center shrink-0">
                  <Gavel className="w-3 h-3 text-slate-950" />
                </span>
                <span>تسجيل القرار</span>
              </button>
            ) : null;
          } else {
            return (
              <span className="text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                <span>⏳ لم يحن موعد الجلسة</span>
              </span>
            );
          }
        })()}

        {/* 4. Delete Session Button */}
        {currentUser?.permissions?.deleteSession !== false && (
          <button
            onClick={() => {
              const confirmDelete = window.confirm(`هل أنت تأكد من حذف جلسة القضية (${session.caseNumber || ''}) المنعقدة بتاريخ (${session.date}) نهائياً؟`);
              if (!confirmDelete) return;
              if (onDeleteSession) {
                onDeleteSession(session.id);
              }
            }}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95"
            title="حذف الجلسة نهائياً من الأجندة"
          >
            <span className="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <Trash2 className="w-3 h-3 text-rose-600" />
            </span>
            <span>حذف</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-fadeIn" dir="rtl">
      
      {/* Visual Header KPI Metric Dashboard Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-800 relative overflow-hidden">
        {/* Subtle decorative glow elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  أجندة رول الجلسات القضائية
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  متابعة دقيقة لمواعيد الجلسات، القضايا، الرول اليومي، وتسجيل القرارات القضائية فور صدورها
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
            {currentUser.permissions.addSession && (
              <button
                onClick={() => {
                  const activeCases = cases.filter(c => !c.isArchived);
                  if (activeCases.length === 0) {
                    alert('يرجى أولاً إدخال قضايا نشطة لتتمكن من جدولة جلسات لها.');
                    return;
                  }
                  const firstCase = activeCases[0];
                  setSelectedCaseId(firstCase.id);
                  setNewSessionCourt(firstCase.court || '');
                  setNewSessionCircuit(firstCase.circuit || '');
                  setNewSessionDate(todayStr);
                  setNewSessionTime('09:00');
                  setNewSessionSubject('');
                  setNewSessionLawyer('');
                  setShowAddModal(true);
                }}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <div className="w-5 h-5 bg-amber-400/80 rounded-full flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 text-slate-950" />
                </div>
                <span>إضافة جلسة للرول</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 relative z-10">
          
          <div 
            onClick={() => setFilterCategory('all')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              filterCategory === 'all'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/30'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">إجمالي الجلسات</span>
              <strong className="text-base sm:text-lg font-black text-white">{toAr(totalSessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-slate-700/50 rounded-full flex items-center justify-center text-slate-300 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div 
            onClick={() => setFilterCategory('detention')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              filterCategory === 'detention'
                ? 'bg-rose-500/30 border-rose-400 text-rose-200 ring-2 ring-rose-400/40'
                : 'bg-slate-800/60 border-rose-900/40 hover:bg-rose-950/40'
            }`}
          >
            <div>
              <span className="text-[10px] text-rose-300 font-bold block flex items-center gap-1">
                تجديد الحبس 🔒
              </span>
              <strong className="text-base sm:text-lg font-black text-rose-400">{toAr(detentionSessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          <div 
            onClick={() => setFilterCategory('expert')}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
              filterCategory === 'expert'
                ? 'bg-indigo-500/30 border-indigo-400 text-indigo-200 ring-2 ring-indigo-400/40'
                : 'bg-slate-800/60 border-indigo-900/40 hover:bg-indigo-950/40'
            }`}
          >
            <div>
              <span className="text-[10px] text-indigo-300 font-bold block">جلسات الخبراء ⚖️</span>
              <strong className="text-base sm:text-lg font-black text-indigo-300">{toAr(expertSessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
            todaySessionsCount > 0 
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/30' 
              : 'bg-slate-800/60 border-slate-700/60'
          }`}>
            <div>
              <span className="text-[10px] text-amber-200/80 block font-medium">جلسات اليوم 🔥</span>
              <strong className="text-base sm:text-lg font-black text-amber-400">{toAr(todaySessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
            tomorrowSessionsCount > 0 
              ? 'bg-amber-600/30 border-amber-400/80 text-amber-300 ring-2 ring-amber-400/30 animate-pulse' 
              : 'bg-slate-800/60 border-slate-700/60'
          }`}>
            <div>
              <span className="text-[10px] text-amber-200/90 block font-medium">جلسات الغد 🔔</span>
              <strong className="text-base sm:text-lg font-black text-amber-300">{toAr(tomorrowSessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-300/80 block font-medium">جلسات قادمة 🔵</span>
              <strong className="text-base sm:text-lg font-black text-blue-400">{toAr(upcomingSessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-300/80 block font-medium">تم تسجيل القرار 🟢</span>
              <strong className="text-base sm:text-lg font-black text-emerald-400">{toAr(completedSessionsCount)}</strong>
            </div>
            <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>

          <div 
            onClick={() => {
              const el = document.getElementById('unrecorded-sessions-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
              unrecordedSessionsCount > 0 
                ? 'bg-gradient-to-r from-rose-950/80 to-slate-900 border-2 border-rose-500 text-white shadow-lg ring-2 ring-rose-500/40 hover:border-rose-400' 
                : 'bg-slate-800/80 border border-slate-700/80'
            }`}
            title="الانتقال إلى قسم جلسات بانتظار تسجيل القرار"
          >
            <div>
              <span className="text-xs text-rose-300 block font-black flex items-center gap-1">
                <span>لم يُسجل قرارها</span>
                <span className="animate-pulse text-rose-400">⚠️</span>
              </span>
              <strong className="text-lg sm:text-xl font-black text-white block mt-0.5" style={{ color: '#ffffff' }}>
                {toAr(unrecordedSessionsCount)} <span className="text-xs font-bold text-rose-200">جلسة</span>
              </strong>
            </div>
            <div className="w-9 h-9 bg-rose-500/30 border border-rose-400/60 rounded-xl flex items-center justify-center text-rose-300 shrink-0 shadow-sm">
              <AlertCircle className="w-5 h-5 text-rose-300 animate-pulse" />
            </div>
          </div>

        </div>
      </div>

      {/* Tomorrow Hearings Alert Banner */}
      {(() => {
        const tomorrowSessionsList = filteredSessions.filter(s => s.date === tomorrowStr);

        return (
          <div className={`rounded-2xl p-4 transition-all border shadow-2xs ${
            tomorrowSessionsCount > 0 
              ? 'bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 border-amber-300/80 ring-1 ring-amber-400/20' 
              : 'bg-slate-50 border-slate-200/90'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  tomorrowSessionsCount > 0 ? 'bg-amber-100 border border-amber-300 text-amber-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  <ShieldAlert className={`w-5 h-5 ${tomorrowSessionsCount > 0 ? 'text-amber-700 animate-bounce' : 'text-slate-500'}`} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-2">
                    <span>تنبيه جلسات الغد</span>
                    <span className="text-xs font-mono font-bold text-amber-950 bg-amber-200/90 border border-amber-300 px-2.5 py-0.5 rounded-full">
                      {getDynamicDateString(tomorrowObj, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </h3>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {tomorrowSessionsCount > 0
                      ? `يوجد عدد (${toAr(tomorrowSessionsCount)}) جلسات قضائية مجدولة ليوم الغد بجدول الأجندة والرول.`
                      : `لا توجد جلسات مجدولة ليوم الغد (${tomorrowStr}).`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => {
                    setViewMode('daily');
                    setCurrentDateState(tomorrowObj);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2 px-3.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="الانتقال إلى أجندة يوم الغد فوراً"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>عرض رول الغد ({toAr(tomorrowSessionsCount)})</span>
                </button>
              </div>
            </div>

            {/* List of Tomorrow Sessions if any */}
            {tomorrowSessionsList.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-[11px] font-black text-amber-950 block mb-1">
                  📋 الجلسات المقرر عقدها غداً ({toAr(tomorrowSessionsList.length)}):
                </span>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pl-1">
                  {tomorrowSessionsList.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      cases={cases}
                      currentUser={currentUser}
                      todayStr={todayStr}
                      sessions={sessions}
                      onOpenOutcome={handleOpenOutcome}
                      onOpenEditSession={handleOpenEditSession}
                      onDeleteSession={onDeleteSession}
                      onSearchCase={onSearchCase}
                      onNavigateToTab={onNavigateToTab}
                      onOpenCaseFile={onOpenCaseFile}
                      onOpenDetentionModal={(c) => setDetentionModalCase(c)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Search and Action Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Smart Search */}
          <div className="relative flex-1">
            <span className="absolute right-3.5 top-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="البحث بأجندة الجلسات: التاريخ، المحكمة، الموكل، رقم القضية، المحامي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white placeholder:text-slate-400 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="تصفية بالمحكمة يدوياً..."
                value={filterCourt === 'الكل' ? '' : filterCourt}
                onChange={(e) => setFilterCourt(e.target.value || 'الكل')}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white placeholder:text-slate-400 w-44 text-right font-medium"
              />
              {filterCourt !== 'الكل' && filterCourt !== '' && (
                <button
                  type="button"
                  onClick={() => setFilterCourt('الكل')}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                  title="مسح الفلترة"
                >
                  ✕
                </button>
              )}
            </div>

            <div>
              <select
                value={filterLawyer}
                onChange={(e) => setFilterLawyer(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white font-medium text-slate-700"
              >
                <option value="الكل">كل المحامين</option>
                {distinctLawyers.map(l => (
                  <option key={l.id} value={l.id}>{l.fullName}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* Discovered Sessions Pending Integration Banner */}
      {discoveredSessions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-2xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-amber-700 animate-spin-slow" />
              </div>
              <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                رصد جلسات ذكية معلّقة لم يتم ضمها لجدول الأجندة ({filteredDiscoveredSessions.length} من {discoveredSessions.length})
              </h4>
            </div>
            <span className="text-[10px] text-amber-950 bg-amber-300 border border-amber-400 px-2.5 py-0.5 rounded-full font-black shadow-3xs">
              مزامنة فورية
            </span>
          </div>

          {filteredDiscoveredSessions.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs font-medium">
              <p>لا توجد جلسات مرصودة معلقة تطابق كلمة البحث.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
              {filteredDiscoveredSessions.map((item, idx) => {
                const eff = getEffectiveStageInfo(item.caseObj);
                return (
                <div 
                  key={idx} 
                  className="bg-white border border-amber-200/80 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-3xs hover:border-amber-500 transition-all"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                        قضية {eff.caseNumber || item.caseObj.caseNumberFirstInstance} ({eff.badgeText})
                      </span>
                      <span className="text-[9px] font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                        {item.fileDate}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-900 truncate">{item.caseObj.clientName}</p>
                    <p className="text-[9px] text-slate-500 truncate font-mono">الملف: {item.file.name}</p>
                  </div>

                  <button
                    onClick={() => handleAddSingleDiscoveredSession(item)}
                    className="bg-slate-950 hover:bg-slate-800 text-amber-400 font-bold text-[10px] py-1.5 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all shrink-0 active:scale-95 shadow-3xs"
                  >
                    <Plus className="w-3 h-3 text-amber-400" />
                    <span>ضم</span>
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Agenda Section: Calendar Controls & Views */}
      <div className="space-y-6">

      {/* Calendar View Controls Bar */}
      <div className="re-dark-panel bg-gradient-to-br from-slate-900 via-[#0e1d33] to-slate-900 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col xl:flex-row items-center justify-between gap-4 shadow-xl text-white">
        
        {/* Navigation buttons & Current Date Display */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 w-full xl:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 p-1 rounded-2xl shadow-inner">
            <button 
              onClick={handlePrev}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
              title="السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <button 
              onClick={handleNext}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
              title="التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <span className="font-black text-white text-xs sm:text-sm md:text-base px-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl shadow-xs text-center" style={{ color: '#ffffff' }}>
            {viewMode === 'daily' && `رول يوم: ${getDynamicDateString(currentDateState, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
            {viewMode === 'weekly' && `أسبوع: ${getDynamicDateString(weekDays[0], { month: 'short', day: 'numeric' })} - ${getDynamicDateString(weekDays[6], { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'monthly' && `${getDynamicDateString(currentDateState, { month: 'long', year: 'numeric' })}`}
            {viewMode === 'yearly' && `عام: ${toAr(currentDateState.getFullYear())}`}
          </span>

          <button 
            onClick={handleGoToToday}
            className="text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black border border-amber-400/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
          >
            اليوم القضائي
          </button>
        </div>

        {/* Print Options */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full xl:w-auto">
          <button
            onClick={() => handlePrintAgenda('today')}
            className="bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 text-xs sm:text-sm py-2 px-3 sm:px-3.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="طباعة رول جدول جلسات اليوم"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>طباعة اليوم</span>
          </button>
          <button
            onClick={() => handlePrintAgenda('week')}
            className="bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 text-xs sm:text-sm py-2 px-3 sm:px-3.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="طباعة رول جدول جلسات الأسبوع"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>طباعة الأسبوع</span>
          </button>
          <button
            onClick={() => handlePrintAgenda('month')}
            className="bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 text-xs sm:text-sm py-2 px-3 sm:px-3.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="طباعة رول جدول جلسات الشهر بالكامل"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>طباعة الشهر</span>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex flex-wrap items-center justify-center bg-slate-950/90 p-1.5 rounded-xl border border-slate-700/80 shadow-inner gap-1 w-full xl:w-auto">
          <button
            onClick={() => setViewMode('daily')}
            className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-lg font-black transition-all duration-200 cursor-pointer ${
              viewMode === 'daily' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md border border-amber-400/50' 
                : 'text-slate-200 hover:text-white hover:bg-slate-800/60 font-bold'
            }`}
          >
            عرض يومي
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-lg font-black transition-all duration-200 cursor-pointer ${
              viewMode === 'weekly' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md border border-amber-400/50' 
                : 'text-slate-200 hover:text-white hover:bg-slate-800/60 font-bold'
            }`}
          >
            عرض أسبوعي
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-lg font-black transition-all duration-200 cursor-pointer ${
              viewMode === 'monthly' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md border border-amber-400/50' 
                : 'text-slate-200 hover:text-white hover:bg-slate-800/60 font-bold'
            }`}
          >
            شهري (التقويم)
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`text-xs sm:text-sm px-3.5 py-1.5 rounded-lg font-black transition-all duration-200 cursor-pointer ${
              viewMode === 'yearly' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md border border-amber-400/50' 
                : 'text-slate-200 hover:text-white hover:bg-slate-800/60 font-bold'
            }`}
          >
            عرض سنوي
          </button>
        </div>

      </div>

      {/* Main Agenda Views Content */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 min-h-[420px] shadow-2xs">
        
        {searchQuery.trim() !== '' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Search className="w-3.5 h-3.5 text-amber-700" />
                </div>
                <span>نتائج البحث العام في الأجندة ورصد الجلسات ({filteredSessions.length} جلسة مطابقة)</span>
              </h3>
              <button 
                onClick={() => setSearchQuery('')} 
                className="text-xs text-amber-700 hover:text-amber-900 font-bold"
              >
                مسح البحث والعودة للتقويم
              </button>
            </div>
            
            {filteredSessions.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold">لا توجد أي جلسات تطابق كلمة البحث "{searchQuery}" في الأجندة.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    cases={cases}
                    currentUser={currentUser}
                    todayStr={todayStr}
                    sessions={sessions}
                    onOpenOutcome={handleOpenOutcome}
                    onOpenEditSession={handleOpenEditSession}
                    onDeleteSession={onDeleteSession}
                    onSearchCase={onSearchCase}
                    onNavigateToTab={onNavigateToTab}
                    onOpenCaseFile={onOpenCaseFile}
                    onOpenDetentionModal={(c, initDate) => {
                      setDetentionModalCase(c);
                      setDetentionModalInitialDate(initDate);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* VIEW: DAILY */}
            {viewMode === 'daily' && (
              <div className="space-y-4">
                {dailySessionsList.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl space-y-3">
                    <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold">لا توجد جلسات مجدولة ليوم {dateFormattedStr} في الأجندة الفلترية.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {dailySessionsList.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        cases={cases}
                        currentUser={currentUser}
                        todayStr={todayStr}
                        sessions={sessions}
                        onOpenOutcome={handleOpenOutcome}
                        onOpenEditSession={handleOpenEditSession}
                        onDeleteSession={onDeleteSession}
                        onSearchCase={onSearchCase}
                        onNavigateToTab={onNavigateToTab}
                        onOpenCaseFile={onOpenCaseFile}
                        onOpenDetentionModal={(c, initDate) => {
                          setDetentionModalCase(c);
                          setDetentionModalInitialDate(initDate);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW: WEEKLY */}
            {viewMode === 'weekly' && (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const dayStr = getLocalYYYYMMDD(day);
                  const daySessions = filteredSessions.filter(s => s.date === dayStr);
                  const isToday = dayStr === todayStr;

                  return (
                    <div 
                      key={dayStr} 
                      className={`p-3 rounded-2xl border flex flex-col justify-between min-h-[170px] transition-all ${
                        isToday 
                          ? 'bg-amber-500/10 border-amber-400 shadow-xs ring-1 ring-amber-400/30' 
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                          <span className={`text-xs font-black ${isToday ? 'text-amber-950' : 'text-slate-800'}`}>
                            {getDynamicDateString(day, { weekday: 'short' })}
                          </span>
                          <span className={`text-[10px] font-mono font-bold ${
                            isToday 
                              ? 'bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-lg shadow-3xs' 
                              : 'text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200'
                          }`}>
                            {toAr(day.getDate())}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {daySessions.map((s) => {
                            const parentCase = cases.find(c => c.id === s.caseId);
                            const eff = getEffectiveStageInfo(parentCase, s);
                            return (
                            <div 
                              key={s.id} 
                              onClick={() => {
                                setViewMode('daily');
                                setCurrentDateState(day);
                              }}
                              className={`p-2 rounded-xl border text-[10px] transition-all cursor-pointer ${
                                s.status === 'completed' || !!s.decision
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                  : isToday
                                    ? 'bg-white border-amber-300 hover:border-amber-500 shadow-3xs'
                                    : 'bg-white border-slate-200 hover:border-blue-400 shadow-3xs'
                              }`}
                            >
                              <span className="font-black text-slate-900 block truncate">
                                🕒 {s.time} - قضية {eff.caseNumber || s.caseNumber}
                              </span>
                              <span className="text-slate-600 font-bold block truncate">{s.clientName}</span>
                              <span className="text-slate-500 block truncate text-[9px]">{eff.court} ({eff.badgeText})</span>
                            </div>
                            );
                          })}
                          {daySessions.length === 0 && (
                            <span className="text-[10px] text-slate-400 block text-center py-6 font-medium">لا توجد جلسات</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW: MONTHLY (CALENDAR) */}
            {viewMode === 'monthly' && (
              <div className="space-y-4">
                
                {/* Days header standard Sat to Fri */}
                <div className="grid grid-cols-7 gap-1.5 text-center font-black text-xs text-slate-700 mb-2 border-b border-slate-200 pb-2.5">
                  <div>السبت</div>
                  <div>الأحد</div>
                  <div>الاثنين</div>
                  <div>الثلاثاء</div>
                  <div>الأربعاء</div>
                  <div>الخميس</div>
                  <div>الجمعة</div>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {monthCells.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/20 rounded-xl min-h-[85px]" />;
                    
                    const dStr = getLocalYYYYMMDD(day);
                    const daySessions = filteredSessions.filter(s => s.date === dStr);
                    const isToday = dStr === todayStr;

                    return (
                      <div
                        key={dStr}
                        onClick={() => {
                          setViewMode('daily');
                          setCurrentDateState(day);
                        }}
                        className={`p-2 rounded-xl border min-h-[95px] flex flex-col justify-between transition-all cursor-pointer ${
                          isToday 
                            ? 'bg-gradient-to-b from-amber-500/20 to-amber-50/50 border-amber-400 ring-1 ring-amber-400/20 shadow-xs' 
                            : 'bg-slate-50/50 border-slate-200 hover:border-amber-400 hover:bg-white'
                        }`}
                      >
                        <span className={`text-[10px] font-mono font-black self-end ${
                          isToday 
                            ? 'bg-amber-500 text-slate-950 px-2 py-0.5 rounded-lg shadow-3xs' 
                            : 'text-slate-700'
                        }`}>
                          {day.getDate()}
                        </span>

                        <div className="mt-1 space-y-1">
                          {daySessions.slice(0, 2).map((s) => (
                            <span 
                              key={s.id} 
                              className={`block text-[9px] font-bold px-1.5 py-0.5 rounded-lg truncate shadow-3xs ${
                                s.status === 'completed' || !!s.decision 
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' 
                                  : 'bg-amber-100 text-amber-950 border border-amber-300/60'
                              }`}
                            >
                              {s.time} | {s.clientName}
                            </span>
                          ))}
                          {daySessions.length > 2 && (
                            <span className="text-[8px] text-amber-800 bg-amber-50 font-black block text-center rounded py-0.5">
                              +{daySessions.length - 2} جلسات أخرى
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW: YEARLY (ANNUAL CALENDAR) */}
            {viewMode === 'yearly' && (
              <div className="space-y-6">
                
                {/* Statistics Card for the Year */}
                {(() => {
                  const selectedYear = currentDateState.getFullYear();
                  const yearSessions = filteredSessions.filter(s => {
                    const sDate = new Date(s.date);
                    return sDate.getFullYear() === selectedYear;
                  });
                  const completedYearSessions = yearSessions.filter(s => s.status === 'completed' || !!s.decision);
                  const pendingYearSessions = yearSessions.filter(s => s.status !== 'completed' && !s.decision);

                  return (
                    <div className="bg-slate-900 text-white border border-slate-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center shadow-lg">
                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                        <span className="text-xs text-slate-400 block mb-1 font-medium">إجمالي الجلسات في {selectedYear}</span>
                        <strong className="text-xl text-white block font-black">{toAr(yearSessions.length)} جلسة</strong>
                      </div>
                      <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl">
                        <span className="text-xs text-emerald-300 block mb-1 font-medium">جلسات منجزة معتمدة</span>
                        <strong className="text-xl text-emerald-400 block font-black">{toAr(completedYearSessions.length)} جلسة</strong>
                      </div>
                      <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-xl">
                        <span className="text-xs text-amber-300 block mb-1 font-medium">جلسات قادمة / معلقة</span>
                        <strong className="text-xl text-amber-400 block font-black">{toAr(pendingYearSessions.length)} جلسة</strong>
                      </div>
                    </div>
                  );
                })()}

                {/* 12-Month Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 12 }).map((_, mIdx) => {
                    const year = currentDateState.getFullYear();
                    const monthDays = getSpecificMonthDays(year, mIdx);
                    
                    const monthSessions = filteredSessions.filter(s => {
                      const sDate = new Date(s.date);
                      return sDate.getFullYear() === year && sDate.getMonth() === mIdx;
                    });

                    const arabicMonthNames = [
                      'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)', 'مايو (5)', 'يونيو (6)',
                      'يوليو (7)', 'أغسطس (8)', 'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
                    ];

                    return (
                      <div 
                        key={mIdx} 
                        className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-3xs hover:border-amber-400 transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Month Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                            <h4 className="font-black text-slate-900 text-xs">
                              {arabicMonthNames[mIdx]}
                            </h4>
                            {monthSessions.length > 0 && (
                              <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full shadow-3xs">
                                {toAr(monthSessions.length)} جلسة
                              </span>
                            )}
                          </div>

                          {/* Mini Calendar Header (Days) */}
                          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-slate-500 mb-1">
                            <div>سبت</div>
                            <div>أحد</div>
                            <div>اثن</div>
                            <div>ثلا</div>
                            <div>أرب</div>
                            <div>خمي</div>
                            <div>جمع</div>
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1 text-center">
                            {monthDays.map((day, dIdx) => {
                              if (!day) return <div key={`empty-${mIdx}-${dIdx}`} className="aspect-square bg-slate-50/10" />;
                              
                              const dStr = getLocalYYYYMMDD(day);
                              const daySessions = filteredSessions.filter(s => s.date === dStr);
                              const hasSessions = daySessions.length > 0;
                              const isToday = dStr === todayStr;

                              return (
                                <button
                                  key={dStr}
                                  type="button"
                                  onClick={() => {
                                    setCurrentDateState(day);
                                    setViewMode('daily');
                                  }}
                                  title={`${getDynamicDateString(day, { day: 'numeric', month: 'numeric', year: 'numeric' })} - لديه ${toAr(daySessions.length)} جلسة`}
                                  className={`aspect-square rounded-lg text-[9px] font-mono flex items-center justify-center transition-all cursor-pointer ${
                                    isToday 
                                      ? 'bg-amber-500 text-slate-950 font-black scale-105 shadow-3xs ring-1 ring-amber-400' 
                                      : hasSessions 
                                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold border border-amber-300' 
                                        : 'text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {toAr(day.getDate())}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Month Sessions list quick peek if any */}
                        {monthSessions.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 max-h-[85px] overflow-y-auto">
                            {monthSessions.slice(0, 3).map(s => (
                              <div 
                                key={s.id}
                                onClick={() => {
                                  setCurrentDateState(new Date(s.date));
                                  setViewMode('daily');
                                }}
                                className="text-[8px] bg-slate-50 hover:bg-amber-50 hover:text-amber-950 rounded-lg p-1 flex justify-between gap-1 items-center cursor-pointer border border-slate-100 transition-colors"
                              >
                                <span className="font-bold truncate max-w-[85px]">{s.clientName}</span>
                                <span className="text-slate-500 text-[7px] font-mono whitespace-nowrap">{s.date.substring(5)}</span>
                              </div>
                            ))}
                            {monthSessions.length > 3 && (
                              <button
                                onClick={() => {
                                  setCurrentDateState(new Date(year, mIdx, 1));
                                  setViewMode('monthly');
                                }}
                                className="text-[8px] text-amber-700 hover:text-amber-900 font-bold block text-center w-full mt-1"
                              >
                                عرض كافة جلسات الشهر ({toAr(monthSessions.length)})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* قسم جلسات بانتظار تسجيل القرار (أسفل رول الجلسات مباشرة) */}
      <div id="unrecorded-sessions-section" className="re-dark-panel bg-[#091528] border-2 border-rose-500/50 rounded-2xl p-4 sm:p-6 text-white shadow-2xl space-y-4 transition-all">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/30 pb-4">
          <div className="flex items-center gap-3">
            {/* Animated visual alert badge */}
            <div className="relative flex items-center justify-center shrink-0">
              {unrecordedSessions.length > 0 && (
                <span className="absolute inline-flex h-10 w-10 rounded-full bg-rose-500/40 animate-ping" />
              )}
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center shadow-md">
                <AlertCircle className="w-5 h-5 text-white animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black !text-white leading-tight" style={{ color: '#ffffff' }}>
                  جلسات بانتظار تسجيل القرار
                </h3>
                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                  unrecordedSessions.length > 0
                    ? 'bg-rose-500/30 !text-rose-200 border border-rose-400/50 ring-1 ring-rose-500/30'
                    : 'bg-emerald-500/30 !text-emerald-200 border border-emerald-400/50'
                }`} style={{ color: unrecordedSessions.length > 0 ? '#fecdd3' : '#a7f3d0' }}>
                  {toAr(unrecordedSessions.length)} {unrecordedSessions.length === 1 ? 'جلسة' : 'جلسات'}
                </span>
              </div>
              <p className="text-xs !text-slate-200 mt-1 font-medium leading-relaxed" style={{ color: '#e2e8f0' }}>
                الجلسات المنتهية التي تقتضي تسديد قرار المحكمة أو منطوق الحكم لتحديث حالة القضية والسجل القضائي.
              </p>
            </div>
          </div>

          {unrecordedSessions.length > 0 && (
            <div className="text-left shrink-0">
              <span className="inline-flex items-center gap-2 text-xs !text-amber-200 font-bold bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-400/50 px-3.5 py-1.5 rounded-xl shadow-md" style={{ color: '#fef08a' }}>
                <Clock className="w-4 h-4 !text-amber-300" style={{ color: '#fde047' }} />
                <span>تتطلب إجراء تسديد القرار</span>
              </span>
            </div>
          )}
        </div>

        {/* Section Content */}
        {unrecordedSessions.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-800/50 border border-emerald-500/20 rounded-xl space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-emerald-300">
              جميع الجلسات المنتهية مسجّل قرارها رسمياً
            </p>
            <p className="text-xs text-slate-400">
              لا توجد أي جلسات متأخرة أو بانتظار تسديد المنطوق والقرار في الأجندة حالياً.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unrecordedSessions.map((session) => (
              <div key={session.id} className="relative group">
                <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-rose-500 rounded-r-2xl z-10" />
                <div className="bg-slate-900/95 border border-rose-500/30 hover:border-rose-500/60 rounded-2xl p-1 transition-all">
                  <SessionCard
                    session={session}
                    cases={cases}
                    currentUser={currentUser}
                    todayStr={todayStr}
                    sessions={sessions}
                    onOpenOutcome={handleOpenOutcome}
                    onOpenEditSession={handleOpenEditSession}
                    onDeleteSession={onDeleteSession}
                    onSearchCase={onSearchCase}
                    onNavigateToTab={onNavigateToTab}
                    onOpenCaseFile={onOpenCaseFile}
                    onOpenDetentionModal={(c) => setDetentionModalCase(c)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

      {/* Outcome Update Modal (بعد انتهاء الجلسة) */}
      {outcomeSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          {(() => {
            const outcomeParentCase = cases.find(c => c.id === outcomeSession.caseId);
            const isDet = isDetentionSession(outcomeSession, outcomeParentCase);
            const isExp = isExpertSession(outcomeSession);

            return (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isDet
                        ? 'bg-rose-100 border border-rose-300 text-rose-800'
                        : isExp 
                        ? 'bg-indigo-100 border border-indigo-300 text-indigo-800' 
                        : 'bg-amber-100 border border-amber-300 text-amber-800'
                    }`}>
                      {isDet ? <Lock className="w-4 h-4 text-rose-700" /> : isExp ? <Scale className="w-4 h-4 text-indigo-800" /> : <Gavel className="w-4 h-4 text-amber-800" />}
                    </div>
                    <span>
                      {isModalReadOnly
                        ? isDet
                          ? 'تفاصيل قرار جلسة تجديد الحبس الاحتياطي المعتمد'
                          : isExp
                          ? 'تفاصيل إجراء وقرار جلسة الخبراء المعتمد'
                          : 'تفاصيل قرار الجلسة والمنطوق المعتمد'
                        : isDet
                        ? `نموذج قرار جلسة تجديد الحبس الاحتياطي (قضية رقم ${outcomeSession.caseNumber})`
                        : isExp
                        ? `نموذج إثبات إجراء وقرار جلسة الخبير (قضية رقم ${outcomeSession.caseNumber})`
                        : `نموذج قرار الجلسة والطعن (قضية رقم ${outcomeSession.caseNumber})`}
                    </span>
                  </h3>
                  <button
                    onClick={() => setOutcomeSession(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleOutcomeSubmit} className="space-y-4">
                  {/* Detention-Specific Information Block */}
                  {isDet && (
                    <div className="bg-rose-50/90 border border-rose-200 p-3.5 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-black text-rose-900 border-b border-rose-200 pb-2">
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-rose-700" />
                          <span>بيانات الحبس الاحتياطي والتجديد</span>
                        </span>
                        <span className="text-[10px] bg-rose-200 text-rose-950 px-2 py-0.5 rounded-md">
                          تحديث تلقائي للملف والأجندة
                        </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ بداية الحبس</label>
                      <input
                        type="date"
                        value={outcomeDetentionStartDate}
                        onChange={(e) => setOutcomeDetentionStartDate(e.target.value)}
                        disabled={isModalReadOnly}
                        className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-mono font-bold text-slate-800 disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">مدة التجديد (يوم)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={outcomeDetentionDurationDays}
                          onChange={(e) => setOutcomeDetentionDurationDays(Number(e.target.value))}
                          disabled={isModalReadOnly}
                          className="w-16 px-2 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-mono font-bold text-center text-slate-800 disabled:bg-slate-100"
                        />
                        {!isModalReadOnly && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOutcomeDetentionDurationDays(4);
                                if (outcomeSession?.date) {
                                  const b = new Date(outcomeSession.date);
                                  if (!isNaN(b.getTime())) {
                                    b.setDate(b.getDate() + 4);
                                    setNextHearingDate(b.toISOString().split('T')[0]);
                                  }
                                }
                              }}
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                outcomeDetentionDurationDays === 4 ? 'bg-rose-700 text-white' : 'bg-white border border-rose-200 text-rose-900'
                              }`}
                            >
                              4ي
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOutcomeDetentionDurationDays(15);
                                if (outcomeSession?.date) {
                                  const b = new Date(outcomeSession.date);
                                  if (!isNaN(b.getTime())) {
                                    b.setDate(b.getDate() + 15);
                                    setNextHearingDate(b.toISOString().split('T')[0]);
                                  }
                                }
                              }}
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                outcomeDetentionDurationDays === 15 ? 'bg-rose-700 text-white' : 'bg-white border border-rose-200 text-rose-900'
                              }`}
                            >
                              15ي
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOutcomeDetentionDurationDays(45);
                                if (outcomeSession?.date) {
                                  const b = new Date(outcomeSession.date);
                                  if (!isNaN(b.getTime())) {
                                    b.setDate(b.getDate() + 45);
                                    setNextHearingDate(b.toISOString().split('T')[0]);
                                  }
                                }
                              }}
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                outcomeDetentionDurationDays === 45 ? 'bg-rose-700 text-white' : 'bg-white border border-rose-200 text-rose-900'
                              }`}
                            >
                              45ي
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم جلسة/قرار التجديد</label>
                      <input
                        type="text"
                        placeholder="مثال: 2 أو قرار رقم 5"
                        value={outcomeDetentionRenewalNumber}
                        onChange={(e) => setOutcomeDetentionRenewalNumber(e.target.value)}
                        disabled={isModalReadOnly}
                        className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">جهة ونوع التجديد القادم</label>
                    <select
                      value={outcomeDetentionNextAuthority}
                      onChange={(e) => setOutcomeDetentionNextAuthority(e.target.value)}
                      disabled={isModalReadOnly}
                      className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-900 disabled:bg-slate-100"
                    >
                      <option value="النيابة العامة">النيابة العامة</option>
                      <option value="تجديد جزئي">تجديد جزئي</option>
                      <option value="تجديد غرفة مشورة">تجديد غرفة مشورة</option>
                      <option value="تجديد جنايات">تجديد جنايات</option>
                      <option value="تجديد جنايات غرفة">تجديد جنايات غرفة</option>
                      <option value="تجديد 150 يوم">تجديد 150 يوم</option>
                      <option value="استئناف أمر الحبس">استئناف أمر الحبس</option>
                      {outcomeDetentionNextAuthority && !["النيابة العامة", "تجديد جزئي", "تجديد غرفة مشورة", "تجديد جنايات", "تجديد جنايات غرفة", "تجديد 150 يوم", "استئناف أمر الحبس"].includes(outcomeDetentionNextAuthority) && (
                        <option value={outcomeDetentionNextAuthority}>{outcomeDetentionNextAuthority}</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {isDetentionSession(outcomeSession) ? 'سلطة التحقيق / جهة التجديد' : isExpertSession(outcomeSession) ? 'مكتب أو جهة الخبراء' : 'المحكمة'}
                  </label>
                  {isModalReadOnly ? (
                    <input
                      type="text"
                      value={outcomeCourt}
                      readOnly
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-right font-bold text-slate-700"
                    />
                  ) : (
                    <CourtSelect
                      value={outcomeCourt}
                      onChange={setOutcomeCourt}
                      placeholder={isDetentionSession(outcomeSession) ? 'النيابة العامة / جهة التحقيق' : isExpertSession(outcomeSession) ? 'مكتب الخبراء المختص' : 'المحكمة المنعقدة أمامها'}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-right font-bold"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {isDetentionSession(outcomeSession) ? 'الدائرة / الغرفة' : isExpertSession(outcomeSession) ? 'مكان أو مقر المباشرة' : 'الدائرة (يدوياً)'}
                  </label>
                  <input
                    type="text"
                    value={outcomeCircuit}
                    onChange={(e) => setOutcomeCircuit(e.target.value)}
                    required
                    disabled={isModalReadOnly}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-600"
                    placeholder={isDetentionSession(outcomeSession) ? 'دائرة تجديد الحبس' : isExpertSession(outcomeSession) ? 'مقر الخبير أو موقع المعاينة' : 'الدائرة القضائية'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {isDetentionSession(outcomeSession)
                    ? 'قرار سلطة التحقيق / المحكمة في تجديد الحبس'
                    : isExpertSession(outcomeSession)
                    ? 'القرار أو الإجراء المتخذ بجلسة الخبير'
                    : 'منطوق قرار المحكمة (رول الجلسة)'}
                </label>
                <textarea
                  placeholder={
                    isDetentionSession(outcomeSession)
                      ? 'مثال: تجديد حبس المتهم 15 يوماً على ذمة التحقيقات مع مراعاة المواعيد القانونية...'
                      : isExpertSession(outcomeSession)
                      ? 'مثال: تم إيداع المستندات وتأجيل المباشرة للانتقال والمعاينة الميدانية...'
                      : 'مثال: التأجيل لجلسة 2 يوليو لتقديم المستندات والطب الشرعي أو الحكم التمهيدي...'
                  }
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  required
                  disabled={isModalReadOnly}
                  rows={2.5}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium disabled:bg-slate-100 disabled:text-slate-700"
                />

                {/* Quick decision buttons for Detention */}
                {isDetentionSession(outcomeSession) && !isModalReadOnly && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDecision('تجديد حبس المتهم 4 أيام على ذمة التحقيقات');
                        setOutcomeDetentionDurationDays(4);
                        if (outcomeSession?.date) {
                          const b = new Date(outcomeSession.date);
                          if (!isNaN(b.getTime())) {
                            b.setDate(b.getDate() + 4);
                            setNextHearingDate(b.toISOString().split('T')[0]);
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      تجديد 4 أيام
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecision('تجديد حبس المتهم 15 يوماً على ذمة التحقيقات');
                        setOutcomeDetentionDurationDays(15);
                        if (outcomeSession?.date) {
                          const b = new Date(outcomeSession.date);
                          if (!isNaN(b.getTime())) {
                            b.setDate(b.getDate() + 15);
                            setNextHearingDate(b.toISOString().split('T')[0]);
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      تجديد 15 يوماً
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecision('تجديد حبس المتهم 45 يوماً على ذمة التحقيقات');
                        setOutcomeDetentionDurationDays(45);
                        if (outcomeSession?.date) {
                          const b = new Date(outcomeSession.date);
                          if (!isNaN(b.getTime())) {
                            b.setDate(b.getDate() + 45);
                            setNextHearingDate(b.toISOString().split('T')[0]);
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      تجديد 45 يوماً
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('إخلاء سبيل المتهم بكفالة مالية')}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      إخلاء سبيل بكفالة
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('إخلاء سبيل المتهم بضمان محل إقامته')}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      إخلاء سبيل بضمان الإقامة
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('تأجيل نظر التجديد لتعذر إحضار المتهم من محبسه')}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      تأجيل لتعذر الإحضار
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('استمرار حبس المتهم')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                    >
                      استمرار الحبس
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {isExpertSession(outcomeSession) ? 'موعد جلسة الخبير القادمة (إن وجد)' : 'تاريخ الجلسة القادمة (إن وجد)'}
                  </label>
                  <input
                    type="date"
                    value={nextHearingDate}
                    onChange={(e) => setNextHearingDate(e.target.value)}
                    disabled={isModalReadOnly}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono disabled:bg-slate-100 disabled:text-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">حالة الجلسة الحالية</label>
                  <div className="text-xs bg-emerald-50 text-emerald-900 p-2.5 rounded-xl border border-emerald-200 font-black">
                    {isModalReadOnly
                      ? isExpertSession(outcomeSession)
                        ? '✓ إجراء معتمد ومثبت في سجل الخبير'
                        : '✓ قرار معتمد في ملف القضية والتحديثات منتهية'
                      : isExpertSession(outcomeSession)
                      ? '✓ سيتم قيدها كـ "جلسة خبرة منجزة ومسجلة"'
                      : '✓ سيتم قيدها كـ "مكتملة ومؤرشفة بالرول"'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
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
                  disabled={isModalReadOnly}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium disabled:bg-slate-100 disabled:text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
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
                  disabled={isModalReadOnly}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium disabled:bg-slate-100 disabled:text-slate-700"
                />
              </div>

              {/* Upload roll photo simulation */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300 text-center">
                <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto mb-1.5 shrink-0">
                  <Camera className="w-5 h-5 text-amber-800" />
                </div>
                <p className="text-xs font-black text-slate-900">
                  {isExpertSession(outcomeSession) ? 'صورة محضر جلسة الخبير أو قرار المعاينة' : 'صورة رول الجلسة أو منطوق الحكم المرفق'}
                </p>
                {!isModalReadOnly && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isExpertSession(outcomeSession) ? 'اضغط لمحاكاة التقاط صورة محضر الخبير أو الرفع' : 'اضغط لمحاكاة التقاط الصورة بالهاتف المحمول أو الرفع'}
                  </p>
                )}
                
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    type="text"
                    placeholder={isExpertSession(outcomeSession) ? 'مثال: expert_session_report.jpg' : 'مثال: roll_session_26_6.jpg'}
                    value={rollPhotoName}
                    onChange={(e) => setRollPhotoName(e.target.value)}
                    disabled={isModalReadOnly}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono w-56 disabled:bg-slate-100 disabled:text-slate-600 font-bold"
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
                        alert(isExpertSession(outcomeSession) ? 'تمت محاكاة إرفاق صورة محضر جلسة الخبير.' : 'تمت محاكاة رفع صورة رول الجلسة وإرفاقها بالمنطوق.');
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-1.5 px-3 rounded-xl cursor-pointer shadow-xs active:scale-95"
                    >
                      إرفاق الصورة
                    </button>
                  )}
                </div>

                {(isRollUploaded || (isModalReadOnly && rollPhotoName)) && (
                  <p className="text-[10px] text-emerald-700 font-black mt-2 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تم إرفاق رول الجلسة وصورة القرار بنجاح.</span>
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                {isModalReadOnly ? (
                  <span className="text-xs text-amber-900 font-black bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl">
                    🔒 المنطوق معتمد في السجل القضائي
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOutcomeSession(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    {isModalReadOnly ? 'إغلاق' : 'إلغاء'}
                  </button>
                  {!isModalReadOnly && (
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs px-5 py-2 rounded-xl shadow-md cursor-pointer active:scale-95"
                    >
                      حفظ وتحديث ملف القضية التلقائي
                    </button>
                  )}
                </div>
              </div>

            </form>
          </div>
            );
          })()}
        </div>
      )}

      {/* Modal: Quick Add Session */}
      <AddHearingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        cases={cases}
        users={users}
        onAddSession={async (newSess, detentionMeta) => {
          onAddSession(newSess);
          if (detentionMeta?.isDetention && onUpdateCase) {
            const targetCase = cases.find(c => c.id === newSess.caseId);
            if (targetCase) {
              const renId = detentionMeta.renewalId || newSess.detentionRenewalId || `ren-${Date.now()}`;
              const existingRenewals = targetCase.detentionRenewals || [];
              const updatedRenewals = [
                ...existingRenewals.filter(r => r.id !== renId),
                {
                  id: renId,
                  renewalDate: newSess.date,
                  date: newSess.date,
                  nextRenewalDate: '',
                  authority: detentionMeta.authority || 'النيابة العامة',
                  durationDays: detentionMeta.duration || 15,
                  notes: newSess.subject || 'جلسة تجديد حبس مضافة من أجندة الجلسات'
                }
              ];
              onUpdateCase({
                ...targetCase,
                isInvestigationActive: true,
                nextHearingDate: newSess.date,
                detentionRenewals: updatedRenewals
              });
            }
          }
          setShowAddModal(false);
        }}
      />

      {/* Edit Session Modal (تعديل الجلسة يدوياً) */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto text-right animate-fadeIn" dir="rtl">
            
            {(() => {
              const editParentCase = cases.find(c => c.id === editingSession.caseId);
              const isDet = isDetentionSession(editingSession, editParentCase);

              return (
                <>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isDet
                          ? 'bg-rose-100 border border-rose-300 text-rose-800'
                          : 'bg-amber-100 border border-amber-300 text-amber-800'
                      }`}>
                        {isDet ? (
                          <Lock className="w-4 h-4 text-rose-700" />
                        ) : (
                          <Edit className="w-4 h-4 text-amber-800" />
                        )}
                      </div>
                      <span>
                        {isDet
                          ? `تعديل بيانات جلسة تجديد الحبس الاحتياطي (دعوى ${editingSession.caseNumber})`
                          : `تعديل بيانات الجلسة يدوياً (قضية رقم ${editingSession.caseNumber})`}
                      </span>
                    </h3>
                    <button
                      onClick={() => setEditingSession(null)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {isDet && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-900 shadow-3xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-rose-200 border border-rose-300 flex items-center justify-center shrink-0">
                          <Lock className="w-4 h-4 text-rose-800" />
                        </span>
                        <div>
                          <div className="font-black text-xs text-rose-950">جلسة تجديد حبس احتياطي</div>
                          <div className="text-[11px] text-rose-700">تعديل الميعاد وسلطة التجديد وبيانات الحضور مع الاحتفاظ بتصنيف التجديد</div>
                        </div>
                      </div>
                      {editDetentionRenewalNumber ? (
                        <span className="bg-rose-700 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-3xs">
                          تجديد #{editDetentionRenewalNumber}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <form onSubmit={handleEditSessionSubmit} className="space-y-4">
                    {isDet && (
                      <div className="grid grid-cols-2 gap-3 bg-rose-50/50 p-3 rounded-2xl border border-rose-200/80">
                        <div>
                          <label className="block text-xs font-bold text-rose-900 mb-1 text-right">سلطة وجهة التجديد</label>
                          <input
                            type="text"
                            value={editDetentionAuthority}
                            onChange={(e) => setEditDetentionAuthority(e.target.value)}
                            placeholder="مثال: قاضي المعارضات / محكمة الجنايات"
                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-semibold text-right"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-rose-900 mb-1 text-right">مدة التجديد التقديرية (بالأيام)</label>
                          <input
                            type="number"
                            min={1}
                            max={45}
                            value={editDetentionDurationDays}
                            onChange={(e) => setEditDetentionDurationDays(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-mono font-bold text-right"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1 text-right">
                          {isDet ? 'المحكمة أو جهة الانعقاد' : 'المحكمة'}
                        </label>
                        <CourtSelect
                          value={editSessionCourt}
                          onChange={setEditSessionCourt}
                          placeholder={isDet ? 'مثال: محكمة جنح مستأنف / النيابة' : 'مثال: محكمة أسرة التجمع الخامس'}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-right font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1 text-right">
                          {isDet ? 'الدائرة أو الغرفة' : 'الدائرة (يدوياً)'}
                        </label>
                        <input
                          type="text"
                          value={editSessionCircuit}
                          onChange={(e) => setEditSessionCircuit(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-right"
                          placeholder={isDet ? 'مثال: غرفة المشورة' : 'مثال: الدائرة 3 إيجارات'}
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
                      <label className="block text-xs font-bold text-slate-800 mb-1 text-right">
                        {isDet ? 'موضوع جلسة التجديد وطلبات الدفاع' : 'موضوع الجلسة والطلبات المطلوبة'}
                      </label>
                      <input
                        type="text"
                        value={editSessionSubject}
                        onChange={(e) => setEditSessionSubject(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1 text-right">المحامي المسؤول والمكلف بالحضور</label>
                      <select
                        value={editSessionLawyer}
                        onChange={(e) => setEditSessionLawyer(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-right"
                      >
                        <option value="">اختر محامياً</option>
                        {distinctLawyers.map(l => (
                          <option key={l.id} value={l.id}>{l.fullName} ({l.title})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingSession(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className={`font-black text-xs px-5 py-2 rounded-xl shadow-md cursor-pointer active:scale-95 ${
                          isDet
                            ? 'bg-rose-700 hover:bg-rose-800 text-white'
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950'
                        }`}
                      >
                        {isDet ? 'حفظ تعديلات جلسة التجديد' : 'حفظ التعديلات'}
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Detention Renewals Modal for comprehensive case renewals */}
      {detentionModalCase && onUpdateCase && (
        <DetentionRenewalsModal
          isOpen={!!detentionModalCase}
          initialDate={detentionModalInitialDate}
          onClose={() => {
            setDetentionModalCase(null);
            setDetentionModalInitialDate(undefined);
          }}
          caseData={detentionModalCase}
          onUpdateCase={async (updated) => {
            await onUpdateCase(updated);
            setDetentionModalCase(updated);
          }}
          currentUser={currentUser}
        />
      )}

    </div>
  );
}
