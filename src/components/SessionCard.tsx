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

export const isDetentionSession = (s?: HearingSession | null, parentCase?: Case | null, allCases?: Case[]) => {
  if (!s) return false;
  const targetCase = parentCase || (allCases ? allCases.find(c => c.id === s.caseId) : undefined);
  // إذا كانت القضية محددة ومرحلة التحقيق غير مفعّلة: يُمنع نهائياً وبشكل قاطع اعتبار الجلسة جلسة تجديد حبس
  if (targetCase && !targetCase.isInvestigationActive) return false;
  if (!targetCase && s.isDetentionRenewal === false) return false;
  if (s.isDetentionRenewal) return true;
  if (s.detentionRenewalId || s.detentionRenewalNumber || s.detentionAuthority || s.detentionDurationDays) return true;
  if (s.id && (s.id.includes('detention') || s.id.includes('session-detention'))) return true;
  if (s.subject && (s.subject.includes('تجديد') || s.subject.includes('حبس') || s.subject.includes('احتياطي'))) return true;
  if (s.court && (s.court.includes('تجديد') || s.court.includes('مشورة'))) return true;
  if (targetCase?.isInvestigationActive) {
    if (targetCase.detentionRenewals && targetCase.detentionRenewals.length > 0) {
      const hasMatch = targetCase.detentionRenewals.some(r => 
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
      <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px] font-black px-2.5 sm:px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs shrink-0 max-w-full">
        <span className="w-5 h-5 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
          <Lock className="w-3 h-3 text-rose-600" />
        </span>
        <span className="whitespace-nowrap">تجديد حبس احتياطي</span>
        {session.detentionRenewalNumber && (
          <span className="text-[9px] bg-rose-200 text-rose-950 px-1.5 py-0.2 rounded-md font-black whitespace-nowrap">
            تجديد #{session.detentionRenewalNumber}
          </span>
        )}
        {session.detentionDuration && (
          <span className="text-[9px] bg-rose-100 text-rose-900 border border-rose-200 px-1.5 py-0.2 rounded-md font-bold whitespace-nowrap">
            {session.detentionDuration}
          </span>
        )}
        {session.detentionAuthority && (
          <span className="text-[9px] bg-rose-700 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
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
        <span className="whitespace-nowrap">جلسة خبراء</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-full border shadow-2xs shrink-0 ${eff.badgeStyle}`}>
      <span className="w-5 h-5 rounded-full bg-white/80 border border-current flex items-center justify-center shrink-0">
        <Gavel className="w-3 h-3 text-current" />
      </span>
      <span className="whitespace-nowrap">{eff.badgeText}</span>
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
      className={`w-full p-3.5 sm:p-4 md:p-5 rounded-2xl flex flex-col gap-3.5 transition-all border text-right overflow-hidden ${
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
      {/* 1. Header: Badges, Date/Time, Case Link & Case File Button */}
      <div className="flex flex-col gap-2 w-full">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {renderSessionCategoryBadge(session, parentCase)}

            <span className="text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full font-mono bg-slate-900 text-amber-400 shadow-3xs shrink-0 whitespace-nowrap">
              📅 {session.date}
            </span>
            <span className={`text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full font-mono shrink-0 whitespace-nowrap ${
              isCompleted 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : isToday 
                  ? 'bg-amber-500 text-slate-950 font-black' 
                  : 'bg-blue-100 text-blue-900 border border-blue-200'
            }`}>
              🕒 {session.time}
            </span>
          </div>

          {showCaseFileButton && (
            <button
              type="button"
              onClick={handleOpenCase}
              className="bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 rounded-xl py-1.5 px-3 shadow-3xs transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 active:scale-95"
              title="فتح ملف ومستندات القضية بالكامل"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="whitespace-nowrap">ملف القضية</span>
            </button>
          )}
        </div>

        {/* Case Title and Court Link */}
        <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 min-w-0 pt-0.5">
          <button
            type="button"
            onClick={handleOpenCase}
            className="font-black text-slate-900 hover:text-amber-700 text-xs sm:text-sm md:text-base flex items-center gap-1.5 transition-colors cursor-pointer text-right group break-words min-w-0"
            title="اضغط لفتح ملف هذه القضية مباشرة"
          >
            <FolderOpen className="w-4 h-4 text-amber-600 group-hover:text-amber-700 shrink-0 mt-0.5" />
            <span className="group-hover:underline decoration-amber-500 decoration-2 underline-offset-4 break-words">
              دعوى {toAr(eff.caseNumber || session.caseNumber)} / {toAr(eff.caseYear || session.caseYear)} - {session.type}
            </span>
          </button>
          {eff.court && (
            <span className="text-xs font-bold text-slate-500 break-words">
              ({eff.court})
            </span>
          )}
        </div>
      </div>
      
      {/* 2. Venue & Parties Info Box */}
      <div className="text-xs text-slate-800 font-bold bg-slate-50/90 p-2.5 sm:p-3 rounded-xl border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-right">
          <div className="flex flex-wrap items-baseline gap-1 min-w-0">
            <span className="text-slate-500 font-semibold shrink-0">
              {isExpert ? 'مكتب الخبراء / الجهة:' : 'مكان النظر / المحكمة:'}
            </span>
            <span className="text-amber-950 font-black break-words min-w-0">
              {eff.court || 'غير محدد'}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-1 min-w-0">
            <span className="text-slate-500 font-semibold shrink-0">
              {isExpert ? 'مقر المباشرة / المعاينة:' : 'الدائرة:'}
            </span>
            <span className="text-slate-950 font-black break-words min-w-0">
              {eff.circuit || 'غير محدد'}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-1 min-w-0">
            <span className="text-slate-500 font-semibold shrink-0">الموكل:</span>
            <span className="text-slate-950 font-black break-words min-w-0">
              {session.clientName || 'غير محدد'}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-1 min-w-0">
            <span className="text-slate-500 font-semibold shrink-0">الخصم:</span>
            <span className="text-slate-900 font-bold break-words min-w-0">
              {session.opponentName || 'غير محدد'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Detention Info (if detention session) */}
      {isDetention && (session.detentionStartDate || session.detentionDuration || session.detentionDurationDays || session.detentionRenewalNumber || session.detentionAuthority) && (
        <div className="text-xs bg-rose-50/80 border border-rose-200/90 p-2.5 sm:p-3 rounded-xl font-bold text-rose-950 space-y-2">
          <div className="flex items-center gap-1.5 font-black text-rose-900">
            <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span>بيانات الحبس الاحتياطي والتجديد:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-800">
            {session.detentionStartDate && (
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-slate-600 shrink-0">تاريخ بداية الحبس:</span>{' '}
                <span className="font-mono font-bold text-rose-950 break-words">{session.detentionStartDate}</span>
              </div>
            )}
            {(session.detentionDuration || session.detentionDurationDays) && (
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-slate-600 shrink-0">مدة الحبس:</span>{' '}
                <span className="font-black text-rose-950 break-words">{session.detentionDuration || `${session.detentionDurationDays} يوم`}</span>
              </div>
            )}
            {session.detentionRenewalNumber && (
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-slate-600 shrink-0">رقم التجديد:</span>{' '}
                <span className="font-black text-rose-950 break-words">تجديد #{session.detentionRenewalNumber}</span>
              </div>
            )}
            {session.detentionAuthority && (
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-slate-600 shrink-0">جهة التجديد:</span>{' '}
                <span className="font-bold text-rose-950 break-words">{session.detentionAuthority}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Subject Box (if subject exists) */}
      {session.subject && (
        <div className="text-xs sm:text-sm bg-amber-50 border-2 border-amber-400/90 p-2.5 sm:p-3 rounded-2xl font-bold shadow-2xs my-0.5 block leading-relaxed session-subject-box break-words overflow-hidden" style={{ backgroundColor: '#fffbeb', borderColor: '#fbbf24' }}>
          <div className="flex items-center gap-1.5 mb-1 font-black text-xs sm:text-sm text-amber-950" style={{ color: '#78350f' }}>
            <span className="w-5 h-5 rounded-lg bg-amber-200/90 text-amber-950 flex items-center justify-center shrink-0 font-black">
              📌
            </span>
            <span className="underline decoration-amber-500/80 decoration-2 underline-offset-2 font-black text-amber-950">
              {isExpert ? 'موضوع ومهمة جلسة الخبير:' : 'موضوع الجلسة والطلبات:'}
            </span>
          </div>
          <div className="text-slate-950 font-black text-xs sm:text-sm leading-relaxed pr-6 sm:pr-7 break-words [overflow-wrap:anywhere]" style={{ color: '#020617' }}>
            <p className="font-black text-slate-950 text-xs sm:text-sm leading-relaxed tracking-wide break-words" style={{ color: '#020617' }}>
              {session.subject}
            </p>
          </div>
        </div>
      )}

      {/* 5. Assigned Lawyer (if assigned) */}
      {session.assignedLawyerName && (
        <p className="text-xs sm:text-sm text-slate-800 font-bold flex items-center gap-1.5 pt-0.5 break-words min-w-0" style={{ color: '#1e293b' }}>
          <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
            <UserCheck className="w-3.5 h-3.5 text-amber-800" />
          </span>
          <span className="break-words">
            <strong className="text-slate-900">{isExpert ? 'المحامي المكلف بالحضور أمام الخبير:' : 'المحامي المكلف بالحضور:'}</strong>{' '}
            <span className="text-slate-950 font-black">{session.assignedLawyerName}</span>
          </span>
        </p>
      )}

      {/* 6. Decision & Next Hearing Date Box (if decision exists) */}
      {session.decision && (
        <div className="mt-1 text-xs bg-emerald-500/10 border border-emerald-300/80 p-2.5 sm:p-3 rounded-xl text-emerald-950 font-bold space-y-1.5 break-words">
          <div className="flex items-center gap-1.5 text-emerald-800 font-black">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isExpertSession(session)
                ? 'إجراء / قرار الخبير المباشر:'
                : isDetention
                ? 'قرار سلطة التحقيق / المحكمة:'
                : 'قرار المحكمة الصادر:'}
            </span>
          </div>
          <p className="pr-5 text-slate-800 break-words leading-relaxed">{session.decision}</p>
          {session.nextHearingDate && (
            <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2 font-black text-amber-900 text-xs">
              <span>📅 {isExpertSession(session) ? 'تحددت جلسة الخبرة التالية في:' : 'تأجلت لجلسة:'} <span className="font-mono">{session.nextHearingDate}</span></span>
              {session.nextHearingCircuit && !isExpertSession(session) && !isDetention && (
                <span className="inline-flex items-center text-slate-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-300">
                  الدائرة: <strong className="mr-1 text-amber-950 font-black">{session.nextHearingCircuit}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. Status & Actions Bar (Fully Responsive) */}
      <div className="w-full pt-3 mt-0.5 border-t border-slate-100/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Status Badge */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {statusBadge}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-stretch sm:justify-end">
          {/* Edit button */}
          {onOpenEditSession && currentUser?.permissions?.editSession && (
            <button
              onClick={() => onOpenEditSession(session)}
              className={`font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 border flex-1 sm:flex-initial shrink-0 ${
                isDetention 
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
              }`}
              title={isDetention ? "تعديل بيانات جلسة تجديد الحبس" : isCompleted ? "تعديل قرار الجلسة والمنطوق" : "تعديل تفاصيل الجلسة يدوياً"}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                isDetention ? 'bg-rose-200 text-rose-800' : isCompleted ? 'bg-amber-200 text-amber-900' : 'bg-white text-slate-600'
              }`}>
                {isDetention ? <Lock className="w-3 h-3 text-rose-700" /> : <Edit className="w-3 h-3 text-slate-600" />}
              </span>
              <span>{isDetention ? 'تعديل التجديد' : isCompleted ? 'تعديل القرار' : 'تعديل'}</span>
            </button>
          )}

          {/* Detention Renewals Modal button */}
          {onOpenDetentionModal && parentCase && parentCase.isInvestigationActive && (
            <button
              type="button"
              onClick={() => onOpenDetentionModal(parentCase, session.date)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 flex-1 sm:flex-initial shrink-0"
              title="فتح سجل وإجراءات تجديد الحبس الاحتياطي"
            >
              <span className="w-4 h-4 rounded-full bg-amber-200/90 flex items-center justify-center shrink-0">
                <Lock className="w-3 h-3 text-amber-800" />
              </span>
              <span>سجل التجديدات</span>
            </button>
          )}

          {/* Record or View Decision Button */}
          {(() => {
            if (isCompleted) {
              return (
                <button
                  onClick={() => onOpenOutcome(session)}
                  className={`font-bold text-xs py-2 px-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 border flex-1 sm:flex-initial shrink-0 ${
                    isDetention
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                  title={isDetention ? "عرض واستعراض قرار جلسة التجديد (للعرض فقط)" : isExpert ? "عرض واستعراض قرار وإجراء جلسة الخبير (للعرض فقط)" : "عرض واستعراض قرار الجلسة (للعرض فقط)"}
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
                <span className="text-xs text-amber-900 font-bold bg-amber-50 border border-amber-300/80 px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 shadow-3xs flex-1 sm:flex-initial">
                  <span>⚠️ تم تسجيل قرار اليوم هذه القضية</span>
                </span>
              );
            } else if (isToday || isPast) {
              return currentUser?.permissions?.recordSessionDecision ? (
                <button
                  onClick={() => onOpenOutcome(session)}
                  className={`font-black text-xs py-2 px-4 rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 flex-1 sm:flex-initial shrink-0 ${
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
              return (
                <span 
                  className="text-xs text-slate-500 font-bold bg-slate-100/80 border border-slate-200 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                  title="تسجيل القرار متاح فقط في يوم انعقاد الجلسة أو بعدها"
                >
                  <span className="text-slate-400">⏳</span>
                  <span>لم يحن موعد الجلسة</span>
                </span>
              );
            }
          })()}

          {/* Delete Session Button */}
          {onDeleteSession && currentUser?.permissions?.deleteSession !== false && (
            <button
              onClick={() => {
                const confirmDelete = window.confirm(`هل أنت تأكد من حذف جلسة القضية (${session.caseNumber || ''}) المنعقدة بتاريخ (${session.date}) نهائياً؟`);
                if (!confirmDelete) return;
                onDeleteSession(session.id);
              }}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/90 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs active:scale-95 shrink-0"
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
    </div>
  );
}
