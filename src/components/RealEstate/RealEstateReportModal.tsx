import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, Download, X, ZoomIn, ZoomOut, Landmark, FileText, Check, AlertCircle, Eye
} from 'lucide-react';
import { 
  ReRentDue, ReOwner, ReProperty, ReUnit, ReTenant, User 
} from '../../types';

export type ReportType = 
  | 'property_monthly' 
  | 'owner_statement' 
  | 'tenant_statement' 
  | 'owner_payouts' 
  | 'tenant_collections' 
  | 'arrears' 
  | 'office_commissions' 
  | 'office_advances';

interface RealEstateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  dues: ReRentDue[];
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  selectedPropertyId: string;
  selectedOwnerId: string;
  selectedTenantId: string;
  selectedMonthYear: string;
  currentUser: User;
  autoPrint?: boolean;
}

export function getReportTitle(reportType: ReportType): string {
  switch (reportType) {
    case 'property_monthly':
      return 'التقرير الشهري المالي والإشغالي للعقار';
    case 'owner_statement':
      return 'تقرير كشف حساب وتسوية مستحقات المالك';
    case 'tenant_statement':
      return 'تقرير كشف حساب ومدفوعات وتأخيرات المستأجر';
    case 'owner_payouts':
      return 'تقرير المبالغ المصروفة للملاك';
    case 'tenant_collections':
      return 'تقرير المبالغ المحصلة من المستأجرين';
    case 'arrears':
      return 'تقرير المتأخرات والديون المستحقة عن العقود';
    case 'office_commissions':
      return 'تقرير أرباح وعمولات المكتب عن الإدارة العقارية';
    case 'office_advances':
      return 'تقرير سُلف المكتب والفرق بين المصروف والمحصل';
    default:
      return 'التقرير المالي الرسمي للإدارة العقارية';
  }
}

export function generateRealEstateReportHTML(params: {
  reportType: ReportType;
  dues: ReRentDue[];
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  selectedPropertyId: string;
  selectedOwnerId: string;
  selectedTenantId: string;
  selectedMonthYear: string;
  currentUser: User;
  serialNumber?: string;
  issuedAt?: string;
}): string {
  const {
    reportType,
    dues,
    owners,
    properties,
    units,
    tenants,
    selectedPropertyId,
    selectedOwnerId,
    selectedTenantId,
    selectedMonthYear,
    currentUser,
    serialNumber = `RUM-RE-${Math.floor(100000 + Math.random() * 900000)}`,
    issuedAt = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })
  } = params;

  const todayISO = new Date().toISOString().slice(0, 10);
  const currentMonthISO = new Date().toISOString().slice(0, 7);

  // Status computation helpers
  const getDuePayoutStatus = (due: ReRentDue): 'paid_out' | 'pending_payout' => {
    if (due.payoutStatus === 'paid_out' || due.status === 'paid_out' || due.payoutDate) {
      return 'paid_out';
    }
    return 'pending_payout';
  };

  const getDueCollectionStatus = (due: ReRentDue): 'collected' | 'overdue' | 'pending_collection' => {
    if (due.collectionStatus === 'collected' || due.status === 'collected' || due.collectedAmount! > 0 || due.paidDate) {
      return 'collected';
    }
    if (due.dueDate < todayISO || due.forMonthYear < currentMonthISO) {
      return 'overdue';
    }
    return 'pending_collection';
  };

  // Filter dues based on report configuration
  const filteredDues = dues.filter(d => {
    if (selectedMonthYear !== 'all' && d.forMonthYear !== selectedMonthYear) return false;
    if (selectedOwnerId !== 'all' && d.ownerId !== selectedOwnerId) return false;
    if (selectedPropertyId !== 'all' && d.propertyId !== selectedPropertyId) return false;
    if (selectedTenantId !== 'all' && d.tenantId !== selectedTenantId) return false;

    if (reportType === 'arrears' && getDueCollectionStatus(d) !== 'overdue') return false;
    if (reportType === 'owner_payouts' && getDuePayoutStatus(d) !== 'paid_out') return false;
    if (reportType === 'tenant_collections' && getDueCollectionStatus(d) !== 'collected') return false;
    if (reportType === 'office_advances' && (getDuePayoutStatus(d) !== 'paid_out' || getDueCollectionStatus(d) === 'collected')) return false;

    return true;
  });

  // Financial Summaries for the report
  let sumRent = 0;
  let sumCommission = 0;
  let sumNetOwner = 0;
  let sumCollected = 0;
  let sumDisbursed = 0;
  let sumAdvances = 0;

  filteredDues.forEach(d => {
    sumRent += d.rentAmount || 0;
    sumCommission += d.commissionAmount || 0;
    sumNetOwner += d.netOwnerAmount || 0;

    const pStat = getDuePayoutStatus(d);
    const cStat = getDueCollectionStatus(d);

    if (cStat === 'collected') {
      sumCollected += d.collectedAmount || d.rentAmount || 0;
    }
    if (pStat === 'paid_out') {
      sumDisbursed += d.netOwnerAmount || 0;
      if (cStat !== 'collected') {
        sumAdvances += d.netOwnerAmount || 0;
      }
    }
  });

  // Context Descriptions
  const propertyName = selectedPropertyId === 'all' ? 'جميع العقارات' : (properties.find(p => p.id === selectedPropertyId)?.name || 'عقار محدد');
  const ownerName = selectedOwnerId === 'all' ? 'جميع الملاك' : (owners.find(o => o.id === selectedOwnerId)?.name || 'مالك محدد');
  const tenantName = selectedTenantId === 'all' ? 'جميع المستأجرين' : (tenants.find(t => t.id === selectedTenantId)?.fullName || (tenants.find(t => t.id === selectedTenantId) as any)?.name || 'مستأجر محدد');
  const monthName = selectedMonthYear === 'all' ? 'كافة الشهور' : selectedMonthYear;

  const reportTitle = getReportTitle(reportType);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - مؤسسة رميح للمحاماة</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 12mm 15mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'IBM Plex Sans Arabic', 'Cairo', sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      direction: rtl;
      text-align: right;
      font-size: 11pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .page-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 5mm;
      background: #ffffff;
    }

    /* Official Branding Header */
    .header-branding {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px double #b45309;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }

    .brand-logo-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border: 2px solid #d97706;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f59e0b;
      font-size: 24px;
      font-weight: bold;
    }

    .firm-name {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
    }

    .firm-sub {
      font-size: 9.5pt;
      color: #b45309;
      font-weight: 700;
      margin-top: 2px;
    }

    .meta-box {
      text-align: left;
      font-size: 8.5pt;
      color: #475569;
    }

    .meta-box strong {
      color: #0f172a;
    }

    .serial-badge {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: bold;
      font-size: 9pt;
      margin-top: 4px;
    }

    /* Report Banner */
    .report-title-banner {
      background: #0f172a;
      color: #fbbf24;
      text-align: center;
      padding: 10px 15px;
      border-radius: 8px;
      border: 1px solid #d97706;
      margin-bottom: 15px;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
    }

    .report-title-banner h1 {
      font-size: 13pt;
      font-weight: 800;
      margin: 0;
      color: #f59e0b;
    }

    /* Filters Summary Grid */
    .filters-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 15px;
      font-size: 8.5pt;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
    }

    .filter-item .label {
      color: #64748b;
      font-weight: 600;
      margin-bottom: 1px;
    }

    .filter-item .val {
      color: #0f172a;
      font-weight: 700;
    }

    /* KPI Cards Row */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 15px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }

    .kpi-card.gold {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .kpi-card.emerald {
      border-color: #10b981;
      background: #ecfdf5;
    }

    .kpi-card .kpi-lbl {
      font-size: 7.5pt;
      color: #475569;
      font-weight: 700;
      display: block;
    }

    .kpi-card .kpi-val {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
      font-family: 'Cairo', sans-serif;
    }

    /* Report Data Table */
    .data-table-container {
      width: 100%;
      margin-bottom: 20px;
    }

    table.report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }

    table.report-table th {
      background-color: #0f172a;
      color: #f59e0b;
      font-weight: 800;
      padding: 7px 6px;
      border: 1px solid #1e293b;
      text-align: center;
      font-size: 8.5pt;
    }

    table.report-table td {
      padding: 6px 6px;
      border: 1px solid #cbd5e1;
      text-align: center;
      vertical-align: middle;
    }

    table.report-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .num-font {
      font-family: 'Cairo', monospace, sans-serif;
      font-weight: 700;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
    }

    .badge-collected {
      background-color: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }

    .badge-overdue {
      background-color: #ffe4e6;
      color: #9f1239;
      border: 1px solid #fecdd3;
    }

    .badge-pending {
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    .badge-payout {
      background-color: #e0e7ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
    }

    tr.total-row td {
      background-color: #1e293b !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 9pt;
      border-top: 2px solid #d97706;
    }

    tr.total-row td.gold-text {
      color: #f59e0b !important;
    }

    /* Signatures Section */
    .signatures-block {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #cbd5e1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      text-align: center;
      font-size: 8.5pt;
    }

    .sig-col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 70px;
    }

    .sig-title {
      font-weight: 700;
      color: #334155;
    }

    .sig-dots {
      color: #94a3b8;
      font-weight: bold;
    }

    /* Footer */
    .report-footer {
      margin-top: 20px;
      text-align: center;
      font-size: 7.5pt;
      color: #64748b;
      border-top: 1px border #e2e8f0;
      padding-top: 6px;
    }

    @media print {
      body {
        background: white !important;
        color: black !important;
      }
      .page-container {
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">

    <!-- Header Branding -->
    <div class="header-branding">
      <div class="brand-logo-title">
        <div class="brand-icon">⚖️</div>
        <div>
          <div class="firm-name">مؤسسة رميح للمحاماة والاستشارات القانونية</div>
          <div class="firm-sub">قطاع الإدارة العقارية والتحصيل والخدمات المالية والتوثيق</div>
        </div>
      </div>

      <div class="meta-box">
        <div><strong>تاريخ الإصدار:</strong> ${issuedAt}</div>
        <div><strong>مُعد التقرير:</strong> ${currentUser?.fullName || (currentUser as any)?.name || 'عربي أبو رميح'}</div>
        <div class="serial-badge">${serialNumber}</div>
      </div>
    </div>

    <!-- Title Banner -->
    <div class="report-title-banner">
      <h1>${reportTitle}</h1>
    </div>

    <!-- Filters Summary -->
    <div class="filters-summary">
      <div class="filter-item">
        <span class="label">العقار المختار:</span>
        <span class="val">${propertyName}</span>
      </div>
      <div class="filter-item">
        <span class="label">المالك:</span>
        <span class="val">${ownerName}</span>
      </div>
      <div class="filter-item">
        <span class="label">المستأجر:</span>
        <span class="val">${tenantName}</span>
      </div>
      <div class="filter-item">
        <span class="label">الشهر المستهدف:</span>
        <span class="val">${monthName}</span>
      </div>
    </div>

    <!-- KPI Summary Row -->
    <div class="kpi-row">
      <div class="kpi-card gold">
        <span class="kpi-lbl">إجمالي المستحق</span>
        <span class="kpi-val">${sumRent.toLocaleString('ar-EG')} ج.م</span>
      </div>
      <div class="kpi-card emerald">
        <span class="kpi-lbl">المبالغ المحصلة</span>
        <span class="kpi-val">${sumCollected.toLocaleString('ar-EG')} ج.م</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-lbl">المصروف للملاك</span>
        <span class="kpi-val">${sumDisbursed.toLocaleString('ar-EG')} ج.م</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-lbl">عمولات المكتب</span>
        <span class="kpi-val">${sumCommission.toLocaleString('ar-EG')} ج.م</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-lbl">سُلف الفرق</span>
        <span class="kpi-val">${sumAdvances.toLocaleString('ar-EG')} ج.م</span>
      </div>
    </div>

    <!-- Data Table -->
    <div class="data-table-container">
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 8%;">الشهر</th>
            <th style="width: 14%;">اسم المالك</th>
            <th style="width: 14%;">اسم العقار</th>
            <th style="width: 8%;">الوحدة</th>
            <th style="width: 14%;">اسم المستأجر</th>
            <th style="width: 10%;">الإيجار</th>
            <th style="width: 8%;">العمولة</th>
            <th style="width: 10%;">صافي المالك</th>
            <th style="width: 7%;">التحصيل</th>
            <th style="width: 7%;">الصرف</th>
          </tr>
        </thead>
        <tbody>
          ${filteredDues.length === 0 ? `
            <tr>
              <td colspan="10" style="padding: 20px; color: #64748b; font-weight: bold;">
                لا توجد بيانات مطابقة للفلاتر المحددة في هذا التقرير.
              </td>
            </tr>
          ` : filteredDues.map(d => {
            const pStat = getDuePayoutStatus(d);
            const cStat = getDueCollectionStatus(d);

            return `
              <tr>
                <td class="num-font">${d.monthNameAr || d.forMonthYear}</td>
                <td style="font-weight: 700;">${d.ownerName}</td>
                <td>${d.propertyName}</td>
                <td class="num-font">وحدة ${d.unitNumber}</td>
                <td style="font-weight: 700;">${d.tenantName}</td>
                <td class="num-font">${d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                <td class="num-font" style="color: #d97706;">${d.commissionAmount.toLocaleString('ar-EG')} ج.m</td>
                <td class="num-font" style="font-weight: 800;">${d.netOwnerAmount.toLocaleString('ar-EG')} ج.م</td>
                <td>
                  ${cStat === 'collected' ? '<span class="badge badge-collected">محصل</span>' :
                    cStat === 'overdue' ? '<span class="badge badge-overdue">متأخر</span>' :
                    '<span class="badge badge-pending">معلق</span>'}
                </td>
                <td>
                  ${pStat === 'paid_out' ? '<span class="badge badge-payout">تم الصرف</span>' :
                    '<span class="badge badge-pending">بانتظار الصرف</span>'}
                </td>
              </tr>
            `;
          }).join('')}
          
          <tr class="total-row">
            <td colspan="5" style="text-align: right; padding-right: 15px;">الإجمالي الكلي للتقرير (${filteredDues.length} سجل)</td>
            <td class="num-font gold-text">${sumRent.toLocaleString('ar-EG')} ج.م</td>
            <td class="num-font gold-text">${sumCommission.toLocaleString('ar-EG')} ج.م</td>
            <td class="num-font gold-text">${sumNetOwner.toLocaleString('ar-EG')} ج.م</td>
            <td colspan="2" style="font-size: 8pt; text-align: center;">إجمالي التقرير المالي المعتمد</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Signatures -->
    <div class="signatures-block">
      <div class="sig-col">
        <span class="sig-title">إعداد المحاسب المسؤول</span>
        <span class="sig-dots">التوقيع: .....................</span>
      </div>
      <div class="sig-col">
        <span class="sig-title">مراجعة مدير قطاع العقارات</span>
        <span class="sig-dots">التوقيع: .....................</span>
      </div>
      <div class="sig-col">
        <span class="sig-title">اعتماد رئيس المؤسسة والختم الرسمي</span>
        <span class="sig-dots">الختم والتوقيع الرسمي</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="report-footer">
      وثيقة إلكترونية موثقة صادرة عن منظومة مؤسسة رميح للمحاماة - جميع الحقوق محفوظة © ${new Date().getFullYear()}
    </div>

  </div>
</body>
</html>`;

  return html;
}

/**
 * Direct print helper: Creates a temporary iframe and triggers browser print
 * strictly for the generated report content.
 */
export function printReportDirectly(htmlContent: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Direct print error:', err);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 2000);
      }
    }, 500);
  }
}

export default function RealEstateReportModal({
  isOpen,
  onClose,
  reportType,
  dues,
  owners,
  properties,
  units,
  tenants,
  selectedPropertyId,
  selectedOwnerId,
  selectedTenantId,
  selectedMonthYear,
  currentUser,
  autoPrint = false
}: RealEstateReportModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  if (!isOpen) return null;

  const htmlContent = generateRealEstateReportHTML({
    reportType,
    dues,
    owners,
    properties,
    units,
    tenants,
    selectedPropertyId,
    selectedOwnerId,
    selectedTenantId,
    selectedMonthYear,
    currentUser
  });

  const reportTitle = getReportTitle(reportType);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (err) {
        printReportDirectly(htmlContent);
      }
    } else {
      printReportDirectly(htmlContent);
    }
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 animate-fadeIn" dir="rtl">
      <div className="bg-[#0f172a] border border-[#D4A84F]/30 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-[#F8F9FB]">
        
        {/* Modal Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between p-3.5 sm:p-4 bg-[#132238] border-b border-[#D4A84F]/20 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#D4A84F]/15 text-[#D4A84F]">
              <Landmark className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#F8F9FB] flex items-center gap-2">
                <span>معاينة التقرير الرسمي</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30 font-bold">A4 PDF</span>
              </h3>
              <p className="text-xs text-[#9EA7B8] font-bold">{reportTitle}</p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            
            {/* Zoom controls */}
            <div className="hidden sm:flex items-center bg-[#08111F] border border-[#D4A84F]/15 rounded-xl px-2 py-1 gap-1">
              <button
                onClick={() => setZoomLevel(prev => Math.max(75, prev - 15))}
                className="p-1 hover:bg-white/10 rounded-lg text-[#9EA7B8] hover:text-white transition-all"
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-[#D4A84F] px-1">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
                className="p-1 hover:bg-white/10 rounded-lg text-[#9EA7B8] hover:text-white transition-all"
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownloadHTML}
              className="px-3 py-1.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/25 text-[#D4A84F] hover:bg-[#D4A84F]/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="تنزيل نسختك المطبوعة"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">تنزيل التقرير</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 shadow-md shadow-[#D4A84F]/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>طباعة التقرير</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer mr-1"
              title="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Canvas Stage */}
        <div className="flex-1 bg-slate-950/70 p-4 overflow-auto flex justify-center items-start">
          <div 
            className="bg-white rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-slate-300 overflow-hidden transition-all duration-200"
            style={{
              width: `${(210 * (zoomLevel / 100))}mm`,
              minHeight: `${(297 * (zoomLevel / 100))}mm`,
              transformOrigin: 'top center'
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full h-full min-h-[800px] border-none"
              title="A4 Report Paper Frame"
            />
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="p-2.5 px-4 bg-[#132238] border-t border-[#D4A84F]/20 flex items-center justify-between text-[11px] text-[#9EA7B8] font-bold">
          <span>مؤسسة رميح للمحاماة والاستشارات القانونية • قطاع العقارات والتحصيل</span>
          <span className="text-[#D4A84F] font-mono">جاهز للطباعة والتصدير الفعلي</span>
        </div>

      </div>
    </div>
  );
}
