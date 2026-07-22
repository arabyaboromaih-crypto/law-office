/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Case, PaymentReceipt, User } from '../types';
import { 
  CreditCard, Search, Printer, Plus, FileText, CheckCircle, Clock, X, AlertTriangle 
} from 'lucide-react';
import { toAr } from '../utils/arabicNumbers';

interface FeesPanelProps {
  cases: Case[];
  currentUser: User;
  onUpdateCase: (updated: Case) => void;
}

export default function FeesPanel({ cases, currentUser, onUpdateCase }: FeesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  // New payment form
  const [payAmount, setPayAmount] = useState(2000);
  const [payNotes, setPayNotes] = useState('');
  const [receiptNo, setReceiptNo] = useState('');

  // Active cases to show financials
  const activeCases = cases.filter(c => !c.isArchived);

  const filteredCases = activeCases.filter(c => 
    c.clientName.includes(searchQuery) ||
    c.caseNumberFirstInstance.includes(searchQuery) ||
    c.court.includes(searchQuery)
  );

  // Print Beautiful Invoice Voucher (سند القبض)
  const handlePrintReceipt = (c: Case, receipt: PaymentReceipt) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>إيصال استلام نقدية - ${receipt.receiptNumber}</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 15px; line-height: 1.8; color: #1e293b; }
              .receipt-border { border: 4px double #b45309; padding: 25px; border-radius: 12px; max-width: 650px; margin: 0 auto; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 25px; }
              .header h2 { margin: 0; font-size: 18px; color: #b45309; }
              .header p { margin: 2px 0 0; font-size: 11px; color: #64748b; }
              .receipt-title { text-align: center; font-size: 20px; font-weight: bold; background-color: #fef3c7; color: #b45309; width: 180px; margin: 0 auto 20px; padding: 4px 10px; border-radius: 6px; border: 1px solid #fde68a; }
              .field-row { margin-bottom: 12px; font-size: 13px; display: flex; }
              .field-label { font-weight: bold; width: 140px; color: #475569; }
              .field-value { border-bottom: 1px dotted #94a3b8; flex-grow: 1; padding-bottom: 2px; }
              .footer { margin-top: 35px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
              .amount-box { border: 2px solid #b45309; background: #fffbeb; font-weight: bold; font-size: 16px; padding: 6px 15px; border-radius: 6px; display: inline-block; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="receipt-border">
              <div class="header">
                <div>
                  <h2>مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
                  <p>قصر النيل، وسط البلد، القاهرة</p>
                </div>
                <div>
                  <p>تاريخ السند: <strong>${receipt.date}</strong></p>
                  <p>رقم السند المالي: <strong>${receipt.receiptNumber}</strong></p>
                </div>
              </div>

              <div class="receipt-title">سند قبض نقدية</div>

              <div class="field-row">
                <div class="field-label">استلمنا من السيد /</div>
                <div class="field-value"><strong>${c.clientName}</strong></div>
              </div>

              <div class="field-row">
                <div class="field-label">مبلغ وقدره /</div>
                <div class="field-value">${receipt.amount.toLocaleString()} جنيهاً مصرياً لا غير.</div>
              </div>

              <div class="field-row">
                <div class="field-label">وذلك قيمة /</div>
                <div class="field-value">دفعة مالية من أتعاب القضية المقيدة برقم ${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance} أمام محكمة ${c.court} (${c.type}).</div>
              </div>

              <div class="field-row">
                <div class="field-label">ملاحظات السداد /</div>
                <div class="field-value">${receipt.notes || 'سداد مقدم تعاقد وحضور جلسات النزاع'}</div>
              </div>

              <div style="margin-top: 25px; display: flex; justify-content: space-between; align-items: center;">
                <div class="amount-box">المبلغ: ${receipt.amount.toLocaleString()} ج.م</div>
                <div style="font-size: 13px; font-weight: bold; color: #475569;">توقيع المستلم المالي للمؤسسة: ............................</div>
              </div>

              <div class="footer">
                <div>المالية العامة للمؤسسة</div>
                <div>البريد الإلكتروني: info@romeih-law.com</div>
              </div>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Submit payment handler
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    if (payAmount <= 0) {
      alert('يرجى كتابة مبلغ سداد صالح أكبر من صفر');
      return;
    }

    if (payAmount > selectedCase.remainingFees) {
      alert(`عفواً، المبلغ المدفوع (${payAmount}) أكبر من إجمالي المتبقي على القضية وهو (${selectedCase.remainingFees}) ج.م.`);
      return;
    }

    const finalReceiptNo = receiptNo || `سند رقم ${Math.floor(2000 + Math.random() * 8000)}`;

    const newReceipt: PaymentReceipt = {
      id: `pay-${Date.now()}`,
      amount: Number(payAmount),
      date: new Date().toISOString().split('T')[0],
      receiptNumber: finalReceiptNo,
      notes: payNotes || 'سداد مالي مباشر بالمؤسسة'
    };

    const updatedCase: Case = {
      ...selectedCase,
      paidFees: selectedCase.paidFees + Number(payAmount),
      remainingFees: selectedCase.remainingFees - Number(payAmount),
      payments: [...selectedCase.payments, newReceipt]
    };

    onUpdateCase(updatedCase);
    setSelectedCase(null);
    setPayNotes('');
    setReceiptNo('');
  };

  return (
    <div className="space-y-3.5 animate-fadeIn">
      
      {/* Financials Overview header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700/60 shadow-md">
          <span className="text-xs text-amber-400 font-semibold block">إجمالي العقود والأتعاب المقيدة</span>
          <span className="text-2xl font-bold font-mono mt-2 block">
            {toAr(activeCases.reduce((sum, c) => sum + (c.totalFees || 0), 0).toLocaleString())} ج.م
          </span>
          <p className="text-[10px] text-slate-400 mt-1">المبالغ الكلية المتعاقد عليها للملفات النشطة</p>
        </div>

        <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md">
          <span className="text-xs text-emerald-100 font-semibold block">المحصل الفعلي (الخزينة)</span>
          <span className="text-2xl font-bold font-mono mt-2 block">
            {toAr(activeCases.reduce((sum, c) => sum + (c.paidFees || 0), 0).toLocaleString())} ج.م
          </span>
          <p className="text-[10px] text-emerald-100/80 mt-1">المدفوعات والمقدمات المسددة بخزينة المؤسسة</p>
        </div>

        <div className="bg-red-500 text-white p-5 rounded-2xl shadow-md">
          <span className="text-xs text-red-100 font-semibold block">المعلق والمتبقي (الذمم المدينة)</span>
          <span className="text-2xl font-bold font-mono mt-2 block">
            {toAr(activeCases.reduce((sum, c) => sum + (c.remainingFees || 0), 0).toLocaleString())} ج.م
          </span>
          <p className="text-[10px] text-red-100/80 mt-1">مستحقات على الموكلين واقية السداد</p>
        </div>
      </div>

      {/* Search client financial file */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex items-center gap-3">
        <span className="text-slate-400"><Search className="w-5 h-5" /></span>
        <input
          type="text"
          placeholder="البحث بالماليات: الموكل، رقم القضية، المحكمة..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
        />
      </div>

      {/* Financial list of cases */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-700">جدول كشوف الأتعاب والذمم المالية للموكلين</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="p-4">الموكل والقضية</th>
                <th className="p-4">إجمالي العقد</th>
                <th className="p-4">المسدد للخزينة</th>
                <th className="p-4">المتبقي الذمم</th>
                <th className="p-4">حالة السداد</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
              {filteredCases.map((c) => {
                const isPaidFull = c.remainingFees === 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <strong className="block text-slate-800">{c.clientName}</strong>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        قضية رقم {toAr(c.caseNumberFirstInstance)} لسنة {toAr(c.caseYearFirstInstance)} ({c.type})
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold">{toAr(c.totalFees.toLocaleString())} ج.م</td>
                    <td className="p-4 font-mono text-emerald-600 font-bold">{toAr(c.paidFees.toLocaleString())} ج.م</td>
                    <td className="p-4 font-mono text-red-500 font-bold">{toAr(c.remainingFees.toLocaleString())} ج.م</td>
                    <td className="p-4">
                      {isPaidFull ? (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                          خالص بالكامل
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] flex items-center gap-0.5 inline-flex">
                          <Clock className="w-3 h-3" />
                          متبقي مديونية
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {!isPaidFull && currentUser.permissions.addReceipt && (
                          <button
                            onClick={() => {
                              setSelectedCase(c);
                              setPayAmount(c.remainingFees);
                              setReceiptNo(`سند رقم ${Math.floor(1000 + Math.random() * 9000)}`);
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg font-bold text-[11px]"
                          >
                            سداد قسط مالي
                          </button>
                        )}
                        
                        {/* Receipt Vouchers List dropdown mockup */}
                        {c.payments?.length > 0 && (
                          <button
                            onClick={() => {
                              const list = c.payments.map(p => `- ${p.receiptNumber}: سدد ${p.amount.toLocaleString()} ج.م في ${p.date}`).join('\n');
                              alert(`قائمة سندات القبض المستلمة لهذه القضية:\n${list}`);
                            }}
                            className="text-blue-600 hover:underline text-[11px] font-bold"
                          >
                            السندات ({c.payments.length})
                          </button>
                        )}

                        {c.payments?.length > 0 && (
                          <button
                            onClick={() => handlePrintReceipt(c, c.payments[c.payments.length - 1])}
                            title="طباعة آخر سند قبض تم تحصيله للموكل"
                            className="p-1.5 text-slate-500 hover:text-slate-800"
                          >
                            <Printer className="w-4 h-4" />
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

      {/* Pay Installment Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800">تحرير سند قبض واستلام نقدية</h3>
              <button onClick={() => setSelectedCase(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 text-xs text-slate-800">
                <p><strong>الموكل:</strong> {selectedCase.clientName}</p>
                <p className="mt-1"><strong>القضية:</strong> رقم {selectedCase.caseNumberFirstInstance} ({selectedCase.type})</p>
                <p className="mt-1"><strong>المسدد حتى الآن:</strong> {selectedCase.paidFees.toLocaleString()} ج.م</p>
                <p className="mt-1 text-red-700 font-bold"><strong>المتبقي الكلي للذمة:</strong> {selectedCase.remainingFees.toLocaleString()} ج.م</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المبلغ المراد تحصيله (ج.م)</label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    max={selectedCase.remainingFees}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم سند القبض المالي</label>
                  <input
                    type="text"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    placeholder="سند رقم ..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">بيان السداد (السبب والملاحظات)</label>
                <input
                  type="text"
                  placeholder="مثال: سداد القسط الثاني من أتعاب مرافعة الاستئناف"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إلغاء السند
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md"
                >
                  تأكيد التحصيل والطباعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
