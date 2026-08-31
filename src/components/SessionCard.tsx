/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HearingSession, Case, User } from '../types';
import { 
  Calendar as CalendarIcon, Clock, Gavel, CheckCircle2, AlertCircle, 
  FileText, Edit, FolderOpen, Trash2, Sparkles, UserCheck, ShieldAlert, Scale, Lock 
} from 'lucide-react';
import { toAr } from '../utils/arabicNumbers';
import { getEffectiveStageInfo } from '../utils/stageUtils';

export const isDetentionSession = (s?: HearingSession | null, parentCase?: Case | null) => {
  if (!s) return false;
  if (s.isDetentionRenewal) return true;
  if (s.detentionRenewalId || s.detentionRenewalNumber || s.detentionAuthority || s.detentionDurationDays) return true;
  if (s.id && (s.id.includes('detention') || s.id.includes('session-detention'))) return true;
  if (s.subject && (s.subject.includes('تجديد') || s.subject.includes('حبس') || s.subject.includes('احتياطي'))) return true;
  if (s.court && (s.court.includes('تجديد') || s.court.includes('مشورة'))) return true;
  if (parentCase?.isInvestigationActive) {
    if (parentCase.detentionRenewals && parentCase.detentionRenewals.length > 0) {
      const hasMatch = parentCase.detentionRenewals.some(r => 
        (r.id && (r.id === s.detentionRenewalId || s.id?.includes(r.id))) ||
        ((r.date || r.renewalDate) === s.date) ||
        (r.nextRenewalDate === s.date)
      );
      if (hasMatch) return true;
    }
    return true;
  }
  return false;
};

export const isExpertSession = (s: HearingSession) => {
  return !!s.isExpertSession || (s.court && s.court.includes('خبراء')) || (s.subject && (s.subject.includes('خبرة') || s.subject.includes('خبير')));
};

export const renderSessionCategoryBadge = (session: HearingSession, parentCase?: Case) => {
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
  onOpenDetentionModal?: (c: Case, initialDate?: string) => void;
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
  onOpenDetentionModal,
  showCaseFileButton = true
}: SessionCardProps) {
  const parentCase = cases.find(c => c.id === session.caseId);
  const eff = getEffectiveStageInfo(parentCase, session);
  const isExpert = isExpertSession(session) || !!parentCase?.isReferredToExperts || !!parentCase?.expertReferral?.isReferred;
  const isDetention = isDetentionSession(session, parentCase);

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
  const hasDecision = !!session.decision && session.decision.trim() !== '';
  const isCompleted = session.status === 'completed' || (session.status !== 'pending' && hasDecision);
  const isPostponed = session.status === 'postponed' && !isCompleted;

  const hasRecordedDecisionOnSameDate = !isCompleted && sessions.some(
    s => s.id !== session.id && s.caseId === session.caseId && s.date === session.date && (s.status === 'completed' || (s.status !== 'pending' && !!s.decision && s.decision.trim() !== ''))
  );

  // Status Badge
  let statusBadge = null;
  if (isCompleted) {
    statusBadge = (
      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
        <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          {isDetention ? <Lock className="w-3.5 h-3.5 text-emerald-700" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        </span>
        <span>{isDetention ? 'تم صدور قرار التجديد' : isExpert ? 'تم تسجيل قرار الخبير' : 'تم تسجيل القرار'}</span>
      </span>
    );
  } else if (isPostponed) {
    statusBadge = (
      <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
        <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
        </span>
        <span>{isDetention ? 'جلسة تجديد مؤجلة' : isExpert ? 'جلسة خبير مؤجلة' : 'جلسة مؤجلة'}</span>
      </span>
    );
  } else if (isToday) {
    statusBadge = (
      <span className="text-xs font-black text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
        <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
          {isDetention ? <Lock className="w-3.5 h-3.5 text-amber-800" /> : <Sparkles className="w-3.5 h-3.5 text-amber-800 animate-spin-slow" />}
        </span>
        <span>{isDetention ? 'جلسة التجديد اليوم' : isExpert ? 'جلسة الخبير اليوم' : 'الجلسة اليوم'}</span>
      </span>
    );
  } else if (isFuture) {
    statusBadge = (
      <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
        <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          {isDetention ? <Lock className="w-3.5 h-3.5 text-blue-700" /> : <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />}
        </span>
        <span>{isDetention ? 'جلسة تجديد قادمة' : isExpert ? 'جلسة خبير قادمة' : 'جلسة قادمة'}</span>
      </span>
    );
  } else if (isPast) {
    statusBadge = (
      <span className="text-xs font-black text-rose-950 bg-rose-100 border-2 border-rose-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs" style={{ backgroundColor: '#ffe4e6', color: '#881337', borderColor: '#fb7185' }}>
        <span className="w-5 h-5 rounded-full bg-rose-200 border border-rose-300 flex items-center justify-center shrink-0">
          {isDetention ? <Lock className="w-3.5 h-3.5 text-rose-800" /> : <AlertCircle className="w-3.5 h-3.5 text-rose-800" />}
        </span>
        <span className="font-black text-rose-950" style={{ color: '#881337' }}>
          {isDetention ? 'جلسة تجديد سابقة (بانتظار القرار)' : isExpert ? 'جلسة خبير سابقة (بانتظار القرار)' : 'جلسة سابقة (بانتظار القرار)'}
        </span>
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
            : isDetention
              ? 'bg-gradient-to-r from-rose-50/30 via-white to-white border-r-4 border-r-rose-500 border-slate-200/90 shadow-3xs hover:shadow-2xs'
              : isExpert
                ? 'bg-white border-r-4 border-r-indigo-600 border-slate-200/90 shadow-3xs hover:shadow-2xs'
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
            <span>
              <strong className="text-slate-900">{isExpert ? 'مكتب الخبراء / الجهة:' : 'مكان النظر / المحكمة:'}</strong>{' '}
              <span className="text-amber-900 font-black">{eff.court}</span>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span>
              <strong className="text-slate-900">{isExpert ? 'مقر المباشرة / المعاينة:' : 'الدائرة:'}</strong>{' '}
              <span className="text-slate-950 font-black">{eff.circuit}</span>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span><strong className="text-slate-900">الموكل:</strong> <span className="text-slate-950 font-black">{session.clientName}</span></span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span><strong className="text-slate-900">الخصم:</strong> <span className="text-slate-900 font-bold">{session.opponentName}</span></span>
          </div>
        </div>

        {isDetention && (session.detentionStartDate || session.detentionDuration || session.detentionDurationDays || session.detentionRenewalNumber || session.detentionAuthority) && (
          <div className="text-xs bg-rose-50/80 border border-rose-200/90 p-2.5 rounded-xl font-bold text-rose-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-black text-rose-900">
              <Lock className="w-3.5 h-3.5 text-rose-700" />
              <span>بيانات الحبس الاحتياطي والتجديد:</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-800">
              {session.detentionStartDate && (
                <span>
                  <strong className="text-slate-900">تاريخ بداية الحبس:</strong>{' '}
                  <span className="font-mono font-bold text-rose-950">{session.detentionStartDate}</span>
                </span>
              )}
              {session.detentionStartDate && <span className="text-rose-200 hidden sm:inline">|</span>}
              {(session.detentionDuration || session.detentionDurationDays) && (
                <span>
                  <strong className="text-slate-900">مدة الحبس:</strong>{' '}
                  <span className="font-black text-rose-950">{session.detentionDuration || `${session.detentionDurationDays} يوم`}</span>
                </span>
              )}
              {(session.detentionDuration || session.detentionDurationDays) && <span className="text-rose-200 hidden sm:inline">|</span>}
              {session.detentionRenewalNumber && (
                <span>
                  <strong className="text-slate-900">رقم التجديد:</strong>{' '}
                  <span className="font-black text-rose-950">تجديد #{session.detentionRenewalNumber}</span>
                </span>
              )}
              {session.detentionRenewalNumber && <span className="text-rose-200 hidden sm:inline">|</span>}
              {session.detentionAuthority && (
                <span>
                  <strong className="text-slate-900">جهة التجديد:</strong>{' '}
                  <span className="font-bold text-rose-950">{session.detentionAuthority}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {session.subject && (
          <div className="text-xs sm:text-sm bg-amber-50 border-2 border-amber-400/90 p-3 rounded-2xl font-bold shadow-2xs my-1 block leading-relaxed session-subject-box" style={{ backgroundColor: '#fffbeb', borderColor: '#fbbf24' }}>
            <div className="flex items-center gap-1.5 mb-1.5 font-black text-xs sm:text-sm" style={{ color: '#78350f' }}>
              <span className="w-5 h-5 rounded-lg bg-amber-200/90 text-amber-950 flex items-center justify-center shrink-0 font-black">
                📌
              </span>
              <span className="underline decoration-amber-500/80 decoration-2 underline-offset-2 font-black text-amber-950">
                {isExpert ? 'موضوع ومهمة جلسة الخبير:' : 'موضوع الجلسة والطلبات:'}
              </span>
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
            <span>
              <strong className="text-slate-900">{isExpert ? 'المحامي المكلف بالحضور أمام الخبير:' : 'المحامي المكلف بالحضور:'}</strong>{' '}
              <span className="text-slate-950 font-black">{session.assignedLawyerName}</span>
            </span>
          </p>
        )}

        {session.decision && (
          <div className="mt-2 text-xs bg-emerald-500/10 border border-emerald-300/80 p-3 rounded-xl text-emerald-950 font-bold space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-800 font-black">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isExpertSession(session)
                  ? 'إجراء / قرار الخبير المباشر:'
                  : isDetentionSession(session)
                  ? 'قرار سلطة التحقيق / المحكمة:'
                  : 'قرار المحكمة الصادر:'}
              </span>
            </div>
            <p className="pr-5 text-slate-800">{session.decision}</p>
            {session.nextHearingDate && (
              <span className="block mt-1 pt-1 border-t border-emerald-200/60 font-black text-amber-900">
                📅 {isExpertSession(session) ? 'تحددت جلسة الخبرة التالية في:' : 'تأجلت لجلسة:'} {session.nextHearingDate}
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
            className={`font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 border ${
              isDetention 
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
            }`}
            title={isDetention ? "تعديل بيانات جلسة تجديد الحبس" : "تعديل تفاصيل الجلسة يدوياً"}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              isDetention ? 'bg-rose-200 text-rose-800' : 'bg-white text-slate-600'
            }`}>
              {isDetention ? <Lock className="w-3 h-3 text-rose-700" /> : <Edit className="w-3 h-3 text-slate-600" />}
            </span>
            <span>{isDetention ? 'تعديل التجديد' : 'تعديل'}</span>
          </button>
        )}

        {/* 2.5 Detention Renewals Modal button */}
        {onOpenDetentionModal && parentCase && (isDetention || parentCase.isInvestigationActive || (parentCase.detentionRenewals && parentCase.detentionRenewals.length > 0)) && (
          <button
            type="button"
            onClick={() => onOpenDetentionModal(parentCase, session.date)}
            className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95"
            title="فتح سجل وإجراءات تجديد الحبس الاحتياطي"
          >
            <span className="w-4 h-4 rounded-full bg-amber-200/90 flex items-center justify-center shrink-0">
              <Lock className="w-3 h-3 text-amber-800" />
            </span>
            <span>سجل التجديدات</span>
          </button>
        )}

        {/* 3. Record or View Decision Button */}
        {(() => {
          if (isCompleted) {
            return (
              <button
                onClick={() => onOpenOutcome(session)}
                className={`font-bold text-xs py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 border ${
                  isDetention
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
                title={isDetention ? "عرض واستعراض قرار جلسة التجديد" : isExpert ? "عرض واستعراض قرار وإجراء جلسة الخبير" : "عرض واستعراض قرار الجلسة وتفاصيله"}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  isDetention ? 'bg-rose-200/80 text-rose-800' : 'bg-emerald-200/80 text-emerald-800'
                }`}>
                  {isDetention ? <Lock className="w-3 h-3 text-rose-800" /> : <FileText className="w-3 h-3 text-emerald-800" />}
                </span>
                <span>{isDetention ? 'استعراض قرار التجديد' : isExpert ? 'استعراض قرار الخبير' : 'استعراض القرار'}</span>
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
                className={`font-black text-xs py-2 px-4 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 ${
                  isDetention
                    ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 text-white border-rose-400 ring-1 ring-rose-400/40'
                    : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border-amber-300 ring-1 ring-amber-400/40'
                }`}
                style={isDetention ? { color: '#ffffff' } : { color: '#020617' }}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-3xs ${
                  isDetention ? 'bg-white text-rose-700' : 'bg-slate-950 text-amber-400'
                }`}>
                  {isDetention ? <Lock className="w-3 h-3 text-rose-700" /> : isExpert ? <Scale className="w-3 h-3 text-amber-400" /> : <Gavel className="w-3 h-3 text-amber-400" />}
                </span>
                <span className="font-black" style={isDetention ? { color: '#ffffff' } : { color: '#020617' }}>
                  {isDetention ? 'تسجيل قرار التجديد' : isExpert ? 'تسجيل قرار الخبير' : 'تسجيل القرار'}
                </span>
              </button>
            ) : null;
          } else {
            return currentUser?.permissions?.recordSessionDecision ? (
              <button
                onClick={() => onOpenOutcome(session)}
                className={`font-bold text-xs py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 border ${
                  isDetention
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
                title={isDetention ? "تسجيل قرار التجديد مسبقاً أو فور صدوره" : "تسجيل القرار مسبقاً أو فور صدوره"}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  isDetention ? 'bg-rose-200/80 text-rose-800' : 'bg-amber-200/80 text-amber-800'
                }`}>
                  {isDetention ? <Lock className="w-3 h-3 text-rose-800" /> : isExpert ? <Scale className="w-3 h-3 text-amber-800" /> : <Gavel className="w-3 h-3 text-amber-800" />}
                </span>
                <span>{isDetention ? 'تسجيل قرار التجديد' : isExpert ? 'تسجيل قرار الخبير' : 'تسجيل القرار'}</span>
              </button>
            ) : (
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
