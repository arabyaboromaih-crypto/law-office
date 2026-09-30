import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, X, CheckCircle, Building, User, 
  Wallet, DollarSign, AlertTriangle, ArrowUpDown, 
  Receipt, Printer, RotateCcw, Eye, Check, Calendar, FileText,
  Clock, ShieldCheck, Tag
} from 'lucide-react';
import { ReOwnerAdvance, ReAdvanceDeductionEntry, User as AuthUser } from '../../types';
import { getAdvanceDeductedAmount } from './RealEstateData';

interface AdvanceDeductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  advance: ReOwnerAdvance | null;
  availableNetEntitlement: number;
  onConfirmDeduct: (params: {
    deductionMethod: string;
    settlementAmount: number;
    deductionDate: string;
    deductionRef: string;
    deductionNotes: string;
  }) => Promise<void>;
  onRevertDeduction?: (advance: ReOwnerAdvance, deductionEntryId?: string) => Promise<void>;
  isSubmitting?: boolean;
  currentUser?: { fullName?: string; username?: string };
}

export const DEDUCTION_METHODS = [
  {
    id: 'خصم من المستحق',
    title: 'خصم من المستحق',
    subtitle: 'خصم المبلغ المحدد مباشرة من صافي مستحقات إيجار المالك في كشف الحساب',
    icon: Coins,
    color: 'emerald',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'نقدي',
    title: 'نقدي',
    subtitle: 'سداد نقدي مباشر بخزينة المؤسسة (لا يؤثر على رصيد ومستحقات المالك)',
    icon: Wallet,
    color: 'amber',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
];

export const getDeductionMethodBadge = (method?: string) => {
  const norm = method || 'خصم من المستحق';
  if (norm === 'خصم من المستحق' || norm === 'من المستحق للمالك' || norm === 'from_entitlement') {
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
  }
  if (norm === 'نقدي' || norm === 'سداد نقدي') {
    return 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold';
  }
  return 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold';
};

// Convert number to Arabic words (Tafqeet)
export const tafqeetNumber = (num: number): string => {
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

  return `${words} جنيه مصري لا غير`;
};

// Print Single or Comprehensive Voucher
export const handlePrintAdvanceVoucher = ({
  advance,
  specificEntry,
  currentUser
}: {
  advance: ReOwnerAdvance;
  specificEntry?: ReAdvanceDeductionEntry;
  currentUser?: { fullName?: string; username?: string };
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
    return;
  }

  const originalAmount = advance.amount || 0;
  const currentTotalDeducted = getAdvanceDeductedAmount(advance);
  const remainingAmount = Math.max(0, originalAmount - currentTotalDeducted);

  const voucherAmount = specificEntry 
    ? specificEntry.amount 
    : (currentTotalDeducted > 0 ? currentTotalDeducted : originalAmount);

  const voucherNumber = specificEntry?.deductionRef 
    ? `DED-${specificEntry.deductionRef}`
    : advance.deductionRef
      ? `DED-${advance.deductionRef}`
      : `ADV-${(advance.id || '').slice(-6).toUpperCase() || '0000'}`;

  const amountWords = tafqeetNumber(voucherAmount);
  const deductionMethod = specificEntry?.deductionMethod || advance.deductionMethod || 'خصم من المستحق';
  const isFromEntitlement = deductionMethod === 'خصم من المستحق' || deductionMethod === 'من المستحق للمالك';
  const deductionDate = specificEntry?.deductionDate || advance.deductedAt || advance.deductionDate || new Date().toISOString().slice(0, 10);
  const accountant = specificEntry?.deductedBy || advance.deductedBy || advance.recordedBy || currentUser?.fullName || 'المحاسب المسؤول';
  const notes = specificEntry?.deductionNotes || advance.deductionNotes || advance.notes || 'تسوية وخصم سلفة';

  const deductionsHistory = advance.deductions && advance.deductions.length > 0
    ? advance.deductions
    : (advance.isDeducted && advance.deductedAmount ? [{
        id: 'legacy_1',
        amount: advance.deductedAmount,
        deductionDate: advance.deductedAt || advance.deductionDate || advance.advanceDate,
        deductionMethod: advance.deductionMethod || 'خصم من المستحق',
        deductionRef: advance.deductionRef || '',
        deductionNotes: advance.deductionNotes || '',
        deductedBy: advance.deductedBy || '',
        createdAt: advance.createdAt
      }] : []);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>سند خصم وتسوية سُلفة - ${voucherNumber}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            background: #fff;
            color: #0f172a;
            margin: 0;
            padding: 12px;
            font-size: 11pt;
          }
          .voucher-card {
            border: 2px solid #b38734;
            border-radius: 14px;
            padding: 20px;
            position: relative;
            background: #ffffff;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            font-size: 50pt;
            color: rgba(179, 135, 52, 0.04);
            font-weight: 900;
            white-space: nowrap;
            pointer-events: none;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #b38734;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .logo-area h1 {
            margin: 0;
            font-size: 16pt;
            color: #1e293b;
            font-weight: 900;
          }
          .logo-area p {
            margin: 3px 0 0;
            font-size: 9pt;
            color: #64748b;
            font-weight: bold;
          }
          .title-badge {
            background: #fef3c7;
            color: #92400e;
            border: 1.5px solid #d97706;
            padding: 6px 16px;
            border-radius: 9999px;
            font-weight: 900;
            font-size: 13pt;
          }
          .meta-box {
            text-align: left;
            font-size: 9.5pt;
            color: #334155;
            line-height: 1.6;
          }
          .amount-banner {
            background: #f8fafc;
            border: 1.5px dashed #b38734;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .amount-num {
            font-size: 17pt;
            font-weight: 900;
            color: #047857;
            font-family: monospace;
          }
          .amount-words {
            font-size: 10.5pt;
            color: #1e293b;
            font-weight: bold;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          .grid-table td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            font-size: 10pt;
          }
          .grid-table .label-col {
            background: #f1f5f9;
            font-weight: 800;
            color: #475569;
            width: 22%;
          }
          .grid-table .val-col {
            background: #ffffff;
            color: #0f172a;
          }
          .history-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 9.5pt;
          }
          .history-table th {
            background: #0f172a;
            color: #f8fafc;
            padding: 6px 8px;
            text-align: right;
            border: 1px solid #334155;
          }
          .history-table td {
            padding: 6px 8px;
            border: 1px solid #cbd5e1;
          }
          .status-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 14px;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            margin-top: 20px;
            padding-top: 10px;
            text-align: center;
          }
          .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            padding: 10px;
            min-height: 75px;
          }
          .sig-box strong {
            display: block;
            margin-bottom: 35px;
            color: #334155;
            font-size: 10pt;
          }
          .footer-note {
            margin-top: 14px;
            text-align: center;
            font-size: 8.5pt;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="voucher-card">
          <div class="watermark">مؤسسة رميح للمحاماة</div>

          <div class="header">
            <div class="logo-area">
              <h1>مؤسسة رميح للمحاماة والاستشارات القانونية</h1>
              <p>قسم إدارة الأملاك والعقارات — السجل المالي والمحاسبي</p>
            </div>
            <div>
              <div class="title-badge">
                ${specificEntry ? 'سند خصم وتسوية سلفة' : 'سند تسوية سُلفة مالك'}
              </div>
            </div>
            <div class="meta-box">
              <div><strong>رقم السند:</strong> ${voucherNumber}</div>
              <div><strong>تاريخ السند:</strong> ${deductionDate}</div>
              <div><strong>تاريخ السلفة الأصلية:</strong> ${advance.advanceDate || '—'}</div>
            </div>
          </div>

          <div class="amount-banner">
            <div>
              <span style="font-size: 10pt; color: #78350f; font-weight: bold; display: block;">
                ${specificEntry ? 'مبلغ الخصم المسدد بالسند:' : 'المبلغ المخصوم / المسدد:'}
              </span>
              <span class="amount-num">${voucherAmount.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div style="text-align: left;">
              <span style="font-size: 10pt; color: #78350f; font-weight: bold; display: block;">المبلغ بالحروف:</span>
              <span class="amount-words">${amountWords}</span>
            </div>
          </div>

          <table class="grid-table">
            <tr>
              <td class="label-col">اسم المالك (المستفيد):</td>
              <td class="val-col" style="font-weight: 900; color: #b38734;">${advance.ownerName || 'مالك العقار'}</td>
              <td class="label-col">العقار المرتبط:</td>
              <td class="val-col">${advance.propertyName || 'عقار المالك'}</td>
            </tr>
            <tr>
              <td class="label-col">قيمة السلفة الأصلية:</td>
              <td class="val-col" style="font-weight: 800; font-family: monospace;">${originalAmount.toLocaleString('ar-EG')} ج.م</td>
              <td class="label-col">المتبقي بعد هذه الحركة:</td>
              <td class="val-col" style="font-weight: 800; font-family: monospace; color: ${remainingAmount > 0 ? '#b45309' : '#047857'};">
                ${remainingAmount.toLocaleString('ar-EG')} ج.م ${remainingAmount === 0 ? '(تمت التسوية بالكامل ✔)' : ''}
              </td>
            </tr>
            <tr>
              <td class="label-col">طريقة الخصم / السداد:</td>
              <td class="val-col" style="font-weight: 800;">${deductionMethod}</td>
              <td class="label-col">المحاسب المسؤول:</td>
              <td class="val-col">${accountant}</td>
            </tr>
            <tr>
              <td class="label-col">البيان والملاحظات:</td>
              <td class="val-col" colspan="3">${notes}</td>
            </tr>
          </table>

          ${!specificEntry && deductionsHistory.length > 0 ? `
            <div style="margin-top: 10px;">
              <strong style="font-size: 10pt; color: #1e293b;">سجل عمليات وخصومات السلفة:</strong>
              <table class="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>التاريخ</th>
                    <th>المبلغ المخصوم</th>
                    <th>طريقة الخصم</th>
                    <th>رقم المرجع</th>
                    <th>البيان</th>
                  </tr>
                </thead>
                <tbody>
                  ${deductionsHistory.map((d, i) => `
                    <tr>
                      <td style="text-align: center; font-family: monospace;">${i + 1}</td>
                      <td style="font-family: monospace;">${d.deductionDate}</td>
                      <td style="font-weight: 800; font-family: monospace; color: #047857;">${(d.amount || 0).toLocaleString('ar-EG')} ج.م</td>
                      <td>${d.deductionMethod || 'خصم من المستحق'}</td>
                      <td style="font-family: monospace;">${d.deductionRef || '—'}</td>
                      <td>${d.deductionNotes || 'خصم سلفة'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="status-box">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>حالة السلفة الحالية:</strong>
              <span style="font-weight: 900; font-size: 11pt; color: ${remainingAmount === 0 ? '#047857' : '#b45309'};">
                ${remainingAmount === 0 ? '✔ مخصومة ومسددة بالكامل' : `⏳ مخصومة جزئياً (المتبقي: ${remainingAmount.toLocaleString('ar-EG')} ج.م)`}
              </span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <strong>المستلم / المالك</strong>
            </div>
            <div class="sig-box">
              <strong>المحاسب المالي</strong>
            </div>
            <div class="sig-box">
              <strong>الختم المعتمد</strong>
            </div>
          </div>

          <div class="footer-note">
            تم إصدار هذا السند آلياً من النظام المالي الإلكتروني لمؤسسة رميح للمحاماة والاستشارات القانونية — ${new Date().toLocaleString('ar-EG')}
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const AdvanceDeductionModal: React.FC<AdvanceDeductionModalProps> = ({
  isOpen,
  onClose,
  advance,
  availableNetEntitlement,
  onConfirmDeduct,
  onRevertDeduction,
  isSubmitting = false,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'deduct' | 'receipts' | 'revert'>('deduct');
  const [deductionMethod, setDeductionMethod] = useState<string>('خصم من المستحق');
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [deductionDate, setDeductionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [deductionRef, setDeductionRef] = useState<string>('');
  const [deductionNotes, setDeductionNotes] = useState<string>('');
  const [previewEntry, setPreviewEntry] = useState<ReAdvanceDeductionEntry | null>(null);

  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // Financial Calculations for this Advance
  const originalAmount = advance?.amount || 0;
  const currentTotalDeducted = advance ? getAdvanceDeductedAmount(advance) : 0;
  const remainingAmount = Math.max(0, originalAmount - currentTotalDeducted);
  const isFullyDeducted = currentTotalDeducted >= originalAmount && originalAmount > 0;
  const isPartiallyDeducted = currentTotalDeducted > 0 && currentTotalDeducted < originalAmount;

  // Deductions History List
  const deductionsList: ReAdvanceDeductionEntry[] = (advance?.deductions && advance.deductions.length > 0)
    ? advance.deductions
    : (advance?.isDeducted && advance.deductedAmount ? [{
        id: 'ded_legacy',
        amount: advance.deductedAmount,
        deductionDate: advance.deductedAt || advance.deductionDate || advance.advanceDate,
        deductionMethod: advance.deductionMethod || 'خصم من المستحق',
        deductionRef: advance.deductionRef || '',
        deductionNotes: advance.deductionNotes || '',
        deductedBy: advance.deductedBy || '',
        createdAt: advance.createdAt
      }] : []);

  useEffect(() => {
    if (isOpen && advance) {
      setDeductionMethod('خصم من المستحق');
      // Default deduction input to the REMAINING balance
      const rem = Math.max(0, (advance.amount || 0) - getAdvanceDeductedAmount(advance));
      setSettlementAmount(rem > 0 ? String(rem) : '');
      setDeductionDate(new Date().toISOString().slice(0, 10));
      setDeductionRef('');
      setDeductionNotes('');
      setPreviewEntry(null);

      // If already fully deducted, default view to receipts tab; otherwise deduction tab
      if (rem <= 0) {
        setActiveTab('receipts');
      } else {
        setActiveTab('deduct');
      }

      setTimeout(() => {
        if (scrollBodyRef.current) {
          scrollBodyRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [isOpen, advance]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !advance) return null;

  const parsedAmount = parseFloat(settlementAmount) || 0;
  const isFromEntitlement = deductionMethod === 'خصم من المستحق' || deductionMethod === 'من المستحق للمالك';
  const hasSufficientEntitlement = availableNetEntitlement >= parsedAmount;
  const isAmountValid = parsedAmount > 0 && parsedAmount <= remainingAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parsedAmount <= 0) {
      alert('⚠️ يرجى إدخال مبلغ سداد / خصم صحيح أكبر من الصفر.');
      return;
    }

    if (parsedAmount > remainingAmount) {
      alert(`⚠️ المبلغ المطلوب خصمه (${parsedAmount.toLocaleString('ar-EG')} ج.م) يتجاوز الرصيد المتبقي للسلفة (${remainingAmount.toLocaleString('ar-EG')} ج.م).`);
      return;
    }

    if (isFromEntitlement && !hasSufficientEntitlement) {
      alert(
        `⚠️ عفواً، لا يمكن تنفيذ الخصم من المستحق!\n\n` +
        `المبلغ المطلوب خصمه (${parsedAmount.toLocaleString('ar-EG')} ج.م) يتجاوز رصيد مستحقات الإيجار المتاحة للمالك (${Math.max(0, availableNetEntitlement).toLocaleString('ar-EG')} ج.م).\n\n` +
        `يرجى تعديل المبلغ أو اختيار (نقدي) لإتمام السداد.`
      );
      return;
    }

    await onConfirmDeduct({
      deductionMethod,
      settlementAmount: parsedAmount,
      deductionDate,
      deductionRef: deductionRef.trim(),
      deductionNotes: deductionNotes.trim(),
    });
  };

  const handleRevertSingle = async (entryId?: string) => {
    if (!onRevertDeduction) return;
    if (window.confirm('هل أنت متأكد من إلغاء عملية الخصم هذه واسترجاع رصيدها إلى السلفة؟')) {
      await onRevertDeduction(advance, entryId);
    }
  };

  const handleRevertAll = async () => {
    if (!onRevertDeduction) return;
    if (window.confirm('هل أنت متأكد من إلغاء كافة عمليات الخصم لهذه السلفة وإعادة رصيدها بالكامل إلى قائمة السلف الجارية؟')) {
      await onRevertDeduction(advance);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="advance-deduction-unified-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
          }
        }}
      >
        <motion.div
          id="advance-deduction-unified-container"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] bg-[#0A1628] border border-[#D4A84F]/40 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden text-right"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            id="advance-deduction-modal-header"
            className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-[#132238] via-[#0E1A2C] to-[#132238] border-b border-[#D4A84F]/30 flex items-center justify-between z-10 select-none shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#D4A84F] to-[#92400e] p-0.5 shadow-lg shadow-[#D4A84F]/20 flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-[#08111F] rounded-[14px] flex items-center justify-center">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4A84F]" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base md:text-lg font-black text-[#F8F9FB] tracking-tight">
                    خصم السلف وإدارة السندات
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                    isFullyDeducted 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                      : isPartiallyDeducted
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  }`}>
                    {isFullyDeducted 
                      ? 'مخصومة بالكامل ✔' 
                      : isPartiallyDeducted 
                        ? `مخصومة جزئياً (متبقي ${remainingAmount.toLocaleString('ar-EG')} ج.م)` 
                        : 'سلفة جارية (غير مخصومة)'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#CBD5E1] font-semibold mt-0.5">
                  المالك: <span className="text-[#D4A84F] font-bold">{advance.ownerName || 'مالك'}</span> | العقار: <span className="text-slate-200 font-bold">{advance.propertyName || 'عقار المالك'}</span>
                </p>
              </div>
            </div>
            <button
              id="advance-deduction-modal-close-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#132238] hover:bg-rose-500/20 text-[#CBD5E1] hover:text-rose-300 border border-[#D4A84F]/30 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              title="إغلاق النافذة (Esc)"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Unified Financial Metrics Bar (Always Visible) */}
          <div className="bg-[#08111F] px-4 py-3 border-b border-[#D4A84F]/20 grid grid-cols-3 gap-2 sm:gap-4 shrink-0 text-center">
            {/* Original Advance Value */}
            <div className="p-2.5 rounded-xl bg-[#132238]/70 border border-slate-700/50">
              <span className="text-[10px] sm:text-xs text-slate-400 font-extrabold block">قيمة السلفة الأصلية</span>
              <span className="text-sm sm:text-base md:text-lg font-black font-mono text-amber-300">
                {originalAmount.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
              </span>
            </div>

            {/* Deducted Amount */}
            <div className="p-2.5 rounded-xl bg-[#132238]/70 border border-emerald-700/40">
              <span className="text-[10px] sm:text-xs text-emerald-400 font-extrabold block">المبلغ المخصوم</span>
              <span className="text-sm sm:text-base md:text-lg font-black font-mono text-emerald-400">
                {currentTotalDeducted.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
              </span>
            </div>

            {/* Remaining Amount */}
            <div className="p-2.5 rounded-xl bg-[#132238]/70 border border-amber-600/50">
              <span className="text-[10px] sm:text-xs text-amber-300 font-extrabold block">المتبقي القابل للخصم</span>
              <span className="text-sm sm:text-base md:text-lg font-black font-mono text-[#D4A84F]">
                {remainingAmount.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
              </span>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="px-4 pt-3 pb-2 bg-[#0E1A2C] border-b border-[#D4A84F]/30 flex items-center gap-2 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('deduct');
                setPreviewEntry(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'deduct' && !previewEntry
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-[#132238] text-slate-300 hover:text-white border border-[#D4A84F]/30'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>تنفيذ الخصم</span>
              {remainingAmount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'deduct' && !previewEntry ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/30 text-emerald-300'
                }`}>
                  متبقي {remainingAmount.toLocaleString('ar-EG')}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('receipts');
                setPreviewEntry(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'receipts'
                  ? 'bg-gradient-to-r from-[#D4A84F] to-[#b38734] text-slate-950 shadow-md shadow-[#D4A84F]/20'
                  : 'bg-[#132238] text-slate-300 hover:text-white border border-[#D4A84F]/30'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>سندات الخصم</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'receipts' ? 'bg-slate-950 text-amber-300' : 'bg-[#D4A84F]/20 text-amber-300'
              }`}>
                {deductionsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('revert');
                setPreviewEntry(null);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'revert'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-md shadow-rose-600/20'
                  : 'bg-[#132238] text-slate-300 hover:text-white border border-[#D4A84F]/30'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>تسجيل عملية الرجوع</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div 
            ref={scrollBodyRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm"
          >
            {/* TAB 1: EXECUTE DEDUCTION */}
            {activeTab === 'deduct' && (
              remainingAmount <= 0 ? (
                <div className="p-8 text-center bg-[#132238]/80 border border-emerald-500/50 rounded-2xl space-y-4 shadow-lg">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-emerald-300">
                      تم خصم وتسوية كامل رصيد هذه السلفة بنجاح!
                    </h3>
                    <p className="text-xs text-slate-300 font-extrabold">
                      تم خصم كامل المبلغ ({originalAmount.toLocaleString('ar-EG')} ج.م) ولم يعد هناك أي رصيد متبقي قابل للخصم.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('receipts')}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#b38734] hover:from-[#e0b75c] hover:to-[#c4953d] text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>عرض سندات الخصم المسجلة ({deductionsList.length})</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Method Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-[#CBD5E1]">
                      اختر طريقة الخصم / السداد:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {DEDUCTION_METHODS.map((method) => {
                        const Icon = method.icon;
                        const isSelected = deductionMethod === method.id;
                        return (
                          <div
                            key={method.id}
                            onClick={() => setDeductionMethod(method.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                              isSelected
                                ? method.id === 'خصم من المستحق'
                                  ? 'bg-emerald-950/40 border-emerald-500/70 ring-1 ring-emerald-500/40'
                                  : 'bg-amber-950/40 border-amber-500/70 ring-1 ring-amber-500/40'
                                : 'bg-[#132238] border-slate-700/60 hover:border-slate-500/60 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected 
                                ? method.id === 'خصم من المستحق' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                                : 'bg-[#08111F] text-slate-400'
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs sm:text-sm font-black ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                  {method.title}
                                </span>
                                {isSelected && (
                                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {method.subtitle}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Entitlement Status Notice */}
                  {isFromEntitlement && (
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                      hasSufficientEntitlement 
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <Coins className={`w-5 h-5 shrink-0 ${hasSufficientEntitlement ? 'text-emerald-400' : 'text-rose-400'}`} />
                        <div>
                          <span className="text-xs font-bold block">رصيد صافي مستحقات الإيجار المتاحة للمالك:</span>
                          <span className="text-sm font-black font-mono text-white">
                            {Math.max(0, availableNetEntitlement).toLocaleString('ar-EG')} ج.م
                          </span>
                        </div>
                      </div>
                      {!hasSufficientEntitlement && (
                        <div className="text-left text-[11px] font-bold text-rose-300 max-w-[200px]">
                          ⚠️ الرصيد المتاح لا يكفي لخصم المبلغ المطلوب
                        </div>
                      )}
                    </div>
                  )}

                  {/* Deduction Amount Input with Quick Presets */}
                  <div className="p-4 rounded-2xl bg-[#132238] border border-[#D4A84F]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#CBD5E1]">
                        المبلغ المراد خصمه الآن (ج.م):
                      </label>
                      <span className="text-xs font-mono text-amber-300 font-extrabold">
                        الحد الأقصى المتاح للخصم: {remainingAmount.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={remainingAmount}
                        step="any"
                        required
                        value={settlementAmount}
                        onChange={(e) => setSettlementAmount(e.target.value)}
                        placeholder="أدخل المبلغ المراد خصمه..."
                        className="w-full px-4 py-3 rounded-xl bg-[#08111F] border border-[#D4A84F]/40 text-base sm:text-lg font-mono font-black text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        جنيه مصري
                      </div>
                    </div>

                    {/* Quick Amount Presets */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 font-bold">تحديد سريع:</span>
                      <button
                        type="button"
                        onClick={() => setSettlementAmount(String(remainingAmount))}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black cursor-pointer"
                      >
                        كامل المتبقي ({remainingAmount.toLocaleString('ar-EG')})
                      </button>
                      {remainingAmount >= 2 && (
                        <button
                          type="button"
                          onClick={() => setSettlementAmount(String(Math.floor(remainingAmount / 2)))}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-black cursor-pointer"
                        >
                          نصف المتبقي ({Math.floor(remainingAmount / 2).toLocaleString('ar-EG')})
                        </button>
                      )}
                      {remainingAmount >= 4 && (
                        <button
                          type="button"
                          onClick={() => setSettlementAmount(String(Math.floor(remainingAmount / 4)))}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-black cursor-pointer"
                        >
                          ربع المتبقي ({Math.floor(remainingAmount / 4).toLocaleString('ar-EG')})
                        </button>
                      )}
                    </div>

                    {/* Impact preview */}
                    {parsedAmount > 0 && parsedAmount <= remainingAmount && (
                      <div className="p-2.5 rounded-xl bg-[#08111F]/80 border border-slate-700/60 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-300">الرصيد المتبقي بعد تنفيذ هذا الخصم:</span>
                        <span className={`font-mono font-black ${remainingAmount - parsedAmount === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                          {(remainingAmount - parsedAmount).toLocaleString('ar-EG')} ج.م {remainingAmount - parsedAmount === 0 ? '(اكتملت التسوية)' : '(ستبقى السلفة قابلة للخصم لاحقاً)'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Date & Ref */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-[#CBD5E1] mb-1.5">
                        تاريخ الخصم / السداد:
                      </label>
                      <input
                        type="date"
                        required
                        value={deductionDate}
                        onChange={(e) => setDeductionDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#132238] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] focus:border-[#D4A84F] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-[#CBD5E1] mb-1.5">
                        رقم المرجع / الإيصال (اختياري):
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: REC-402..."
                        value={deductionRef}
                        onChange={(e) => setDeductionRef(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#132238] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] focus:border-[#D4A84F] outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-black text-[#CBD5E1] mb-1.5">
                      ملاحظات وبيان التسوية (اختياري):
                    </label>
                    <input
                      type="text"
                      placeholder="أي تفاصيل أو ملاحظات حول حركة الخصم..."
                      value={deductionNotes}
                      onChange={(e) => setDeductionNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#132238] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] focus:border-[#D4A84F] outline-none"
                    />
                  </div>

                  {/* Submit Action */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !isAmountValid || (isFromEntitlement && !hasSufficientEntitlement)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                          <span>جاري تسجيل وتأكيد الخصم...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 stroke-[2.5]" />
                          <span>
                            تأكيد {isFromEntitlement ? 'خصم' : 'سداد'} مبلغ ({parsedAmount > 0 ? parsedAmount.toLocaleString('ar-EG') : '0'} ج.م)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )
            )}

            {/* TAB 2: RECEIPTS & VOUCHERS */}
            {activeTab === 'receipts' && (
              previewEntry ? (
                /* Voucher In-Modal Preview Mode */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between bg-[#132238] p-3 rounded-xl border border-[#D4A84F]/35 shadow-md">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#D4A84F]" />
                      <span className="text-xs font-black text-amber-300">
                        معاينة تفاصيل سند الخصم #{previewEntry.deductionRef || (previewEntry.id || '').slice(-6)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintAdvanceVoucher({ advance, specificEntry: previewEntry, currentUser })}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#D4A84F] to-[#b38734] hover:from-[#e0b75c] hover:to-[#c4953d] text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>طباعة السند</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewEntry(null)}
                        className="px-3 py-1.5 bg-[#08111F] hover:bg-[#1C2E46] text-slate-300 hover:text-white border border-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                      >
                        الرجوع للقائمة
                      </button>
                    </div>
                  </div>

                  {/* Printable-style Preview Card */}
                  <div className="bg-white text-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-[#b38734] shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b-2 border-[#b38734] pb-3">
                      <div>
                        <h4 className="text-base font-black text-slate-900">مؤسسة رميح للمحاماة والاستشارات القانونية</h4>
                        <p className="text-xs text-slate-600 font-bold">سند خصم وتسوية سلفة مالك</p>
                      </div>
                      <div className="text-left font-mono text-xs font-bold text-amber-800">
                        <div>رقم السند: {previewEntry.deductionRef ? `DED-${previewEntry.deductionRef}` : `ADV-${(advance.id || '').slice(-6).toUpperCase()}`}</div>
                        <div>تاريخ الإصدار: {previewEntry.deductionDate}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                      <div>
                        <span className="text-[10px] text-amber-900 font-bold block">اسم المالك</span>
                        <span className="text-xs font-black text-slate-900">{advance.ownerName || 'مالك العقار'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-900 font-bold block">العقار المرتبط</span>
                        <span className="text-xs font-bold text-slate-900">{advance.propertyName || 'عقار المالك'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-900 font-bold block">مبلغ الخصم</span>
                        <span className="text-sm font-black font-mono text-emerald-800">{(previewEntry.amount || 0).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-900 font-bold block">طريقة التسوية</span>
                        <span className="text-xs font-bold text-slate-900">{previewEntry.deductionMethod || 'خصم من المستحق'}</span>
                      </div>
                    </div>

                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div className="text-slate-700"><strong>المبلغ بالحروف:</strong> {tafqeetNumber(previewEntry.amount || 0)}</div>
                      {previewEntry.deductionNotes && (
                        <div className="text-slate-700"><strong>البيان والملاحظات:</strong> {previewEntry.deductionNotes}</div>
                      )}
                      <div className="text-slate-700"><strong>المحاسب المسؤول:</strong> {previewEntry.deductedBy || currentUser?.fullName || 'المحاسب المالي'}</div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-3 text-center text-xs font-bold text-slate-700">
                      <div className="space-y-6">
                        <span>المستلم / المالك</span>
                        <div className="border-b border-dashed border-slate-300"></div>
                      </div>
                      <div className="space-y-6">
                        <span>المحاسب المالي</span>
                        <div className="border-b border-dashed border-slate-300"></div>
                      </div>
                      <div className="space-y-6">
                        <span>الختم المعتمد</span>
                        <div className="border-b border-dashed border-slate-300"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#D4A84F]/30 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-[#F8F9FB]">
                        سندات الخصم والتسوية الخاصة بهذه السلفة
                      </h3>
                      <p className="text-xs text-slate-400 font-bold">
                        معاينة وطباعة سندات الخصم المسجلة لكل حركة خصم
                      </p>
                    </div>
                    <span className="text-xs font-mono font-black text-[#D4A84F]">
                      {deductionsList.length} سندات مسجلة
                    </span>
                  </div>

                {deductionsList.length === 0 ? (
                  <div className="p-8 text-center bg-[#132238]/40 border border-slate-700/60 rounded-2xl space-y-3">
                    <Receipt className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-extrabold">
                      لم يتم تسجيل أي سندات خصم لهذه السلفة حتى الآن
                    </p>
                    {remainingAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('deduct')}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black rounded-lg text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>تنفيذ أول عملية خصم الآن</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deductionsList.map((ded, index) => (
                      <div 
                        key={ded.id || index}
                        className="p-4 rounded-2xl bg-[#132238] border border-[#D4A84F]/30 hover:border-[#D4A84F]/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-[#08111F] text-amber-300 font-mono font-bold text-xs border border-[#D4A84F]/30">
                              سند #{index + 1} {ded.deductionRef ? `(${ded.deductionRef})` : ''}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${getDeductionMethodBadge(ded.deductionMethod)}`}>
                              {ded.deductionMethod || 'خصم من المستحق'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {ded.deductionDate}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-base font-black font-mono text-emerald-400">
                              {(ded.amount || 0).toLocaleString('ar-EG')} ج.م
                            </span>
                            {ded.deductedBy && (
                              <span className="text-[11px] text-slate-400">
                                بواسطة: {ded.deductedBy}
                              </span>
                            )}
                          </div>

                          {ded.deductionNotes && (
                            <p className="text-xs text-slate-300 font-medium">
                              البيان: {ded.deductionNotes}
                            </p>
                          )}
                        </div>

                        {/* Actions for this receipt */}
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setPreviewEntry(ded)}
                            className="px-3 py-1.5 rounded-xl bg-[#08111F] hover:bg-[#1C2E46] text-amber-300 hover:text-amber-200 border border-[#D4A84F]/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="معاينة تفاصيل سند الخصم"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#D4A84F]" />
                            <span>معاينة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrintAdvanceVoucher({ advance, specificEntry: ded, currentUser })}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#b38734] hover:from-[#e0b75c] hover:to-[#c4953d] text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                            title="طباعة سند الخصم هذا"
                          >
                            <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                            <span>طباعة</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            )}

            {/* TAB 3: REVERT DEDUCTION */}
            {activeTab === 'revert' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#D4A84F]/20 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-rose-300">
                      تسجيل الرجوع وإلغاء الخصومات
                    </h3>
                    <p className="text-xs text-slate-400">
                      يمكنك إلغاء حركة خصم محددة أو إلغاء كافة الخصومات لإعادة السلفة جارية
                    </p>
                  </div>
                </div>

                {deductionsList.length === 0 ? (
                  <div className="p-8 text-center bg-[#132238]/40 border border-slate-700/60 rounded-2xl space-y-3">
                    <RotateCcw className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-extrabold">
                      هذه السلفة جارية وغير مخصومة حالياً، لا توجد حركات خصم مسجلة للرجوع عنها.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        تنبيه: عند الرجوع عن الخصم، ستتم إعادة المبلغ المسترجع فوراً إلى رصيد السلفة غير المخصومة وتحديث كافة الكشوفات والمستحقات.
                      </span>
                    </div>

                    {/* Master Revert All Button */}
                    <div className="p-4 rounded-2xl bg-[#08111F] border border-rose-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs sm:text-sm font-black text-white block">
                          الرجوع عن كافة الخصومات بالكامل
                        </span>
                        <span className="text-[11px] text-slate-400">
                          إلغاء جميع حركات الخصم ({currentTotalDeducted.toLocaleString('ar-EG')} ج.م) وإعادة السلفة إلى حالتها الجارية الأصلية
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRevertAll}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-95 flex items-center gap-1.5 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إلغاء الخصم كلياً</span>
                      </button>
                    </div>

                    {/* Individual Deductions List for Reversal */}
                    <div className="space-y-2.5 pt-2">
                      <span className="text-xs font-black text-slate-300 block">
                        أو إلغاء حركة خصم معينة بالتحديد:
                      </span>
                      {deductionsList.map((ded, idx) => (
                        <div
                          key={ded.id || idx}
                          className="p-3.5 rounded-xl bg-[#132238] border border-slate-700/60 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-300">
                                حركة #{idx + 1} - {ded.deductionDate}
                              </span>
                              <span className="text-xs font-bold text-slate-300">
                                ({ded.deductionMethod || 'خصم من المستحق'})
                              </span>
                            </div>
                            <span className="text-sm font-black font-mono text-emerald-400 block">
                              {(ded.amount || 0).toLocaleString('ar-EG')} ج.م
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRevertSingle(ded.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>استرجاع هذه الحركة</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Bottom Bar */}
          <div className="p-3.5 bg-[#08111F] border-t border-[#D4A84F]/20 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D4A84F]" />
              <span>مؤسسة رميح للمحاماة — النظام المالي والعقاري</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#132238] hover:bg-[#1E293B] text-slate-200 font-bold border border-slate-700 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
