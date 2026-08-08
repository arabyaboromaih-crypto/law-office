import { Case, Client, User, CaseSession } from '../types';

export interface CaseReportOptions {
  generatedBy?: string;
  reportDate?: string;
  reportTime?: string;
}

/**
 * Helper to generate QR code SVG string
 */
function generateQRCodeSVG(text: string): string {
  // Simple clean SVG QR code representation
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="60" height="60">
      <rect width="100" height="100" fill="#ffffff" />
      <path d="M10 10 h30 v30 h-30 z M15 15 v20 h20 v-20 z M20 20 h10 v10 h-10 z" fill="#0b1b2b" />
      <path d="M60 10 h30 v30 h-30 z M65 15 v20 h20 v-20 z M70 20 h10 v10 h-10 z" fill="#0b1b2b" />
      <path d="M10 60 h30 v30 h-30 z M15 65 v20 h20 v-20 z M20 70 h10 v10 h-10 z" fill="#0b1b2b" />
      <rect x="50" y="50" width="10" height="10" fill="#0b1b2b" />
      <rect x="70" y="50" width="15" height="10" fill="#d4a84f" />
      <rect x="50" y="70" width="10" height="15" fill="#0b1b2b" />
      <rect x="70" y="70" width="15" height="15" fill="#0b1b2b" />
      <rect x="45" y="20" width="10" height="20" fill="#d4a84f" />
      <rect x="20" y="45" width="20" height="10" fill="#0b1b2b" />
    </svg>
  `;
}

/**
 * Builds an aggregated chronological timeline of litigation stages for a case
 */
export function buildLitigationTimeline(
  c: Case,
  caseSessions: CaseSession[]
) {
  const stages: Array<{
    stepNumber: number;
    title: string;
    date: string;
    status: 'تم' | 'قادم' | 'قيد المباشرة' | 'مؤجل';
    badgeColor: string; // 'green' | 'amber' | 'blue'
    icon: string;
    description: string;
    category: string;
  }> = [];

  let stepCounter = 1;

  // 1. Stage 1: Filing & Registration (قيد الدعوى)
  const openingDate = c.files && c.files.length > 0
    ? [...c.files].sort((a, b) => a.uploadDate.localeCompare(b.uploadDate))[0].uploadDate
    : `${c.caseYearFirstInstance || '2024'}-01-01`;

  stages.push({
    stepNumber: stepCounter++,
    title: `قيد الدعوى برقم (${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance})`,
    date: openingDate,
    status: 'تم',
    badgeColor: 'green',
    icon: '📄',
    category: 'درجة أولى',
    description: `تم قيد العريضة وتسجيل ملف القضية أمام محكمة ${c.courtFirstInstance || c.court || 'الابتدائية'} - الدائرة (${c.circuitFirstInstance || c.circuit || 'المختصة'}).`
  });

  // 2. Stage 2: Investigation / Detention (التحقيقات وتجديد الحبس - إن وجدت)
  if (c.isInvestigationActive || c.investigationNumber || (c.detentionRenewals && c.detentionRenewals.length > 0) || (c.investigationProcedures && c.investigationProcedures.length > 0)) {
    const invDate = c.investigationStartDate || openingDate;
    stages.push({
      stepNumber: stepCounter++,
      title: `تحقيقات النيابة العامة ${c.investigationNumber ? `(رقم ${c.investigationNumber} لسنة ${c.investigationYear || ''})` : ''}`,
      date: invDate,
      status: c.investigationDefendantStatus === 'تمت الإحالة للمحاكمة' ? 'تم' : 'تم',
      badgeColor: 'green',
      icon: '🛡️',
      category: 'التحقيقات',
      description: `النيابة المختصة: ${c.investigationAuthority || 'النيابة العامة'} | حالة المتهم: ${c.investigationDefendantStatus || 'تحت التحقيق'}.`
    });

    // Add detention renewals summary if available
    if (c.detentionRenewals && c.detentionRenewals.length > 0) {
      c.detentionRenewals.forEach((ren) => {
        stages.push({
          stepNumber: stepCounter++,
          title: `جلسة تجديد حبس احتياطي (${ren.authority || 'قاضي المعارضات'})`,
          date: ren.date || ren.renewalDate || invDate,
          status: 'تم',
          badgeColor: 'green',
          icon: '⏳',
          category: 'التحقيقات',
          description: `القرار: ${ren.decision || 'تجديد الحبس'} ${ren.duration ? `لمدة (${ren.duration})` : ''}. ${ren.notes ? `ملاحظات: ${ren.notes}` : ''}`
        });
      });
    }
  }

  // 3. Stage 3: Hearings & Sessions (الجلسات والتأجيلات)
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedSessions = [...caseSessions].sort((a, b) => a.date.localeCompare(b.date));
  
  if (sortedSessions.length > 0) {
    sortedSessions.forEach((sess, idx) => {
      const isFuture = sess.date > todayStr;
      let statusText: 'تم' | 'قادم' | 'قيد المباشرة' | 'مؤجل' = isFuture ? 'قادم' : (sess.status === 'postponed' ? 'مؤجل' : 'تم');
      let badgeColor = isFuture ? 'amber' : (sess.status === 'postponed' ? 'amber' : 'green');
      let descriptionText = '';

      if (isFuture) {
        statusText = 'قادم';
        badgeColor = 'amber';
        descriptionText = 'جلسة قادمة (لم تنعقد بعد)';
        if (sess.requirements && sess.requirements.trim()) {
          descriptionText += ` | المطلوب: ${sess.requirements}`;
        }
      } else {
        const whatHappenedPart = sess.whatHappened?.trim() ? `الإجراء: ${sess.whatHappened.trim()}` : '';
        const decisionPart = sess.decision?.trim() ? `القرار: ${sess.decision.trim()}` : '';
        if (whatHappenedPart || decisionPart) {
          descriptionText = [whatHappenedPart, decisionPart].filter(Boolean).join(' | ');
        } else {
          descriptionText = 'جلسة انقضت (غير مدون قرارات جديدة)';
        }
      }

      stages.push({
        stepNumber: stepCounter++,
        title: `جلسة نظر دعوى (#${idx + 1}): ${sess.subject || 'نظر الدعوى'}`,
        date: sess.date,
        status: statusText,
        badgeColor: badgeColor,
        icon: '📅',
        category: 'الجلسات',
        description: descriptionText
      });
    });
  } else {
    // If no sessions recorded, add First Session entry if next hearing date exists
    if (c.nextHearingDate) {
      const isFuture = c.nextHearingDate > todayStr;
      stages.push({
        stepNumber: stepCounter++,
        title: 'تحديد الجلسة الأولى ونظر الدعوى',
        date: c.nextHearingDate,
        status: isFuture ? 'قادم' : 'تم',
        badgeColor: isFuture ? 'amber' : 'green',
        icon: '🏛️',
        category: 'الجلسات',
        description: `النظر أمام محكمة ${c.court} الدائرة ${c.circuit}. ${isFuture ? 'جلسة قادمة (لم تنعقد بعد)' : ''}`
      });
    }
  }

  // 4. Stage 4: Expert Referral (الإحالة للخبراء - إن وجدت)
  if (c.isReferredToExperts || c.expertReferral?.isReferred || (c.expertReferral && (c.expertReferral.expertOffice || c.expertReferral.expertName))) {
    const expDate = c.expertReferral?.referralDate || openingDate;
    stages.push({
      stepNumber: stepCounter++,
      title: `إحالة الدعوى لمكتب خبراء وزارة العدل (${c.expertReferral?.expertOffice || 'مكتب الخبراء المختص'})`,
      date: expDate,
      status: c.expertReferral?.returnedToCourtAt ? 'تم' : 'قيد المباشرة',
      badgeColor: c.expertReferral?.returnedToCourtAt ? 'green' : 'amber',
      icon: '🔍',
      category: 'الخبراء',
      description: `الخبير المباشر: ${c.expertReferral?.expertName || 'غير محدد'} | رقم الملف: ${c.expertReferral?.fileNumber || 'غير مدون'}. ${c.expertReferral?.status ? `الحالة: ${c.expertReferral.status}` : ''}`
    });

    if (c.expertReferral?.report && c.expertReferral.report.summary) {
      stages.push({
        stepNumber: stepCounter++,
        title: 'ورود تقرير الخبير النهائي للمحكمة',
        date: c.expertReferral.returnedToCourtAt || expDate,
        status: 'تم',
        badgeColor: 'green',
        icon: '📊',
        category: 'الخبراء',
        description: `ملخص التقرير: ${c.expertReferral.report.summary}`
      });
    }
  }

  // 5. Stage 5: Second Instance / Appeal (الاستئناف - إن وجد)
  if (c.caseNumberSecondInstance) {
    stages.push({
      stepNumber: stepCounter++,
      title: `الطعن بالاستئناف رقم (${c.caseNumberSecondInstance} لسنة ${c.caseYearSecondInstance || ''})`,
      date: openingDate,
      status: 'تم',
      badgeColor: 'green',
      icon: '⚖️',
      category: 'الاستئناف',
      description: `مقيد أمام محكمة استئناف: ${c.courtSecondInstance || 'الاستئناف العالي'} - الدائرة (${c.circuitSecondInstance || 'المختصة'}).`
    });
  }

  // 6. Stage 6: Cassation (النقض - إن وجد)
  if (c.cassationNumber) {
    stages.push({
      stepNumber: stepCounter++,
      title: `الطعن بالنقض رقم (${c.cassationNumber} لسنة ${c.cassationYear || ''})`,
      date: openingDate,
      status: 'تم',
      badgeColor: 'green',
      icon: '🏛️',
      category: 'النقض',
      description: `مقيد أمام محكمة النقض - الدائرة (${c.circuitCassation || 'الجنائية/المدنية'}).`
    });
  }

  // 7. Stage 7: Next Step / Decision Judgment (الحالة الحالية / الحكم)
  if (c.nextHearingDate) {
    stages.push({
      stepNumber: stepCounter++,
      title: `الجلسة القادمة المرتقبة (${c.nextHearingDate})`,
      date: c.nextHearingDate,
      status: 'قادم',
      badgeColor: 'amber',
      icon: '📌',
      category: 'المرحلة القادمة',
      description: `الموعد: الساعة ${c.nextHearingTime || '09:00 صباحاً'} - الموقف الحلي: ${c.status}.`
    });
  }

  return stages;
}

/**
 * Generates printable HTML string for Comprehensive Case Report
 * Adhering strictly to Navy & Gold luxury legal document theme
 */
export function generateCaseReportHTML(
  c: Case,
  clients: Client[],
  users: User[],
  caseSessions: CaseSession[],
  options: CaseReportOptions = {}
): string {
  const matchedClient = clients.find(cl => cl.id === c.clientId || cl.name === c.clientName);
  const assignedLawyer = users.find(u => u.id === c.assignedLawyerId);
  const formattedDate = options.reportDate || new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  const currentTime = options.reportTime || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const generatedBy = options.generatedBy || assignedLawyer?.fullName || 'أ. عربي رميح';

  const timelineStages = buildLitigationTimeline(c, caseSessions);
  const sortedSessions = [...caseSessions].sort((a, b) => a.date.localeCompare(b.date));
  const filesList = c.files || [];

  const reportCode = `R-REP-${c.caseNumberFirstInstance}-${c.caseYearFirstInstance || '2024'}`;
  const qrCodeSvg = generateQRCodeSVG(reportCode);

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>تقرير قضائي شامل - قضية رقم ${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Cairo', sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            direction: rtl;
            text-align: right;
            font-size: 11px;
            line-height: 1.5;
            padding: 0;
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm 10mm 10mm 10mm;
          }

          @media print {
            body {
              background-color: #ffffff !important;
            }
            .no-print {
              display: none !important;
            }
            .page-break {
              page-break-before: always;
            }
            .keep-together {
              page-break-inside: avoid;
            }
          }

          /* PRINT BUTTON BAR */
          .print-bar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #0b1b2b;
            color: #ffffff;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          }
          .print-btn {
            background: #d4a84f;
            color: #0b1b2b;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-weight: 800;
            font-family: 'Cairo', sans-serif;
            cursor: pointer;
            font-size: 12px;
          }
          .print-btn:hover {
            background: #c59b27;
          }

          /* MAIN CONTAINER */
          .report-container {
            max-width: 900px;
            margin: 50px auto 20px auto;
            background: #ffffff;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
          }

          @media print {
            .report-container {
              margin: 0;
              padding: 0;
              box-shadow: none;
              border: none;
              width: 100%;
              max-width: 100%;
            }
          }

          /* TOP HEADER BANNER (NAVY & GOLD) */
          .header-banner {
            background: linear-gradient(135deg, #0b1b2b 0%, #112233 100%);
            color: #ffffff;
            border-radius: 10px;
            padding: 16px 20px;
            display: grid;
            grid-template-columns: 28% 44% 28%;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            border-bottom: 3px solid #d4a84f;
          }

          .header-right {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .emblem-icon {
            width: 44px;
            height: 44px;
            background: rgba(212, 168, 79, 0.15);
            border: 1px solid #d4a84f;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            color: #d4a84f;
            flex-shrink: 0;
          }

          .firm-title {
            font-size: 14px;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: -0.3px;
          }
          .firm-subtitle {
            font-size: 9.5px;
            color: #d4a84f;
            font-weight: 700;
          }

          .header-center {
            text-align: center;
          }

          .report-main-title {
            font-size: 16px;
            font-weight: 900;
            color: #d4a84f;
            margin-bottom: 2px;
          }

          .ornament {
            color: #c59b27;
            font-size: 10px;
            margin: 2px 0;
          }

          .case-badge-pill {
            display: inline-block;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(212, 168, 79, 0.4);
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 800;
            padding: 3px 12px;
            border-radius: 20px;
            margin-top: 4px;
          }

          .header-left {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(212, 168, 79, 0.25);
            border-radius: 8px;
            padding: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .qr-box {
            background: #ffffff;
            padding: 4px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .meta-info {
            font-size: 9px;
            color: #cbd5e1;
            line-height: 1.4;
          }

          .meta-info strong {
            color: #d4a84f;
          }

          /* METRICS RIBBON (بيانات القضية) */
          .metrics-ribbon {
            margin-bottom: 16px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            background: #ffffff;
          }

          .ribbon-header {
            background: #0b1b2b;
            color: #d4a84f;
            padding: 6px 14px;
            font-weight: 800;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            divide-x: 1px solid #e2e8f0;
            divide-x-reverse: true;
            background: #f8fafc;
          }

          .metric-card {
            padding: 8px 10px;
            text-align: center;
            border-left: 1px solid #e2e8f0;
          }
          .metric-card:last-child {
            border-left: none;
          }

          .metric-label {
            font-size: 9px;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 3px;
          }

          .metric-value {
            font-size: 10.5px;
            font-weight: 800;
            color: #0f172a;
          }

          .metric-value.gold {
            color: #b45309;
          }

          /* TWO COLUMN BODY GRID */
          .body-grid {
            display: grid;
            grid-template-columns: 31% 67%;
            gap: 2%;
            margin-bottom: 16px;
          }

          /* CARDS & SECTIONS */
          .side-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
          }

          .side-card-title {
            background: #0b1b2b;
            color: #ffffff;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 10.5px;
            font-weight: 800;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            border-right: 3px solid #d4a84f;
          }

          .party-box {
            padding: 6px 8px;
            border-radius: 6px;
            margin-bottom: 6px;
            font-size: 10px;
          }

          .party-box.client {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
          }

          .party-box.opponent {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #991b1b;
          }

          .party-title {
            font-weight: 800;
            font-size: 10.5px;
            margin-bottom: 2px;
          }

          .party-detail {
            color: #475569;
            font-size: 9.5px;
          }

          /* TIMELINE SECTION */
          .main-section {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
          }

          .section-header-banner {
            background: linear-gradient(90deg, #0b1b2b 0%, #1e293b 100%);
            color: #ffffff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-right: 4px solid #d4a84f;
          }

          /* TIMELINE FLOW TABLE */
          .timeline-list {
            position: relative;
            padding-right: 20px;
            border-right: 2px solid #cbd5e1;
            margin-right: 8px;
          }

          .timeline-node {
            position: relative;
            margin-bottom: 12px;
          }

          .timeline-node:last-child {
            margin-bottom: 0;
          }

          .node-dot {
            position: absolute;
            right: -28px;
            top: 2px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #0b1b2b;
            color: #d4a84f;
            border: 2px solid #d4a84f;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 800;
          }

          .node-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
          }

          .node-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          }

          .node-title {
            font-weight: 800;
            font-size: 10.5px;
            color: #0f172a;
          }

          .node-date {
            font-family: monospace;
            font-size: 9.5px;
            color: #b45309;
            font-weight: 700;
            background: #fffbeb;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #fde68a;
          }

          .badge-status {
            font-size: 9px;
            font-weight: 800;
            padding: 1px 8px;
            border-radius: 12px;
          }
          .badge-status.green {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
          }
          .badge-status.amber {
            background: #fef3c7;
            color: #b45309;
            border: 1px solid #fde68a;
          }

          .node-desc {
            font-size: 9.5px;
            color: #475569;
            line-height: 1.4;
          }

          /* DATA TABLES */
          .custom-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-top: 6px;
          }

          .custom-table th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 800;
            padding: 6px 8px;
            text-align: right;
            border: 1px solid #cbd5e1;
          }

          .custom-table td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            color: #1e293b;
          }

          .custom-table tr:nth-child(even) {
            background: #f8fafc;
          }

          /* FOOTER & STAMP */
          .footer-section {
            margin-top: 16px;
            border-top: 2px solid #cbd5e1;
            padding-top: 12px;
          }

          .signature-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            text-align: center;
            align-items: center;
            margin-bottom: 12px;
          }

          .sig-box {
            font-size: 10px;
          }

          .sig-title {
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 4px;
          }

          .sig-name {
            font-size: 9.5px;
            color: #475569;
          }

          .sig-line {
            margin-top: 24px;
            border-bottom: 1px dotted #94a3b8;
            width: 110px;
            margin-left: auto;
            margin-right: auto;
          }

          .stamp-container {
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .stamp-circle {
            width: 76px;
            height: 76px;
            border: 3px double #d4a84f;
            border-radius: 50%;
            padding: 2px;
            transform: rotate(-6deg);
            opacity: 0.9;
          }

          .stamp-inner {
            width: 100%;
            height: 100%;
            border: 1px dashed #d4a84f;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 7.5px;
            font-weight: 900;
            color: #b45309;
            line-height: 1.2;
            text-align: center;
          }

          .bottom-bar {
            background: #0b1b2b;
            color: #cbd5e1;
            padding: 6px 12px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            border-top: 2px solid #d4a84f;
          }

          .bottom-bar strong {
            color: #d4a84f;
          }
        </style>
      </head>
      <body>

        <!-- PRINT CONTROL BAR (Web only) -->
        <div class="print-bar no-print">
          <div>
            <strong>معاينة تقرير القضية الشامل</strong> - رقم الملف: ${c.officeFileNo || c.caseNumberFirstInstance}
          </div>
          <button class="print-btn" onclick="window.print()">🖨️ طباعة التقرير / حفظ PDF</button>
        </div>

        <div class="report-container">

          <!-- TOP LUXURY HEADER -->
          <div class="header-banner">
            <div class="header-right">
              <div class="emblem-icon">⚖️</div>
              <div>
                <div class="firm-title">مؤسسة رميح للمحاماة</div>
                <div class="firm-subtitle">والاستشارات القانونية وأعمال الطعن</div>
              </div>
            </div>

            <div class="header-center">
              <div class="report-main-title">تقرير شامل عن القضية</div>
              <div class="ornament">✧ ⚖ ✧</div>
              <div class="case-badge-pill">رقم القضية: ${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance} (${c.type})</div>
            </div>

            <div class="header-left">
              <div class="qr-box">
                ${qrCodeSvg}
              </div>
              <div class="meta-info">
                <div>تاريخ التقرير: <strong>${formattedDate}</strong></div>
                <div>وقت التقرير: <strong>${currentTime}</strong></div>
                <div>المحرر: <strong>${generatedBy}</strong></div>
                <div>رمز الملف: <strong>${reportCode}</strong></div>
              </div>
            </div>
          </div>

          <!-- METRICS RIBBON (بيانات القضية) -->
          <div class="metrics-ribbon">
            <div class="ribbon-header">
              📋 بيانات ومعرفات القضية الأساسية
            </div>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">🏛️ المحكمة والدائرة</div>
                <div class="metric-value">${c.courtFirstInstance || c.court} - د/ ${c.circuitFirstInstance || c.circuit}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">📁 تصنيف القضية</div>
                <div class="metric-value">${c.subject || c.type}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">⚖️ نوع الدعوى</div>
                <div class="metric-value gold">${c.type} (${c.degree})</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">📅 تاريخ القيد</div>
                <div class="metric-value">${timelineStages[0]?.date || formattedDate}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">💰 قيمة الدعوى والأتعاب</div>
                <div class="metric-value gold">${c.totalFees ? `${c.totalFees.toLocaleString()} ج.م` : 'غير محدد'}</div>
              </div>
            </div>
          </div>

          <!-- TWO COLUMN BODY GRID -->
          <div class="body-grid">

            <!-- RIGHT SIDEBAR COLUMN (~31%) -->
            <div class="right-sidebar">

              <!-- 1. أطراف الدعوى -->
              <div class="side-card">
                <div class="side-card-title">👥 أطراف الخصومة والدعوى</div>
                
                ${c.clientsList && c.clientsList.length > 0 ? c.clientsList.map((cl, idx) => `
                  <div class="party-box client">
                    <div class="party-title">الموكل (${idx + 1}): ${cl.name}</div>
                    <div class="party-detail">الصفة: ${cl.role || 'مدعي'} | الهاتف: ${cl.phone || 'غير مدون'}</div>
                  </div>
                `).join('') : `
                  <div class="party-box client">
                    <div class="party-title">الموكل: ${c.clientName}</div>
                    <div class="party-detail">
                      الهاتف: ${matchedClient?.phone || 'غير مدون'}<br/>
                      الرقم القومي: ${matchedClient?.nationalId || 'غير مدون'}
                    </div>
                  </div>
                `}

                ${c.opponentsList && c.opponentsList.length > 0 ? c.opponentsList.map((opp, idx) => `
                  <div class="party-box opponent">
                    <div class="party-title">الخصم (${idx + 1}): ${opp.name}</div>
                    <div class="party-detail">الصفة: ${opp.role} | محاميه: ${opp.lawyer || 'لا يوجد'}</div>
                  </div>
                `).join('') : `
                  <div class="party-box opponent">
                    <div class="party-title">الخصم: ${c.opponent.name}</div>
                    <div class="party-detail">
                      الصفة: ${c.opponent.role}<br/>
                      العنوان: ${c.opponent.address || 'غير مدون'}<br/>
                      محامي الخصم: ${c.opponent.lawyer || 'لا يوجد'}
                    </div>
                  </div>
                `}
              </div>

              <!-- 2. محامي القضية وفريق الدفاع -->
              <div class="side-card">
                <div class="side-card-title">👨‍⚖️ هيئة الدفاع والمتابعة</div>
                <div style="font-size: 10px; line-height: 1.6;">
                  <div>• <strong>المحامي المسند إليه القضية:</strong> ${assignedLawyer ? assignedLawyer.fullName : 'غير مسند لمحامٍ محدد'}</div>
                  ${assignedLawyer?.phone ? `<div>• <strong>هاتف المحامي:</strong> ${assignedLawyer.phone}</div>` : ''}
                  <div>• <strong>معد التقرير:</strong> ${generatedBy}</div>
                  <div>• <strong>رقم الملف الداخلي:</strong> <span style="font-family: monospace; font-weight: 800; color: #b45309;">${c.officeFileNo || 'R-' + c.caseNumberFirstInstance}</span></div>
                </div>
              </div>

              <!-- 3. الموقف والملخص المالي (إن وجد) -->
              <div class="side-card">
                <div class="side-card-title">💰 ملخص الموقف المالي</div>
                <table style="width: 100%; font-size: 9.5px; border-collapse: collapse;">
                  <tr>
                    <td style="color: #64748b; padding: 2px 0;">إجمالي الأتعاب:</td>
                    <td style="font-weight: 800; color: #0284c7; text-align: left;">${c.totalFees.toLocaleString()} ج.م</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; padding: 2px 0;">المسدد المقبوض:</td>
                    <td style="font-weight: 800; color: #15803d; text-align: left;">${c.paidFees.toLocaleString()} ج.م</td>
                  </tr>
                  <tr style="border-top: 1px dashed #cbd5e1;">
                    <td style="font-weight: 800; color: #991b1b; padding: 4px 0;">المتبقي المستحق:</td>
                    <td style="font-weight: 900; color: #b91c1c; text-align: left; font-size: 10.5px;">${c.remainingFees.toLocaleString()} ج.م</td>
                  </tr>
                </table>
              </div>

              <!-- 4. الجلسة القادمة -->
              <div class="side-card" style="border-color: #fde68a; background: #fffbeb;">
                <div class="side-card-title" style="background: #b45309;">📌 الجلسة القادمة المرتقبة</div>
                <div style="font-size: 10.5px; font-weight: 800; color: #78350f;">
                  ${c.nextHearingDate ? `📅 ${c.nextHearingDate} ${c.nextHearingTime ? 'الساعة ' + c.nextHearingTime : ''}` : '❌ لم تحدد بعد'}
                </div>
                <div style="font-size: 9px; color: #92400e; margin-top: 3px;">
                  الموقف: ${c.status}
                </div>
              </div>

            </div>

            <!-- LEFT MAIN COLUMN (~67%) -->
            <div class="left-main">

              <!-- 1. ملخص موضوع وقائع الدعوى -->
              <div class="main-section">
                <div class="section-header-banner">
                  <span>📝 ملخص وقائع الدعوى والطلبات القانونية</span>
                  <span style="font-size: 9.5px; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 4px;">الحالة: ${c.status}</span>
                </div>
                <div style="font-size: 10px; color: #1e293b; line-height: 1.6; text-align: justify; background: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  ${c.subject ? `<p style="font-weight: 800; color: #b45309; margin-bottom: 4px;">📌 الموضوع والطلبات: ${c.subject}</p>` : ''}
                  ${c.notes || `دعوى مقيدة برقم (${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}) أمام محكمة ${c.court} الدائرة ${c.circuit}، دفاعاً عن الموكل (${c.clientName}) في مواجهة الخصم (${c.opponent.name}).`}
                </div>
              </div>

              <!-- 2. الخط الزمني الشامل لمراحل الدعوى -->
              <div class="main-section">
                <div class="section-header-banner">
                  <span>⏳ المراحل القضائية والخط الزمني للإجراءات (${timelineStages.length} مرحلة)</span>
                  <span style="font-size: 9.5px; color: #d4a84f;">مراحل مرتبة تسلسلياً</span>
                </div>

                <div class="timeline-list">
                  ${timelineStages.map(stg => `
                    <div class="timeline-node">
                      <div class="node-dot">${stg.stepNumber}</div>
                      <div class="node-card">
                        <div class="node-header">
                          <span class="node-title">${stg.icon} ${stg.title}</span>
                          <div style="display: flex; gap: 6px; align-items: center;">
                            <span class="node-date">${stg.date}</span>
                            <span class="badge-status ${stg.badgeColor}">${stg.status}</span>
                          </div>
                        </div>
                        <div class="node-desc">${stg.description}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- 3. جدول الجلسات والقرارات التفصيلي -->
              <div class="main-section">
                <div class="section-header-banner">
                  <span>📅 جدول الجلسات المعتمد والقرارات القضائية (${sortedSessions.length})</span>
                </div>

                ${sortedSessions.length === 0 ? `
                  <p style="color: #64748b; font-style: italic; text-align: center; padding: 10px;">لا توجد جلسات مسجلة بملف القضية حتى تاريخه.</p>
                ` : `
                  <table class="custom-table">
                    <thead>
                      <tr>
                        <th style="width: 20%;">التاريخ</th>
                        <th style="width: 25%;">موضوع الجلسة</th>
                        <th>ما تم بالجلسة والإجراء</th>
                        <th style="width: 28%;">القرار الصادر</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sortedSessions.map((sess) => {
                        const isFuture = sess.date > todayStr;
                        const whatHappenedText = isFuture 
                          ? 'جلسة قادمة (لم تنعقد بعد)' 
                          : (sess.whatHappened?.trim() || 'غير مدون');
                        const decisionText = isFuture 
                          ? 'جلسة قادمة' 
                          : (sess.decision?.trim() || 'غير مدون');
                        return `
                          <tr>
                            <td style="font-family: monospace; font-weight: 800; color: #b45309;">${sess.date} ${sess.time ? '(' + sess.time + ')' : ''}</td>
                            <td style="font-weight: 700;">${sess.subject || 'نظر الدعوى'}</td>
                            <td>${whatHappenedText}</td>
                            <td style="font-weight: 800; color: #0f172a; background: #fffbeb;">${decisionText}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `}
              </div>

              <!-- 4. التحقيقات والخبراء والمستندات (إن وجدت) -->
              ${(c.isReferredToExperts || c.expertReferral?.isReferred || (c.expertReferral && (c.expertReferral.expertOffice || c.expertReferral.expertName))) ? `
                <div class="main-section" style="border-color: #fde68a;">
                  <div class="section-header-banner" style="background: linear-gradient(90deg, #78350f 0%, #b45309 100%);">
                    <span>🔍 ملف وسجل إحالة القضية للخبراء</span>
                    <span style="font-size: 9.5px; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 4px;">${c.expertReferral?.status || 'قيد المباشرة'}</span>
                  </div>
                  <div style="font-size: 10px; line-height: 1.5; color: #1e293b;">
                    <div>• <strong>مكتب الخبراء:</strong> ${c.expertReferral?.expertOffice || 'غير محدد'} | <strong>الخبير المباشر:</strong> ${c.expertReferral?.expertName || 'لم يحدد'} ${c.expertReferral?.expertPhone ? `(${c.expertReferral.expertPhone})` : ''}</div>
                    <div>• <strong>رقم ملف الخبراء:</strong> <span style="font-family: monospace; font-weight: 800; color: #b45309;">${c.expertReferral?.fileNumber || 'غير مدون'}</span> | <strong>تاريخ الإحالة:</strong> ${c.expertReferral?.referralDate || 'غير مدون'}</div>
                    ${c.expertReferral?.report?.summary ? `
                      <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 6px 8px; border-radius: 4px; margin-top: 6px; font-weight: 700; color: #78350f;">
                        📊 ملخص تقرير الخبير: ${c.expertReferral.report.summary}
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              <!-- 5. المستندات والأوراق المرفقة -->
              ${filesList.length > 0 ? `
                <div class="main-section">
                  <div class="section-header-banner">
                    <span>📂 المستندات والمذكرات المودعة بالملف (${filesList.length})</span>
                  </div>
                  <table class="custom-table">
                    <thead>
                      <tr>
                        <th>اسم المستند</th>
                        <th style="width: 25%;">التصنيف</th>
                        <th style="width: 20%;">تاريخ الإيداع</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filesList.map(f => `
                        <tr>
                          <td style="font-weight: 700;">📄 ${f.name}</td>
                          <td>${f.category || f.type || 'مستند قانوني'}</td>
                          <td style="font-family: monospace;">${f.uploadDate}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

            </div>

          </div>

          <!-- FOOTER & SIGNATURES -->
          <div class="footer-section">
            <div class="signature-grid">
              <div class="sig-box">
                <div class="sig-title">إعداد التقرير والمتابعة</div>
                <div class="sig-name">المحامي/ ${assignedLawyer?.fullName || generatedBy}</div>
                <div class="sig-line"></div>
              </div>

              <div class="stamp-container">
                <div class="stamp-circle">
                  <div class="stamp-inner">
                    <span style="font-size: 12px; margin-bottom: 1px;">⚖️</span>
                    <span>مؤسسة رميح للمحاماة</span>
                    <span>معتمد ورسمي</span>
                  </div>
                </div>
              </div>

              <div class="sig-box">
                <div class="sig-title">اعتماد الإدارة العليا</div>
                <div class="sig-name">المدير العام/ أ. عربي رميح</div>
                <div class="sig-line"></div>
              </div>
            </div>

            <div class="bottom-bar">
              <div>📞 الهاتف الرئيسي: <strong>0100222000 / +20 123 456 7890</strong></div>
              <div>📍 المقر الرئيسي: <strong>القاهرة - جمهورية مصر العربية</strong></div>
              <div>🌐 نظام إدارة القضايا الذكي - مؤسسة رميح للمحاماة © ${new Date().getFullYear()}</div>
            </div>
          </div>

        </div>

        <script>
          // Auto trigger print when loaded directly
          window.onload = function() {
            // Optional auto print if requested
          };
        </script>
      </body>
    </html>
  `;
}
