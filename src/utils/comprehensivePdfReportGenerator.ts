/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case, Client, Company, HearingSession, User } from '../types';

/**
 * Utility to convert numbers to Arabic-Indic digits (٠-٩)
 */
export function toArabicNum(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  return String(val).replace(/[0-9]/g, (char) => '٠١٢٣٤٥٦٧٨٩'[char.charCodeAt(0) - 48]);
}

/**
 * Generates an SVG emblem/scales of justice logo for the report header
 */
function getEmblemSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="64" height="64">
      <circle cx="50" cy="50" r="46" fill="#0b1b2b" stroke="#d4a84f" stroke-width="2.5" />
      <path d="M50 18 L50 78 M42 78 L58 78 M35 83 L65 83" stroke="#d4a84f" stroke-width="3" stroke-linecap="round" />
      <path d="M26 34 L74 34" stroke="#d4a84f" stroke-width="2.5" stroke-linecap="round" />
      <path d="M26 34 L18 52 M26 34 L34 52" stroke="#d4a84f" stroke-width="1.5" />
      <path d="M14 52 Q26 62 38 52 Z" fill="#d4a84f" />
      <path d="M74 34 L66 52 M74 34 L82 52" stroke="#d4a84f" stroke-width="1.5" />
      <path d="M62 52 Q74 62 86 52 Z" fill="#d4a84f" />
      <polygon points="50,14 54,20 46,20" fill="#d4a84f" />
    </svg>
  `;
}

/**
 * Common Print CSS for high contrast, crisp typography, and professional formatting
 */
function getReportCommonStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      direction: rtl;
      text-align: right;
      background-color: #f1f5f9;
      color: #0f172a;
      font-size: 12px;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }

    @media print {
      body {
        background-color: #ffffff !important;
      }
      .no-print {
        display: none !important;
      }
      .page-break-before {
        page-break-before: always;
      }
      .keep-together {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .report-container {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        max-width: 100% !important;
        width: 100% !important;
      }
    }

    /* Top Action Bar on Screen */
    .print-bar {
      position: sticky;
      top: 0;
      z-index: 99999;
      background: linear-gradient(135deg, #0b1b2b 0%, #1e293b 100%);
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border-bottom: 2px solid #d4a84f;
    }
    .print-btn-main {
      background: linear-gradient(135deg, #d4a84f 0%, #b45309 100%);
      color: #0b1b2b;
      font-weight: 900;
      font-size: 13px;
      padding: 9px 24px;
      border-radius: 8px;
      border: 1px solid #fef08a;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(212,168,79,0.4);
      font-family: inherit;
    }
    .print-btn-main:hover {
      filter: brightness(1.1);
    }
    .close-btn {
      background: #334155;
      color: #ffffff;
      border: 1px solid #475569;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
    }
    .close-btn:hover {
      background: #475569;
    }

    /* Main Container */
    .report-container {
      max-width: 960px;
      margin: 30px auto 40px auto;
      background: #ffffff;
      padding: 32px 36px;
      border-radius: 12px;
      box-shadow: 0 6px 25px rgba(15,23,42,0.08);
      border: 1px solid #cbd5e1;
    }

    /* Header */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px double #0b1b2b;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header-logo-block {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .office-title {
      font-size: 18px;
      font-weight: 900;
      color: #0b1b2b;
      line-height: 1.2;
    }
    .office-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #b45309;
      margin-top: 3px;
    }
    .header-meta-block {
      text-align: left;
      font-size: 11px;
      color: #334155;
      line-height: 1.5;
    }
    .header-meta-title {
      font-weight: 800;
      color: #0b1b2b;
      font-size: 12px;
    }

    /* Document Banner */
    .doc-banner {
      background: #0b1b2b;
      color: #ffffff;
      border-radius: 8px;
      padding: 12px 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-right: 6px solid #d4a84f;
    }
    .doc-banner-title {
      font-size: 15px;
      font-weight: 900;
      color: #fef08a;
    }
    .doc-banner-sub {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .stats-pill {
      background: rgba(212,168,79,0.2);
      border: 1px solid #d4a84f;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 800;
    }

    /* Client Section Divider */
    .client-group-header {
      background: linear-gradient(90deg, #f8fafc 0%, #e2e8f0 100%);
      border: 1px solid #94a3b8;
      border-right: 6px solid #0b1b2b;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 28px 0 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }
    .client-group-name {
      font-size: 15px;
      font-weight: 900;
      color: #0b1b2b;
    }
    .client-group-details {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    /* Case Card Base */
    .case-card {
      border-radius: 10px;
      background: #ffffff;
      margin-bottom: 24px;
      overflow: hidden;
      page-break-inside: avoid;
    }

    /* ══════════════════════════════════════════════════════════════
       اللون الأول بالتناوب (Theme 1: الكحلي الملكي الداكن #0b2545)
       ══════════════════════════════════════════════════════════════ */
    .theme-color-1 {
      border: 2px solid #0b2545 !important;
      background-color: #ffffff !important;
    }
    .theme-color-1 > .card-header-bar,
    .theme-color-1.card-header-bar,
    .theme-color-1 .card-header-bar {
      background: #0b2545 !important;
      color: #ffffff !important;
      border-bottom: 2px solid #06172c !important;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .theme-color-1 .card-title-text {
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 800;
      flex: 1;
    }
    .theme-color-1 .card-serial-badge {
      background: #ffffff !important;
      color: #0b2545 !important;
      border: 1.5px solid #93c5fd !important;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 900;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .theme-color-1 .card-status-badge {
      background: rgba(255, 255, 255, 0.18) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.4) !important;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      white-space: nowrap;
    }
    .theme-color-1 .sub-section-title {
      background: #0b2545 !important;
      color: #ffffff !important;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 800;
      border-right: 5px solid #3b82f6 !important;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }
    .theme-color-1 .sessions-table th, 
    .theme-color-1 .files-table th, 
    .theme-color-1 .partners-table th {
      background: #0b2545 !important;
      color: #ffffff !important;
      border: 1px solid #1e3a8a !important;
    }
    .theme-color-1 .highlight-cell {
      background-color: #f0f7ff !important;
      color: #0b2545 !important;
      font-weight: 800 !important;
    }
    .theme-color-1 .hearing-cell {
      background-color: #eff6ff !important;
      color: #1e3a8a !important;
      font-weight: 800 !important;
      border: 1px solid #bfdbfe !important;
    }
    .theme-color-1 .notes-box {
      background: #f0f7ff !important;
      border-top: 1px solid #bfdbfe !important;
      color: #0b2545 !important;
    }

    /* ══════════════════════════════════════════════════════════════
       اللون الثاني بالتناوب (Theme 2: البني البرونزي الداكن الوقور #78350f)
       ══════════════════════════════════════════════════════════════ */
    .theme-color-2 {
      border: 2px solid #78350f !important;
      background-color: #ffffff !important;
    }
    .theme-color-2 > .card-header-bar,
    .theme-color-2.card-header-bar,
    .theme-color-2 .card-header-bar {
      background: #78350f !important;
      color: #ffffff !important;
      border-bottom: 2px solid #451a03 !important;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .theme-color-2 .card-title-text {
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 800;
      flex: 1;
    }
    .theme-color-2 .card-serial-badge {
      background: #ffffff !important;
      color: #78350f !important;
      border: 1.5px solid #fde68a !important;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 900;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .theme-color-2 .card-status-badge {
      background: rgba(255, 255, 255, 0.18) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.4) !important;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      white-space: nowrap;
    }
    .theme-color-2 .sub-section-title {
      background: #78350f !important;
      color: #ffffff !important;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 800;
      border-right: 5px solid #f59e0b !important;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }
    .theme-color-2 .sessions-table th, 
    .theme-color-2 .files-table th, 
    .theme-color-2 .partners-table th {
      background: #78350f !important;
      color: #ffffff !important;
      border: 1px solid #92400e !important;
    }
    .theme-color-2 .highlight-cell {
      background-color: #fefce8 !important;
      color: #78350f !important;
      font-weight: 800 !important;
    }
    .theme-color-2 .hearing-cell {
      background-color: #fffbeb !important;
      color: #92400e !important;
      font-weight: 800 !important;
      border: 1px solid #fde68a !important;
    }
    .theme-color-2 .notes-box {
      background: #fefce8 !important;
      border-top: 1px solid #fde68a !important;
      color: #78350f !important;
    }

    /* Grid & Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      font-size: 11.5px;
    }
    .data-table th, .data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: right;
      vertical-align: middle;
    }
    .data-table th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 800;
      white-space: nowrap;
    }
    .data-table td {
      color: #0f172a;
      font-weight: 600;
    }

    .sessions-table, .files-table, .partners-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 11px;
    }
    .sessions-table th, .files-table th, .partners-table th {
      padding: 6px 8px;
      font-weight: 800;
      font-size: 11px;
      text-align: center;
    }
    .sessions-table td, .files-table td, .partners-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: right;
    }
    .sessions-table tr:nth-child(even), .files-table tr:nth-child(even), .partners-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .footer-note {
      text-align: center;
      font-size: 10px;
      color: #64748b;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      margin-top: 30px;
      line-height: 1.5;
    }
  `;
}

/**
 * Generates comprehensive PDF Report HTML for ALL Cases
 * Grouped strictly by client, with consecutive serial numbers starting from 1 (١)
 */
export function generateAllCasesComprehensiveReportHTML(
  cases: Case[],
  clients: Client[],
  users: User[],
  sessions: HearingSession[],
  currentUser: User
): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // 1. Group active cases by client (deduplicating case records)
  const clientGroupsMap = new Map<string, {
    clientKey: string;
    clientName: string;
    clientInfo?: Client;
    cases: Case[];
  }>();

  const seenCaseIds = new Set<string>();
  const uniqueCases = cases.filter((c) => {
    const cKey = c.id || `${c.caseNumberFirstInstance || ''}_${c.caseYearFirstInstance || ''}_${c.court || ''}`;
    if (seenCaseIds.has(cKey)) return false;
    seenCaseIds.add(cKey);
    return true;
  });

  uniqueCases.forEach((c) => {
    const matchedClient = clients.find(
      (cl) => cl.id === c.clientId || cl.name.trim() === c.clientName?.trim()
    );
    const key = matchedClient?.id || c.clientId || c.clientName?.trim() || 'عام';
    const name = matchedClient?.name || c.clientName?.trim() || 'موكل غير محدد';

    if (!clientGroupsMap.has(key)) {
      clientGroupsMap.set(key, {
        clientKey: key,
        clientName: name,
        clientInfo: matchedClient,
        cases: []
      });
    }
    clientGroupsMap.get(key)!.cases.push(c);
  });

  // Sort clients alphabetically
  const sortedClients = Array.from(clientGroupsMap.values()).sort((a, b) =>
    a.clientName.localeCompare(b.clientName, 'ar')
  );

  let globalSerialCounter = 1;
  const totalCasesCount = uniqueCases.length;
  const totalClientsCount = sortedClients.length;

  let casesHtml = '';

  sortedClients.forEach((group) => {
    const cl = group.clientInfo;
    const clientPhone = cl?.phone || group.cases[0]?.clientsList?.[0]?.phone || 'غير مسجل';
    const clientNatId = cl?.nationalId || 'غير مسجل';
    const clientAddress = cl?.address || 'غير مسجل';
    const clientJob = cl?.job || 'غير مسجل';

    casesHtml += `
      <div class="client-group-header keep-together">
        <div>
          <div class="client-group-name">👤 ملف قضايا الموكل: ${group.clientName}</div>
          <div class="client-group-details">
            <span><strong>الرقم القومي:</strong> ${toArabicNum(clientNatId)}</span>
            <span><strong>رقم الهاتف:</strong> ${toArabicNum(clientPhone)}</span>
            <span><strong>العنوان:</strong> ${clientAddress}</span>
            <span><strong>المهنة / الصفة:</strong> ${clientJob}</span>
          </div>
        </div>
        <div class="stats-pill">
          ${toArabicNum(group.cases.length)} ${group.cases.length === 1 ? 'قضية' : 'قضايا'}
        </div>
      </div>
    `;

    group.cases.forEach((c) => {
      const serialArabic = toArabicNum(globalSerialCounter);
      const isEvenTheme = globalSerialCounter % 2 === 0;
      const themeClass = isEvenTheme ? 'theme-color-2' : 'theme-color-1';
      
      const seenSess = new Set<string>();
      const caseSessions = sessions.filter((s) => s.caseId === c.id).filter((s) => {
        const sKey = s.id || `${s.date}_${s.time || ''}_${s.subject || ''}`;
        if (seenSess.has(sKey)) return false;
        seenSess.add(sKey);
        return true;
      }).sort((a, b) => a.date.localeCompare(b.date));

      const assignedLawyer = users.find((u) => u.id === c.assignedLawyerId)?.fullName || 'غير مخصص';

      // Status styling
      let statusClass = 'status-active';
      if (c.status?.includes('مؤجل')) statusClass = 'status-postponed';
      if (c.status?.includes('حكم') || c.status?.includes('منتهية')) statusClass = 'status-judgment';

      // Court Numbers
      const firstNum = c.caseNumberFirstInstance ? `${toArabicNum(c.caseNumberFirstInstance)} لسنة ${toArabicNum(c.caseYearFirstInstance)}` : 'غير مقيد';
      const firstCourt = `${c.courtFirstInstance || c.court || 'غير محدد'} ${c.circuitFirstInstance || c.circuit ? `- الدائرة (${c.circuitFirstInstance || c.circuit})` : ''}`;

      const secNum = c.caseNumberSecondInstance ? `${toArabicNum(c.caseNumberSecondInstance)} لسنة ${toArabicNum(c.caseYearSecondInstance)}` : '-';
      const secCourt = c.courtSecondInstance ? `${c.courtSecondInstance} ${c.circuitSecondInstance ? `- الدائرة (${c.circuitSecondInstance})` : ''}` : '-';

      const cassNum = c.cassationNumber ? `${toArabicNum(c.cassationNumber)} لسنة ${toArabicNum(c.cassationYear)}` : '-';
      const cassCourt = c.courtCassation ? `${c.courtCassation} ${c.circuitCassation ? `- الدائرة (${c.circuitCassation})` : ''}` : '-';

      // Opponents info
      const opp = c.opponent;
      const oppName = opp?.name || 'غير مدون';
      const oppRole = opp?.role || 'المدعى عليه / الخصم';
      const oppLawyer = opp?.lawyer ? `${opp.lawyer} ${opp.lawyerPhone ? `(${toArabicNum(opp.lawyerPhone)})` : ''}` : 'غير مدون';

      casesHtml += `
        <div class="case-card keep-together ${themeClass}">
          <!-- Header of Case -->
          <div class="card-header-bar">
            <div class="card-serial-badge">
              <span>مسلسل:</span>
              <span>(${serialArabic})</span>
            </div>
            <div class="card-title-text">
              ⚖️ ${c.subject || 'ملف دعوى قضائية'}
              ${c.officeFileNo ? `<span style="font-size:11px; opacity:0.85; margin-right:8px;">[ملف مكتب رقم: ${toArabicNum(c.officeFileNo)}]</span>` : ''}
            </div>
            <div class="card-status-badge">
              ${c.status || 'متداولة'}
            </div>
          </div>

          <!-- Court & Jurisdictions Grid -->
          <table class="data-table">
            <tr>
              <th style="width: 14%;">درجة التقاضي</th>
              <td style="width: 20%;" class="highlight-cell">${c.degree || 'أول درجة'}</td>
              <th style="width: 14%;">نوع النزاع</th>
              <td style="width: 20%;">${c.type || 'مدني'}</td>
              <th style="width: 14%;">المحامي المسؤول</th>
              <td style="width: 18%;" class="highlight-cell">${assignedLawyer}</td>
            </tr>
            <tr>
              <th>أول درجة (الابتدائي)</th>
              <td class="highlight-cell">${firstNum}</td>
              <th>محكمة أول درجة</th>
              <td colspan="3">${firstCourt}</td>
            </tr>
            ${c.caseNumberSecondInstance ? `
            <tr>
              <th>الاستئناف (ثاني درجة)</th>
              <td class="highlight-cell">${secNum}</td>
              <th>محكمة الاستئناف</th>
              <td colspan="3">${secCourt}</td>
            </tr>
            ` : ''}
            ${c.cassationNumber ? `
            <tr>
              <th>الطعن بالنقض</th>
              <td class="highlight-cell">${cassNum}</td>
              <th>محكمة النقض</th>
              <td colspan="3">${cassCourt}</td>
            </tr>
            ` : ''}
            ${c.enforcementNumber || c.prosecutorName ? `
            <tr>
              <th>رقم الحصر / المحضر</th>
              <td>${c.enforcementNumber ? toArabicNum(c.enforcementNumber) : '-'}</td>
              <th>عضو / نيابة</th>
              <td colspan="3">${c.prosecutorName || '-'}</td>
            </tr>
            ` : ''}
          </table>

          <!-- Parties & Opponents -->
          <table class="data-table" style="border-top: none;">
            <tr>
              <th style="width: 14%;">الموكل وصفته</th>
              <td style="width: 36%;">
                <strong>${c.clientName}</strong> 
                <span style="color:#b45309; font-size:10.5px;">(${c.clientsList?.[0]?.role || 'المدعي / الشاكي'})</span>
              </td>
              <th style="width: 14%;">الخصم وصفته</th>
              <td style="width: 36%;">
                <strong>${oppName}</strong> 
                <span style="color:#b45309; font-size:10.5px;">(${oppRole})</span>
              </td>
            </tr>
            <tr>
              <th>عنوان / هاتف الموكل</th>
              <td>${toArabicNum(clientPhone)} - ${clientAddress}</td>
              <th>محامي الخصم وبياناته</th>
              <td>${oppLawyer} - ${opp?.address || 'العنوان غير مدون'}</td>
            </tr>
            ${c.nextHearingDate ? `
            <tr>
              <th>الجلسة القادمة</th>
              <td colspan="5" class="hearing-cell">
                📅 انعقاد الجلسة: ${toArabicNum(c.nextHearingDate)} ${c.nextHearingTime ? `الساعة ${toArabicNum(c.nextHearingTime)}` : ''}
              </td>
            </tr>
            ` : ''}
          </table>

          <!-- Investigation & Detention (If Active) -->
          ${c.isInvestigationActive ? `
            <div class="sub-section-title">
              <span>🛡️ مرحلة التحقيقات والحبس الاحتياطي</span>
              <span style="font-size:10.5px; font-weight:600;">تحقيق رقم: ${toArabicNum(c.investigationNumber || '')} لسنة ${toArabicNum(c.investigationYear || '')}</span>
            </div>
            <table class="data-table">
              <tr>
                <th style="width: 16%;">سلطة التحقيق</th>
                <td style="width: 34%;">${c.investigationAuthority || 'النيابة العامة'}</td>
                <th style="width: 16%;">حالة المتهم</th>
                <td style="width: 34%;">${c.investigationDefendantStatus || 'محبوس احتياطياً'}</td>
              </tr>
              <tr>
                <th>تاريخ البدء</th>
                <td>${toArabicNum(c.investigationStartDate || c.detentionStartDate || '-')}</td>
                <th>ملاحظات التحقيق</th>
                <td>${c.investigationNotes || 'لا توجد ملاحظات إضافية'}</td>
              </tr>
            </table>

            ${c.detentionRenewals && c.detentionRenewals.length > 0 ? `
              <table class="sessions-table">
                <thead>
                  <tr>
                    <th style="width: 6%;">م</th>
                    <th style="width: 18%;">تاريخ التجديد</th>
                    <th style="width: 22%;">سلطة / دائرة التجديد</th>
                    <th style="width: 14%;">مدة الحبس</th>
                    <th style="width: 24%;">القرار الصادر</th>
                    <th style="width: 16%;">الجلسة القادمة</th>
                  </tr>
                </thead>
                <tbody>
                  ${c.detentionRenewals.map((r, rIdx) => `
                    <tr>
                      <td style="text-align:center; font-weight:700;">${toArabicNum(rIdx + 1)}</td>
                      <td style="font-weight:700;">${toArabicNum(r.renewalDate || r.date || '')}</td>
                      <td>${r.authority || r.court || 'النيابة العامة'}</td>
                      <td>${r.duration || `${toArabicNum(r.durationDays || 15)} يوماً`}</td>
                      <td style="color:#0b1b2b; font-weight:700;">${r.decision || 'تجديد الحبس'}</td>
                      <td>${toArabicNum(r.nextRenewalDate || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          ` : ''}

          <!-- Expert Referral (If Active) -->
          ${c.isReferredToExperts || c.expertReferral?.isReferred ? `
            <div class="sub-section-title">
              <span>⚖️ ملف الإحالة للخبراء</span>
              <span style="font-size:10.5px; font-weight:600;">${c.expertReferral?.expertOffice || 'مكتب الخبراء المختص'}</span>
            </div>
            <table class="data-table">
              <tr>
                <th style="width: 16%;">مكتب الخبراء</th>
                <td style="width: 34%;">${c.expertReferral?.expertOffice || 'مكتب الخبراء'}</td>
                <th style="width: 16%;">رقم الملف / الخبير</th>
                <td style="width: 34%;">${c.expertReferral?.fileNumber ? toArabicNum(c.expertReferral.fileNumber) : '-'} / ${c.expertReferral?.expertName || 'غير مسجل'}</td>
              </tr>
            </table>
          ` : ''}

          <!-- Sessions History Table -->
          <div class="sub-section-title">
            <span>📅 جدول وسجل الجلسات القضائية (${toArabicNum(caseSessions.length)})</span>
            <span style="font-size:10px; font-weight:600;">القرارات والمواعيد والإجراءات</span>
          </div>
          ${caseSessions.length > 0 ? `
            <table class="sessions-table">
              <thead>
                <tr>
                  <th style="width: 5%;">م</th>
                  <th style="width: 15%;">تاريخ الجلسة</th>
                  <th style="width: 20%;">المحكمة والدائرة</th>
                  <th style="width: 25%;">ما تم بالجلسة والإجراءات</th>
                  <th style="width: 22%;">القرار الصادر / المنطوق</th>
                  <th style="width: 13%;">الجلسة القادمة</th>
                </tr>
              </thead>
              <tbody>
                ${caseSessions.map((s, sIdx) => `
                  <tr>
                    <td style="text-align:center; font-weight:700;">${toArabicNum(sIdx + 1)}</td>
                    <td style="font-weight:700; white-space:nowrap;">
                      ${toArabicNum(s.date)}
                      ${s.time ? `<div style="font-size:9.5px; color:#475569;">${toArabicNum(s.time)}</div>` : ''}
                    </td>
                    <td>
                      <div>${s.court || c.court || '-'}</div>
                      <div style="font-size:10px; color:#b45309;">${s.circuit || c.circuit || '-'}</div>
                    </td>
                    <td>${s.whatHappened || s.subject || 'حضور ومباشرة الدعوى'}</td>
                    <td style="font-weight:700; color:#0b1b2b;">${s.decision || (s.status === 'completed' ? 'تمت الجلسة' : 'قيد الانتظار')}</td>
                    <td style="color:#b45309; font-weight:800;">${s.nextHearingDate ? toArabicNum(s.nextHearingDate) : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="padding: 8px 14px; font-size:11px; color:#64748b; font-style:italic;">
              لا توجد جلسات سابقة مسجلة لهذا الملف حتى تاريخه.
            </div>
          `}

          <!-- Case Attachments -->
          ${c.files && c.files.length > 0 ? `
            <div class="sub-section-title">
              <span>📎 الوثائق والمستندات المرفقة (${toArabicNum(c.files.length)})</span>
            </div>
            <table class="files-table">
              <thead>
                <tr>
                  <th style="width: 6%;">م</th>
                  <th style="width: 44%;">اسم المستند / الملف</th>
                  <th style="width: 20%;">التصنيف</th>
                  <th style="width: 15%;">تاريخ الرفع</th>
                  <th style="width: 15%;">الحجم</th>
                </tr>
              </thead>
              <tbody>
                ${c.files.map((f, fIdx) => `
                  <tr>
                    <td style="text-align:center;">${toArabicNum(fIdx + 1)}</td>
                    <td style="font-weight:700;">${f.name}</td>
                    <td>${f.category || 'عام'}</td>
                    <td>${toArabicNum(f.uploadDate)}</td>
                    <td>${f.size || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <!-- Financials (If any recorded) -->
          ${(c.totalFees && c.totalFees > 0) ? `
            <table class="data-table" style="border-top: 1px dashed #cbd5e1; margin-top:4px;">
              <tr>
                <th style="width: 16%;">إجمالي الأتعاب</th>
                <td style="width: 17%; font-weight:800; color:#0b1b2b;">${toArabicNum(c.totalFees)} ج.م</td>
                <th style="width: 16%;">المسدد</th>
                <td style="width: 17%; font-weight:800; color:#166534;">${toArabicNum(c.paidFees || 0)} ج.م</td>
                <th style="width: 17%;">المتبقي</th>
                <td style="width: 17%; font-weight:800; color:#b45309;">${toArabicNum(c.remainingFees || (c.totalFees - (c.paidFees || 0)))} ج.م</td>
              </tr>
            </table>
          ` : ''}

          <!-- Notes (If any) -->
          ${c.notes ? `
            <div class="notes-box" style="padding:8px 12px; font-size:11px;">
              <strong>📝 ملاحظات وتوجيهات المكتب:</strong> ${c.notes}
            </div>
          ` : ''}
        </div>
      `;

      globalSerialCounter++;
    });
  });

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>ملف وسجل القضايا الشامل - مؤسسة رميح للمحاماة</title>
        <style>
          ${getReportCommonStyles()}
        </style>
      </head>
      <body>
        <!-- Top Screen Print Action Bar -->
        <div class="print-bar no-print">
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="print-btn-main" onclick="window.print()">
              <span>🖨️ طباعة ملف PDF الآن</span>
            </button>
            <div style="font-size:12px; color:#cbd5e1;">
              ملف القضايا والدعاوى الشامل (${toArabicNum(totalCasesCount)} قضية منظمة ومسلسلة لـ ${toArabicNum(totalClientsCount)} موكل)
            </div>
          </div>
          <button class="close-btn" onclick="window.close()">✖ إغلاق</button>
        </div>

        <!-- Main Report Paper Container -->
        <div class="report-container">
          <!-- Official Header -->
          <div class="report-header">
            <div class="header-logo-block">
              ${getEmblemSvg()}
              <div>
                <h1 class="office-title">مؤسسة رميح للمحاماة والاستشارات القانونية</h1>
                <p class="office-subtitle">بوابة الإدارة القضائية والمرافعة والطعن بالنقض والدستورية العليا</p>
              </div>
            </div>
            <div class="header-meta-block">
              <div class="header-meta-title">السجل والملف القضائي الموحد</div>
              <div><strong>هاتف المؤسسة:</strong> 01143472682</div>
              <div><strong>تاريخ الإصدار:</strong> ${toArabicNum(currentDate)}</div>
              <div><strong>التوقيت:</strong> ${toArabicNum(currentTime)}</div>
              <div><strong>المستخرج بواسطة:</strong> ${currentUser.fullName}</div>
            </div>
          </div>

          <!-- Document Banner -->
          <div class="doc-banner">
            <div>
              <div class="doc-banner-title">ملف القضايا والدعاوى القضائية الشامل</div>
              <div class="doc-banner-sub">
                تقرير رسمي تفصيلي شامل لكافة القضايا المسجلة، مجمعة ومسلسلة متتالية لكل موكل مع كافة الأرقام والمراحل والخصوم والجلسات والمرفقات.
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <div class="stats-pill">
                عدد الموكلين: ${toArabicNum(totalClientsCount)}
              </div>
              <div class="stats-pill" style="background:#d4a84f; color:#0b1b2b;">
                إجمالي القضايا: ${toArabicNum(totalCasesCount)}
              </div>
            </div>
          </div>

          <!-- Cases Listing Grouped by Client -->
          ${casesHtml}

          <!-- Footer -->
          <div class="footer-note">
            مؤسسة رميح للمحاماة والاستشارات القانونية • هاتف المؤسسة: 01143472682 • القاهرة - جمهورية مصر العربية<br/>
            تم استخراج هذا التقرير القضائي الشامل آلياً من قاعدة البيانات الرسمية لمؤسسة رميح للمحاماة والاستشارات القانونية.<br/>
            كافة البيانات وأرقام القضايا والجلسات مطابقة للقيود القضائية الرسمية المحفوظة بالملفات.
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates comprehensive PDF Report HTML for ALL Companies & their disputes/cases
 * Grouped strictly by company with consecutive serial numbers starting from 1 (١)
 */
export function generateAllCompaniesComprehensiveReportHTML(
  companies: Company[],
  cases: Case[],
  users: User[],
  sessions: HearingSession[],
  currentUser: User
): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // Deduplicate companies by ID
  const seenCompIds = new Set<string>();
  const uniqueCompanies = companies.filter(co => {
    const key = co.id || co.name.trim();
    if (seenCompIds.has(key)) return false;
    seenCompIds.add(key);
    return true;
  });

  // Sort companies alphabetically
  const sortedCompanies = [...uniqueCompanies].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  let companySerialCounter = 1;

  let companiesHtml = '';

  sortedCompanies.forEach((co) => {
    const serialArabic = toArabicNum(companySerialCounter);
    const isEvenTheme = companySerialCounter % 2 === 0;
    const themeClass = isEvenTheme ? 'theme-color-2' : 'theme-color-1';
    
    // Find cases belonging to this company (deduplicating case records)
    const seenCompCaseIds = new Set<string>();
    const companyCases = cases.filter((c) => {
      const cClientName = c.clientName?.trim() || '';
      const coName = co.name?.trim() || '';
      const matches = (
        c.clientId === co.id ||
        cClientName === coName ||
        (coName.length > 3 && cClientName.includes(coName)) ||
        (cClientName.length > 3 && coName.includes(cClientName))
      );
      if (!matches) return false;
      const cKey = c.id || `${c.caseNumberFirstInstance}_${c.caseYearFirstInstance}`;
      if (seenCompCaseIds.has(cKey)) return false;
      seenCompCaseIds.add(cKey);
      return true;
    });

    const partnersList = co.partners || [];
    const docsList = co.documents || [];

    companiesHtml += `
      <div class="case-card keep-together ${themeClass}" style="margin-bottom: 30px;">
        <!-- Company Header Banner -->
        <div class="card-header-bar" style="padding: 12px 16px;">
          <div class="card-serial-badge" style="font-size: 14px;">
            <span>شركة مسلسل:</span>
            <span>(${serialArabic})</span>
          </div>
          <div class="card-title-text" style="font-size: 16px;">
            🏢 ${co.name}
            ${co.officeFileNumber ? `<span style="font-size:11px; opacity:0.85; margin-right:10px;">[ملف مكتب رقم: ${toArabicNum(co.officeFileNumber)}]</span>` : ''}
          </div>
          <div class="card-status-badge">
            ${co.stage === 'post-establishment' ? 'ما بعد التأسيس' : 'مرحلة التأسيس'}
          </div>
        </div>

        <!-- Company Details Table -->
        <table class="data-table">
          <tr>
            <th style="width: 15%;">الشكل القانوني / الكيان</th>
            <td style="width: 35%;" class="highlight-cell">${co.companyType || 'شركة تجارية'}</td>
            <th style="width: 15%;">طبيعة النشاط</th>
            <td style="width: 35%;">${co.activityType || 'غير مدون'}</td>
          </tr>
          <tr>
            <th>رقم السجل التجاري</th>
            <td class="highlight-cell">${co.commercialRegister ? toArabicNum(co.commercialRegister) : 'غير مسجل'}</td>
            <th>البطاقة الضريبية</th>
            <td class="highlight-cell">${co.taxCard ? toArabicNum(co.taxCard) : 'غير مسجلة'}</td>
          </tr>
          <tr>
            <th>شهادة القيمة المضافة</th>
            <td>${co.vatCertificate ? toArabicNum(co.vatCertificate) : 'غير مسجلة'}</td>
            <th>أرقام الاتصال</th>
            <td>${co.phone ? toArabicNum(co.phone) : 'غير مدونة'}</td>
          </tr>
          <tr>
            <th>عنوان المركز الرئيسي</th>
            <td colspan="3">${co.address || 'العنوان غير مدون'}</td>
          </tr>
        </table>

        <!-- Partners and Shareholders -->
        <div class="sub-section-title">
          <span>👥 الشركاء والأنصبة والحصص بالشركة (${toArabicNum(partnersList.length)})</span>
        </div>
        ${partnersList.length > 0 ? `
          <table class="partners-table">
            <thead>
              <tr>
                <th style="width: 6%;">م</th>
                <th style="width: 32%;">اسم الشريك</th>
                <th style="width: 20%;">الرقم القومي</th>
                <th style="width: 16%;">رقم الهاتف</th>
                <th style="width: 13%;">نسبة المشاركة</th>
                <th style="width: 13%;">قيمة الحصة</th>
              </tr>
            </thead>
            <tbody>
              ${partnersList.map((p, pIdx) => `
                <tr>
                  <td style="text-align:center; font-weight:700;">${toArabicNum(pIdx + 1)}</td>
                  <td style="font-weight:700;">${p.name}</td>
                  <td>${p.nationalId ? toArabicNum(p.nationalId) : '-'}</td>
                  <td>${p.phone ? toArabicNum(p.phone) : '-'}</td>
                  <td style="font-weight:800; color:#b45309; text-align:center;">${toArabicNum(p.participationPercentage)}%</td>
                  <td style="font-weight:700;">${p.shareValue ? `${toArabicNum(p.shareValue)} ج.م` : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div style="padding: 8px 14px; font-size:11px; color:#64748b; font-style:italic;">
            لا توجد بيانات شركاء مدونة بالملف حالياً.
          </div>
        `}

        <!-- Company Documents & Contracts -->
        <div class="sub-section-title">
          <span>📑 عقود ووثائق تأسيس الشركة المودعة (${toArabicNum(docsList.length)})</span>
        </div>
        ${docsList.length > 0 ? `
          <table class="files-table">
            <thead>
              <tr>
                <th style="width: 6%;">م</th>
                <th style="width: 50%;">اسم الوثيقة / العقد</th>
                <th style="width: 24%;">نوع المستند</th>
                <th style="width: 20%;">تاريخ الإيداع</th>
              </tr>
            </thead>
            <tbody>
              ${docsList.map((d, dIdx) => `
                <tr>
                  <td style="text-align:center;">${toArabicNum(dIdx + 1)}</td>
                  <td style="font-weight:700;">${d.name}</td>
                  <td>${d.type || 'وثيقة رسمية'}</td>
                  <td>${toArabicNum(d.uploadDate || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div style="padding: 8px 14px; font-size:11px; color:#64748b; font-style:italic;">
            لا توجد عقود أو وثائق مودعة بملف الشركة حتى تاريخه.
          </div>
        `}

        <!-- Associated Disputes & Cases for this Company -->
        <div class="sub-section-title" style="background:#0b1b2b; color:#ffffff; border-right-color:#d4a84f; margin-top:14px;">
          <span>⚖️ النزاعات والقضايا القضائية التابعة للشركة (${toArabicNum(companyCases.length)})</span>
          <span style="font-size:11px; color:#fef08a;">جميع قضايا الشركة متتالية معاً بالتفصيل</span>
        </div>

        ${companyCases.length > 0 ? `
          <div style="padding: 12px; background:#f8fafc;">
            ${companyCases.map((c, cIdx) => {
              const caseSessions = sessions.filter((s) => s.caseId === c.id).sort((a, b) => a.date.localeCompare(b.date));
              const assignedLawyer = users.find((u) => u.id === c.assignedLawyerId)?.fullName || 'غير مخصص';
              const disputeTheme = (cIdx % 2 === 0) ? 'theme-color-1' : 'theme-color-2';

              const firstNum = c.caseNumberFirstInstance ? `${toArabicNum(c.caseNumberFirstInstance)} لسنة ${toArabicNum(c.caseYearFirstInstance)}` : 'غير مقيد';
              const firstCourt = `${c.courtFirstInstance || c.court || 'غير محدد'} ${c.circuitFirstInstance || c.circuit ? `- الدائرة (${c.circuitFirstInstance || c.circuit})` : ''}`;

              return `
                <div class="case-card keep-together ${disputeTheme}" style="margin-bottom:14px; border-width:1.5px;">
                  <div class="card-header-bar" style="padding:8px 12px;">
                    <div class="card-title-text" style="font-size:13px;">
                      <span class="card-serial-badge" style="padding:2px 8px; font-size:11px; margin-left:6px;">
                        دعوى (${toArabicNum(cIdx + 1)})
                      </span>
                      ${c.subject || 'ملف نزاع قضائي'}
                    </div>
                    <div class="card-status-badge">
                      ${c.status || 'متداولة'}
                    </div>
                  </div>

                  <table class="data-table">
                    <tr>
                      <th style="width: 15%;">رقم الدعوى (أول درجة)</th>
                      <td style="width: 35%;" class="highlight-cell">${firstNum}</td>
                      <th style="width: 15%;">المحكمة والدائرة</th>
                      <td style="width: 35%;">${firstCourt}</td>
                    </tr>
                    ${c.caseNumberSecondInstance ? `
                    <tr>
                      <th>رقم الاستئناف</th>
                      <td class="highlight-cell">${toArabicNum(c.caseNumberSecondInstance)} لسنة ${toArabicNum(c.caseYearSecondInstance)}</td>
                      <th>محكمة الاستئناف</th>
                      <td>${c.courtSecondInstance || '-'}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <th>الخصم وصفته</th>
                      <td>${c.opponent?.name || 'غير مدون'} (${c.opponent?.role || 'المدعى عليه'})</td>
                      <th>محامي الخصم</th>
                      <td>${c.opponent?.lawyer || 'غير مدون'}</td>
                    </tr>
                    <tr>
                      <th>المحامي المسؤول</th>
                      <td style="font-weight:700;">${assignedLawyer}</td>
                      <th>الجلسة القادمة</th>
                      <td class="hearing-cell">
                        ${c.nextHearingDate ? `${toArabicNum(c.nextHearingDate)} (${toArabicNum(c.nextHearingTime || '09:00')})` : 'لم تحدد'}
                      </td>
                    </tr>
                  </table>

                  ${caseSessions.length > 0 ? `
                    <table class="sessions-table" style="margin-top:0;">
                      <thead>
                        <tr>
                          <th style="width: 6%;">م</th>
                          <th style="width: 18%;">تاريخ الجلسة</th>
                          <th style="width: 44%;">ما تم بالجلسة</th>
                          <th style="width: 32%;">القرار الصادر</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${caseSessions.slice(-4).map((s, sIdx) => `
                          <tr>
                            <td style="text-align:center;">${toArabicNum(sIdx + 1)}</td>
                            <td style="font-weight:700;">${toArabicNum(s.date)}</td>
                            <td>${s.whatHappened || s.subject || '-'}</td>
                            <td style="font-weight:700; color:#0b1b2b;">${s.decision || (s.status === 'completed' ? 'تمت' : 'قيد الانتظار')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="padding: 14px; background:#f0fdf4; border-top:1px solid #bbf7d0; font-size:12px; color:#166534; font-weight:700;">
            ✓ لا توجد قضايا أو منازعات قضائية متداولة مسجلة لهذه الشركة (السجل القضائي خالٍ من النزاعات).
          </div>
        `}
      </div>
    `;

    companySerialCounter++;
  });

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>ملف وسجل الشركات والمؤسسات الشامل - مؤسسة رميح للمحاماة</title>
        <style>
          ${getReportCommonStyles()}
        </style>
      </head>
      <body>
        <!-- Top Screen Print Action Bar -->
        <div class="print-bar no-print">
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="print-btn-main" onclick="window.print()">
              <span>🖨️ طباعة ملف PDF الآن</span>
            </button>
            <div style="font-size:12px; color:#cbd5e1;">
              ملف الشركات والمؤسسات الشامل (${toArabicNum(companies.length)} شركة مع كافة بياناتها وقضاياها متتالية)
            </div>
          </div>
          <button class="close-btn" onclick="window.close()">✖ إغلاق</button>
        </div>

        <!-- Main Report Paper Container -->
        <div class="report-container">
          <!-- Official Header -->
          <div class="report-header">
            <div class="header-logo-block">
              ${getEmblemSvg()}
              <div>
                <h1 class="office-title">مؤسسة رميح للمحاماة والاستشارات القانونية</h1>
                <p class="office-subtitle">قسم الشركات والكيانات التجارية والاستشارات المؤسسية</p>
              </div>
            </div>
            <div class="header-meta-block">
              <div class="header-meta-title">سجل ملفات الشركات والقضايا المرتبطة</div>
              <div><strong>هاتف المؤسسة:</strong> 01143472682</div>
              <div><strong>تاريخ الإصدار:</strong> ${toArabicNum(currentDate)}</div>
              <div><strong>التوقيت:</strong> ${toArabicNum(currentTime)}</div>
              <div><strong>المستخرج بواسطة:</strong> ${currentUser.fullName}</div>
            </div>
          </div>

          <!-- Document Banner -->
          <div class="doc-banner">
            <div>
              <div class="doc-banner-title">ملف سجل الشركات والكيانات التجارية وقضاياها</div>
              <div class="doc-banner-sub">
                تقرير رسمي شامل بجميع بيانات الشركات، السجلات، الضرائب، الشركاء، العقود، وجميع القضايا والنزاعات التابعة لكل شركة متتالية بالتفصيل الدقيق.
              </div>
            </div>
            <div class="stats-pill" style="background:#d4a84f; color:#0b1b2b;">
              إجمالي الشركات: ${toArabicNum(companies.length)}
            </div>
          </div>

          <!-- Companies Listing -->
          ${companiesHtml}

          <!-- Footer -->
          <div class="footer-note">
            مؤسسة رميح للمحاماة والاستشارات القانونية • هاتف المؤسسة: 01143472682 • القاهرة - جمهورية مصر العربية<br/>
            تم استخراج هذا التقرير الشامل آلياً من قاعدة البيانات الرسمية لمؤسسة رميح للمحاماة والاستشارات القانونية.<br/>
            كافة البيانات المؤسسية والنزاعات القضائية المرتبطة مطابقة للسجلات الرسمية المحفوظة.
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Helper to open print window safely with generated HTML
 */
export function openPrintReportWindow(htmlContent: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة (Popups) لعرض وطباعة تقرير الـ PDF.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
