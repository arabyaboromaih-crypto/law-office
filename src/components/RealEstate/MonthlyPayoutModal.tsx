/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, X, Calendar, Building, User, DollarSign,
  AlertCircle, CheckCircle2, Loader2, ArrowRight, FileText
} from 'lucide-react';
import { MonthlyEntitlementRow } from './RealEstateData';
import { User as AuthUser } from '../../types';

interface MonthlyPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: MonthlyEntitlementRow | null;
  onConfirm: (data: {
    row: MonthlyEntitlementRow;
    payoutAmount: number;
    payoutDate: string;
    paymentMethod: string;
    bankTransactionRef: string;
    notes: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  currentUser?: AuthUser;
}

export const MonthlyPayoutModal: React.FC<MonthlyPayoutModalProps> = ({
  isOpen,
  onClose,
  row,
  onConfirm,
  isSubmitting,
  currentUser
}) => {
  const [payoutAmount, setPayoutAmount] = useState<number | ''>('');
  const [payoutDate, setPayoutDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('تحويل بنكي');
  const [bankTransactionRef, setBankTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (row && isOpen) {
      const todayISO = new Date().toISOString().slice(0, 10);
      const defaultAmount = row.remainingBalance > 0 ? row.remainingBalance : row.netOwnerSum;
      setPayoutAmount(defaultAmount);
      setPayoutDate(todayISO);
      setPaymentMethod('تحويل بنكي');
      setBankTransactionRef('');
      setNotes(`صرف مستحقات إيجار شهر ${row.monthNameAr} لعقار ${row.propertyName} للمالك ${row.ownerName}`);
    }
  }, [row, isOpen]);

  if (!isOpen || !row) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amt = typeof payoutAmount === 'number' ? payoutAmount : parseFloat(String(payoutAmount || '0'));
    if (!amt || amt <= 0 || isNaN(amt)) {
      alert('يرجى إدخال مبلغ صرف صحيح أكبر من 0.');
      return;
    }

    await onConfirm({
      row,
      payoutAmount: amt,
      payoutDate: payoutDate || new Date().toISOString().slice(0, 10),
      paymentMethod,
      bankTransactionRef,
      notes
    });
  };

  const pendingDues = row.dues.filter(d => d.status !== 'paid_out' && d.payoutStatus !== 'paid_out');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-3xl bg-[#08111F] border border-[#D4A84F]/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#132238] via-[#0D1829] to-[#132238] border-b border-[#D4A84F]/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-[#08111F] rounded-[14px] flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#F8F9FB] flex items-center gap-2">
                  <span>تنفيذ صرف إيجار شهر:</span>
                  <span className="text-[#D4A84F]">{row.monthNameAr}</span>
                </h2>
                <p className="text-xs text-[#9EA7B8] font-bold mt-0.5 flex items-center gap-2">
                  <span>العقار: <strong className="text-amber-300">{row.propertyName}</strong></span>
                  <span>•</span>
                  <span>المالك: <strong className="text-emerald-300">{row.ownerName}</strong></span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-9 h-9 rounded-xl bg-[#132238] hover:bg-rose-500/20 text-[#9EA7B8] hover:text-rose-400 border border-[#D4A84F]/20 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#132238]/60 p-3.5 rounded-2xl border border-[#D4A84F]/20">
              <div className="space-y-1">
                <span className="text-[10px] text-[#9EA7B8] font-bold block">إجمالي إيجار الشهر:</span>
                <span className="text-sm font-black text-[#F8F9FB] font-mono">
                  {row.rentSum.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#9EA7B8] font-bold block">عمولة المكتب:</span>
                <span className="text-sm font-black text-amber-400 font-mono">
                  {row.commissionSum.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#9EA7B8] font-bold block">الخصومات (سلف/مصاريف):</span>
                <span className="text-sm font-black text-rose-400 font-mono">
                  {row.totalDeductionsSum > 0 ? `${row.totalDeductionsSum.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold block">المتبقي المستحق للصرف:</span>
                <span className="text-base font-black text-emerald-300 font-mono">
                  {row.remainingBalance.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>

            {/* Included Dues / Tenants Notice */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>الإيجارات المشمولة في عملية الصرف ({pendingDues.length} استحقاق بانتظار الصرف):</span>
                </span>
                <span className="text-[10px] text-[#9EA7B8] font-bold bg-[#08111F] px-2 py-0.5 rounded-lg border border-[#D4A84F]/15">
                  يقتصر الصرف على هذا الشهر والعقار والمالك فقط
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#D4A84F]/15 bg-[#08111F]/70">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#132238] text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/15">
                      <th className="p-2.5 text-center w-8">#</th>
                      <th className="p-2.5">المستأجر</th>
                      <th className="p-2.5 text-center">الوحدة</th>
                      <th className="p-2.5 text-center">قيمة الإيجار</th>
                      <th className="p-2.5 text-center">حالة الصرف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                    {row.dues.map((d, idx) => {
                      const isPaid = d.status === 'paid_out' || d.payoutStatus === 'paid_out';
                      return (
                        <tr key={d.id || idx} className={`hover:bg-white/5 ${isPaid ? 'opacity-60 bg-emerald-950/10' : ''}`}>
                          <td className="p-2.5 text-center font-mono text-[#9EA7B8] text-[11px]">{idx + 1}</td>
                          <td className="p-2.5 text-[#F8F9FB]">{d.tenantName || 'مستأجر'}</td>
                          <td className="p-2.5 text-center font-mono text-[#D4A84F]">{d.unitNumber || '—'}</td>
                          <td className="p-2.5 text-center font-mono text-[#F8F9FB]">{(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م</td>
                          <td className="p-2.5 text-center">
                            {isPaid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                تم الصرف مسبقاً
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                مشمول في الصرف الحالي
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#F8F9FB] block mb-1.5">
                  المبلغ المنصرف الفعلي (ج.م) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={row.remainingBalance > 0 ? row.remainingBalance * 2 : 1000000}
                    step="any"
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-emerald-400 font-mono font-black text-base focus:border-[#D4A84F] outline-none"
                    placeholder="0"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9EA7B8] pointer-events-none">
                    ج.م
                  </span>
                </div>
                <span className="text-[10px] text-[#9EA7B8] mt-1 block">
                  المبلغ المستحق تلقائياً: {row.remainingBalance.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#F8F9FB] block mb-1.5">
                  تاريخ الصرف الفعلي *
                </label>
                <input
                  type="date"
                  value={payoutDate}
                  onChange={e => setPayoutDate(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs text-[#F8F9FB] font-mono font-bold focus:border-[#D4A84F] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#F8F9FB] block mb-1.5">
                  طريقة الصرف *
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
                >
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="نقدي">نقدي (خزينة المكتب)</option>
                  <option value="إنستاباي">إنستاباي (InstaPay)</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="اتصالات كاش">اتصالات كاش</option>
                  <option value="شيك">شيك بنكي</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#F8F9FB] block mb-1.5">
                  رقم المعاملة / التحويل البنكي (اختياري)
                </label>
                <input
                  type="text"
                  value={bankTransactionRef}
                  onChange={e => setBankTransactionRef(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs text-[#F8F9FB] font-mono focus:border-[#D4A84F] outline-none"
                  placeholder="رقم مرجع التحويل أو الشيك..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#F8F9FB] block mb-1.5">
                بيان وملاحظات سند الصرف
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs text-[#F8F9FB] focus:border-[#D4A84F] outline-none resize-none"
                placeholder="اكتب تفاصيل أو ملاحظات سند الصرف..."
              />
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-4 bg-[#0D1829] border-t border-[#D4A84F]/25 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#9EA7B8] font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>سيتم إنشاء سند الصرف وتحديث حالة استحقاق الشهر إلى "تم الصرف" فورياً في Firestore</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#132238] hover:bg-[#1C2D42] text-[#F8F9FB] text-xs font-bold border border-[#D4A84F]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 border border-emerald-400/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ السند...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    <span>تأكيد صرف الإيجار وإصدار السند</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
