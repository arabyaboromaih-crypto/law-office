import React from 'react';
import { ShieldAlert, Printer, X, FileText, Calendar, Scale, Clock, AlertTriangle, UserCheck, CheckCircle } from 'lucide-react';
import { Case, InvestigationProcedure } from '../types';

interface InvestigationReportModalProps {
  caseData: Case;
  procedures: InvestigationProcedure[];
  onClose: () => void;
}

export default function InvestigationReportModal({ caseData, procedures, onClose }: InvestigationReportModalProps) {
  const sortedProcedures = [...procedures].sort((a, b) => (a.sessionDate || '').localeCompare(b.sessionDate || ''));

  // Calculations
  const renewalCount = procedures.filter(p => p.actionType && p.actionType.includes('تجديد')).length;
  const totalDetentionDays = procedures.reduce((sum, p) => sum + (Number(p.renewalDays) || 0), 0);
  
  // Latest detention end date
  const proceduresWithEndDate = procedures.filter(p => p.detentionEndDate);
  const latestEndDate = proceduresWithEndDate.length > 0 
    ? [...proceduresWithEndDate].sort((a, b) => (b.detentionEndDate || '').localeCompare(a.detentionEndDate || ''))[0].detentionEndDate
    : null;

  const latestDecision = sortedProcedures.length > 0 ? sortedProcedures[sortedProcedures.length - 1].decision : 'لا يوجد قرارات';
  const latestDefendantStatus = sortedProcedures.length > 0 ? sortedProcedures[sortedProcedures.length - 1].defendantStatus : (caseData.status || 'قيد التحقيق');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 overflow-y-auto" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Controls Bar - Hidden on Print */}
        <div className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between no-print flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-white">
                معاينة وتصدير: تقرير التحقيق وتجديد الحبس
              </h2>
              <p className="text-[11px] text-slate-400">
                القضية رقم {caseData.caseNumberFirstInstance} لسنة {caseData.caseYearFirstInstance} - {caseData.clientName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              طباعة / حفظ PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="p-6 md:p-10 overflow-y-auto flex-1 bg-white text-slate-900 print:p-0 print:overflow-visible">
          {/* Printable CSS style overlay */}
          <style>{`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; color: black !important; }
              @page { size: A4 portrait; margin: 15mm; }
              .print-container { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
            }
          `}</style>

          <div className="print-container space-y-6">
            {/* Document Header / Letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
              <div className="text-right">
                <h1 className="text-lg md:text-xl font-black text-slate-900 leading-tight">
                  مؤسسة رميح للمحاماة والاستشارات القانونية
                </h1>
                <p className="text-xs text-slate-600 font-bold mt-1">
                  قسم القضايا الجنائية والتحقيقات والطعون
                </p>
                <p className="text-[11px] text-slate-500">
                  سجل الاستجوابات وجلسات التجديد والقرارات الصادرة
                </p>
              </div>

              <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-200 min-w-[200px]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">عنوان التقرير</p>
                <p className="text-xs font-black text-amber-700 mt-0.5">تقرير التحقيق وتجديد الحبس</p>
                <p className="text-[10px] text-slate-600 mt-1">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</p>
              </div>
            </div>

            {/* Case Information Grid */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">رقم القضية (أول درجة):</span>
                <span className="font-black text-slate-900">{caseData.caseNumberFirstInstance} لسنة {caseData.caseYearFirstInstance}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">الموكل:</span>
                <span className="font-black text-amber-800">{caseData.clientName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">الخصم / الاتهام:</span>
                <span className="font-black text-rose-800">{caseData.opponent?.name || 'النيابة العامة'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block">الجهة المختصة / النيابة:</span>
                <span className="font-black text-slate-900">{caseData.prosecutorName || caseData.court || 'غير محدد'}</span>
              </div>
            </div>

            {/* Summary Metrics Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-800 block">إجمالي أيام الحبس</span>
                <span className="text-base md:text-lg font-black text-amber-900">{totalDetentionDays} يوماً</span>
              </div>
              <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-blue-800 block">عدد مرات التجديد</span>
                <span className="text-base md:text-lg font-black text-blue-900">{renewalCount} مرات</span>
              </div>
              <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200 text-center">
                <span className="text-[10px] font-bold text-rose-800 block">انتهاء آخر مدة حبس</span>
                <span className="text-xs md:text-sm font-black text-rose-900">{latestEndDate || 'غير محدد'}</span>
              </div>
              <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-800 block">حالة المتهم الحالية</span>
                <span className="text-xs md:text-sm font-black text-emerald-900">{latestDefendantStatus || 'قيد التحقيق'}</span>
              </div>
            </div>

            {/* Latest Decision Banner */}
            {latestDecision && (
              <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                  <Scale className="w-4 h-4" />
                  <span>آخر قرار صادر في مرحلة التحقيق:</span>
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-200 leading-relaxed">
                  {latestDecision}
                </p>
              </div>
            )}

            {/* Chronological Procedures Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>السجل الزمني لإجراءات التحقيق والتجديدات ({sortedProcedures.length}):</span>
              </h3>

              {sortedProcedures.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500">
                  لم يتم تسجيل أي إجراءات تحقيق أو تجديدات حتى الآن.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-300 rounded-2xl">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300">
                        <th className="p-2.5 border-l border-slate-200">#</th>
                        <th className="p-2.5 border-l border-slate-200">تاريخ الجلسة</th>
                        <th className="p-2.5 border-l border-slate-200">نوع الإجراء</th>
                        <th className="p-2.5 border-l border-slate-200">الجهة المختصة</th>
                        <th className="p-2.5 border-l border-slate-200">القرار الصادر</th>
                        <th className="p-2.5 border-l border-slate-200">مدة التجديد</th>
                        <th className="p-2.5 border-l border-slate-200">انتهاء الحبس</th>
                        <th className="p-2.5">حالة المتهم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedProcedures.map((proc, idx) => (
                        <tr key={proc.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="p-2.5 font-bold text-slate-600 border-l border-slate-200">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900 border-l border-slate-200">{proc.sessionDate}</td>
                          <td className="p-2.5 font-black text-amber-800 border-l border-slate-200">{proc.actionType}</td>
                          <td className="p-2.5 text-slate-700 border-l border-slate-200">{proc.authority || '—'}</td>
                          <td className="p-2.5 font-medium text-slate-900 border-l border-slate-200">{proc.decision || '—'}</td>
                          <td className="p-2.5 font-bold text-slate-800 border-l border-slate-200">
                            {proc.renewalDays ? `${proc.renewalDays} يوماً` : '—'}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-rose-700 border-l border-slate-200">
                            {proc.detentionEndDate || '—'}
                          </td>
                          <td className="p-2.5 font-bold text-slate-800">
                            {proc.defendantStatus || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notes Section if any */}
            {sortedProcedures.some(p => p.notes) && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-800">ملاحظات وتعليمات الدفاع في التحقيقات:</h4>
                <div className="space-y-1.5">
                  {sortedProcedures.filter(p => p.notes).map((p, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="font-bold text-amber-700">[{p.sessionDate} - {p.actionType}]:</span> {p.notes}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Seal & Signatures */}
            <div className="pt-8 border-t border-slate-300 flex items-end justify-between text-xs text-slate-600">
              <div>
                <p className="font-bold text-slate-800">توقيع المحامي المكلف بالتحقيق:</p>
                <p className="text-[11px] text-slate-500 mt-8">...................................................</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800">اعتماد مدير المؤسسة:</p>
                <p className="text-[11px] text-amber-800 font-black mt-8">الأستاذ عربي رميح المحامي</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
