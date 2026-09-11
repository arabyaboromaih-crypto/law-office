import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, X, Search, Calendar, DollarSign, Printer, 
  CheckCircle, FileText, User, Building, Phone, Clock,
  ArrowRight, ShieldCheck, AlertCircle, Sparkles, Filter, Download,
  Wallet, RefreshCw, Eye, RotateCcw, Coins, ArrowUpDown, Tag
} from 'lucide-react';
import { ReOwnerAdvance, ReOwner, ReProperty, User as AuthUser } from '../../types';
import { tafqeetNumber, getDeductionMethodBadge } from './AdvanceDeductionModal';

interface AdvanceDeductionReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  advances: ReOwnerAdvance[];
  owners: ReOwner[];
  properties: ReProperty[];
  selectedAdvance?: ReOwnerAdvance | null;
  currentUser?: AuthUser;
}

const formatDeductionDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return dateStr;
};

// Generate official printable HTML voucher for an advance deduction voucher
export function generateAdvanceDeductionVoucherHTML({
  advance,
  currentUser
}: {
  advance: ReOwnerAdvance;
  currentUser?: AuthUser;
}): string {
  const isDeducted = !!advance.isDeducted;
  const isFromEntitlement = !advance.deductionMethod || advance.deductionMethod === 'خصم من المستحق' || advance.deductionMethod === 'من المستحق للمالك';
  const methodLabel = advance.deductionMethod || (isDeducted ? 'خصم من المستحق' : 'سلفة جارية (غير مخصومة)');
  
  const originalAmount = advance.amount || 0;
  const deductedAmount = (advance.deductedAmount !== undefined && advance.deductedAmount !== null && Number(advance.deductedAmount) > 0)
    ? Number(advance.deductedAmount)
    : originalAmount;

  const voucherNumber = advance.deductionRef 
    ? `DED-${advance.deductionRef}` 
    : `ADV-${(advance.id || '').slice(-6).toUpperCase() || '0000'}`;

  const amountWords = tafqeetNumber(deductedAmount);
  const issuedDate = advance.deductedAt || advance.deductionDate || advance.advanceDate || new Date().toISOString().slice(0, 10);
  const accountantName = advance.deductedBy || advance.recordedBy || currentUser?.fullName || 'المحاسب المالي';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>سند خصم وتسوية سُلفة - ${voucherNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      background: #fff;
      color: #0f172a;
      margin: 0;
      padding: 12px;
      font-size: 11pt;
    }
    .voucher-container {
      border: 2px solid #b38734;
      border-radius: 16px;
      padding: 24px;
      position: relative;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 55pt;
      color: rgba(179, 135, 52, 0.04);
      font-weight: 900;
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #b38734;
      padding-bottom: 14px;
      margin-bottom: 18px;
      position: relative;
      z-index: 1;
    }
    .brand-title {
      font-size: 16pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 9pt;
      color: #b38734;
      font-weight: bold;
      margin-top: 4px;
    }
    .badge-container {
      text-align: center;
    }
    .voucher-badge {
      display: inline-block;
      background: #fdf6e7;
      color: #b38734;
      border: 1.5px solid #b38734;
      padding: 6px 20px;
      border-radius: 25px;
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .meta-box {
      text-align: left;
      font-size: 9pt;
      color: #475569;
      line-height: 1.6;
    }
    .meta-box strong {
      color: #0f172a;
    }
    .amount-card {
      background: linear-gradient(135deg, #fefce8, #fef3c7);
      border: 1.5px dashed #b38734;
      border-radius: 12px;
      padding: 14px 20px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 1;
    }
    .amount-val {
      font-size: 20pt;
      font-weight: 900;
      color: #92400e;
      font-family: monospace;
    }
    .amount-words {
      font-size: 10.5pt;
      font-weight: bold;
      color: #78350f;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10pt;
      position: relative;
      z-index: 1;
    }
    table.data-table td {
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    table.data-table .lbl {
      background: #f8fafc;
      font-weight: 800;
      color: #334155;
      width: 22%;
    }
    table.data-table .val {
      font-weight: 600;
      color: #0f172a;
      width: 28%;
    }
    .settlement-status-box {
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 24px;
      font-size: 10pt;
      background: ${isDeducted ? (isFromEntitlement ? '#ecfdf5' : '#fefce8') : '#f8fafc'};
      border: 1.5px solid ${isDeducted ? (isFromEntitlement ? '#a7f3d0' : '#fef08a') : '#cbd5e1'};
      color: ${isDeducted ? (isFromEntitlement ? '#065f46' : '#854d0e') : '#475569'};
      position: relative;
      z-index: 1;
    }
    .signatures-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 35px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      font-size: 10pt;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    .sig-block {
      width: 30%;
    }
    .sig-line {
      margin-top: 45px;
      border-bottom: 1.5px dotted #94a3b8;
    }
    .footer-note {
      margin-top: 25px;
      text-align: center;
      font-size: 8.5pt;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
      position: relative;
      z-index: 1;
    }
  </style>
</head>
<body>
  <div class="voucher-container">
    <div class="watermark">مؤسسة رميح للمحاماة</div>

    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-title">⚖️ مؤسسة رميح للمحاماة والاستشارات القانونية</div>
        <div class="brand-sub">قطاع الإدارة العقارية — السجل المالي وسندات التسوية</div>
      </div>
      <div class="badge-container">
        <div class="voucher-badge">سند خصم وتسوية سُلفة</div>
      </div>
      <div class="meta-box">
        <div><strong>رقم السند:</strong> ${voucherNumber}</div>
        <div><strong>تاريخ الإصدار:</strong> ${issuedDate}</div>
        <div><strong>حالة السند:</strong> ${isDeducted ? 'معتمد ومُسوّى ✔' : 'سلفة جارية ⏳'}</div>
      </div>
    </div>

    <!-- Amount Banner -->
    <div class="amount-banner amount-card">
      <div>
        <span style="font-size: 9pt; color: #78350f; font-weight: bold; display: block;">المبلغ المسدد / المخصوم:</span>
        <span class="amount-val">${deductedAmount.toLocaleString('ar-EG')} ج.م</span>
      </div>
      <div style="text-align: left;">
        <span style="font-size: 9pt; color: #78350f; font-weight: bold; display: block;">المبلغ كتابةً:</span>
        <span class="amount-words">${amountWords}</span>
      </div>
    </div>

    <!-- Details Table -->
    <table class="data-table">
      <tr>
        <td class="lbl">اسم المالك (المستفيد):</td>
        <td class="val" style="font-weight: 800; color: #b38734;">${advance.ownerName || 'مالك العقار'}</td>
        <td class="lbl">العقار المرتبط:</td>
        <td class="val" style="font-weight: 700;">${advance.propertyName || 'عقار المالك'}</td>
      </tr>
      <tr>
        <td class="lbl">مبلغ السلفة الأصلي:</td>
        <td class="val" style="font-family: monospace; font-weight: 800;">${originalAmount.toLocaleString('ar-EG')} ج.م</td>
        <td class="lbl">تاريخ منح السلفة:</td>
        <td class="val" style="font-family: monospace;">${advance.advanceDate || '—'}</td>
      </tr>
      <tr>
        <td class="lbl">طريقة التسوية / الخصم:</td>
        <td class="val" style="font-weight: 800; color: ${isFromEntitlement ? '#047857' : '#b45309'};">
          ${methodLabel}
        </td>
        <td class="lbl">رقم المرجع / الإيصال:</td>
        <td class="val" style="font-family: monospace; font-weight: 700;">${advance.deductionRef || '—'}</td>
      </tr>
      <tr>
        <td class="lbl">تاريخ التسوية والخصم:</td>
        <td class="val" style="font-family: monospace;">${advance.deductedAt || advance.deductionDate || '—'}</td>
        <td class="lbl">المسؤول عن التسجيل:</td>
        <td class="val">${accountantName}</td>
      </tr>
      <tr>
        <td class="lbl">البيان / الغرض الأصلي:</td>
        <td class="val" colspan="3">${advance.notes || 'سلفة مالك عاجلة'}</td>
      </tr>
      ${advance.deductionNotes ? `
      <tr>
        <td class="lbl">ملاحظات التسوية:</td>
        <td class="val" colspan="3" style="color: #0f172a; font-style: italic;">${advance.deductionNotes}</td>
      </tr>
      ` : ''}
    </table>

    <!-- Status Box -->
    <div class="settlement-status-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong style="font-size: 11pt;">بيان الأثر المالي للتسوية:</strong>
        <span style="font-weight: 900; font-size: 11pt;">
          ${isDeducted 
            ? (isFromEntitlement ? `✔ تم الخصم الفعلي من مستحقات المالك` : `✔ تم السداد نقداً لخزينة المؤسسة`)
            : `⏳ سلفة جارية لم تُخصم بعد`}
        </span>
      </div>
      <div style="font-size: 9.5pt; line-height: 1.6; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 6px;">
        ${isDeducted ? (
          isFromEntitlement 
            ? `تم خصم مبلغ قدره (${deductedAmount.toLocaleString('ar-EG')} ج.م) مباشرة من صافي مستحقات إيجار المالك في كشف الحساب المالي والتسويات المعتمدة.`
            : `تم استلام وسداد مبلغ قدره (${deductedAmount.toLocaleString('ar-EG')} ج.م) نقداً وأودع في خزينة المؤسسة دون خصمه من مستحقات الإيجار.`
        ) : `هذه السلفة ما تزال مسجلة برصيد المالك كذمة مدينة، وسيتم تصفيتها عند الخصم من المستحقات أو السداد النقدي.`}
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures-grid">
      <div class="sig-block">
        <strong>المستلم / المالك</strong>
        <div class="sig-line"></div>
        <p style="margin: 4px 0 0; font-size: 8.5pt; color: #64748b;">التوقيع والصفة</p>
      </div>
      <div class="sig-block">
        <strong>المحاسب المالي</strong>
        <div class="sig-line"></div>
        <p style="margin: 4px 0 0; font-size: 8.5pt; color: #64748b;">التوقيع والاعتماد</p>
      </div>
      <div class="sig-block">
        <strong>اعتماد المدير العام / الختم</strong>
        <div class="sig-line"></div>
        <p style="margin: 4px 0 0; font-size: 8.5pt; color: #64748b;">مؤسسة رميح للمحاماة</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-note">
      تم إصدار هذا السند إلكترونياً من النظام المالي والإداري لمؤسسة رميح للمحاماة والاستشارات القانونية — تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;
}

export const printAdvanceDeductionVoucher = (advance: ReOwnerAdvance, currentUser?: AuthUser) => {
  const html = generateAdvanceDeductionVoucherHTML({ advance, currentUser });
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة السند');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
};

export const AdvanceDeductionReceiptsModal: React.FC<AdvanceDeductionReceiptsModalProps> = ({
  isOpen,
  onClose,
  advances,
  owners,
  properties,
  selectedAdvance = null,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'deducted' | 'pending'>('all');
  const [previewVoucherAdvance, setPreviewVoucherAdvance] = useState<ReOwnerAdvance | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // If initial selected advance is provided on open, pre-focus or preview it
  useEffect(() => {
    if (isOpen) {
      if (selectedAdvance) {
        setOwnerFilter(selectedAdvance.ownerId || 'all');
        setPreviewVoucherAdvance(selectedAdvance);
      } else {
        setPreviewVoucherAdvance(null);
      }
    }
  }, [isOpen, selectedAdvance]);

  // Keyboard navigation: Escape closes preview first, then modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewVoucherAdvance) {
          setPreviewVoucherAdvance(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewVoucherAdvance, onClose]);

  // Filtered Advances / Vouchers
  const filteredAdvances = useMemo(() => {
    return advances.filter(adv => {
      const ownerName = adv.ownerName || owners.find(o => o.id === adv.ownerId)?.name || '';
      const propName = adv.propertyName || properties.find(p => p.id === adv.propertyId)?.name || '';
      const notes = adv.notes || '';
      const deductionRef = adv.deductionRef || '';
      const deductionNotes = adv.deductionNotes || '';
      const id = adv.id || '';

      const matchSearch = !searchQuery || 
        ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        propName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deductionRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deductionNotes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchOwner = ownerFilter === 'all' || adv.ownerId === ownerFilter;
      const matchProp = propertyFilter === 'all' || adv.propertyId === propertyFilter;

      let matchStatus = true;
      if (statusFilter === 'deducted') matchStatus = !!adv.isDeducted;
      if (statusFilter === 'pending') matchStatus = !adv.isDeducted;

      let matchMethod = true;
      if (methodFilter !== 'all') {
        if (methodFilter === 'entitlement') {
          matchMethod = adv.isDeducted && (!adv.deductionMethod || adv.deductionMethod === 'خصم من المستحق' || adv.deductionMethod === 'من المستحق للمالك');
        } else if (methodFilter === 'cash') {
          matchMethod = adv.isDeducted && (adv.deductionMethod === 'نقدي' || adv.deductionMethod === 'سداد نقدي');
        } else if (methodFilter === 'other') {
          matchMethod = adv.isDeducted && adv.deductionMethod !== 'خصم من المستحق' && adv.deductionMethod !== 'من المستحق للمالك' && adv.deductionMethod !== 'نقدي' && adv.deductionMethod !== 'سداد نقدي';
        } else if (methodFilter === 'pending') {
          matchMethod = !adv.isDeducted;
        }
      }

      return matchSearch && matchOwner && matchProp && matchStatus && matchMethod;
    });
  }, [advances, owners, properties, searchQuery, ownerFilter, propertyFilter, statusFilter, methodFilter]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    let totalAdvancesSum = 0;
    let totalDeductedEntitlementSum = 0;
    let totalDeductedCashSum = 0;
    let totalPendingAdvancesSum = 0;

    let totalCount = advances.length;
    let entitlementCount = 0;
    let cashCount = 0;
    let pendingCount = 0;

    advances.forEach(adv => {
      const origAmt = adv.amount || 0;
      totalAdvancesSum += origAmt;

      const settledAmt = (adv.deductedAmount !== undefined && adv.deductedAmount !== null && Number(adv.deductedAmount) > 0)
        ? Number(adv.deductedAmount)
        : origAmt;

      if (adv.isDeducted) {
        const isFromEntitlement = !adv.deductionMethod || adv.deductionMethod === 'خصم من المستحق' || adv.deductionMethod === 'من المستحق للمالك';
        if (isFromEntitlement) {
          totalDeductedEntitlementSum += settledAmt;
          entitlementCount++;
        } else {
          totalDeductedCashSum += settledAmt;
          cashCount++;
        }
      } else {
        totalPendingAdvancesSum += origAmt;
        pendingCount++;
      }
    });

    return {
      totalAdvancesSum,
      totalDeductedEntitlementSum,
      totalDeductedCashSum,
      totalPendingAdvancesSum,
      totalCount,
      entitlementCount,
      cashCount,
      pendingCount
    };
  }, [advances]);

  // Print Complete Filtered Vouchers List
  const handlePrintFilteredList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير');
      return;
    }

    const rowsHTML = filteredAdvances.map((a, idx) => {
      const isDeducted = !!a.isDeducted;
      const isFromEntitlement = !a.deductionMethod || a.deductionMethod === 'خصم من المستحق' || a.deductionMethod === 'من المستحق للمالك';
      const settledAmount = (a.deductedAmount !== undefined && a.deductedAmount !== null && Number(a.deductedAmount) > 0)
        ? Number(a.deductedAmount)
        : (a.amount || 0);

      const statusText = isDeducted 
        ? (isFromEntitlement ? 'مخصومة من المستحق 🟢' : `مسددة (${a.deductionMethod || 'نقدي'}) 🟡`)
        : 'سلفة جارية (غير مخصومة) ⏳';

      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold;">${a.ownerName || 'مالك'}</td>
          <td>${a.propertyName || 'عقار'}</td>
          <td style="font-family: monospace; text-align: center;">${a.advanceDate || '—'}</td>
          <td style="font-weight: bold; color: #b45309; text-align: center; font-family: monospace;">${(a.amount || 0).toLocaleString('ar-EG')} ج.م</td>
          <td style="font-weight: bold; color: ${isDeducted ? '#047857' : '#64748b'}; text-align: center; font-family: monospace;">${settledAmount.toLocaleString('ar-EG')} ج.م</td>
          <td style="text-align: center; font-weight: bold;">${statusText}</td>
          <td style="font-family: monospace; text-align: center;">${a.deductedAt || a.deductionDate || '—'}</td>
          <td style="font-family: monospace; text-align: center;">${a.deductionRef ? `#${a.deductionRef}` : '—'}</td>
          <td style="font-size: 9pt;">${a.notes || a.deductionNotes || '—'}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>سجل وكشف سندات الخصم والتسوية - مؤسسة رميح للمحاماة</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; direction: rtl; background: #fff; color: #0f172a; font-size: 9.5pt; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b38734; padding-bottom: 10px; margin-bottom: 15px; }
            h2 { margin: 0; font-size: 14pt; color: #1e293b; font-weight: 900; }
            p.sub { margin: 2px 0 0 0; color: #64748b; font-size: 9pt; }
            .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .card { border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 8px; text-align: center; background: #f8fafc; }
            .card .lbl { font-size: 8pt; color: #64748b; font-weight: bold; display: block; }
            .card .val { font-size: 12pt; font-weight: 900; color: #0f172a; margin-top: 3px; font-family: monospace; display: block; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 8.5pt; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
            th { background-color: #0f172a; color: #fff; font-weight: bold; text-align: center; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 25px; text-align: left; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>⚖️ مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
              <p class="sub">كشف وسجل سندات خصم وتسوية سُلف الملاك</p>
            </div>
            <div style="text-align: left; font-size: 8.5pt; color: #475569;">
              <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleString('ar-EG')}</div>
              <div><strong>المسؤول:</strong> ${currentUser?.fullName || currentUser?.username || 'الإدارة المالية'}</div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <span class="lbl">إجمالي السلف المسجلة</span>
              <span class="val" style="color: #b45309;">${metrics.totalAdvancesSum.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="card">
              <span class="lbl">مخصومة من المستحق</span>
              <span class="val" style="color: #047857;">${metrics.totalDeductedEntitlementSum.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="card">
              <span class="lbl">مسددة نقداً</span>
              <span class="val" style="color: #d97706;">${metrics.totalDeductedCashSum.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div class="card">
              <span class="lbl">سُلف جارية (غير مخصومة)</span>
              <span class="val" style="color: #7c3aed;">${metrics.totalPendingAdvancesSum.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم المالك</th>
                <th>العقار المرتبط</th>
                <th>تاريخ المنح</th>
                <th>المبلغ الأصلي</th>
                <th>المبلغ المسدد/المخصوم</th>
                <th>طريقة التسوية</th>
                <th>تاريخ الخصم</th>
                <th>رقم المرجع</th>
                <th>البيان والملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="10" style="text-align:center;">لا توجد سندات مطابقة لمحددات البحث</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <span>تم استخراج السجل من النظام المالي الإلكتروني — مؤسسة رميح للمحاماة</span>
            <span>توقيع واعتماد المحاسب المالي: ............................</span>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="advance-vouchers-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          id="advance-vouchers-modal-container"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-6xl max-h-[92vh] sm:max-h-[90vh] bg-[#0A1628] border border-[#D4A84F]/40 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-right"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            id="advance-vouchers-modal-header"
            className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-[#132238] via-[#0E1A2C] to-[#132238] border-b border-[#D4A84F]/30 flex items-center justify-between z-10 select-none shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#D4A84F] to-[#92400e] p-0.5 shadow-lg shadow-[#D4A84F]/20 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-[#08111F] rounded-[14px] flex items-center justify-center">
                  <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4A84F]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base md:text-lg font-black text-[#F8F9FB] tracking-tight">
                    سندات الخصم والتسوية المرتبطة بالسلف
                  </h2>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30 font-bold font-mono">
                    {filteredAdvances.length} سند
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#CBD5E1] font-semibold mt-0.5">
                  استعراض وطباعة سندات خصم وتسوية سُلف الملاك (خصم من المستحق / سداد نقدي)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintFilteredList}
                className="px-3.5 py-2 bg-[#132238] hover:bg-[#1C2E46] text-amber-300 hover:text-amber-200 border border-[#D4A84F]/40 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer text-xs font-bold shadow-sm"
                title="طباعة كشف بكافة السندات المعروضة"
              >
                <Printer className="w-4 h-4 text-[#D4A84F]" />
                <span className="hidden sm:inline">طباعة الكشف</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#132238] hover:bg-rose-500/20 text-[#CBD5E1] hover:text-rose-300 border border-[#D4A84F]/30 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title="إغلاق النافذة (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Switch between Voucher Preview mode and Vouchers List mode */}
          {previewVoucherAdvance ? (
            /* =================== VIEW 1: SINGLE VOUCHER FULL PREVIEW =================== */
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#D4A84F]/20 pb-3">
                <button
                  type="button"
                  onClick={() => setPreviewVoucherAdvance(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#132238] hover:bg-[#1C2E46] text-[#CBD5E1] hover:text-white border border-[#D4A84F]/30 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ArrowRight className="w-4 h-4 text-[#D4A84F]" />
                  <span>العودة لقائمة السندات</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printAdvanceDeductionVoucher(previewVoucherAdvance, currentUser)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#b38734] hover:from-amber-400 hover:to-amber-600 text-slate-950 text-xs sm:text-sm font-black transition-all shadow-lg shadow-[#D4A84F]/20 active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 stroke-[2.5]" />
                    <span>طباعة هذا السند فوراً</span>
                  </button>
                </div>
              </div>

              {/* Full In-App Document Preview Card */}
              <div className="max-w-3xl mx-auto bg-white text-slate-900 rounded-2xl p-6 sm:p-8 border-2 border-[#b38734] shadow-2xl space-y-6 relative select-text">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between border-b-2 border-[#b38734] pb-4 gap-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-950">
                      ⚖️ مؤسسة رميح للمحاماة والاستشارات القانونية
                    </h3>
                    <p className="text-xs text-[#b38734] font-bold mt-0.5">
                      قطاع الإدارة العقارية — السجل المالي وسندات التسوية
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="inline-block bg-amber-50 text-[#b38734] border border-[#b38734] px-4 py-1.5 rounded-full text-sm font-black shadow-sm">
                      سند خصم وتسوية سُلفة
                    </span>
                  </div>
                  <div className="text-left text-xs text-slate-600 font-mono space-y-0.5">
                    <div><strong>رقم السند:</strong> {previewVoucherAdvance.deductionRef ? `DED-${previewVoucherAdvance.deductionRef}` : `ADV-${(previewVoucherAdvance.id || '').slice(-6).toUpperCase() || '0000'}`}</div>
                    <div><strong>التاريخ:</strong> {previewVoucherAdvance.deductedAt || previewVoucherAdvance.deductionDate || previewVoucherAdvance.advanceDate || '—'}</div>
                  </div>
                </div>

                {/* Amount Box */}
                {(() => {
                  const isDeducted = !!previewVoucherAdvance.isDeducted;
                  const isFromEntitlement = !previewVoucherAdvance.deductionMethod || previewVoucherAdvance.deductionMethod === 'خصم من المستحق' || previewVoucherAdvance.deductionMethod === 'من المستحق للمالك';
                  const settledAmount = (previewVoucherAdvance.deductedAmount !== undefined && previewVoucherAdvance.deductedAmount !== null && Number(previewVoucherAdvance.deductedAmount) > 0)
                    ? Number(previewVoucherAdvance.deductedAmount)
                    : (previewVoucherAdvance.amount || 0);
                  const amountWords = tafqeetNumber(settledAmount);

                  return (
                    <>
                      <div className="bg-gradient-to-r from-amber-50 to-yellow-100 border border-dashed border-[#b38734] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-xs text-amber-900 font-bold block">مبلغ السداد / الخصم:</span>
                          <span className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">
                            {settledAmount.toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-xs text-amber-900 font-bold block">المبلغ كتابةً:</span>
                          <span className="text-xs sm:text-sm font-black text-amber-900">
                            {amountWords}
                          </span>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 font-bold">اسم المالك (المستفيد):</span>
                          <span className="text-sm font-black text-[#b38734]">{previewVoucherAdvance.ownerName || 'مالك العقار'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 font-bold">العقار المرتبط:</span>
                          <span className="text-sm font-black text-slate-900">{previewVoucherAdvance.propertyName || 'غير محدد'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 font-bold">مبلغ السلفة الأصلي:</span>
                          <span className="text-sm font-mono font-bold text-slate-900">{(previewVoucherAdvance.amount || 0).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 font-bold">طريقة السداد / الخصم:</span>
                          <span className={`text-sm font-black ${isFromEntitlement ? 'text-emerald-700' : 'text-amber-800'}`}>
                            {previewVoucherAdvance.deductionMethod || (isDeducted ? 'خصم من المستحق' : 'سلفة جارية')}
                          </span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 font-bold">تاريخ السداد / الخصم:</span>
                          <span className="text-sm font-mono font-bold text-slate-900">{previewVoucherAdvance.deductedAt || previewVoucherAdvance.deductionDate || '—'}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-slate-500 block mb-0.5 font-bold">رقم المرجع / الإيصال:</span>
                          <span className="text-sm font-mono font-bold text-slate-900">{previewVoucherAdvance.deductionRef ? `#${previewVoucherAdvance.deductionRef}` : '—'}</span>
                        </div>
                      </div>

                      {previewVoucherAdvance.notes && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <span className="text-slate-500 block mb-0.5 font-bold">بيان السلفة الأصلي:</span>
                          <span className="text-slate-800 font-semibold">{previewVoucherAdvance.notes}</span>
                        </div>
                      )}

                      {previewVoucherAdvance.deductionNotes && (
                        <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
                          <span className="text-amber-900 block mb-0.5 font-bold">ملاحظات التسوية والخصم:</span>
                          <span className="text-amber-950 font-semibold">{previewVoucherAdvance.deductionNotes}</span>
                        </div>
                      )}

                      {/* Status Box */}
                      <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                        isDeducted 
                          ? (isFromEntitlement ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950')
                          : 'bg-slate-50 border-slate-300 text-slate-800'
                      }`}>
                        <div className="font-black text-sm mb-1 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>حالة التسوية والأثر المالي:</span>
                        </div>
                        <p>
                          {isDeducted ? (
                            isFromEntitlement 
                              ? `تم خصم مبلغ قدره (${settledAmount.toLocaleString('ar-EG')} ج.م) فعلياً من صافي مستحقات إيجار المالك في كشف الحساب المالي والتسويات المعتمدة.`
                              : `تم استلام وسداد مبلغ قدره (${settledAmount.toLocaleString('ar-EG')} ج.م) نقداً في خزينة المؤسسة دون التأثير على كشف مستحقات الإيجار.`
                          ) : `هذه السلفة ما تزال مسجلة برصيد المالك كذمة مدينة بانتظار إتمام الخصم أو السداد النقدي.`}
                        </p>
                      </div>

                      {/* Signatures */}
                      <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs font-bold text-slate-800">
                        <div className="space-y-10">
                          <div>المستلم / المالك</div>
                          <div className="border-b border-dashed border-slate-400"></div>
                        </div>
                        <div className="space-y-10">
                          <div>المحاسب المالي</div>
                          <div className="border-b border-dashed border-slate-400"></div>
                        </div>
                        <div className="space-y-10">
                          <div>الختم المعتمد</div>
                          <div className="border-b border-dashed border-slate-400"></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* =================== VIEW 2: VOUCHERS LIST & SEARCH =================== */
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5"
            >
              {/* KPI Summary Cards Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-[#132238] p-3.5 rounded-2xl border border-[#D4A84F]/30 shadow-md">
                  <div className="flex items-center justify-between text-xs text-[#CBD5E1] font-bold mb-1">
                    <span>إجمالي السلف المسجلة</span>
                    <Coins className="w-4 h-4 text-[#D4A84F]" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-300 font-mono">
                    {metrics.totalAdvancesSum.toLocaleString('ar-EG')} <span className="text-xs text-[#D4A84F]">ج.م</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 block">{metrics.totalCount} سلفة مسجلة</span>
                </div>

                <div className="bg-[#132238] p-3.5 rounded-2xl border border-emerald-500/30 shadow-md">
                  <div className="flex items-center justify-between text-xs text-[#CBD5E1] font-bold mb-1">
                    <span>خصم من المستحق</span>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {metrics.totalDeductedEntitlementSum.toLocaleString('ar-EG')} <span className="text-xs text-emerald-300">ج.م</span>
                  </div>
                  <span className="text-[10px] text-emerald-300/80 font-bold mt-1 block">{metrics.entitlementCount} سند مخصوم</span>
                </div>

                <div className="bg-[#132238] p-3.5 rounded-2xl border border-amber-500/30 shadow-md">
                  <div className="flex items-center justify-between text-xs text-[#CBD5E1] font-bold mb-1">
                    <span>سداد نقدي مباشر</span>
                    <Wallet className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-400 font-mono">
                    {metrics.totalDeductedCashSum.toLocaleString('ar-EG')} <span className="text-xs text-amber-300">ج.م</span>
                  </div>
                  <span className="text-[10px] text-amber-300/80 font-bold mt-1 block">{metrics.cashCount} سند نقدي</span>
                </div>

                <div className="bg-[#132238] p-3.5 rounded-2xl border border-purple-500/30 shadow-md">
                  <div className="flex items-center justify-between text-xs text-[#CBD5E1] font-bold mb-1">
                    <span>سُلف جارية (غير مخصومة)</span>
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-purple-300 font-mono">
                    {metrics.totalPendingAdvancesSum.toLocaleString('ar-EG')} <span className="text-xs text-purple-200">ج.م</span>
                  </div>
                  <span className="text-[10px] text-purple-300/80 font-bold mt-1 block">{metrics.pendingCount} سلفة جارية</span>
                </div>
              </div>

              {/* Search and Filters Bar */}
              <div className="p-4 rounded-2xl bg-[#132238] border border-[#D4A84F]/30 shadow-md space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#D4A84F] absolute right-3.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="بحث باسم المالك، العقار، رقم المرجع، الملاحظات..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] placeholder:text-[#9EA7B8]/60 focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none transition-all"
                    />
                  </div>

                  {/* Owner Dropdown */}
                  <div>
                    <select
                      value={ownerFilter}
                      onChange={(e) => setOwnerFilter(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none font-bold"
                    >
                      <option value="all">جميع الملاك ({owners.length})</option>
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Property Dropdown */}
                  <div>
                    <select
                      value={propertyFilter}
                      onChange={(e) => setPropertyFilter(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none font-bold"
                    >
                      <option value="all">جميع العقارات ({properties.length})</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Method / Status Filter Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#D4A84F]/15 text-xs font-bold">
                  <span className="text-[#CBD5E1] ml-1">نوع السند / التسوية:</span>
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'entitlement', label: 'خصم من المستحق' },
                    { id: 'cash', label: 'سداد نقدي' },
                    { id: 'pending', label: 'غير مخصومة (سلف جارية)' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMethodFilter(tab.id)}
                      className={`px-3 py-1 rounded-lg transition-all text-xs font-bold cursor-pointer ${
                        methodFilter === tab.id
                          ? 'bg-[#D4A84F] text-slate-950 shadow-md font-black'
                          : 'bg-[#08111F] text-slate-300 hover:text-white border border-[#D4A84F]/20'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vouchers Table */}
              <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 overflow-hidden shadow-xl">
                {filteredAdvances.length === 0 ? (
                  <div className="p-12 text-center text-[#9EA7B8] space-y-3">
                    <Receipt className="w-12 h-12 text-[#D4A84F]/30 mx-auto" />
                    <p className="text-sm font-bold">لا توجد سندات مطابقة لمحددات البحث الحالية</p>
                    <p className="text-xs text-slate-400">يمكنك تعديل البحث أو اختيار مالك/عقار آخر</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[#08111F]/90 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/20 select-none">
                          <th className="p-3.5 text-center">#</th>
                          <th className="p-3.5">المالك</th>
                          <th className="p-3.5">العقار المرتبط</th>
                          <th className="p-3.5 text-center">تاريخ المنح</th>
                          <th className="p-3.5 text-center">المبلغ الأصلي</th>
                          <th className="p-3.5 text-center">مبلغ السداد / الخصم</th>
                          <th className="p-3.5 text-center">طريقة التسوية</th>
                          <th className="p-3.5 text-center">تاريخ الخصم</th>
                          <th className="p-3.5 text-center">رقم المرجع</th>
                          <th className="p-3.5">البيان</th>
                          <th className="p-3.5 text-center">إجراءات السند</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/10">
                        {filteredAdvances.map((adv, idx) => {
                          const isDeducted = !!adv.isDeducted;
                          const settledAmount = (adv.deductedAmount !== undefined && adv.deductedAmount !== null && Number(adv.deductedAmount) > 0)
                            ? Number(adv.deductedAmount)
                            : (adv.amount || 0);

                          return (
                            <tr 
                              key={adv.id}
                              className="hover:bg-[#18283E]/70 transition-colors group"
                            >
                              <td className="p-3 text-center font-mono text-slate-400 font-bold">
                                {idx + 1}
                              </td>

                              <td className="p-3 font-bold text-amber-300">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-[#D4A84F] shrink-0" />
                                  <span>{adv.ownerName || 'مالك العقار'}</span>
                                </div>
                              </td>

                              <td className="p-3 text-slate-200 font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{adv.propertyName || '—'}</span>
                                </div>
                              </td>

                              <td className="p-3 text-center font-mono text-slate-300 text-xs">
                                {adv.advanceDate || '—'}
                              </td>

                              <td className="p-3 text-center font-mono font-bold text-slate-200">
                                {(adv.amount || 0).toLocaleString('ar-EG')} ج.م
                              </td>

                              <td className="p-3 text-center font-mono font-black text-sm text-amber-400">
                                {settledAmount.toLocaleString('ar-EG')} ج.م
                              </td>

                              <td className="p-3 text-center">
                                {isDeducted ? (
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border inline-flex items-center gap-1 shadow-sm ${getDeductionMethodBadge(adv.deductionMethod)}`}>
                                    <CheckCircle className="w-3 h-3" />
                                    <span>{adv.deductionMethod || 'خصم من المستحق'}</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1 shadow-sm">
                                    <Clock className="w-3 h-3" />
                                    <span>سلفة جارية</span>
                                  </span>
                                )}
                              </td>

                              <td className="p-3 text-center font-mono text-emerald-400 text-xs font-bold">
                                {adv.deductedAt || adv.deductionDate || '—'}
                              </td>

                              <td className="p-3 text-center font-mono text-xs text-amber-300 font-bold">
                                {adv.deductionRef ? `#${adv.deductionRef}` : '—'}
                              </td>

                              <td className="p-3 text-slate-300 text-xs max-w-[180px] truncate" title={adv.notes || adv.deductionNotes}>
                                {adv.deductionNotes || adv.notes || '—'}
                              </td>

                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* View / Preview Voucher Button */}
                                  <button
                                    type="button"
                                    onClick={() => setPreviewVoucherAdvance(adv)}
                                    className="p-1.5 sm:px-2.5 sm:py-1.5 bg-[#08111F] hover:bg-[#132238] text-amber-300 hover:text-amber-200 border border-[#D4A84F]/40 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-sm text-[11px] font-bold"
                                    title="معاينة وتفاصيل السند"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#D4A84F]" />
                                    <span className="hidden sm:inline">معاينة</span>
                                  </button>

                                  {/* Print Voucher Button */}
                                  <button
                                    type="button"
                                    onClick={() => printAdvanceDeductionVoucher(adv, currentUser)}
                                    className="p-1.5 sm:px-2.5 sm:py-1.5 bg-gradient-to-r from-[#D4A84F] to-[#b38734] hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-sm text-[11px] font-black"
                                    title="طباعة سند الخصم والتسوية"
                                  >
                                    <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span className="hidden sm:inline">طباعة</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div 
            id="advance-vouchers-modal-footer"
            className="shrink-0 p-4 bg-gradient-to-r from-[#0E1A2C] via-[#132238] to-[#0E1A2C] border-t border-[#D4A84F]/30 flex items-center justify-between z-10 shadow-lg text-xs"
          >
            <div className="text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>جميع سندات الخصم موثقة ومربوطة بحسابات الملاك وقاعدة البيانات السحابية</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#F8F9FB] text-xs font-black border border-[#D4A84F]/30 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
