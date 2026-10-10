/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, X, Printer, Calendar, Building, User, Wallet,
  ShieldCheck, CheckCircle2, ChevronRight, Hash, ArrowDownRight
} from 'lucide-react';
import { RePayout, User as AuthUser } from '../../types';
import { generatePayoutReceiptVoucherHTML } from './PropertyPayoutReceiptsModal';

interface SinglePayoutVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  payouts: RePayout[]; // One or more vouchers for the row
  selectedPayoutId?: string;
  property?: { id: string; name: string } | null;
  owner?: { id: string; name: string; phone?: string; bankAccount?: string } | null;
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
      return method || 'تحويل بنكي';
  }
};

// Tafqeet in Arabic
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

export const SinglePayoutVoucherModal: React.FC<SinglePayoutVoucherModalProps> = ({
  isOpen,
  onClose,
  payouts = [],
  selectedPayoutId,
  property,
  owner,
  currentUser
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(0);

  React.useEffect(() => {
    if (selectedPayoutId && payouts.length > 0) {
      const idx = payouts.findIndex(p => p.id === selectedPayoutId || p.receiptNumber === selectedPayoutId);
      if (idx !== -1) setActiveIdx(idx);
    } else {
      setActiveIdx(0);
    }
  }, [selectedPayoutId, payouts]);

  if (!isOpen || payouts.length === 0) return null;

  const currentPayout = payouts[activeIdx] || payouts[0];
  const receiptNum = currentPayout.receiptNumber || `PAY-${currentPayout.id.slice(-6).toUpperCase()}`;
  const ownerName = owner?.name || currentPayout.ownerName || 'المالك الموقر';
  const propertyName = property?.name || currentPayout.propertyName || 'العقار المعتمد';
  const monthName = currentPayout.monthNameAr || formatMonthYearAr(currentPayout.forMonthYear);
  const payoutDateFormatted = currentPayout.payoutDate || (currentPayout.createdAt ? currentPayout.createdAt.slice(0, 10) : '—');
  const amountPaid = currentPayout.netAmountPaid || 0;
  const methodLabel = getPaymentMethodLabel(currentPayout.paymentMethod);
  const issuerName = currentPayout.createdBy || currentUser?.fullName || 'الإدارة المالية';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة سند الصرف');
      return;
    }
    const htmlContent = generatePayoutReceiptVoucherHTML({
      payout: currentPayout,
      property: property || (currentPayout.propertyId ? { id: currentPayout.propertyId, name: propertyName } : null),
      owner: owner || (currentPayout.ownerId ? { id: currentPayout.ownerId, name: ownerName } : null),
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-4xl bg-[#08111F] border border-[#D4A84F]/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#132238] via-[#0D1829] to-[#132238] border-b border-[#D4A84F]/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#D4A84F]/15 border border-[#D4A84F]/35 flex items-center justify-center text-[#D4A84F] shadow-md shadow-[#D4A84F]/10">
                <Receipt className="w-6 h-6 text-[#D4A84F]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[#F8F9FB]">
                    سند صرف إيجار معتمد
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/35 text-xs font-mono font-black">
                    {receiptNum}
                  </span>
                </div>
                <p className="text-xs text-[#9EA7B8] font-bold mt-0.5">
                  سند مسجل فعلياً في قاعدة البيانات • {monthName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/25 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة السند</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-[#132238] hover:bg-rose-500/20 text-[#9EA7B8] hover:text-rose-400 border border-[#D4A84F]/20 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Multiple Vouchers Tabs (if more than 1 voucher for this month) */}
          {payouts.length > 1 && (
            <div className="px-5 py-2.5 bg-[#0D1829] border-b border-[#D4A84F]/15 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold text-[#9EA7B8] shrink-0">سندات الشهر ({payouts.length}):</span>
              {payouts.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    activeIdx === idx
                      ? 'bg-[#D4A84F] text-slate-950 shadow-md font-black'
                      : 'bg-[#132238] text-[#9EA7B8] hover:text-white border border-[#D4A84F]/20'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  <span>{p.receiptNumber || `سند ${idx + 1}`}</span>
                  <span className="text-[10px]">({(p.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م)</span>
                </button>
              ))}
            </div>
          )}

          {/* Printable Voucher Paper Preview */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#040811]/70">
            <div className="max-w-3xl mx-auto bg-[#ffffff] text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border-2 border-[#b45309] relative">
              {/* Decorative dashed inner border */}
              <div className="absolute inset-2 border border-dashed border-[#d4a84f] rounded-xl pointer-events-none" />

              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                <span className="text-6xl sm:text-7xl font-black text-amber-500/[0.04] -rotate-12 whitespace-nowrap">
                  سند صرف معتمد
                </span>
              </div>

              {/* Voucher Header */}
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-slate-200 gap-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    مؤسسة رميح للمحاماة والاستشارات القانونية
                  </h3>
                  <p className="text-xs font-bold text-[#b45309] mt-0.5">
                    قسم إدارة الأملاك والعقارات — السندات المالية الرسمية
                  </p>
                </div>
                <div className="bg-slate-900 text-[#fbbf24] px-4 py-2 rounded-xl text-center border border-[#b45309] shadow-sm">
                  <div className="text-xs font-extrabold">سند صرف إيجار</div>
                  <div className="text-xs font-mono font-bold text-amber-200 mt-0.5">{receiptNum}</div>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 my-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold w-24">تاريخ الصرف:</span>
                  <span className="font-mono font-bold text-slate-900">{payoutDateFormatted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold w-24">شهر الاستحقاق:</span>
                  <span className="font-bold text-[#b45309]">{monthName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold w-24">اسم المالك:</span>
                  <span className="font-black text-slate-900">{ownerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold w-24">العقار المعني:</span>
                  <span className="font-bold text-slate-900">{propertyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold w-24">طريقة الصرف:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {methodLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold w-24">رقم التحويل / المرجع:</span>
                  <span className="font-mono font-bold text-slate-800">{currentPayout.bankTransactionRef || '—'}</span>
                </div>
              </div>

              {/* Amount Highlight Box */}
              <div className="relative z-10 p-4 rounded-xl bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 border-2 border-amber-400 text-center my-4 shadow-sm">
                <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono tracking-tight">
                  {amountPaid.toLocaleString('ar-EG')} ج.م
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-amber-900 mt-1">
                  {tafqeetNumber(amountPaid)}
                </div>
              </div>

              {/* Included Dues / Tenants Breakdown Table */}
              {currentPayout.includedDues && currentPayout.includedDues.length > 0 && (
                <div className="relative z-10 my-4 space-y-2">
                  <div className="text-xs font-black text-[#b45309] flex items-center gap-1.5">
                    <ArrowDownRight className="w-3.5 h-3.5 text-[#b45309]" />
                    <span>تفصيل الإيجارات المشمولة في سند الصرف ({currentPayout.includedDues.length} مستأجر / استحقاق):</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-300">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-slate-100 text-[11px] font-bold">
                          <th className="p-2 text-center w-8">#</th>
                          <th className="p-2">اسم المستأجر</th>
                          <th className="p-2 text-center">الوحدة</th>
                          <th className="p-2 text-center">الشهر</th>
                          <th className="p-2 text-center">قيمة الإيجار</th>
                          <th className="p-2 text-center">العمولة</th>
                          <th className="p-2 text-center text-emerald-300 font-black">صافي المستحق للمالك</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
                        {currentPayout.includedDues.map((d, dIdx) => (
                          <tr key={d.dueId || dIdx} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-mono text-slate-500 text-[11px]">{dIdx + 1}</td>
                            <td className="p-2 font-black">{d.tenantName || 'مستأجر'}</td>
                            <td className="p-2 text-center font-mono text-slate-700">{d.unitNumber || '—'}</td>
                            <td className="p-2 text-center font-mono text-slate-600">{formatMonthYearAr(d.forMonthYear)}</td>
                            <td className="p-2 text-center font-mono text-slate-900">{(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-2 text-center font-mono text-amber-700">{(d.commissionAmount || 0).toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-2 text-center font-mono font-black text-emerald-700">
                              {(d.netOwnerAmount || d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes & Description */}
              {currentPayout.notes && (
                <div className="relative z-10 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 my-3">
                  <span className="font-bold text-slate-800">البيان / ملاحظات الصرف: </span>
                  <span>{currentPayout.notes}</span>
                </div>
              )}

              {/* Official Signatures Box */}
              <div className="relative z-10 grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-dashed border-slate-300 text-center">
                <div>
                  <div className="text-[11px] font-bold text-slate-600 mb-8">توقيع المالك المستلم</div>
                  <div className="w-4/5 mx-auto border-b border-slate-400" />
                  <div className="text-xs font-black text-slate-900 mt-1">{ownerName}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 mb-8">المحاسب المسؤول</div>
                  <div className="w-4/5 mx-auto border-b border-slate-400" />
                  <div className="text-xs font-bold text-slate-800 mt-1">{issuerName}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-600 mb-8">اعتماد الإدارة والختم</div>
                  <div className="w-4/5 mx-auto border-b border-slate-400" />
                  <div className="text-xs font-black text-amber-800 mt-1">مؤسسة رميح للمحاماة</div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="relative z-10 text-center text-[10px] text-slate-400 mt-6 pt-3 border-t border-slate-100">
                تم استخراج هذا السند رسمياً من نظام مؤسسة رميح لإدارة العقارات والأملاك القانونية • تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}
              </div>
            </div>
          </div>

          {/* Modal Bottom Actions */}
          <div className="p-4 bg-[#0D1829] border-t border-[#D4A84F]/20 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#9EA7B8] font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>سند معتمد ومطابق لقيود الصرف في قاعدة البيانات السحابية</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs hover:brightness-110 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة السند</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#132238] hover:bg-[#1C2D42] text-[#F8F9FB] text-xs font-bold border border-[#D4A84F]/20 transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
