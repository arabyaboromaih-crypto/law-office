import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, X, Search, Calendar, Coins, Printer, 
  CheckCircle, FileText, User, Building, Phone, Clock,
  ArrowRight, ShieldCheck, AlertCircle, Sparkles, Filter, Download,
  Eye, Copy, Check
} from 'lucide-react';
import { ReCommissionReceipt, ReCommissionStatus, User as AuthUser } from '../../types';

interface PropertyCommissionReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: {
    id: string;
    name: string;
    ownerId?: string;
    ownerName?: string;
  } | null;
  commissionStatuses: ReCommissionStatus[];
  currentUser?: AuthUser;
  onOpenCollect?: () => void;
}

const AR_MONTHS_MAP: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
};

const formatMonthYearAr = (myStr?: string) => {
  if (!myStr) return 'غير محدد';
  if (myStr === 'all' || myStr === 'حساب إجمالي شامل') return 'حساب إجمالي شامل';
  if (!myStr.includes('-')) return myStr;
  const [y, m] = myStr.split('-');
  return `${AR_MONTHS_MAP[m] || m} ${y}`;
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
  if (norm.includes('voda') || norm.includes('كاش') || norm.includes('اتصالات')) {
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

  const integerPart = Math.floor(Math.abs(num));
  const fractionPart = Math.round((Math.abs(num) - integerPart) * 100);

  let output = '';
  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    output += `${convertThreeDigits(millions)} مليون `;
  }

  const thousands = Math.floor((integerPart % 1000000) / 1000);
  if (thousands > 0) {
    if (output) output += 'و ';
    if (thousands === 1) output += 'ألف ';
    else if (thousands === 2) output += 'ألفان ';
    else if (thousands >= 3 && thousands <= 10) output += `${convertThreeDigits(thousands)} آلاف `;
    else output += `${convertThreeDigits(thousands)} ألف `;
  }

  const rest = integerPart % 1000;
  if (rest > 0) {
    if (output) output += 'و ';
    output += convertThreeDigits(rest);
  }

  if (!output) output = 'صفر';
  output += ' جنيه مصري';

  if (fractionPart > 0) {
    output += ` و ${convertThreeDigits(fractionPart)} قرشاً`;
  }

  return `${output} فقط لا غير`;
};

export default function PropertyCommissionReceiptsModal({
  isOpen,
  onClose,
  property,
  commissionStatuses,
  currentUser,
  onOpenCollect
}: PropertyCommissionReceiptsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<ReCommissionReceipt | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);

  // Extract all receipts strictly for this property by actual property ID
  const propertyReceipts = useMemo(() => {
    if (!property?.id) return [];
    const actualPropId = String(property.id).trim();

    const list: ReCommissionReceipt[] = [];

    (commissionStatuses || []).forEach(cs => {
      if (String(cs.propertyId).trim() !== actualPropId) return;

      // 1. If explicit receipts array is recorded
      if (Array.isArray(cs.receipts) && cs.receipts.length > 0) {
        cs.receipts.forEach(r => {
          list.push({
            id: r.id || `${cs.id}_${r.date}_${r.amount}`,
            receiptNumber: r.receiptNumber || cs.referenceNumber || `COM-${(r.forMonthYear || cs.forMonthYear || '').replace(/[^0-9]/g, '') || 'ALL'}-${String(r.id || cs.id).slice(-4)}`,
            propertyId: actualPropId,
            propertyName: r.propertyName || cs.propertyName || property.name,
            ownerId: r.ownerId || cs.ownerId || property.ownerId,
            ownerName: r.ownerName || cs.ownerName || property.ownerName,
            forMonthYear: r.forMonthYear || cs.forMonthYear || 'حساب إجمالي شامل',
            amount: Number(r.amount) || 0,
            date: r.date || cs.collectionDate || cs.updatedAt || '',
            paymentMethod: r.paymentMethod || cs.paymentMethod || 'نقدي',
            referenceNumber: r.referenceNumber || cs.referenceNumber || '',
            notes: r.notes || cs.notes || '',
            collectedBy: r.collectedBy || cs.updatedBy || 'المسؤول',
            createdAt: r.createdAt || cs.updatedAt || ''
          });
        });
      } else if (
        cs.isCollectedFromOwner || 
        (cs.amountCollectedFromOwner && cs.amountCollectedFromOwner > 0) || 
        (cs.paidAmount && cs.paidAmount > 0) ||
        cs.status === 'collected'
      ) {
        // 2. Fallback to status document itself as receipt
        list.push({
          id: cs.id,
          receiptNumber: cs.referenceNumber || `COM-${(cs.forMonthYear || '').replace(/[^0-9]/g, '') || 'ALL'}-${cs.id.slice(-4)}`,
          propertyId: actualPropId,
          propertyName: cs.propertyName || property.name,
          ownerId: cs.ownerId || property.ownerId,
          ownerName: cs.ownerName || property.ownerName,
          forMonthYear: cs.forMonthYear || 'حساب إجمالي شامل',
          amount: Number(cs.amountCollectedFromOwner || cs.paidAmount || 0),
          date: cs.collectionDate || cs.updatedAt || '',
          paymentMethod: cs.paymentMethod || 'نقدي',
          referenceNumber: cs.referenceNumber || '',
          notes: cs.notes || '',
          collectedBy: cs.updatedBy || 'المسؤول',
          createdAt: cs.updatedAt || ''
        });
      }
    });

    // Sort newest date first
    return list.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
  }, [property, commissionStatuses]);

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return propertyReceipts.filter(rec => {
      if (filterMethod !== 'all') {
        const methodNorm = (rec.paymentMethod || '').toLowerCase();
        if (!methodNorm.includes(filterMethod.toLowerCase())) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchNumber = (rec.receiptNumber || '').toLowerCase().includes(q);
        const matchRef = (rec.referenceNumber || '').toLowerCase().includes(q);
        const matchNotes = (rec.notes || '').toLowerCase().includes(q);
        const matchMonth = (rec.forMonthYear || '').toLowerCase().includes(q) || formatMonthYearAr(rec.forMonthYear).toLowerCase().includes(q);
        const matchCollector = (rec.collectedBy || '').toLowerCase().includes(q);
        if (!matchNumber && !matchRef && !matchNotes && !matchMonth && !matchCollector) {
          return false;
        }
      }

      return true;
    });
  }, [propertyReceipts, filterMethod, searchTerm]);

  // Statistics
  const totalReceiptsCount = propertyReceipts.length;
  const totalCollectedAmount = propertyReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const latestDate = propertyReceipts[0]?.date || 'لا يوجد';

  const handleCopyReceiptNumber = (rec: ReCommissionReceipt) => {
    navigator.clipboard?.writeText(rec.receiptNumber || rec.id);
    setCopiedReceiptId(rec.id);
    setTimeout(() => setCopiedReceiptId(null), 2000);
  };

  const handlePrintReceipt = (rec: ReCommissionReceipt) => {
    setSelectedReceipt(rec);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  if (!isOpen || !property) return null;

  return (
    <AnimatePresence>
      <div 
        id="property-commission-receipts-modal-overlay"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0A111E] border-2 border-purple-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/80 via-[#0F1A2E] to-slate-900 border-b border-purple-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border-2 border-purple-400/50 flex items-center justify-center text-purple-300 shadow-md">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-white">سندات تحصيل العمولات</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                    {property.name}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                  <span>المالك: <strong className="text-amber-300">{property.ownerName || 'غير محدد'}</strong></span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 font-mono text-[11px]">كود العقار: {property.id}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenCollect && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCollect();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md border border-emerald-400/50 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-300" />
                  <span>تحصيل عمولة</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="p-4 bg-purple-950/20 border-b border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-[#050C16] p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-purple-400" /> إجمالي السندات
              </span>
              <span className="text-lg font-black text-white font-mono mt-1">
                {totalReceiptsCount} <span className="text-xs font-normal text-slate-400">سند</span>
              </span>
            </div>

            <div className="bg-[#050C16] p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" /> إجمالي المبالغ المحصلة
              </span>
              <span className="text-lg font-black text-emerald-400 font-mono mt-1">
                {totalCollectedAmount.toLocaleString('ar-EG')} <span className="text-xs font-normal text-emerald-200">ج.م</span>
              </span>
            </div>

            <div className="bg-[#050C16] p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> آخر تاريخ تحصيل
              </span>
              <span className="text-sm font-black text-amber-300 font-mono mt-1">
                {latestDate}
              </span>
            </div>

            <div className="bg-[#050C16] p-3 rounded-2xl border border-white/10 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> مصدر السندات
              </span>
              <span className="text-xs font-black text-sky-300 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                قاعدة بيانات سحابية موثقة
              </span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="p-3 sm:p-4 bg-[#070E18] border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم السند، المرجع، الشهر..."
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#0B1525] border border-white/15 text-white text-xs font-bold focus:border-purple-400 outline-none transition-all placeholder:text-slate-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-purple-400" /> طريقة الدفع:
              </span>
              <div className="flex items-center gap-1 bg-[#0B1525] p-1 rounded-xl border border-white/15">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'نقد', label: 'نقدي' },
                  { id: 'تحويل', label: 'تحويل بنكي' },
                  { id: 'إنستا', label: 'إنستاباي' },
                  { id: 'كاش', label: 'محافظ إلكترونية' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterMethod(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      filterMethod === opt.id
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Receipts Content */}
          <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3">
            {filteredReceipts.length === 0 ? (
              <div className="py-12 px-4 text-center bg-[#070E18] rounded-2xl border border-white/10 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border-2 border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
                  <Receipt className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-black text-white">
                  {searchTerm || filterMethod !== 'all' 
                    ? 'لا توجد سندات مطابقة لمعايير البحث الحالية'
                    : 'لا توجد سندات تحصيل مسجلة لهذا العقار حتى الآن'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {searchTerm || filterMethod !== 'all'
                    ? 'جرب تعديل كلمة البحث أو فلتر طريقة الدفع لعرض المزيد من السجلات.'
                    : 'عند تحصيل عمولة هذا العقار عبر زر «تحصيل العمولة»، سيتم إصدار سند التحصيل تلقائياً وحفظه في السحاب وتوثيقه هنا.'}
                </p>
                {onOpenCollect && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCollect();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs shadow-md border border-emerald-400/50 inline-flex items-center gap-2 cursor-pointer mt-2"
                  >
                    <Coins className="w-4 h-4 text-amber-300" />
                    <span>تحصيل عمولة لهذا العقار الآن</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-hidden rounded-2xl border border-white/15 bg-[#070E18]">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0F1A2E] text-slate-300 font-extrabold border-b border-white/15">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">رقم السند</th>
                        <th className="p-3">الشهر المستحق</th>
                        <th className="p-3 text-emerald-400 font-black">المبلغ المحصل</th>
                        <th className="p-3">تاريخ التحصيل</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3">المحصل / الملاحظات</th>
                        <th className="p-3 text-center">معاينة / طباعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredReceipts.map((rec, idx) => (
                        <tr key={rec.id || idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-mono font-bold">
                            {idx + 1}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-lg border border-purple-500/30">
                                {rec.receiptNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyReceiptNumber(rec)}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                                title="نسخ رقم السند"
                              >
                                {copiedReceiptId === rec.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {rec.referenceNumber && rec.referenceNumber !== rec.receiptNumber && (
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                                مرجع: {rec.referenceNumber}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-white">
                            {formatMonthYearAr(rec.forMonthYear)}
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {rec.amount.toLocaleString('ar-EG')}
                            </span>
                            <span className="text-[10px] text-emerald-300 font-bold mr-1">ج.م</span>
                          </td>
                          <td className="p-3 text-slate-200 font-mono font-bold">
                            {rec.date || '—'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${getPaymentMethodBadgeColor(rec.paymentMethod)}`}>
                              {rec.paymentMethod || 'نقدي'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-slate-300 block font-bold text-[11px]">
                              {rec.collectedBy || 'المسؤول'}
                            </span>
                            {rec.notes && (
                              <span className="text-slate-400 text-[10px] block line-clamp-1 mt-0.5" title={rec.notes}>
                                {rec.notes}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedReceipt(rec)}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1"
                                title="عرض تفاصيل السند"
                              >
                                <Eye className="w-3.5 h-3.5 text-purple-400" />
                                <span>معاينة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintReceipt(rec)}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1"
                                title="طباعة السند الرسمي"
                              >
                                <Printer className="w-3.5 h-3.5 text-amber-400" />
                                <span>طباعة</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-2.5">
                  {filteredReceipts.map((rec, idx) => (
                    <div 
                      key={rec.id || idx}
                      className="bg-[#070E18] p-3.5 rounded-2xl border border-white/15 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white/10 text-slate-300 text-[11px] font-mono font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-mono font-black text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-lg border border-purple-500/30 text-xs">
                              {rec.receiptNumber}
                            </span>
                          </div>
                          <span className="text-xs text-white font-bold block mt-1">
                            الشهر: {formatMonthYearAr(rec.forMonthYear)}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="font-mono font-black text-emerald-400 text-sm block">
                            {rec.amount.toLocaleString('ar-EG')} ج.م
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border inline-block mt-1 ${getPaymentMethodBadgeColor(rec.paymentMethod)}`}>
                            {rec.paymentMethod || 'نقدي'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-white/5 p-2 rounded-xl text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-400 block">تاريخ التحصيل</span>
                          <span className="font-mono font-bold text-white">{rec.date || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">المسؤول / المحصل</span>
                          <span className="font-bold text-white">{rec.collectedBy || 'المسؤول'}</span>
                        </div>
                        {rec.referenceNumber && rec.referenceNumber !== rec.receiptNumber && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-400 block">رقم المرجع / الشيك</span>
                            <span className="font-mono font-bold text-amber-300">{rec.referenceNumber}</span>
                          </div>
                        )}
                        {rec.notes && (
                          <div className="col-span-2">
                            <span className="text-[10px] text-slate-400 block">ملاحظات</span>
                            <span className="text-slate-200 text-xs">{rec.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(rec)}
                          className="flex-1 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-black transition-all flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-purple-400" />
                          <span>معاينة السند</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(rec)}
                          className="flex-1 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>طباعة</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 bg-[#070E18] border-t border-white/10 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              عدد السندات المعروضة: <strong className="text-white font-mono">{filteredReceipts.length}</strong> من إجمالي <strong className="text-white font-mono">{totalReceiptsCount}</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </motion.div>

        {/* Detailed Official Printable Receipt Modal */}
        {selectedReceipt && (
          <div 
            className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            dir="rtl"
          >
            <div className="bg-white text-slate-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6 print:m-0 print:p-4 print:w-full print:max-w-none print:shadow-none border border-slate-200">
              {/* Receipt Top Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
                  <p className="text-xs text-slate-600 font-bold">قسم إدارة الأملاك والعقارات والتحصيلات القانونية</p>
                  <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-950 font-black text-xs border border-purple-300 mt-1">
                    سند تحصيل عمولة إدارة عقارية
                  </span>
                </div>
                <div className="text-left space-y-1 font-mono">
                  <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-300 text-center">
                    <span className="text-[10px] text-slate-500 block font-sans">رقم السند</span>
                    <strong className="text-sm text-purple-900 font-black">{selectedReceipt.receiptNumber}</strong>
                  </div>
                  <div className="text-[11px] text-slate-600 text-center font-sans mt-1">
                    التاريخ: <strong>{selectedReceipt.date || new Date().toISOString().slice(0, 10)}</strong>
                  </div>
                </div>
              </div>

              {/* Receipt Body Info */}
              <div className="space-y-4 text-sm">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <span className="text-slate-600 font-bold">استلمنا من السيد المالك:</span>
                    <span className="text-slate-950 font-black text-base">{selectedReceipt.ownerName || property.ownerName || '—'}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">بخصوص العقار:</span>
                    <span className="text-slate-950 font-black text-sm">{property.name} <span className="font-mono text-slate-500 text-xs">({property.id})</span></span>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">المبلغ المستلم:</span>
                    <div className="text-left sm:text-right">
                      <span className="text-emerald-700 font-black font-mono text-xl">
                        {selectedReceipt.amount.toLocaleString('ar-EG')} ج.م
                      </span>
                      <p className="text-xs text-slate-600 font-bold mt-0.5">
                        فقط: {tafqeetNumber(selectedReceipt.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">وذلك مقابل:</span>
                    <span className="text-slate-900 font-extrabold">
                      عمولة إدارة وتحصيل إيجارات عن شهر ({formatMonthYearAr(selectedReceipt.forMonthYear)})
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">طريقة السداد / المرجع:</span>
                    <span className="text-slate-900 font-bold">
                      {selectedReceipt.paymentMethod || 'نقدي'} 
                      {selectedReceipt.referenceNumber ? ` (مرجع: ${selectedReceipt.referenceNumber})` : ''}
                    </span>
                  </div>

                  {selectedReceipt.notes && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-slate-600 font-bold block text-xs">ملاحظات:</span>
                      <span className="text-slate-800 text-xs font-medium">{selectedReceipt.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-300 text-xs text-center">
                <div className="space-y-8">
                  <span className="font-bold text-slate-700 block">المستلم / المحصل</span>
                  <p className="font-black text-slate-900">{selectedReceipt.collectedBy || currentUser?.fullName || 'المسؤول'}</p>
                </div>
                <div className="space-y-8">
                  <span className="font-bold text-slate-700 block">اعتماد الإدارة والختم</span>
                  <div className="w-20 h-20 border-2 border-dashed border-slate-400 rounded-full mx-auto flex items-center justify-center text-[10px] text-slate-400">
                    الختم الرسمي
                  </div>
                </div>
              </div>

              {/* Modal Buttons (Hidden in Print) */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 print:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  رجوع لقائمة السندات
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>طباعة السند الآن</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
