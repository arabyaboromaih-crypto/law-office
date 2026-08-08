import { Case, HearingSession, LitigationDegree } from '../types';

export interface EffectiveStageInfo {
  degreeLabel: LitigationDegree | string; // 'أول درجة' | 'استئناف' | 'نقض' | 'تحقيق' | string
  caseNumber: string;
  caseYear: string;
  court: string;
  circuit: string;
  isAppeal: boolean;
  isCassation: boolean;
  isInvestigation: boolean;
  isFirstInstance: boolean;
  stageNameAr: string; // e.g. "محكمة الاستئناف" or "طعن النقض" or "محكمة أول درجة"
  badgeText: string;
  badgeStyle: string;
}

/**
 * Calculates the latest active registered litigation stage for a case (and session).
 * Respects all registered degrees without deleting or altering previous historical data.
 */
export function getEffectiveStageInfo(c: Case | undefined, session?: HearingSession): EffectiveStageInfo {
  if (!c) {
    return {
      degreeLabel: 'عام',
      caseNumber: session?.caseNumber || '',
      caseYear: session?.caseYear || '',
      court: session?.court || 'غير محدد',
      circuit: session?.circuit || 'غير محدد',
      isAppeal: false,
      isCassation: false,
      isInvestigation: false,
      isFirstInstance: false,
      stageNameAr: session?.court || 'غير محدد',
      badgeText: 'جلسة عامة',
      badgeStyle: 'bg-slate-100 text-slate-800 border-slate-200'
    };
  }

  // 1. Check Cassation (النقض): If cassationNumber exists OR degree is 'نقض' OR courtCassation exists OR session court mentions 'نقض'
  const isCassationSession = !!(session && session.court && session.court.includes('نقض'));
  const hasCassation = !!(c.cassationNumber || c.degree === 'نقض' || c.courtCassation || isCassationSession);

  if (hasCassation) {
    const caseNumber = c.cassationNumber || (isCassationSession ? session?.caseNumber : '') || c.caseNumberFirstInstance || '';
    const caseYear = c.cassationYear || (isCassationSession ? session?.caseYear : '') || c.caseYearFirstInstance || '';
    const court = c.courtCassation || (isCassationSession ? session?.court : '') || (c.court && c.court.includes('نقض') ? c.court : 'محكمة النقض');
    const circuit = c.circuitCassation || session?.circuit || c.circuit || 'الدائرة الجنائية / المدنية';

    return {
      degreeLabel: 'نقض',
      caseNumber,
      caseYear,
      court,
      circuit,
      isAppeal: false,
      isCassation: true,
      isInvestigation: false,
      isFirstInstance: false,
      stageNameAr: 'محكمة النقض',
      badgeText: 'طعن النقض',
      badgeStyle: 'bg-indigo-100 text-indigo-900 border-indigo-300'
    };
  }

  // 2. Check Appeal (الاستئناف): If caseNumberSecondInstance exists OR degree is 'استئناف' OR courtSecondInstance exists OR session court/subject mentions 'استئناف'
  const isAppealSession = !!(session && (
    (session.court && (session.court.includes('استئناف') || session.court.includes('مستأنف'))) ||
    (session.subject && session.subject.includes('استئناف'))
  ));
  const hasAppeal = !!(c.caseNumberSecondInstance || c.degree === 'استئناف' || c.courtSecondInstance || isAppealSession);

  if (hasAppeal) {
    const caseNumber = c.caseNumberSecondInstance || (isAppealSession ? session?.caseNumber : '') || c.caseNumberFirstInstance || '';
    const caseYear = c.caseYearSecondInstance || (isAppealSession ? session?.caseYear : '') || c.caseYearFirstInstance || '';
    const court = c.courtSecondInstance || (isAppealSession ? session?.court : '') || (c.court && (c.court.includes('استئناف') || c.court.includes('مستأنف')) ? c.court : 'محكمة الاستئناف');
    const circuit = c.circuitSecondInstance || session?.circuit || c.circuit || 'دائرة الاستئناف';

    return {
      degreeLabel: 'استئناف',
      caseNumber,
      caseYear,
      court,
      circuit,
      isAppeal: true,
      isCassation: false,
      isInvestigation: false,
      isFirstInstance: false,
      stageNameAr: 'محكمة الاستئناف',
      badgeText: 'مرحلة الاستئناف',
      badgeStyle: 'bg-purple-100 text-purple-900 border-purple-300'
    };
  }

  // 3. Check Investigation / Detention Renewal (التحقيق والتجديد)
  const isDetentionSession = !!(session && (
    session.isDetentionRenewal || 
    (session.subject && (session.subject.includes('تجديد') || session.subject.includes('حبس') || session.subject.includes('احتياطي'))) ||
    (session.court && (session.court.includes('تجديد') || session.court.includes('مشورة') || session.court.includes('نيابة')))
  ));
  const isInvestigation = !!(c.isInvestigationActive || c.degree === 'تحقيق' || c.investigationNumber || isDetentionSession);

  if (isInvestigation) {
    const caseNumber = c.investigationNumber || session?.caseNumber || c.caseNumberFirstInstance || '';
    const caseYear = c.investigationYear || session?.caseYear || c.caseYearFirstInstance || '';
    const court = session?.detentionAuthority || c.investigationAuthority || session?.court || c.court || 'النيابة العامة';
    const circuit = session?.circuit || c.circuit || 'غرفة المشورة / النيابة';

    return {
      degreeLabel: 'تحقيق',
      caseNumber,
      caseYear,
      court,
      circuit,
      isAppeal: false,
      isCassation: false,
      isInvestigation: true,
      isFirstInstance: false,
      stageNameAr: 'جهة التحقيق والنيابة العامة',
      badgeText: 'تجديد حبس / تحقيق',
      badgeStyle: 'bg-rose-100 text-rose-900 border-rose-300'
    };
  }

  // 4. Default: First Instance (أول درجة)
  return {
    degreeLabel: c.degree || 'أول درجة',
    caseNumber: c.caseNumberFirstInstance || session?.caseNumber || '',
    caseYear: c.caseYearFirstInstance || session?.caseYear || '',
    court: c.courtFirstInstance || session?.court || c.court || 'غير محدد',
    circuit: c.circuitFirstInstance || session?.circuit || c.circuit || 'غير محدد',
    isAppeal: false,
    isCassation: false,
    isInvestigation: false,
    isFirstInstance: true,
    stageNameAr: 'محكمة أول درجة',
    badgeText: 'أول درجة',
    badgeStyle: 'bg-amber-100 text-amber-900 border-amber-300'
  };
}
