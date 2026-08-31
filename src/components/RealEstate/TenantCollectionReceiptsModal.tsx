import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, X, Search, Calendar, DollarSign, Printer, 
  CheckCircle, FileText, User, Building, Phone, Clock,
  ArrowRight, ShieldCheck, AlertCircle, Sparkles, Filter, Download
} from 'lucide-react';
import { ReTenant, ReProperty, ReUnit, ReOwner, ReCollectionReceipt, User as AuthUser } from '../../types';

interface TenantCollectionReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: ReTenant | null;
  collections: ReCollectionReceipt[];
  properties: ReProperty[];
  units: ReUnit[];
  owners: ReOwner[];
  currentUser?: AuthUser;
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
      return 'نقداً';
    case 'bank_transfer':
      return 'تحويل بنكي';
    case 'instapay':
      return 'إنستاباي (InstaPay)';
    case 'vodafone_cash':
      return 'فودافون كاش';
    case 'check':
      return 'شيك بنكي';
    default:
      return method || 'نقداً';
  }
};

const getPaymentMethodBadgeColor = (method?: string): string => {
  switch (method) {
    case 'cash':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35';
    case 'bank_transfer':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/35';
    case 'instapay':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/35';
    case 'vodafone_cash':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/35';
    case 'check':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/35';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/35';
  }
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

// Generate official printable HTML voucher for a single collection receipt
export function generateCollectionReceiptVoucherHTML({
  receipt,
  tenant,
  property,
  unit,
  owner,
  currentUser
}: {
  receipt: ReCollectionReceipt;
  tenant?: ReTenant | null;
  property?: ReProperty | null;
  unit?: ReUnit | null;
  owner?: ReOwner | null;
  currentUser?: AuthUser;
}): string {
  const receiptNum = receipt.receiptNumber || `REC-${receipt.id.slice(-6).toUpperCase()}`;
  const paymentDateFormatted = receipt.paymentDate 
    ? new Date(receipt.paymentDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(receipt.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const monthText = formatMonthYearAr(receipt.forMonthYear);
  const methodLabel = getPaymentMethodLabel(receipt.paymentMethod);
  const amountNumber = (receipt.amountPaid || 0).toLocaleString('ar-EG');
  const amountWords = tafqeetNumber(receipt.amountPaid || 0);
  const collectorName = receipt.collectedBy || currentUser?.fullName || 'الإدارة المالية';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>سند قبض إيجار - ${receiptNum}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; padding: 24px; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt-container { max-width: 800px; margin: 0 auto; background: #ffffff; border: 3px double #d4a84f; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); position: relative; }
    .receipt-container::before { content: ""; position: absolute; inset: 6px; border: 1px solid #e2e8f0; border-radius: 12px; pointer-events: none; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4a84f; padding-bottom: 18px; margin-bottom: 24px; }
    .header-logo { text-align: right; }
    .header-logo h1 { font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1.3; }
    .header-logo p { font-size: 12px; font-weight: 700; color: #d4a84f; margin-top: 4px; }
    .receipt-badge { text-align: left; background: #fdfaf3; border: 1.5px solid #d4a84f; padding: 10px 18px; border-radius: 12px; }
    .receipt-badge .title { font-size: 15px; font-weight: 900; color: #b38734; }
    .receipt-badge .num { font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace; direction: ltr; margin-top: 2px; }
    .meta-grid { display: grid; grid-cols: 2; grid-template-columns: repeat(2, 1fr); gap: 14px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 22px; }
    .meta-item { font-size: 13px; color: #334155; }
    .meta-item strong { color: #0f172a; font-weight: 800; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    .data-table th { background: #0f172a; color: #f8fafc; padding: 10px 14px; font-size: 13px; font-weight: 800; text-align: right; border: 1px solid #0f172a; }
    .data-table td { padding: 12px 14px; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; color: #1e293b; }
    .amount-highlight { background: #fdfaf3; border: 2px solid #d4a84f; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .amount-val { font-size: 26px; font-weight: 900; color: #0f172a; font-family: monospace; }
    .amount-words { font-size: 14px; font-weight: 800; color: #b38734; margin-top: 4px; }
    .signatures-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center; }
    .sig-box { display: flex; flex-direction: column; align-items: center; }
    .sig-title { font-size: 13px; font-weight: 800; color: #334155; margin-bottom: 45px; }
    .sig-line { width: 130px; border-bottom: 1.5px solid #0f172a; }
    .footer-note { text-align: center; font-size: 11px; font-weight: 600; color: #64748b; margin-top: 24px; }
    @media print {
      body { padding: 0; background: transparent; }
      .receipt-container { box-shadow: none; border-color: #333; max-width: 100%; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="header-logo">
        <h1>مؤسسة رميح للمحاماة والاستشارات القانونية</h1>
        <p>قسم الإدارة العقارية وتحصيل الإيجارات</p>
      </div>
      <div class="receipt-badge">
        <div class="title">سند قبض إيجار رسمي</div>
        <div class="num">${receiptNum}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><strong>تاريخ التحرير والسداد:</strong> ${paymentDateFormatted}</div>
      <div class="meta-item"><strong>عن إيجار شهر:</strong> <span style="color:#b38734; font-weight:900;">${monthText}</span></div>
      <div class="meta-item"><strong>العقار:</strong> ${property?.name || 'عقار تحت الإدارة'}</div>
      <div class="meta-item"><strong>رقم الوحدة:</strong> ${unit?.unitNumber || 'غير محدد'}</div>
      <div class="meta-item"><strong>مالك العقار:</strong> ${owner?.name || 'غير محدد'}</div>
      <div class="meta-item"><strong>طريقة السداد:</strong> ${methodLabel}</div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>البيان</th>
          <th>تفاصيل السداد</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="width: 35%;"><strong>المستأجر (المسدد):</strong></td>
          <td style="font-size: 15px; font-weight: 800;">${tenant?.fullName || 'غير محدد'}</td>
        </tr>
        ${tenant?.nationalId ? `<tr><td><strong>الرقم القومي:</strong></td><td style="font-family: monospace;">${tenant.nationalId}</td></tr>` : ''}
        ${tenant?.phone ? `<tr><td><strong>رقم الهاتف:</strong></td><td style="font-family: monospace;">${tenant.phone}</td></tr>` : ''}
        <tr>
          <td><strong>المستلم / المحصل:</strong></td>
          <td>${collectorName}</td>
        </tr>
        ${receipt.notes ? `<tr><td><strong>ملاحظات وبيان إضافي:</strong></td><td>${receipt.notes}</td></tr>` : ''}
      </tbody>
    </table>

    <div class="amount-highlight">
      <div style="font-size: 12px; font-weight: 800; color: #64748b; margin-bottom: 2px;">المبلغ المحصل بالكامل</div>
      <div class="amount-val">${amountNumber} <span style="font-size: 16px; font-family: 'Cairo', sans-serif;">جنيه مصري</span></div>
      <div class="amount-words">(${amountWords})</div>
    </div>

    <div class="signatures-grid">
      <div class="sig-box">
        <div class="sig-title">توقيع المستأجر</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-box">
        <div class="sig-title">توقيع المحصل / المستلم</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-box">
        <div class="sig-title">ختم واعتماد المؤسسة</div>
        <div class="sig-line"></div>
      </div>
    </div>

    <div class="footer-note">
      يُعتبر هذا السند إيصال سداد مالي رسمي لا يُعتد به إلا إذا كان موقعاً ومختوماً. تم الإصدار إلكترونياً عبر منظومة رميح القانونية.
    </div>
  </div>
</body>
</html>`;
}

// Direct print helper for collection receipts
export function printReceiptDirectly(htmlContent: string) {
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

export const TenantCollectionReceiptsModal: React.FC<TenantCollectionReceiptsModalProps> = ({
  isOpen,
  onClose,
  tenant,
  collections = [],
  properties = [],
  units = [],
  owners = [],
  currentUser
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('all');
  const [previewReceipt, setPreviewReceipt] = useState<ReCollectionReceipt | null>(null);

  // Resolved tenant details
  const property = useMemo(() => {
    if (!tenant) return null;
    if (tenant.propertyId) return properties.find(p => p.id === tenant.propertyId) || null;
    const u = units.find(unit => unit.id === tenant.unitId);
    return u ? properties.find(p => p.id === u.propertyId) || null : null;
  }, [tenant, properties, units]);

  const unit = useMemo(() => {
    if (!tenant) return null;
    return units.find(u => u.id === tenant.unitId) || null;
  }, [tenant, units]);

  const owner = useMemo(() => {
    if (!property) return null;
    return owners.find(o => o.id === property.ownerId) || null;
  }, [property, owners]);

  // Strictly filter receipts for THIS tenant only using tenantId and ignoring cancelled/reverted ones
  const tenantReceipts = useMemo(() => {
    if (!tenant) return [];
    return collections
      .filter(c => {
        if (!c || c.isCancelled || c.status === 'reverted') return false;
        // Strict match on tenantId or matching tenant name if ID is missing
        return (
          c.tenantId === tenant.id ||
          (!c.tenantId && tenant.fullName && (c.collectedBy?.toLowerCase() === tenant.fullName.toLowerCase()))
        );
      })
      .sort((a, b) => {
        const dateA = a.paymentDate || a.createdAt || '';
        const dateB = b.paymentDate || b.createdAt || '';
        return dateB.localeCompare(dateA); // Newest first
      });
  }, [collections, tenant]);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    tenantReceipts.forEach(r => {
      const yr = (r.forMonthYear || r.paymentDate || r.createdAt || '').slice(0, 4);
      if (yr && yr.length === 4) years.add(yr);
    });
    return Array.from(years).sort().reverse();
  }, [tenantReceipts]);

  // Filtered Receipts for Display
  const filteredReceipts = useMemo(() => {
    return tenantReceipts.filter(r => {
      const matchesSearch = 
        !searchQuery.trim() ||
        (r.receiptNumber && r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.forMonthYear && r.forMonthYear.includes(searchQuery)) ||
        (formatMonthYearAr(r.forMonthYear).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.collectedBy && r.collectedBy.toLowerCase().includes(searchQuery.toLowerCase()));

      const yr = (r.forMonthYear || r.paymentDate || r.createdAt || '').slice(0, 4);
      const matchesYear = selectedYearFilter === 'all' || yr === selectedYearFilter;
      const matchesMethod = selectedMethodFilter === 'all' || r.paymentMethod === selectedMethodFilter;

      return matchesSearch && matchesYear && matchesMethod;
    });
  }, [tenantReceipts, searchQuery, selectedYearFilter, selectedMethodFilter]);

  // Metrics
  const totalAmount = useMemo(() => {
    return filteredReceipts.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  }, [filteredReceipts]);

  const handlePrintSingle = (receipt: ReCollectionReceipt) => {
    const html = generateCollectionReceiptVoucherHTML({
      receipt,
      tenant,
      property,
      unit,
      owner,
      currentUser
    });
    printReceiptDirectly(html);
  };

  if (!isOpen || !tenant) return null;

  return (
    <AnimatePresence>
      <div 
        id="tenant-collection-receipts-modal-overlay"
        className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-hidden" 
        dir="rtl"
      >
        <motion.div
          id="tenant-collection-receipts-modal-card"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-[#0B1524] border-2 border-[#D4A84F]/40 rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden text-[#F8F9FB]"
        >
          {/* MODAL HEADER */}
          <div className="flex items-center justify-between border-b border-[#D4A84F]/30 p-4 sm:p-5 shrink-0 bg-gradient-to-r from-[#08111F] via-[#0D1B2D] to-[#0B1524]">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-[#D4A84F]/20 border border-[#D4A84F]/40 text-[#D4A84F] shadow-md">
                <Receipt className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-xl font-black text-[#F8F9FB]">
                    سندات التحصيل الخاصة بالمستأجر:
                  </h3>
                  <span className="text-[#D4A84F] bg-[#D4A84F]/15 px-3 py-1 rounded-xl border border-[#D4A84F]/40 text-sm sm:text-base font-black shadow-inner">
                    {tenant.fullName}
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-extrabold mt-1.5 flex flex-wrap items-center gap-3">
                  {property && (
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-[#D4A84F]" />
                      {property.name} {unit ? `(وحدة ${unit.unitNumber})` : ''}
                    </span>
                  )}
                  {tenant.phone && (
                    <span className="flex items-center gap-1 font-mono text-slate-200">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {tenant.phone}
                    </span>
                  )}
                  <span className="text-[#D4A84F]/60">|</span>
                  <span className="text-slate-300">
                    القيمة الشهرية: <strong className="text-[#D4A84F] font-mono">{(tenant.rentAmount || unit?.rentValue || 0).toLocaleString('ar-EG')} ج.م</strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              id="close-tenant-receipts-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/15 border border-transparent hover:border-white/20 transition-all cursor-pointer shadow-sm"
              title="إغلاق النافذة"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-[#0B1524]/95">

            {/* SUMMARY KPIS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 bg-gradient-to-br from-[#08111F] to-[#0D1B2D] rounded-2xl border border-[#D4A84F]/30 space-y-1 shadow-lg">
                <span className="text-xs text-[#D4A84F] font-extrabold flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  إجمالي سندات التحصيل
                </span>
                <div className="text-xl sm:text-2xl font-black text-white font-mono">
                  {filteredReceipts.length}{' '}
                  <span className="text-xs font-sans text-slate-400 font-bold">
                    سند من أصل {tenantReceipts.length}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-[#08111F] to-[#0D1B2D] rounded-2xl border border-emerald-500/35 space-y-1 shadow-lg">
                <span className="text-xs text-emerald-300 font-extrabold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  إجمالي المبالغ المحصلة
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                  {totalAmount.toLocaleString('ar-EG')}{' '}
                  <span className="text-xs font-sans text-emerald-300 font-bold">ج.م</span>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-[#08111F] to-[#0D1B2D] rounded-2xl border border-sky-500/35 space-y-1 shadow-lg">
                <span className="text-xs text-sky-300 font-extrabold flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  أحدث سند مسدد
                </span>
                <div className="text-sm sm:text-base font-black text-sky-200 font-mono">
                  {tenantReceipts.length > 0 
                    ? formatMonthYearAr(tenantReceipts[0].forMonthYear) + ` (${(tenantReceipts[0].amountPaid || 0).toLocaleString('ar-EG')} ج.م)`
                    : 'لا توجد سندات بعد'}
                </div>
              </div>
            </div>

            {/* FILTERS & SEARCH */}
            <div className="p-3.5 bg-[#08111F]/90 rounded-2xl border border-[#D4A84F]/25 flex flex-wrap items-center justify-between gap-3 shadow-inner">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-[#D4A84F] absolute right-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="بحث برقم السند، الشهر، الملاحظات..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-3.5 py-2 rounded-xl bg-[#0B1524] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] placeholder:text-slate-400 font-bold focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none shadow-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Year Filter */}
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-300 font-bold whitespace-nowrap">السنة:</label>
                  <select
                    value={selectedYearFilter}
                    onChange={e => setSelectedYearFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#0B1524] border border-[#D4A84F]/30 text-xs text-[#F8F9FB] font-bold outline-none"
                  >
                    <option value="all">جميع السنوات</option>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-300 font-bold whitespace-nowrap">طريقة السداد:</label>
                  <select
                    value={selectedMethodFilter}
                    onChange={e => setSelectedMethodFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#0B1524] border border-[#D4A84F]/30 text-xs text-[#F8F9FB] font-bold outline-none"
                  >
                    <option value="all">جميع الطرق</option>
                    <option value="cash">نقداً</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="instapay">إنستاباي (InstaPay)</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="check">شيك بنكي</option>
                  </select>
                </div>
              </div>

              {(searchQuery || selectedYearFilter !== 'all' || selectedMethodFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedYearFilter('all');
                    setSelectedMethodFilter('all');
                  }}
                  className="text-xs text-[#D4A84F] hover:underline font-bold px-2 py-1"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>

            {/* RECEIPTS TABLE */}
            {filteredReceipts.length === 0 ? (
              <div className="py-14 text-center text-slate-400 font-extrabold space-y-3 bg-[#08111F]/50 rounded-2xl border border-dashed border-[#D4A84F]/20">
                <Receipt className="w-12 h-12 text-[#D4A84F] mx-auto opacity-50 stroke-[1.5]" />
                <p className="text-base text-slate-200">
                  {tenantReceipts.length === 0 
                    ? 'لم يتم تسجيل أي سندات تحصيل لهذا المستأجر حتى الآن.'
                    : 'لا توجد سندات تطابق خيارات البحث والفلترة.'}
                </p>
                <span className="text-xs text-slate-400 block">
                  يتم إنشاء السندات آلياً عند تسجيل عمليات تحصيل الإيجارات بنجاح.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D4A84F]/30 bg-[#08111F]/90 shadow-xl">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#0D1B2D] text-slate-200 text-xs font-black border-b border-[#D4A84F]/30">
                      <th className="p-3.5 text-center">#</th>
                      <th className="p-3.5">رقم السند</th>
                      <th className="p-3.5">تاريخ السداد</th>
                      <th className="p-3.5">الشهر المالي المستحق</th>
                      <th className="p-3.5 text-center">المبلغ المحصل</th>
                      <th className="p-3.5 text-center">طريقة السداد</th>
                      <th className="p-3.5">القائم بالتحصيل</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/15 font-bold text-slate-100">
                    {filteredReceipts.map((receipt, idx) => {
                      const receiptNum = receipt.receiptNumber || `REC-${receipt.id.slice(-6).toUpperCase()}`;
                      const paymentDateStr = receipt.paymentDate || receipt.createdAt || '';
                      const formattedDate = paymentDateStr 
                        ? new Date(paymentDateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'غير محدد';
                      const monthText = formatMonthYearAr(receipt.forMonthYear);
                      const methodBadge = getPaymentMethodBadgeColor(receipt.paymentMethod);
                      const methodLabel = getPaymentMethodLabel(receipt.paymentMethod);

                      return (
                        <tr key={receipt.id} className="hover:bg-white/[0.04] transition-colors">
                          <td className="p-3.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>

                          {/* 1. رقم السند */}
                          <td className="p-3.5">
                            <button
                              onClick={() => setPreviewReceipt(receipt)}
                              className="font-mono font-black text-sm text-[#D4A84F] hover:underline flex items-center gap-1.5 cursor-pointer"
                              title="اضغط لفتح ومعاينة السند بالكامل"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#D4A84F]" />
                              <span>{receiptNum}</span>
                            </button>
                            {receipt.notes && (
                              <span className="text-[11px] text-slate-400 block mt-0.5 line-clamp-1 font-normal">
                                {receipt.notes}
                              </span>
                            )}
                          </td>

                          {/* 2. التاريخ */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <Calendar className="w-3.5 h-3.5 text-[#D4A84F]" />
                              <span>{formattedDate}</span>
                            </div>
                            {paymentDateStr && (
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                {paymentDateStr.slice(0, 10)}
                              </span>
                            )}
                          </td>

                          {/* 3. الشهر */}
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-xl bg-[#132238] text-amber-300 font-mono font-black text-xs border border-[#D4A84F]/30 shadow-inner inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#D4A84F]" />
                              {monthText}
                            </span>
                          </td>

                          {/* 4. المبلغ */}
                          <td className="p-3.5 text-center">
                            <span className="font-mono font-black text-base text-emerald-400">
                              {(receipt.amountPaid || 0).toLocaleString('ar-EG')}
                            </span>
                            <span className="text-xs text-emerald-300 font-bold mr-1">ج.م</span>
                          </td>

                          {/* 5. طريقة السداد */}
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border shadow-sm ${methodBadge}`}>
                              {methodLabel}
                            </span>
                          </td>

                          {/* 6. القائم بالتحصيل */}
                          <td className="p-3.5 text-slate-300 text-xs">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{receipt.collectedBy || 'الإدارة المالية'}</span>
                            </div>
                          </td>

                          {/* 7. الإجراءات */}
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setPreviewReceipt(receipt)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border border-slate-600 shadow-sm"
                                title="فتح ومعاينة تفاصيل السند"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#D4A84F]" />
                                <span>فتح السند</span>
                              </button>

                              <button
                                onClick={() => handlePrintSingle(receipt)}
                                className="px-3 py-1.5 rounded-xl bg-[#D4A84F]/20 hover:bg-[#D4A84F]/35 text-[#D4A84F] hover:text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border border-[#D4A84F]/40 shadow-sm"
                                title="طباعة السند الرسمي"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>طباعة</span>
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

          {/* FOOTER */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-t border-[#D4A84F]/30 bg-[#08111F] shrink-0">
            <div className="text-xs text-slate-300 font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                مصدر البيانات: سجلات التحصيل الرسمية الموثقة لـ <strong className="text-white">{tenant.fullName}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs sm:text-sm rounded-xl border border-slate-600 transition-all cursor-pointer shadow-md"
              >
                إغلاق
              </button>
            </div>
          </div>
        </motion.div>

        {/* INNER MODAL: SINGLE RECEIPT PREVIEW & FULL VOUCHER VIEW */}
        <AnimatePresence>
          {previewReceipt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[160] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-[#0D1B2D] border-2 border-[#D4A84F] rounded-3xl w-full max-w-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col my-auto"
              >
                {/* Voucher Header */}
                <div className="p-4 sm:p-6 bg-gradient-to-r from-[#08111F] via-[#132238] to-[#0D1B2D] border-b border-[#D4A84F]/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/40">
                      <Receipt className="w-7 h-7 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-lg sm:text-xl font-black text-white">
                        سند قبض إيجار رسمي
                      </h4>
                      <p className="text-xs text-[#D4A84F] font-mono font-black mt-0.5">
                        رقم السند: {previewReceipt.receiptNumber || `REC-${previewReceipt.id.slice(-6).toUpperCase()}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setPreviewReceipt(null)}
                    className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Voucher Card Content */}
                <div className="p-5 sm:p-8 space-y-6 overflow-y-auto max-h-[75vh]">
                  
                  {/* Firm Branding */}
                  <div className="text-center pb-4 border-b border-[#D4A84F]/20">
                    <h5 className="text-lg font-black text-[#D4A84F]">
                      مؤسسة رميح للمحاماة والاستشارات القانونية
                    </h5>
                    <p className="text-xs text-slate-300 font-bold mt-1">
                      إدارة الأملاك والعقارات والتحصيل المالي
                    </p>
                  </div>

                  {/* Voucher Key-Value Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#08111F] p-4 sm:p-5 rounded-2xl border border-[#D4A84F]/30 text-xs sm:text-sm">
                    <div className="space-y-1">
                      <span className="text-slate-400 block font-bold text-xs">وصلنا من السيد / المستأجر:</span>
                      <span className="text-white font-black text-base">{tenant.fullName}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 block font-bold text-xs">تاريخ السداد الفعلي:</span>
                      <span className="text-slate-200 font-mono font-bold">
                        {previewReceipt.paymentDate 
                          ? new Date(previewReceipt.paymentDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                          : new Date(previewReceipt.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 block font-bold text-xs">العقار والوحدة:</span>
                      <span className="text-slate-200 font-black">
                        {property?.name || 'عقار تحت الإدارة'} {unit ? `(وحدة ${unit.unitNumber})` : ''}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 block font-bold text-xs">عن القيمة الإيجارية لشهر:</span>
                      <span className="text-amber-300 font-black text-sm bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/30 inline-block font-mono">
                        {formatMonthYearAr(previewReceipt.forMonthYear)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 block font-bold text-xs">طريقة السداد:</span>
                      <span className="text-emerald-300 font-black">
                        {getPaymentMethodLabel(previewReceipt.paymentMethod)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 block font-bold text-xs">المستلم / القائم بالتحصيل:</span>
                      <span className="text-slate-200 font-black">
                        {previewReceipt.collectedBy || currentUser?.fullName || 'الإدارة المالية'}
                      </span>
                    </div>

                    {tenant.phone && (
                      <div className="space-y-1">
                        <span className="text-slate-400 block font-bold text-xs">رقم هاتف المستأجر:</span>
                        <span className="text-slate-200 font-mono font-bold">{tenant.phone}</span>
                      </div>
                    )}

                    {tenant.nationalId && (
                      <div className="space-y-1">
                        <span className="text-slate-400 block font-bold text-xs">الرقم القومي:</span>
                        <span className="text-slate-200 font-mono font-bold">{tenant.nationalId}</span>
                      </div>
                    )}
                  </div>

                  {/* Amount Banner */}
                  <div className="bg-gradient-to-r from-[#132238] via-[#0D1B2D] to-[#132238] p-5 rounded-2xl border-2 border-[#D4A84F] text-center space-y-2 shadow-xl">
                    <span className="text-xs text-slate-300 font-extrabold block">المبلغ المسدد والمدفوع</span>
                    <div className="text-2xl sm:text-3xl font-black text-[#D4A84F] font-mono">
                      {(previewReceipt.amountPaid || 0).toLocaleString('ar-EG')}{' '}
                      <span className="text-base font-sans font-black text-slate-200">جنيه مصري</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300 font-extrabold bg-[#08111F]/80 py-1.5 px-3 rounded-xl inline-block border border-[#D4A84F]/30">
                      {tafqeetNumber(previewReceipt.amountPaid || 0)}
                    </div>
                  </div>

                  {previewReceipt.notes && (
                    <div className="p-3.5 bg-[#08111F] rounded-xl border border-slate-700 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">بيان وملاحظات:</span>
                      <p className="text-slate-200">{previewReceipt.notes}</p>
                    </div>
                  )}

                  {/* Signatures Preview */}
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#D4A84F]/20 text-center text-xs text-slate-300 font-bold">
                    <div className="space-y-8">
                      <span>توقيع المستأجر</span>
                      <div className="border-b border-slate-600 w-24 mx-auto"></div>
                    </div>
                    <div className="space-y-8">
                      <span>توقيع المحصل</span>
                      <div className="border-b border-slate-600 w-24 mx-auto"></div>
                    </div>
                    <div className="space-y-8">
                      <span>ختم المؤسسة</span>
                      <div className="border-b border-slate-600 w-24 mx-auto"></div>
                    </div>
                  </div>

                </div>

                {/* Voucher Footer */}
                <div className="p-4 sm:p-5 bg-[#08111F] border-t border-[#D4A84F]/30 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewReceipt(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-black"
                  >
                    الرجوع لقائمة السندات
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintSingle(previewReceipt)}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#B38734] hover:to-[#D4A84F] text-slate-950 text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-[#D4A84F]/20 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة هذا السند</span>
                  </button>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};

export default TenantCollectionReceiptsModal;
