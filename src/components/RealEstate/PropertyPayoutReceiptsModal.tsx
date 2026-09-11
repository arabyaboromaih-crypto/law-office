import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, X, Search, Calendar, DollarSign, Printer, 
  CheckCircle, FileText, User, Building, Phone, Clock,
  ArrowRight, ShieldCheck, AlertCircle, Sparkles, Filter, Download,
  Wallet, RefreshCw, Eye, RotateCcw
} from 'lucide-react';
import { ReProperty, ReOwner, RePayout, ReRentDue, User as AuthUser } from '../../types';

interface PropertyPayoutReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: { id: string; name: string; ownerId?: string; ownerName?: string } | null;
  owner: { id: string; name: string; phone?: string; bankAccount?: string } | null;
  payouts: RePayout[];
  dues?: ReRentDue[];
  currentUser?: AuthUser;
  onRevertPayout?: (payout: RePayout) => Promise<void>;
  isReverting?: boolean;
}

const AR_MONTHS_MAP: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
};

const formatMonthYearAr = (myStr?: string) => {
  if (!myStr) return 'غير محدد';
  if (!myStr.includes('-')) return myStr;
  const [y, m] = myStr.split('-');
  return `${AR_MONTHS_MAP[m] || m} ${y}`;
};

const getPaymentMethodLabel = (method?: string): string => {
  switch (method) {
    case 'cash':
    case 'نقداً':
    case 'نقدي':
      return 'نقداً';
    case 'bank_transfer':
    case 'تحويل بنكي':
      return 'تحويل بنكي';
    case 'instapay':
    case 'إنستاباي':
      return 'إنستاباي (InstaPay)';
    case 'vodafone_cash':
    case 'فودافون كاش':
      return 'فودافون كاش';
    case 'check':
    case 'شيك':
    case 'شيك بنكي':
      return 'شيك بنكي';
    default:
      return method || 'نقداً';
  }
};

const getPaymentMethodBadgeColor = (method?: string): string => {
  const norm = (method || '').toLowerCase();
  if (norm.includes('cash') || norm.includes('نقد')) {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35';
  }
  if (norm.includes('bank') || norm.includes('تحويل')) {
    return 'bg-sky-500/20 text-sky-300 border-sky-500/35';
  }
  if (norm.includes('insta') || norm.includes('إنستا')) {
    return 'bg-purple-500/20 text-purple-300 border-purple-500/35';
  }
  if (norm.includes('voda') || norm.includes('كاش')) {
    return 'bg-rose-500/20 text-rose-300 border-rose-500/35';
  }
  if (norm.includes('check') || norm.includes('شيك')) {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/35';
  }
  return 'bg-slate-500/20 text-slate-300 border-slate-500/35';
};

// Convert number to Arabic words (Tafqeet)
const tafqeetNumber = (num: number): string => {
  if (isNaN(num) || num === 0) return 'صفر جنيه مصري';
  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  const convertThreeDigits = (n: number): string => {
    let result = '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const u = rem % 10;

    if (h > 0) result += hundreds[h];
    if (rem > 0) {
      if (result) result += ' و ';
      if (rem < 20) {
        result += units[rem];
      } else {
        if (u > 0) result += units[u] + ' و ';
        result += tens[t];
      }
    }
    return result;
  };

  let intPart = Math.floor(num);
  let words = '';

  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000);
    intPart %= 1000000;
    words += millions === 1 ? 'مليون' : millions === 2 ? 'مليونان' : millions <= 10 ? `${convertThreeDigits(millions)} ملايين` : `${convertThreeDigits(millions)} مليون`;
  }

  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    intPart %= 1000;
    if (words) words += ' و ';
    words += thousands === 1 ? 'ألف' : thousands === 2 ? 'ألفان' : thousands <= 10 ? `${convertThreeDigits(thousands)} آلاف` : `${convertThreeDigits(thousands)} ألف`;
  }

  if (intPart > 0) {
    if (words) words += ' و ';
    words += convertThreeDigits(intPart);
  }

  return `فقط وقدره ${words || 'صفر'} جنيهاً مصرياً لا غير`;
};

// Generate official printable HTML voucher for a single payout receipt
export function generatePayoutReceiptVoucherHTML({
  payout,
  property,
  owner,
  currentUser
}: {
  payout: RePayout;
  property?: { id: string; name: string } | null;
  owner?: { id: string; name: string; phone?: string; bankAccount?: string } | null;
  currentUser?: AuthUser;
}): string {
  const receiptNum = payout.receiptNumber || `PAY-${payout.id.slice(-6).toUpperCase()}`;
  const payoutDateFormatted = payout.payoutDate 
    ? new Date(payout.payoutDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(payout.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const monthText = formatMonthYearAr(payout.forMonthYear);
  const methodLabel = getPaymentMethodLabel(payout.paymentMethod);
  const amountNumber = (payout.netAmountPaid || 0).toLocaleString('ar-EG');
  const amountWords = tafqeetNumber(payout.netAmountPaid || 0);
  const issuerName = payout.createdBy || currentUser?.fullName || 'الإدارة المالية';
  const ownerDisplayName = owner?.name || 'المالك الموقر';
  const propertyDisplayName = property?.name || 'العقار المعتمد';
  const notesText = payout.notes || `صرف مستحقات إيجار عقار ${propertyDisplayName} للمالك ${ownerDisplayName}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>سند صرف إيجار - ${receiptNum}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      direction: rtl;
      text-align: right;
      padding: 20px;
      font-size: 13px;
    }
    
    .voucher-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #b45309;
      border-radius: 16px;
      padding: 28px 32px;
      position: relative;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    .voucher-container::before {
      content: "";
      position: absolute;
      top: 6px;
      left: 6px;
      right: 6px;
      bottom: 6px;
      border: 1px dashed #d4a84f;
      border-radius: 12px;
      pointer-events: none;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(212, 168, 79, 0.04);
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
    }
    
    .brand-title {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
    }
    
    .brand-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #b45309;
      margin-top: 2px;
    }
    
    .voucher-badge {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fbbf24;
      padding: 8px 18px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 800;
      border: 1px solid #b45309;
      text-align: center;
    }
    
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      position: relative;
      z-index: 1;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .meta-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
    }
    
    .meta-value {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }
    
    .amount-highlight {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 16px 20px;
      text-align: center;
      margin-bottom: 22px;
      position: relative;
      z-index: 1;
    }
    
    .amount-val {
      font-size: 26px;
      font-weight: 900;
      color: #92400e;
      letter-spacing: 0.5px;
    }
    
    .amount-words {
      font-size: 13px;
      font-weight: 800;
      color: #78350f;
      margin-top: 4px;
    }
    
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      position: relative;
      z-index: 1;
    }
    
    .details-table th {
      background: #0f172a;
      color: #f8fafc;
      padding: 9px 12px;
      font-size: 11px;
      font-weight: 800;
      border: 1px solid #0f172a;
    }
    
    .details-table td {
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      background: #ffffff;
    }
    
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    
    .sig-box {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .sig-title {
      font-size: 11px;
      font-weight: 800;
      color: #475569;
      margin-bottom: 35px;
    }
    
    .sig-line {
      width: 80%;
      border-bottom: 1px solid #94a3b8;
    }
    
    .sig-name {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 5px;
    }
    
    .footer-note {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 20px;
      font-weight: 600;
    }

    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .voucher-container {
        box-shadow: none;
        border-color: #000;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="voucher-container">
    <div class="watermark">سند صرف معتمد</div>
    
    <div class="header">
      <div>
        <div class="brand-title">مؤسسة رميح للمحاماة والاستشارات القانونية</div>
        <div class="brand-subtitle">قسم إدارة الأملاك والعقارات — السندات المالية الرسمية</div>
      </div>
      <div class="voucher-badge">
        سند صرف إيجار
        <div style="font-size: 10px; font-weight: normal; color: #fef08a; font-family: monospace;">${receiptNum}</div>
      </div>
    </div>
    
    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">تاريخ السند:</span>
        <span class="meta-value">${payoutDateFormatted}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">الشهر المالي المستحق:</span>
        <span class="meta-value">${monthText}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">اسم المالك المكرم:</span>
        <span class="meta-value" style="color: #b45309;">${ownerDisplayName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">العقار المعني:</span>
        <span class="meta-value">${propertyDisplayName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">طريقة الصرف:</span>
        <span class="meta-value">${methodLabel}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">رقم المرجع / التحويل:</span>
        <span class="meta-value" style="font-family: monospace;">${payout.bankTransactionRef || '—'}</span>
      </div>
    </div>
    
    <div class="amount-highlight">
      <div class="amount-val">${amountNumber} ج.م</div>
      <div class="amount-words">${amountWords}</div>
    </div>
    
    <table class="details-table">
      <thead>
        <tr>
          <th style="width: 25%;">البيان والتفاصيل</th>
          <th style="width: 20%;">المبلغ المصروف</th>
          <th style="width: 25%;">المسؤول عن الصرف</th>
          <th style="width: 30%;">ملاحظات وإثباتات</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${notesText}</td>
          <td style="font-weight: 900; color: #059669; font-size: 13px;">${amountNumber} ج.م</td>
          <td>${issuerName}</td>
          <td style="font-size: 10.5px; color: #64748b;">
            ${payout.status === 'reverted' ? '<span style="color: #dc2626; font-weight: bold;">(تم التراجع عن السند)</span>' : 'سند صرف معتمد ومخصوم من رصيد المالك'}
          </td>
        </tr>
      </tbody>
    </table>
    
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-title">توقيع المستلم / المالك</div>
        <div class="sig-line"></div>
        <div class="sig-name">${ownerDisplayName}</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">المحاسب / المسؤول المالي</div>
        <div class="sig-line"></div>
        <div class="sig-name">${issuerName}</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">اعتماد الإدارة والختم</div>
        <div class="sig-line"></div>
        <div class="sig-name">مؤسسة رميح للمحاماة</div>
      </div>
    </div>
    
    <div class="footer-note">
      تم إنشاء هذا السند آلياً عبر نظام مؤسسة رميح للمحاماة لإدارة العقارات — تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
    </div>
  </div>
</body>
</html>`;
}

export const PropertyPayoutReceiptsModal: React.FC<PropertyPayoutReceiptsModalProps> = ({
  isOpen,
  onClose,
  property,
  owner,
  payouts,
  dues = [],
  currentUser,
  onRevertPayout,
  isReverting = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'reverted'>('all');

  // Filter payouts strictly linked to this property (and owner)
  const propertyPayouts = useMemo(() => {
    if (!property?.id) return [];
    return payouts.filter(p => {
      if (!p) return false;
      const matchProp = p.propertyId === property.id;
      const matchOwner = !owner?.id || p.ownerId === owner.id || !p.ownerId;
      return matchProp && matchOwner;
    });
  }, [payouts, property?.id, owner?.id]);

  // Apply in-modal search & filters
  const filteredPayouts = useMemo(() => {
    return propertyPayouts.filter(p => {
      // Status filter
      const isReverted = p.status === 'reverted' || p.isCancelled;
      if (filterStatus === 'active' && isReverted) return false;
      if (filterStatus === 'reverted' && !isReverted) return false;

      // Month filter
      if (filterMonth !== 'all') {
        const payMonth = p.forMonthYear || (p.payoutDate ? p.payoutDate.slice(0, 7) : '');
        if (payMonth !== filterMonth) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchRec = (p.receiptNumber || '').toLowerCase().includes(term);
        const matchNotes = (p.notes || '').toLowerCase().includes(term);
        const matchRef = (p.bankTransactionRef || '').toLowerCase().includes(term);
        const matchMethod = (p.paymentMethod || '').toLowerCase().includes(term);
        const matchCreated = (p.createdBy || '').toLowerCase().includes(term);
        if (!matchRec && !matchNotes && !matchRef && !matchMethod && !matchCreated) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.payoutDate || a.createdAt || '';
      const dateB = b.payoutDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [propertyPayouts, filterStatus, filterMonth, searchTerm]);

  // Financial sums
  const totalDisbursedActive = useMemo(() => {
    return propertyPayouts
      .filter(p => p.status !== 'reverted' && !p.isCancelled)
      .reduce((sum, p) => sum + (p.netAmountPaid || 0), 0);
  }, [propertyPayouts]);

  const totalDisbursedReverted = useMemo(() => {
    return propertyPayouts
      .filter(p => p.status === 'reverted' || p.isCancelled)
      .reduce((sum, p) => sum + (p.netAmountPaid || 0), 0);
  }, [propertyPayouts]);

  // Extract available months
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    propertyPayouts.forEach(p => {
      const m = p.forMonthYear || (p.payoutDate ? p.payoutDate.slice(0, 7) : '');
      if (m) monthsSet.add(m);
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [propertyPayouts]);

  const handlePrintSingleVoucher = (payout: RePayout) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة سند الصرف');
      return;
    }
    const htmlContent = generatePayoutReceiptVoucherHTML({
      payout,
      property,
      owner,
      currentUser
    });
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handlePrintAllPayoutsStatement = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة الكشف');
      return;
    }

    const rowsHtml = filteredPayouts.map((p, idx) => {
      const isReverted = p.status === 'reverted' || p.isCancelled;
      return `
        <tr style="background-color: ${isReverted ? '#fff1f2' : '#ffffff'};">
          <td style="text-align: center; font-family: monospace; font-weight: bold;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; color: #0284c7;">${p.receiptNumber || `PAY-${p.id.slice(-6)}`}</td>
          <td style="text-align: center; font-family: monospace;">${p.payoutDate || p.createdAt?.slice(0, 10) || '—'}</td>
          <td style="text-align: center; font-family: monospace;">${formatMonthYearAr(p.forMonthYear)}</td>
          <td>${p.notes || 'صرف إيجار للمالك'}</td>
          <td style="text-align: center; font-weight: bold;">${getPaymentMethodLabel(p.paymentMethod)}${p.bankTransactionRef ? ` (${p.bankTransactionRef})` : ''}</td>
          <td style="text-align: center; font-family: monospace; font-weight: bold; color: ${isReverted ? '#94a3b8' : '#059669'};">
            ${(p.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م
          </td>
          <td style="text-align: center; font-weight: bold;">
            ${isReverted ? '<span style="color: #dc2626; background: #ffe4e6; padding: 2px 6px; border-radius: 4px;">ملغي / مسترجع</span>' : '<span style="color: #059669; background: #d1fae5; padding: 2px 6px; border-radius: 4px;">معتمد</span>'}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>كشف سندات الصرف - عقار ${property?.name || ''}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            background: #fff;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 10pt;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #d97706;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .brand-title { font-size: 15pt; font-weight: 900; color: #0f172a; }
          .brand-sub { font-size: 9.5pt; font-weight: 700; color: #b45309; }
          .report-badge {
            background: #0f172a;
            color: #fbbf24;
            padding: 6px 14px;
            border-radius: 8px;
            font-weight: 800;
            font-size: 12pt;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 15px;
            font-size: 9pt;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th {
            background: #0f172a;
            color: #f8fafc;
            padding: 8px;
            font-size: 9pt;
            border: 1px solid #0f172a;
          }
          td {
            padding: 8px;
            border: 1px solid #cbd5e1;
            font-size: 8.5pt;
          }
          .total-row {
            background: #f1f5f9;
            font-weight: 900;
            font-size: 10pt;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 30px;
            text-align: center;
          }
          .sig-line { border-bottom: 1px solid #94a3b8; margin: 30px 15px 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">مؤسسة رميح للمحاماة والاستشارات القانونية</div>
            <div class="brand-sub">سجل سندات الصرف المعتمدة للعقار</div>
          </div>
          <div class="report-badge">كشف سندات الصرف</div>
        </div>

        <div class="info-grid">
          <div><strong>اسم العقار:</strong> ${property?.name || '—'}</div>
          <div><strong>اسم المالك:</strong> ${owner?.name || property?.ownerName || '—'}</div>
          <div><strong>تاريخ استخراج التقرير:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
          <div><strong>إجمالي السندات:</strong> ${propertyPayouts.length} سند</div>
          <div><strong>إجمالي المنصرف المعتمد:</strong> ${totalDisbursedActive.toLocaleString('ar-EG')} ج.م</div>
          <div><strong>المستخدم المسؤول:</strong> ${currentUser?.fullName || 'الإدارة'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 15%;">رقم السند</th>
              <th style="width: 12%;">تاريخ الصرف</th>
              <th style="width: 12%;">الشهر المالي</th>
              <th style="width: 25%;">البيان والتفاصيل</th>
              <th style="width: 14%;">طريقة الصرف</th>
              <th style="width: 10%;">المبلغ المصروف</th>
              <th style="width: 8%;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">لا توجد سندات صرف مسجلة لهذا العقار.</td></tr>'}
            <tr class="total-row">
              <td colspan="6" style="text-align: right; padding-right: 15px;">الإجمالي الكلي للمبالغ المنصرفة المعتمدة:</td>
              <td colspan="2" style="color: #059669; font-family: monospace; font-size: 11pt;">${totalDisbursedActive.toLocaleString('ar-EG')} ج.م</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div>
            <div>توقيع المالك المستلم</div>
            <div class="sig-line"></div>
            <div>${owner?.name || property?.ownerName || ''}</div>
          </div>
          <div>
            <div>المحاسب المعتمد</div>
            <div class="sig-line"></div>
            <div>${currentUser?.fullName || 'الإدارة المالية'}</div>
          </div>
          <div>
            <div>خاتم واعتماد المؤسسة</div>
            <div class="sig-line"></div>
            <div>مؤسسة رميح للمحاماة</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-5xl bg-[#08111F] border border-[#D4A84F]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-[#132238] via-[#0D1829] to-[#132238] border-b border-[#D4A84F]/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4A84F] to-[#92400e] p-0.5 shadow-lg shadow-[#D4A84F]/20 flex items-center justify-center">
                <div className="w-full h-full bg-[#08111F] rounded-[14px] flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-[#D4A84F]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[#F8F9FB]">
                    سندات الصرف المسجلة لعقار: <span className="text-[#D4A84F]">{property?.name}</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D4A84F]/15 border border-[#D4A84F]/30 text-[#D4A84F] text-[11px] font-mono font-black">
                    {propertyPayouts.length} سند
                  </span>
                </div>
                <p className="text-xs text-[#9EA7B8] font-bold mt-0.5 flex items-center gap-2">
                  <span>المالك: <strong className="text-amber-300">{owner?.name || property?.ownerName || 'مالك العقار'}</strong></span>
                  <span>•</span>
                  <span>ربط فوري وتلقائي مع كشف حساب المالك وملف PDF</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintAllPayoutsStatement}
                disabled={filteredPayouts.length === 0}
                className="px-3.5 py-2 rounded-xl bg-[#1C2D42] hover:bg-[#253952] text-[#D4A84F] border border-[#D4A84F]/30 text-xs font-black transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                title="طباعة كشف مجمع بجميع سندات الصرف لهذا العقار"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">طباعة الكشف المجمع</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-[#132238] hover:bg-rose-500/20 text-[#9EA7B8] hover:text-rose-400 border border-[#D4A84F]/20 hover:border-rose-500/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-[#0D1829]/60 border-b border-[#D4A84F]/10 text-right">
            <div className="p-3 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/15">
              <span className="text-[10px] text-[#9EA7B8] font-bold block mb-1">إجمالي المنصرف الفعلي:</span>
              <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                {totalDisbursedActive.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/15">
              <span className="text-[10px] text-[#9EA7B8] font-bold block mb-1">عدد سندات الصرف:</span>
              <span className="text-sm sm:text-base font-black text-[#D4A84F] font-mono">
                {propertyPayouts.filter(p => p.status !== 'reverted' && !p.isCancelled).length} سند معتمد
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/15">
              <span className="text-[10px] text-[#9EA7B8] font-bold block mb-1">السندات الملغاة / المسترجعة:</span>
              <span className="text-sm sm:text-base font-black text-rose-400 font-mono">
                {propertyPayouts.filter(p => p.status === 'reverted' || p.isCancelled).length} سند
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/15">
              <span className="text-[10px] text-[#9EA7B8] font-bold block mb-1">المبالغ المسترجعة للمستحق:</span>
              <span className="text-sm sm:text-base font-black text-amber-300 font-mono">
                {totalDisbursedReverted.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-[#08111F] border-b border-[#D4A84F]/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="w-4 h-4 text-[#D4A84F] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث برقم السند، البيان، طريقة الصرف، المرجع..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-[#132238]/70 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] placeholder:text-[#9EA7B8]/50 focus:border-[#D4A84F] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#132238]/70 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">كافة الشهور المالية</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonthYearAr(m)}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-[#132238]/70 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">كافة الحالات</option>
                <option value="active">السندات المعتمدة فقط</option>
                <option value="reverted">السندات الملغاة والمسترجعة</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {filteredPayouts.length === 0 ? (
              <div className="p-12 text-center bg-[#132238]/20 rounded-2xl border border-dashed border-[#D4A84F]/20">
                <Receipt className="w-12 h-12 text-[#D4A84F]/30 mx-auto mb-3" />
                <h4 className="text-sm font-black text-[#F8F9FB]">لا توجد سندات صرف مسجلة لهذا العقار</h4>
                <p className="text-xs text-[#9EA7B8] font-bold mt-1 max-w-md mx-auto">
                  يتم إصدار سندات الصرف تلقائياً عند الضغط على زر «صرف الإيجار» في كشف حساب المالك، وتظهر هنا فورياً وموثقة بكافة تفاصيلها.
                </p>
              </div>
            ) : (
              <div className="bg-[#132238]/40 rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                        <th className="p-3 text-center">#</th>
                        <th className="p-3">رقم السند</th>
                        <th className="p-3">تاريخ الصرف</th>
                        <th className="p-3">الشهر المالي</th>
                        <th className="p-3">البيان والتفاصيل</th>
                        <th className="p-3">طريقة الصرف والمرجع</th>
                        <th className="p-3">مبلغ الصرف</th>
                        <th className="p-3 text-center">الحالة</th>
                        <th className="p-3 text-center">إجراءات السند</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                      {filteredPayouts.map((payout, idx) => {
                        const isReverted = payout.status === 'reverted' || payout.isCancelled;
                        const payoutNum = payout.receiptNumber || `PAY-${payout.id.slice(-6).toUpperCase()}`;
                        const pDate = payout.payoutDate || (payout.createdAt ? payout.createdAt.slice(0, 10) : '—');
                        const pMonth = formatMonthYearAr(payout.forMonthYear);
                        const methodBadge = getPaymentMethodBadgeColor(payout.paymentMethod);
                        const methodText = getPaymentMethodLabel(payout.paymentMethod);

                        return (
                          <tr 
                            key={payout.id}
                            className={`hover:bg-[#08111F]/60 transition-all ${isReverted ? 'bg-rose-950/10 opacity-75' : 'bg-transparent'}`}
                          >
                            <td className="p-3 text-center font-mono text-[#9EA7B8]">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-mono font-black text-amber-400 flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-[#D4A84F]" />
                                <span>{payoutNum}</span>
                              </div>
                              <span className="text-[10px] text-[#9EA7B8] font-mono">
                                بواسطة: {payout.createdBy || 'الإدارة'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[#F8F9FB]">{pDate}</td>
                            <td className="p-3 font-mono text-[#D4A84F]">{pMonth}</td>
                            <td className="p-3 text-[#F8F9FB] max-w-[260px]">
                              <p className="line-clamp-2 text-xs">{payout.notes || `صرف إيجار عقار ${property?.name || ''}`}</p>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-bold ${methodBadge}`}>
                                {methodText}
                              </span>
                              {payout.bankTransactionRef && (
                                <div className="text-[10px] font-mono text-[#9EA7B8] mt-1">
                                  مرجع: {payout.bankTransactionRef}
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-mono font-black text-sm">
                              <span className={isReverted ? 'text-slate-400 line-through' : 'text-emerald-400'}>
                                {(payout.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {isReverted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-black">
                                  <AlertCircle className="w-3 h-3 text-rose-400" />
                                  <span>ملغي / مسترجع</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span>معتمد ومخصوم</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handlePrintSingleVoucher(payout)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#D4A84F]/15 hover:bg-[#D4A84F]/25 text-[#D4A84F] border border-[#D4A84F]/30 text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                  title="طباعة سند الصرف الفردي الرسمي"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>طباعة السند</span>
                                </button>

                                {!isReverted && onRevertPayout && (
                                  <button
                                    type="button"
                                    onClick={() => onRevertPayout(payout)}
                                    disabled={isReverting}
                                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-40"
                                    title="إلغاء السند والتراجع عن الصرف وإعادة المبلغ لرصيد المالك"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>إلغاء السند</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-[#0D1829] border-t border-[#D4A84F]/20 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#9EA7B8] font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D4A84F]" />
              <span>مؤسسة رميح للمحاماة — نظام إدارة السندات المالية المؤمنة والمزامنة سحابياً مع Firestore</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#132238] hover:bg-[#1C2D42] text-[#F8F9FB] text-xs font-black border border-[#D4A84F]/20 transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
