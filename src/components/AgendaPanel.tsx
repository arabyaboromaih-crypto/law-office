/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HearingSession, Case, User } from '../types';
import { 
  Calendar as CalendarIcon, Clock, Gavel, Search, Printer, 
  ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, RefreshCw, X, FileText, Camera, Plus, Edit, FolderOpen
} from 'lucide-react';
import { extractHearingDate } from '../utils/hearingSync';
import { toAr } from '../utils/arabicNumbers';
import { CourtSelect } from '../utils/courts';

interface AgendaPanelProps {
  sessions: HearingSession[];
  cases: Case[];
  users: User[];
  currentUser: User;
  onAddSession: (s: HearingSession) => void;
  onUpdateSession: (s: HearingSession) => void;
  onNavigateToTab?: (tabName: string) => void;
  onSearchCase?: (query: string) => void;
}

export default function AgendaPanel({ 
  sessions, cases, users, currentUser, onAddSession, onUpdateSession, onNavigateToTab, onSearchCase
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

  // Setup Today String
  const todayStr = getLocalYYYYMMDD(new Date());

  // Find sessions in files that are NOT in sessions state
  const discoveredSessions: Array<{
    caseObj: Case;
    file: { id: string; name: string; type: string; category: string; uploadDate: string; size?: string; fileUrl: string };
    fileDate: string;
    suggestedSubject: string;
  }> = [];

  cases.forEach(c => {
    if (!c.files) return;
    c.files.forEach(file => {
      const fileDate = extractHearingDate(file.name);
      if (!fileDate) return;
      // Check if there is already a session for this case on this date in sessions
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
  });

  const handleAddSingleDiscoveredSession = (item: typeof discoveredSessions[0]) => {
    const newSession: HearingSession = {
      id: `session-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      caseId: item.caseObj.id,
      caseNumber: item.caseObj.caseNumberFirstInstance,
      caseYear: item.caseObj.caseYearFirstInstance,
      clientName: item.caseObj.clientName,
      opponentName: item.caseObj.opponent.name,
      court: item.caseObj.court,
      circuit: item.caseObj.circuit,
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

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ? true : (
      (s.clientName && s.clientName.toLowerCase().includes(q)) ||
      (s.opponentName && s.opponentName.toLowerCase().includes(q)) ||
      (s.caseNumber && s.caseNumber.toLowerCase().includes(q)) ||
      (s.caseYear && s.caseYear.toLowerCase().includes(q)) ||
      (s.court && s.court.toLowerCase().includes(q)) ||
      (s.subject && s.subject.toLowerCase().includes(q)) ||
      (s.assignedLawyerName && s.assignedLawyerName.toLowerCase().includes(q)) ||
      (s.date && s.date.includes(q))
    );

    const matchesCourt = filterCourt === 'الكل' || filterCourt.trim() === '' || (s.court && s.court.toLowerCase().includes(filterCourt.toLowerCase().trim()));
    const matchesLawyer = filterLawyer === 'الكل' || s.assignedLawyerId === filterLawyer;

    return matchesSearch && matchesCourt && matchesLawyer;
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
    // Start of week: Sat (6) in Egypt is standard, or just start from current minus day index
    const currentDay = start.getDay();
    // In JS: Sun=0, Mon=1... Sat=6. Let's start the week from Saturday
    const diff = start.getDate() - currentDay + (currentDay === 6 ? 0 : -1 - currentDay);
    const sundayStart = new Date(start);
    sundayStart.setDate(diff); // Now it points to Saturday

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
    const startingDayIndex = (firstDay.getDay() + 1) % 7; // Align to Saturday start
    
    const cells = [];
    // Blank days
    for (let i = 0; i < startingDayIndex; i++) {
      cells.push(null);
    }
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(new Date(year, month, i));
    }
    return cells;
  };
  const monthCells = getMonthDays(currentDateState);

  // Yearly View Calendar Cells for a specific month index (0-11)
  const getSpecificMonthDays = (year: number, monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDayIndex = (firstDay.getDay() + 1) % 7; // Align to Saturday start
    
    const cells = [];
    // Blank days
    for (let i = 0; i < startingDayIndex; i++) {
      cells.push(null);
    }
    // Days
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
    if (!currentUser?.permissions?.editSession) {
      alert("⚠️ تحذير: غير مصرح لك بتعديل بيانات الجلسات. يرجى التواصل مع المدير العام لتعديل صلاحياتك.");
      return;
    }
    const confirmEdit = window.confirm("تحذير: أنت على وشك تعديل تفاصيل الجلسة. هل تريد الاستمرار؟");
    if (!confirmEdit) return;

    setEditingSession(s);
    setEditSessionCourt(s.court || '');
    setEditSessionCircuit(s.circuit || '');
    setEditSessionDate(s.date);
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
      court: editSessionCourt || 'غير محدد',
      circuit: editSessionCircuit || 'غير محدد',
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

  // Quick Add Session Submit
  const handleAddSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCase = cases.find(c => c.id === selectedCaseId);
    if (!targetCase) return;

    const assignedUser = users.find(u => u.id === newSessionLawyer);

    const newSess: HearingSession = {
      id: `session-${Date.now()}`,
      caseId: targetCase.id,
      caseNumber: targetCase.caseNumberFirstInstance,
      caseYear: targetCase.caseYearFirstInstance,
      clientName: targetCase.clientName,
      opponentName: targetCase.opponent.name,
      court: newSessionCourt || targetCase.court || 'غير محدد',
      circuit: newSessionCircuit || targetCase.circuit || 'غير محدد',
      type: targetCase.type,
      date: newSessionDate,
      time: newSessionTime,
      subject: newSessionSubject,
      status: 'pending',
      assignedLawyerId: newSessionLawyer || undefined,
      assignedLawyerName: assignedUser ? assignedUser.fullName : undefined
    };

    onAddSession(newSess);
    setShowAddModal(false);
    setSelectedCaseId('');
    setNewSessionSubject('');
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
                  printData.map(s => `
                    <tr>
                      <td class="date-tag">${s.date} <br/>الساعة ${s.time}</td>
                      <td>شبهة رقم ${s.caseNumber} / ${s.caseYear}</td>
                      <td>${s.type}</td>
                      <td>${s.court} <br/>${s.circuit}</td>
                      <td><strong>${s.clientName}</strong> <br/>ضد ${s.opponentName}</td>
                      <td>${s.subject}</td>
                      <td>${s.assignedLawyerName || 'غير مكلف'}</td>
                    </tr>
                  `).join('')
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

    // Status Badge
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
      // Past session, not completed/recorded yet
      statusBadge = (
        <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-300">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          <span>⚪ جلسة سابقة (بانتظار تسجيل القرار)</span>
        </span>
      );
    }

    // Buttons/Actions
    return (
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        {/* 1. Status Badge */}
        {statusBadge}

        {/* 2. Edit button: show if permissions allow */}
        {currentUser?.permissions?.editSession && (
          <button
            onClick={() => handleOpenEditSession(session)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            title="تعديل تفاصيل الجلسة يدوياً"
          >
            <Edit className="w-3.5 h-3.5" />
            تعديل الجلسة
          </button>
        )}

        {/* 3. Record or View Decision Button */}
        {(() => {
          if (isDecisionRecorded) {
            return (
              <button
                onClick={() => handleOpenOutcome(session)}
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
                onClick={() => handleOpenOutcome(session)}
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
    );
  };

  return (
    <div className="space-y-3.5 animate-fadeIn">
      
      {/* Search and Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Smart Search */}
          <div className="relative flex-1">
            <span className="absolute right-3 top-3 text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              placeholder="البحث بأجندة الجلسات: التاريخ، المحكمة، الموكل، رقم القضية، المحامي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="تصفية بالمحكمة يدوياً..."
                value={filterCourt === 'الكل' ? '' : filterCourt}
                onChange={(e) => setFilterCourt(e.target.value || 'الكل')}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 w-48 text-right"
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
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="الكل">كل المحامين</option>
                {distinctLawyers.map(l => (
                  <option key={l.id} value={l.id}>{l.fullName}</option>
                ))}
              </select>
            </div>

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
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors"
              >
                إضافة جلسة للرول
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Discovered Sessions pending integration */}
      {discoveredSessions.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <h4 className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                رصد جلسات ذكية معلّقة لم يتم ضمها لجدول الأجندة ({filteredDiscoveredSessions.length} من {discoveredSessions.length})
              </h4>
            </div>
            <span className="text-[9px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
              تحديث رول فوري
            </span>
          </div>

          {filteredDiscoveredSessions.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              <p>لا توجد جلسات مرصودة معلقة تطابق كلمة البحث.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[160px] overflow-y-auto pr-1">
              {filteredDiscoveredSessions.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-200/80 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-amber-500/40 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-1 py-0.2 rounded">
                        قضية رقم {item.caseObj.caseNumberFirstInstance}
                      </span>
                      <span className="text-[9px] text-amber-600 bg-amber-500/10 px-1 py-0.2 rounded font-bold">
                        {item.fileDate}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-800 line-clamp-1">{item.caseObj.clientName}</p>
                    <p className="text-[9px] text-slate-400 line-clamp-1 font-mono">الملف: {item.file.name}</p>
                  </div>

                  <button
                    onClick={() => handleAddSingleDiscoveredSession(item)}
                    className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[9px] py-1 px-2 rounded-md flex items-center gap-0.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    ضم للأجندة
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Navigation buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrev}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <span className="font-bold text-slate-800 text-sm">
            {viewMode === 'daily' && `رول يوم: ${getDynamicDateString(currentDateState, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
            {viewMode === 'weekly' && `أسبوع: ${getDynamicDateString(weekDays[0], { month: 'short', day: 'numeric' })} - ${getDynamicDateString(weekDays[6], { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {viewMode === 'monthly' && `${getDynamicDateString(currentDateState, { month: 'long', year: 'numeric' })}`}
            {viewMode === 'yearly' && `عام: ${toAr(currentDateState.getFullYear())}`}
          </span>

          <button 
            onClick={handleNext}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button 
            onClick={handleGoToToday}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            اليوم القضائي
          </button>
        </div>

        {/* Print Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrintAgenda('today')}
            className="bg-slate-800 hover:bg-slate-700 text-white hover:text-amber-400 text-xs py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة رول اليوم
          </button>
          <button
            onClick={() => handlePrintAgenda('week')}
            className="bg-slate-800 hover:bg-slate-700 text-white hover:text-amber-400 text-xs py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة الأسبوع
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex flex-wrap bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-md">
          <button
            onClick={() => setViewMode('daily')}
            className={`text-xs px-4 py-2 rounded-xl font-bold transition-all duration-300 ${viewMode === 'daily' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            عرض يومي
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`text-xs px-4 py-2 rounded-xl font-bold transition-all duration-300 ${viewMode === 'weekly' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            عرض أسبوعي
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`text-xs px-4 py-2 rounded-xl font-bold transition-all duration-300 ${viewMode === 'monthly' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            شهري (التقويم)
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`text-xs px-4 py-2 rounded-xl font-bold transition-all duration-300 ${viewMode === 'yearly' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            عرض سنوي
          </button>
        </div>

      </div>

      {/* Main Agenda Views Content */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
        
        {searchQuery.trim() !== '' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-amber-500" />
                نتائج البحث العام في الأجندة ورصد الجلسات ({filteredSessions.length} جلسة مطابقة)
              </h3>
              <button 
                onClick={() => setSearchQuery('')} 
                className="text-xs text-amber-600 hover:text-amber-800 font-bold"
              >
                مسح البحث والعودة للتقويم
              </button>
            </div>
            
            {filteredSessions.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <p>لا توجد أي جلسات تطابق كلمة البحث "{searchQuery}" في الأجندة.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className={`p-5 rounded-xl border-r-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${session.status === 'completed' ? 'bg-emerald-50/40 border-emerald-500' : 'bg-slate-50 border-amber-500 hover:bg-slate-100/70'}`}
                  >
                    <div className="space-y-1.5 flex-1 w-full">
                      <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-slate-900 text-amber-400">
                            📅 {session.date}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${session.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {session.time}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">
                            قضية {toAr(session.caseNumber)} / {toAr(session.caseYear)} - {session.type}
                          </span>
                          <span className="text-[11px] text-slate-400">({session.court})</span>
                        </div>
                        {onSearchCase && (
                          <button
                            onClick={() => {
                              if (onSearchCase) onSearchCase(session.caseId);
                              if (onNavigateToTab) onNavigateToTab('cases');
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200/80 rounded-lg py-1 px-2.5 shadow-3xs transition-all flex items-center gap-1.5 text-[10px] font-bold cursor-pointer shrink-0 self-end sm:self-auto"
                            title="فتح ملف ومستندات القضية بالكامل"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>ملف القضية</span>
                          </button>
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-700 font-medium">
                        <strong>الدائرة:</strong> {session.circuit} <span className="text-slate-300 mx-1">|</span>
                        <strong>الموكل:</strong> {session.clientName} <span className="text-slate-300 mx-1">|</span>
                        <strong>الخصم:</strong> {session.opponentName}
                      </p>

                      <p className="text-xs text-amber-900 bg-amber-50 px-2 py-1 rounded inline-block font-medium">
                        <strong>موضوع الجلسة والطلبات:</strong> {session.subject}
                      </p>

                      {session.assignedLawyerName && (
                        <p className="text-[11px] text-slate-500">
                          🧑‍⚖️ <strong>المحامي المكلف بالحضور:</strong> {session.assignedLawyerName}
                        </p>
                      )}

                      {session.decision && (
                        <div className="mt-2 text-xs bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-emerald-900">
                          <strong>قرار المحكمة الصادر:</strong> {session.decision}
                          {session.nextHearingDate && <span className="block mt-1 font-semibold">تأجلت لجلسة: {session.nextHearingDate}</span>}
                        </div>
                      )}
                    </div>

                    {renderSessionStatusAndActions(session)}
                  </div>
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
                  <div className="text-center py-16 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl space-y-3">
                    <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                    <p>لا توجد جلسات مجدولة ليوم {dateFormattedStr} في الأجندة الفلترية.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {dailySessionsList.map((session) => (
                      <div 
                        key={session.id} 
                        className={`p-5 rounded-xl border-r-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${session.status === 'completed' ? 'bg-emerald-50/40 border-emerald-500' : 'bg-slate-50 border-amber-500 hover:bg-slate-100/70'}`}
                      >
                        <div className="space-y-1.5 flex-1 w-full">
                          <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${session.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {session.time}
                              </span>
                              <span className="font-bold text-slate-800 text-sm">
                                قضية {session.caseNumber} / {session.caseYear} - {session.type}
                              </span>
                              <span className="text-[11px] text-slate-400">({session.court})</span>
                            </div>
                            {onSearchCase && (
                              <button
                                onClick={() => {
                                  if (onSearchCase) onSearchCase(session.caseId);
                                  if (onNavigateToTab) onNavigateToTab('cases');
                                }}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200/80 rounded-lg py-1 px-2.5 shadow-3xs transition-all flex items-center gap-1.5 text-[10px] font-bold cursor-pointer shrink-0 self-end sm:self-auto"
                                title="فتح ملف ومستندات القضية بالكامل"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>ملف القضية</span>
                              </button>
                            )}
                          </div>
                          
                          <p className="text-xs text-slate-700 font-medium">
                            <strong>الدائرة:</strong> {session.circuit} <span className="text-slate-300 mx-1">|</span>
                            <strong>الموكل:</strong> {session.clientName} <span className="text-slate-300 mx-1">|</span>
                            <strong>الخصم:</strong> {session.opponentName}
                          </p>

                          <p className="text-xs text-amber-900 bg-amber-50 px-2 py-1 rounded inline-block font-medium">
                            <strong>موضوع الجلسة والطلبات:</strong> {session.subject}
                          </p>

                          {session.assignedLawyerName && (
                            <p className="text-[11px] text-slate-500">
                              🧑‍⚖️ <strong>المحامي المكلف بالحضور:</strong> {session.assignedLawyerName}
                            </p>
                          )}

                          {session.decision && (
                            <div className="mt-2 text-xs bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-emerald-900">
                              <strong>قرار المحكمة الصادر:</strong> {session.decision}
                              {session.nextHearingDate && <span className="block mt-1 font-semibold">تأجلت لجلسة: {session.nextHearingDate}</span>}
                            </div>
                          )}
                        </div>

                        {renderSessionStatusAndActions(session)}
                      </div>
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
                  className={`p-3 rounded-xl border flex flex-col justify-between min-h-[160px] ${isToday ? 'bg-amber-50/50 border-amber-500' : 'bg-slate-50/50 border-slate-200'}`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                      <span className={`text-xs font-bold ${isToday ? 'text-amber-700' : 'text-slate-700'}`}>
                        {getDynamicDateString(day, { weekday: 'short' })}
                      </span>
                      <span className={`text-[10px] font-mono ${isToday ? 'bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                        {toAr(day.getDate())}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {daySessions.map((s) => (
                        <div 
                          key={s.id} 
                          onClick={() => {
                            setViewMode('daily');
                            setCurrentDateState(day);
                          }}
                          className="p-1.5 bg-white border border-slate-200 rounded text-[10px] hover:border-amber-400 transition-colors cursor-pointer"
                        >
                          <span className="font-bold text-slate-800 block truncate">
                            {s.time} - قضية {s.caseNumber}
                          </span>
                          <span className="text-slate-500 block truncate">{s.court}</span>
                        </div>
                      ))}
                      {daySessions.length === 0 && (
                        <span className="text-[9px] text-slate-300 block text-center py-4">فارغ</span>
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
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 mb-2 border-b border-slate-100 pb-2">
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
                if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/30 rounded-lg min-h-[80px]" />;
                
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
                    className={`p-2 rounded-lg border min-h-[90px] flex flex-col justify-between hover:border-amber-500 transition-colors cursor-pointer ${isToday ? 'bg-amber-50/50 border-amber-500' : 'bg-slate-50/50 border-slate-200/80'}`}
                  >
                    <span className={`text-[10px] font-mono font-bold self-end ${isToday ? 'bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded' : 'text-slate-600'}`}>
                      {day.getDate()}
                    </span>

                    <div className="mt-1 space-y-1">
                      {daySessions.slice(0, 2).map((s) => (
                        <span 
                          key={s.id} 
                          className={`block text-[8px] font-bold px-1 py-0.5 rounded truncate ${s.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {s.time} | {s.clientName}
                        </span>
                      ))}
                      {daySessions.length > 2 && (
                        <span className="text-[8px] text-slate-400 font-bold block text-center">
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
              const completedYearSessions = yearSessions.filter(s => s.status === 'completed');
              const pendingYearSessions = yearSessions.filter(s => s.status !== 'completed');

              return (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-3xs">
                    <span className="text-xs text-slate-400 block mb-0.5">إجمالي الجلسات في {selectedYear}</span>
                    <strong className="text-lg text-slate-800 block">{yearSessions.length} جلسة</strong>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-3xs">
                    <span className="text-xs text-slate-400 block mb-0.5">جلسات منجزة</span>
                    <strong className="text-lg text-emerald-600 block">{completedYearSessions.length} جلسة</strong>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-3xs">
                    <span className="text-xs text-slate-400 block mb-0.5">جلسات قادمة / معلقة</span>
                    <strong className="text-lg text-amber-600 block">{pendingYearSessions.length} جلسة</strong>
                  </div>
                </div>
              );
            })()}

            {/* 12-Month Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs hover:border-amber-400/50 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      {/* Month Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                        <h4 className="font-bold text-slate-800 text-xs">
                          {arabicMonthNames[mIdx]}
                        </h4>
                        {monthSessions.length > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                            {monthSessions.length} جلسة
                          </span>
                        )}
                      </div>

                      {/* Mini Calendar Header (Days) */}
                      <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] text-slate-400 mb-1">
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
                              className={`aspect-square rounded-md text-[9px] font-mono flex items-center justify-center transition-all ${
                                isToday 
                                  ? 'bg-amber-500 text-slate-950 font-bold scale-105 shadow-3xs' 
                                  : hasSessions 
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold border border-amber-300' 
                                    : 'text-slate-600 hover:bg-slate-100'
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
                      <div className="mt-3 pt-2.5 border-t border-slate-50 space-y-1 max-h-[85px] overflow-y-auto">
                        {monthSessions.slice(0, 3).map(s => (
                          <div 
                            key={s.id}
                            onClick={() => {
                              setCurrentDateState(new Date(s.date));
                              setViewMode('daily');
                            }}
                            className="text-[8px] bg-slate-50 hover:bg-amber-50 hover:text-amber-900 rounded p-1 flex justify-between gap-1 items-center cursor-pointer border border-slate-100 transition-colors"
                          >
                            <span className="font-bold truncate max-w-[80px]">{s.clientName}</span>
                            <span className="text-slate-400 text-[7px] font-mono whitespace-nowrap">{s.date.substring(5)}</span>
                          </div>
                        ))}
                        {monthSessions.length > 3 && (
                          <button
                            onClick={() => {
                              setCurrentDateState(new Date(year, mIdx, 1));
                              setViewMode('monthly');
                            }}
                            className="text-[8px] text-amber-600 hover:text-amber-800 font-bold block text-center w-full mt-1"
                          >
                            عرض كافة جلسات الشهر ({monthSessions.length})
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Gavel className="w-5 h-5 text-amber-500" />
                {isModalReadOnly ? 'تفاصيل قرار الجلسة والمنطوق المعتمد' : 'نموذج قرار الجلسة والطعن (قضية رقم ' + outcomeSession.caseNumber + ')'}
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
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-500"
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
                  disabled={isModalReadOnly}
                  rows={2.5}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-600"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono disabled:bg-slate-100 disabled:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الجلسة الحالية</label>
                  <div className="text-xs bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-200 font-bold">
                    {isModalReadOnly ? '✓ قرار معتمد في ملف القضية والتحديثات منتهية' : '✓ سيتم قيدها كـ "مكتملة ومؤرشفة بالرول"'}
                  </div>
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-600"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-600"
                />
              </div>

              {/* Upload roll photo simulation */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center">
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">صورة رول الجلسة أو منطوق الحكم المرفق</p>
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
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono w-56 disabled:bg-slate-100 disabled:text-slate-500"
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
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-3 rounded-lg"
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
                  <span className="text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                    🔒 المنطوق معتمد في السجل القضائي
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOutcomeSession(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                  >
                    {isModalReadOnly ? 'إغلاق' : 'إلغاء'}
                  </button>
                  {!isModalReadOnly && (
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow-md"
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
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">إضافة جلسة جديدة لرول الأجندة</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اختر القضية النشطة</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedCaseId(cid);
                    const targetCase = cases.find(c => c.id === cid);
                    if (targetCase) {
                      setNewSessionCourt(targetCase.court || '');
                      setNewSessionCircuit(targetCase.circuit || '');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  {cases.filter(c => !c.isArchived).map(c => (
                    <option key={c.id} value={c.id}>
                      قضية {c.caseNumberFirstInstance} / {c.caseYearFirstInstance} ({c.clientName}) - {c.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المحكمة</label>
                  <CourtSelect
                    value={newSessionCourt}
                    onChange={setNewSessionCourt}
                    placeholder="مثال: محكمة أسرة التجمع الخامس"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الدائرة (يدوياً)</label>
                  <input
                    type="text"
                    placeholder="مثال: الدائرة 3 إيجارات"
                    value={newSessionCircuit}
                    onChange={(e) => setNewSessionCircuit(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ الجلسة</label>
                  <input
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">توقيت الجلسة (الساعة)</label>
                  <input
                    type="time"
                    value={newSessionTime}
                    onChange={(e) => setNewSessionTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">موضوع الجلسة والطلبات المطلوبة</label>
                <input
                  type="text"
                  placeholder="مثال: مرافعة الدفاع وتقديم مذكرة الرد"
                  value={newSessionSubject}
                  onChange={(e) => setNewSessionSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">المحامي المسؤول والمكلف بالحضور</label>
                <select
                  value={newSessionLawyer}
                  onChange={(e) => setNewSessionLawyer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">اختر محامياً</option>
                  {distinctLawyers.map(l => (
                    <option key={l.id} value={l.id}>{l.fullName} ({l.title})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg"
                >
                  جدولة الجلسة بالرول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal (تعديل الجلسة يدوياً) */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto text-right" dir="rtl">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Edit className="w-5 h-5 text-amber-500" />
                تعديل بيانات الجلسة يدوياً (قضية رقم {editingSession.caseNumber})
              </h3>
              <button
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSessionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-right">المحكمة</label>
                  <CourtSelect
                    value={editSessionCourt}
                    onChange={setEditSessionCourt}
                    placeholder="مثال: محكمة أسرة التجمع الخامس"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-right">الدائرة (يدوياً)</label>
                  <input
                    type="text"
                    value={editSessionCircuit}
                    onChange={(e) => setEditSessionCircuit(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                    placeholder="مثال: الدائرة 3 إيجارات"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-right">تاريخ الجلسة</label>
                  <input
                    type="date"
                    value={editSessionDate}
                    onChange={(e) => setEditSessionDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-right">توقيت الجلسة (الساعة)</label>
                  <input
                    type="time"
                    value={editSessionTime}
                    onChange={(e) => setEditSessionTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-right">موضوع الجلسة والطلبات المطلوبة</label>
                <input
                  type="text"
                  value={editSessionSubject}
                  onChange={(e) => setEditSessionSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-right">المحامي المسؤول والمكلف بالحضور</label>
                <select
                  value={editSessionLawyer}
                  onChange={(e) => setEditSessionLawyer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                >
                  <option value="">اختر محامياً</option>
                  {distinctLawyers.map(l => (
                    <option key={l.id} value={l.id}>{l.fullName} ({l.title})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg"
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
