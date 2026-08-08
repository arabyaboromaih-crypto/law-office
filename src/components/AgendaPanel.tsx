/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HearingSession, Case, User } from '../types';
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
  onUpdateCase?: (c: Case) => void;
}

export default function AgendaPanel({ 
  sessions, cases, users, currentUser, onAddSession, onUpdateSession, onDeleteSession, onNavigateToTab, onSearchCase, onUpdateCase
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

  const isModalReadOnly = !!outcomeSession && (!!outcomeSession.decision || outcomeSession.status === 'completed') && !currentUser?.permissions?.editSessionDecision;

  // Edit Session States
  const [editingSession, setEditingSession] = useState<HearingSession | null>(null);
  const [editSessionCourt, setEditSessionCourt] = useState('');
  const [editSessionCircuit, setEditSessionCircuit] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionTime, setEditSessionTime] = useState('');
  const [editSessionSubject, setEditSessionSubject] = useState('');
  const [editSessionLawyer, setEditSessionLawyer] = useState('');

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

  // Helper helper to check session types
  const isDetentionSession = (s: HearingSession) => {
    return !!s.isDetentionRenewal || 
      (s.subject && (s.subject.includes('تجديد') || s.subject.includes('حبس') || s.subject.includes('احتياطي'))) ||
      (s.court && (s.court.includes('تجديد') || s.court.includes('مشورة')));
  };

  const isExpertSession = (s: HearingSession) => {
    return (s.court && s.court.includes('خبراء')) || (s.subject && s.subject.includes('خبرة'));
  };

  const renderSessionCategoryBadge = (session: HearingSession, parentCase?: Case) => {
    const eff = getEffectiveStageInfo(parentCase, session);
    const isDetention = isDetentionSession(session);
    const isExpert = isExpertSession(session);

    if (isDetention) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs shrink-0">
          <span className="w-5 h-5 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-3 h-3 text-rose-600 animate-pulse" />
          </span>
          <span>تجديد حبس احتياطي</span>
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

    // Extract sessions from detention renewals history
    if (c.detentionRenewals && c.detentionRenewals.length > 0) {
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
  const completedSessionsCount = filteredSessions.filter(s => !!s.decision || s.status === 'completed').length;

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
  };

  // Submit Outcome
  const handleOutcomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcomeSession) return;

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
  };

  // Edit Session Handlers
  const handleOpenEditSession = (s: HearingSession) => {
    setEditingSession(s);
    setEditSessionCourt(s.court || '');
    setEditSessionCircuit(s.circuit || '');
    setEditSessionDate(s.date || todayStr);
    setEditSessionTime(s.time || '09:00');
    setEditSessionSubject(s.subject || '');
    setEditSessionLawyer(s.assignedLawyerId || '');
  };

  const handleEditSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    const assignedUser = users.find(u => u.id === editSessionLawyer);

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
  };

  // Full Agenda Print Handler
  const handlePrintAgenda = (scope: string) => {
    let printTitle = '';
    let printData: HearingSession[] = [];

    if (scope === 'today') {
      printTitle = `أجندة رول الجلسات ليوم القضائي ${todayStr}`;
      printData = filteredSessions.filter(s => s.date === todayStr);
    } else if (scope === 'week') {
      const weekStr = weekDays.map(d => getLocalYYYYMMDD(d));
      printTitle = `أجندة رول الجلسات الأسبوعية من ${weekStr[0]} إلى ${weekStr[6]}`;
      printData = filteredSessions.filter(s => weekStr.includes(s.date));
    } else {
      printTitle = `أجندة رول الجلسات الشهرية لشهر ${currentDateState.toLocaleString('ar-EG', { month: 'long', year: 'numeric' })}`;
      printData = filteredSessions.filter(s => {
        const sDate = new Date(s.date);
        return sDate.getMonth() === currentDateState.getMonth() && sDate.getFullYear() === currentDateState.getFullYear();
      });
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${printTitle}</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 20px; line-height: 1.6; }
              .header { text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 22px; color: #b45309; }
              .header p { margin: 5px 0 0; font-size: 14px; color: #555; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #cbd5e1; padding: 12px; font-size: 13px; text-align: right; }
              th { background-color: #f8fafc; color: #1e293b; }
              .date-tag { font-family: monospace; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>مؤسسة رميح لأعمال المحاماة والاستشارات القانونية</h1>
              <p>${printTitle}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>رقم القضية</th>
                  <th>نوع النزاع</th>
                  <th>المحكمة والدائرة</th>
                  <th>الموكل ضد الخصم</th>
                  <th>موضوع الجلسة والطلبات</th>
                  <th>المحامي المكلف</th>
                </tr>
              </thead>
              <tbody>
                ${printData.length === 0 ? `<tr><td colspan="7" style="text-align:center;">لا توجد جلسات مدرجة في هذا الجدول الزمني.</td></tr>` : 
                  printData.map(s => {
                    const c = cases.find(item => item.id === s.caseId);
                    const eff = getEffectiveStageInfo(c, s);
                    return `
                    <tr>
                      <td class="date-tag">${s.date} <br/>الساعة ${s.time}</td>
                      <td>دعوى رقم ${eff.caseNumber || s.caseNumber} / ${eff.caseYear || s.caseYear} <br/><small style="color:#b45309;font-weight:bold;">(${eff.badgeText})</small></td>
                      <td>${s.type}</td>
                      <td>${eff.court} <br/>الدائرة: ${eff.circuit}</td>
                      <td><strong>${s.clientName}</strong> <br/>ضد ${s.opponentName}</td>
                      <td>${s.subject}</td>
                      <td>${s.assignedLawyerName || 'غير مكلف'}</td>
                    </tr>
                  `;
                  }).join('')
                }
              </tbody>
            </table>
            <script>window.print();</script>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pl-1">
                  {tomorrowSessionsList.map((session) => {
                    const parentCase = cases.find(c => c.id === session.caseId);
                    const eff = getEffectiveStageInfo(parentCase, session);
                    return (
                    <div 
                      key={session.id}
                      className="bg-white border border-amber-300/80 p-3 rounded-xl shadow-3xs hover:border-amber-500 transition-all flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 block">
                              دعوى رقم {eff.caseNumber || session.caseNumber || 'بدون'} / {eff.caseYear || session.caseYear || ''} ({session.type || 'عام'})
                            </span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${eff.badgeStyle}`}>
                              {eff.badgeText}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-950 block">
                            الموكل: {session.clientName || 'غير محدد'} <span className="text-slate-400">ضد</span> {session.opponentName || 'غير محدد'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg shrink-0 font-mono">
                          ⏰ الساعة {session.time || '09:00'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-1.5 flex flex-wrap items-center justify-between gap-1">
                        <div>
                          <span className="font-semibold text-slate-800">مكان النظر / المحكمة:</span> {eff.court} - {eff.circuit}
                        </div>
                        {session.assignedLawyerName && (
                          <div className="text-slate-600 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                            👤 المحامي: {session.assignedLawyerName}
                          </div>
                        )}
                      </div>

                      {session.subject && (
                        <div className="text-[10px] text-slate-600 bg-amber-50/60 p-1.5 rounded-lg border border-amber-200/60">
                          <strong className="text-slate-800">الموضوع:</strong> {session.subject}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        {renderSessionStatusAndActions(session)}
                      </div>
                    </div>
                    );
                  })}
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

      {/* Calendar View Controls Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        
        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition-all active:scale-95 cursor-pointer shadow-3xs"
            title="السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <span className="font-black text-slate-900 text-xs sm:text-sm px-2">
            {viewMode === 'daily' && `رول يوم: ${getDynamicDateString(currentDateState, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
            {viewMode === 'weekly' && `أسبوع: ${getDynamicDateString(weekDays[0], { month: 'short', day: 'numeric' })} - ${getDynamicDateString(weekDays[6], { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'monthly' && `${getDynamicDateString(currentDateState, { month: 'long', year: 'numeric' })}`}
            {viewMode === 'yearly' && `عام: ${toAr(currentDateState.getFullYear())}`}
          </span>

          <button 
            onClick={handleNext}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-700 transition-all active:scale-95 cursor-pointer shadow-3xs"
            title="التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button 
            onClick={handleGoToToday}
            className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300/80 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shadow-3xs active:scale-95"
          >
            اليوم القضائي
          </button>
        </div>

        {/* Print Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrintAgenda('today')}
            className="bg-slate-900 hover:bg-slate-800 text-white hover:text-amber-400 text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة اليوم</span>
          </button>
          <button
            onClick={() => handlePrintAgenda('week')}
            className="bg-slate-900 hover:bg-slate-800 text-white hover:text-amber-400 text-xs py-1.5 px-3 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الأسبوع</span>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex flex-wrap bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-md">
          <button
            onClick={() => setViewMode('daily')}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-black transition-all duration-300 cursor-pointer ${
              viewMode === 'daily' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            عرض يومي
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-black transition-all duration-300 cursor-pointer ${
              viewMode === 'weekly' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            عرض أسبوعي
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-black transition-all duration-300 cursor-pointer ${
              viewMode === 'monthly' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            شهري (التقويم)
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`text-xs px-3.5 py-1.5 rounded-xl font-black transition-all duration-300 cursor-pointer ${
              viewMode === 'yearly' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
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
                {filteredSessions.map((session) => {
                  const parentCase = cases.find(c => c.id === session.caseId);
                  const eff = getEffectiveStageInfo(parentCase, session);
                  const isToday = session.date === todayStr;
                  const isCompleted = session.status === 'completed' || !!session.decision;

                  return (
                    <div 
                      key={session.id} 
                      className={`p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all border ${
                        isCompleted
                          ? 'bg-gradient-to-r from-emerald-50/50 via-white to-white border-r-4 border-r-emerald-500 border-slate-200 shadow-3xs'
                          : isToday
                            ? 'bg-gradient-to-r from-amber-500/10 via-amber-50/30 to-white border-r-4 border-r-amber-500 border-amber-300/80 shadow-md ring-1 ring-amber-400/20'
                            : 'bg-white border-r-4 border-r-slate-800 border-slate-200/90 shadow-3xs hover:shadow-2xs'
                      }`}
                    >
                      <div className="space-y-2.5 flex-1 w-full">
                        <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderSessionCategoryBadge(session, parentCase)}

                            <span className="text-[10px] font-black px-2.5 py-1 rounded-full font-mono bg-slate-900 text-amber-400 shadow-3xs">
                              📅 {session.date}
                            </span>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full font-mono ${
                              isCompleted 
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                                : isToday 
                                  ? 'bg-amber-500 text-slate-950 font-black' 
                                  : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}>
                              🕒 {session.time}
                            </span>
                            <span className="font-black text-slate-900 text-sm">
                              دعوى {toAr(eff.caseNumber || session.caseNumber)} / {toAr(eff.caseYear || session.caseYear)} - {session.type}
                            </span>
                            <span className="text-xs font-bold text-slate-500">({eff.court})</span>
                          </div>
                          {onSearchCase && (
                            <button
                              onClick={() => {
                                if (onSearchCase) onSearchCase(session.caseId);
                                if (onNavigateToTab) onNavigateToTab('cases');
                              }}
                              className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl py-1.5 px-3 shadow-3xs transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 active:scale-95"
                              title="فتح ملف ومستندات القضية بالكامل"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                              <span>ملف القضية</span>
                            </button>
                          )}
                        </div>
                        
                        <p className="text-xs text-slate-700 font-bold">
                          <strong>مكان النظر / المحكمة:</strong> <span className="text-amber-900 font-black">{eff.court}</span> <span className="text-slate-300 mx-1.5">|</span>
                          <strong>الدائرة:</strong> <span className="text-slate-900 font-bold">{eff.circuit}</span> <span className="text-slate-300 mx-1.5">|</span>
                          <strong>الموكل:</strong> <span className="text-slate-900 font-black">{session.clientName}</span> <span className="text-slate-300 mx-1.5">|</span>
                          <strong>الخصم:</strong> <span className="text-slate-800">{session.opponentName}</span>
                        </p>

                        <p className="text-xs text-amber-950 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl inline-block font-bold shadow-3xs">
                          <strong>موضوع الجلسة والطلبات:</strong> {session.subject}
                        </p>

                        {session.assignedLawyerName && (
                          <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <UserCheck className="w-3 h-3 text-amber-700" />
                            </span>
                            <span><strong>المحامي المكلف بالحضور:</strong> {session.assignedLawyerName}</span>
                          </p>
                        )}

                        {session.decision && (
                          <div className="mt-2 text-xs bg-emerald-500/10 border border-emerald-300/80 p-3 rounded-xl text-emerald-950 font-bold space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>قرار المحكمة الصادر:</span>
                            </div>
                            <p className="pr-5 text-slate-800">{session.decision}</p>
                            {session.nextHearingDate && (
                              <span className="block mt-1 pt-1 border-t border-emerald-200/60 font-black text-amber-900">
                                📅 تأجلت لجلسة: {session.nextHearingDate}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {renderSessionStatusAndActions(session)}
                    </div>
                  );
                })}
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
                    {dailySessionsList.map((session) => {
                      const parentCase = cases.find(c => c.id === session.caseId);
                      const eff = getEffectiveStageInfo(parentCase, session);
                      const isToday = session.date === todayStr;
                      const isCompleted = session.status === 'completed' || !!session.decision;

                      return (
                        <div 
                          key={session.id} 
                          className={`p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all border ${
                            isCompleted
                              ? 'bg-gradient-to-r from-emerald-50/50 via-white to-white border-r-4 border-r-emerald-500 border-slate-200 shadow-3xs'
                              : isToday
                                ? 'bg-gradient-to-r from-amber-500/10 via-amber-50/30 to-white border-r-4 border-r-amber-500 border-amber-300/80 shadow-md ring-1 ring-amber-400/20'
                                : 'bg-white border-r-4 border-r-slate-800 border-slate-200/90 shadow-3xs hover:shadow-2xs'
                          }`}
                        >
                          <div className="space-y-2.5 flex-1 w-full">
                            <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {renderSessionCategoryBadge(session, parentCase)}

                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full font-mono ${
                                  isCompleted 
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                                    : isToday 
                                      ? 'bg-amber-500 text-slate-950 font-black' 
                                      : 'bg-blue-100 text-blue-900 border border-blue-200'
                                }`}>
                                  🕒 {session.time}
                                </span>
                                <span className="font-black text-slate-900 text-sm">
                                  دعوى {toAr(eff.caseNumber || session.caseNumber)} / {toAr(eff.caseYear || session.caseYear)} - {session.type}
                                </span>
                                <span className="text-xs font-bold text-slate-500">({eff.court})</span>
                              </div>
                              {onSearchCase && (
                                <button
                                  onClick={() => {
                                    if (onSearchCase) onSearchCase(session.caseId);
                                    if (onNavigateToTab) onNavigateToTab('cases');
                                  }}
                                  className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl py-1.5 px-3 shadow-3xs transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 active:scale-95"
                                  title="فتح ملف ومستندات القضية بالكامل"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                                  <span>ملف القضية</span>
                                </button>
                              )}
                            </div>
                            
                            <p className="text-xs text-slate-700 font-bold">
                              <strong>مكان النظر / المحكمة:</strong> <span className="text-amber-900 font-black">{eff.court}</span> <span className="text-slate-300 mx-1.5">|</span>
                              <strong>الدائرة:</strong> <span className="text-slate-900 font-bold">{eff.circuit}</span> <span className="text-slate-300 mx-1.5">|</span>
                              <strong>الموكل:</strong> <span className="text-slate-900 font-black">{session.clientName}</span> <span className="text-slate-300 mx-1.5">|</span>
                              <strong>الخصم:</strong> <span className="text-slate-800">{session.opponentName}</span>
                            </p>

                            <p className="text-xs text-amber-950 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl inline-block font-bold shadow-3xs">
                              <strong>موضوع الجلسة والطلبات:</strong> {session.subject}
                            </p>

                            {session.assignedLawyerName && (
                              <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                  <UserCheck className="w-3 h-3 text-amber-700" />
                                </span>
                                <span><strong>المحامي المكلف بالحضور:</strong> {session.assignedLawyerName}</span>
                              </p>
                            )}

                            {session.decision && (
                              <div className="mt-2 text-xs bg-emerald-500/10 border border-emerald-300/80 p-3 rounded-xl text-emerald-950 font-bold space-y-1">
                                <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>قرار المحكمة الصادر:</span>
                                </div>
                                <p className="pr-5 text-slate-800">{session.decision}</p>
                                {session.nextHearingDate && (
                                  <span className="block mt-1 pt-1 border-t border-emerald-200/60 font-black text-amber-900">
                                    📅 تأجلت لجلسة: {session.nextHearingDate}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {renderSessionStatusAndActions(session)}
                        </div>
                      );
                    })}
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

      {/* Outcome Update Modal (بعد انتهاء الجلسة) */}
      {outcomeSession && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto animate-fadeIn">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                  <Gavel className="w-4 h-4 text-amber-800" />
                </div>
                <span>{isModalReadOnly ? 'تفاصيل قرار الجلسة والمنطوق المعتمد' : 'نموذج قرار الجلسة والطعن (قضية رقم ' + outcomeSession.caseNumber + ')'}</span>
              </h3>
              <button
                onClick={() => setOutcomeSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOutcomeSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">المحكمة</label>
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
                      placeholder="المحكمة المنعقدة أمامها"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-right font-bold"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">الدائرة (يدوياً)</label>
                  <input
                    type="text"
                    value={outcomeCircuit}
                    onChange={(e) => setOutcomeCircuit(e.target.value)}
                    required
                    disabled={isModalReadOnly}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-600"
                    placeholder="الدائرة القضائية"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">منطوق قرار المحكمة (رول الجلسة)</label>
                <textarea
                  placeholder="مثال: التأجيل لجلسة 2 يوليو لتقديم المستندات والطب الشرعي أو الحكم التمهيدي..."
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  required
                  disabled={isModalReadOnly}
                  rows={2.5}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium disabled:bg-slate-100 disabled:text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">تاريخ الجلسة القادمة (إن وجد)</label>
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
                    {isModalReadOnly ? '✓ قرار معتمد في ملف القضية والتحديثات منتهية' : '✓ سيتم قيدها كـ "مكتملة ومؤرشفة بالرول"'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">ما تم تفصيلاً في جلسة اليوم ومرافعتنا</label>
                <textarea
                  placeholder="اكتب تفاصيل مرافعة الدفاع ودفوع الخصوم بالجلسة..."
                  value={whatHappened}
                  onChange={(e) => setWhatHappened(e.target.value)}
                  rows={2}
                  disabled={isModalReadOnly}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium disabled:bg-slate-100 disabled:text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">المطلوب تجهيزه وصياغته قبل الجلسة القادمة</label>
                <textarea
                  placeholder="مثال: كتابة مذكرة الرد على تقرير الخبير، تقديم شهادة وفاة..."
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
                <p className="text-xs font-black text-slate-900">صورة رول الجلسة أو منطوق الحكم المرفق</p>
                {!isModalReadOnly && (
                  <p className="text-[10px] text-slate-500 mt-0.5">اضغط لمحاكاة التقاط الصورة بالهاتف المحمول أو الرفع</p>
                )}
                
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    type="text"
                    placeholder="مثال: roll_session_26_6.jpg"
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
                        alert('تمت محاكاة رفع صورة رول الجلسة وإرفاقها بالمنطوق.');
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
              const existingRenewals = targetCase.detentionRenewals || [];
              const updatedRenewals = [
                ...existingRenewals,
                {
                  id: `ren-${Date.now()}`,
                  renewalDate: newSess.date,
                  date: newSess.date,
                  nextRenewalDate: newSess.date,
                  authority: detentionMeta.authority,
                  durationDays: detentionMeta.duration,
                  notes: newSess.subject || 'جلسة تجديد حبس مضافة من أجندة الجلسات'
                }
              ];
              onUpdateCase({
                ...targetCase,
                isInvestigationActive: true,
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
