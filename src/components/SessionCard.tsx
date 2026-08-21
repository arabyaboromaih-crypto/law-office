/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HearingSession, Case, User } from '../types';
import { 
  Calendar as CalendarIcon, Clock, Gavel, CheckCircle2, AlertCircle, 
  FileText, Edit, FolderOpen, Trash2, Sparkles, UserCheck, ShieldAlert, Scale 
} from 'lucide-react';
import { toAr } from '../utils/arabicNumbers';
import { getEffectiveStageInfo } from '../utils/stageUtils';

export const isDetentionSession = (s: HearingSession) => {
  return !!s.isDetentionRenewal || 
    (s.subject && (s.subject.includes('تجديد') || s.subject.includes('حبس') || s.subject.includes('احتياطي'))) ||
    (s.court && (s.court.includes('تجديد') || s.court.includes('مشورة')));
};

export const isExpertSession = (s: HearingSession) => {
  return (s.court && s.court.includes('خبراء')) || (s.subject && s.subject.includes('خبرة'));
};

export const renderSessionCategoryBadge = (session: HearingSession, parentCase?: Case) => {
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

export interface SessionCardProps {
  key?: React.Key;
  session: HearingSession;
  cases: Case[];
  currentUser: User;
  todayStr: string;
  sessions: HearingSession[];
  onOpenOutcome: (s: HearingSession) => void;
  onOpenEditSession?: (s: HearingSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onSearchCase?: (caseId: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenCaseFile?: (caseId: string) => void;
  showCaseFileButton?: boolean;
}

export default function SessionCard({
  session,
  cases,
  currentUser,
  todayStr,
  sessions,
  onOpenOutcome,
  onOpenEditSession,
  onDeleteSession,
  onSearchCase,
  onNavigateToTab,
  onOpenCaseFile,
  showCaseFileButton = true
}: SessionCardProps) {
  const parentCase = cases.find(c => c.id === session.caseId);
  const eff = getEffectiveStageInfo(parentCase, session);

  const handleOpenCase = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetCaseId = session.caseId;
    if (!targetCaseId) return;
    if (onOpenCaseFile) {
      onOpenCaseFile(targetCaseId);
    } else {
      if (onSearchCase) onSearchCase(targetCaseId);
      if (onNavigateToTab) onNavigateToTab('cases');
    }
  };

  const isToday = session.date === todayStr;
  const isPast = session.date < todayStr;
  const isFuture = session.date > todayStr;
  const isCompleted = session.status === 'completed' || !!session.decision;
  const isPostponed = session.status === 'postponed' || (session.decision && session.nextHearingDate);

  const hasRecordedDecisionOnSameDate = sessions.some(
    s => s.id !== session.id && s.caseId === session.caseId && s.date === session.date && (!!s.decision || s.status === 'completed')
  );

  // Status Badge
  let statusBadge = null;
  if (isCompleted) {
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
      <span className="text-xs font-black text-rose-950 bg-rose-100 border-2 border-rose-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs" style={{ backgroundColor: '#ffe4e6', color: '#881337', borderColor: '#fb7185' }}>
        <span className="w-5 h-5 rounded-full bg-rose-200 border border-rose-300 flex items-center justify-center shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-rose-800" />
        </span>
        <span className="font-black text-rose-950" style={{ color: '#881337' }}>جلسة سابقة (بانتظار القرار)</span>
      </span>
    );
  }

  return (
    <div 
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
            <button
              type="button"
              onClick={handleOpenCase}
              className="font-black text-slate-900 hover:text-amber-700 text-sm flex items-center gap-1.5 transition-colors cursor-pointer text-right group"
              title="اضغط لفتح ملف هذه القضية مباشرة"
            >
              <FolderOpen className="w-4 h-4 text-amber-600 group-hover:text-amber-700 shrink-0" />
              <span className="group-hover:underline decoration-amber-500 decoration-2 underline-offset-4">
                دعوى {toAr(eff.caseNumber || session.caseNumber)} / {toAr(eff.caseYear || session.caseYear)} - {session.type}
              </span>
            </button>
            <span className="text-xs font-bold text-slate-500">({eff.court})</span>
          </div>

          {showCaseFileButton && (
            <button
              type="button"
              onClick={handleOpenCase}
              className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl py-1.5 px-3 shadow-3xs transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 active:scale-95"
              title="فتح ملف ومستندات القضية بالكامل"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>ملف القضية</span>
            </button>
          )}
        </div>
        
        <div className="text-xs sm:text-sm text-slate-800 font-bold leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><strong className="text-slate-900">مكان النظر / المحكمة:</strong> <span className="text-amber-900 font-black">{eff.court}</span></span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span><strong className="text-slate-900">الدائرة:</strong> <span className="text-slate-950 font-black">{eff.circuit}</span></span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span><strong className="text-slate-900">الموكل:</strong> <span className="text-slate-950 font-black">{session.clientName}</span></span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span><strong className="text-slate-900">الخصم:</strong> <span className="text-slate-900 font-bold">{session.opponentName}</span></span>
          </div>
        </div>

        {session.subject && (
          <div className="text-xs sm:text-sm bg-amber-50 border-2 border-amber-400/90 p-3 rounded-2xl font-bold shadow-2xs my-1 block leading-relaxed session-subject-box" style={{ backgroundColor: '#fffbeb', borderColor: '#fbbf24' }}>
            <div className="flex items-center gap-1.5 mb-1.5 font-black text-xs sm:text-sm" style={{ color: '#78350f' }}>
              <span className="w-5 h-5 rounded-lg bg-amber-200/90 text-amber-950 flex items-center justify-center shrink-0 font-black">
                📌
              </span>
              <span className="underline decoration-amber-500/80 decoration-2 underline-offset-2 font-black text-amber-950">موضوع الجلسة والطلبات:</span>
            </div>
            <div className="text-slate-950 font-black text-xs sm:text-sm leading-relaxed pr-6" style={{ color: '#020617' }}>
              <p className="font-black text-slate-950 text-xs sm:text-sm leading-relaxed tracking-wide" style={{ color: '#020617' }}>
                {session.subject}
              </p>
            </div>
          </div>
        )}

        {session.assignedLawyerName && (
          <p className="text-xs sm:text-sm text-slate-800 font-bold flex items-center gap-1.5 pt-0.5" style={{ color: '#1e293b' }}>
            <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5 text-amber-800" />
            </span>
            <span><strong className="text-slate-900">المحامي المكلف بالحضور:</strong> <span className="text-slate-950 font-black">{session.assignedLawyerName}</span></span>
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

      {/* Status & Actions Bar */}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        {/* 1. Status Badge */}
        {statusBadge}

        {/* 2. Edit button */}
        {onOpenEditSession && currentUser?.permissions?.editSession && (
          <button
            onClick={() => onOpenEditSession(session)}
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
          if (isCompleted) {
            return (
              <button
                onClick={() => onOpenOutcome(session)}
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
                onClick={() => onOpenOutcome(session)}
                className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs py-2 px-4 rounded-xl border border-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 ring-1 ring-amber-400/40"
                style={{ color: '#020617' }}
              >
                <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-3xs">
                  <Gavel className="w-3 h-3 text-amber-400" />
                </span>
                <span className="font-black text-slate-950" style={{ color: '#020617' }}>تسجيل القرار</span>
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
        {onDeleteSession && currentUser?.permissions?.deleteSession !== false && (
          <button
            onClick={() => {
              const confirmDelete = window.confirm(`هل أنت تأكد من حذف جلسة القضية (${session.caseNumber || ''}) المنعقدة بتاريخ (${session.date}) نهائياً؟`);
              if (!confirmDelete) return;
              onDeleteSession(session.id);
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
    </div>
  );
}
