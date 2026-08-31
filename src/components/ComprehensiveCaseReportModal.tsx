import React from 'react';
import { Case, Client, User, CaseSession } from '../types';
import { buildLitigationTimeline, generateCaseReportHTML } from '../utils/caseReportGenerator';
import { getEffectiveStageInfo } from '../utils/stageUtils';
import { Printer, MessageSquare, X, Scale, FileText, Calendar, Shield, Award, MapPin, Phone, UserCheck, CheckCircle2, Clock } from 'lucide-react';

interface ComprehensiveCaseReportModalProps {
  caseData: Case;
  clients: Client[];
  users: User[];
  sessions: CaseSession[];
  onClose: () => void;
  onSendWhatsApp?: () => void;
}

export const ComprehensiveCaseReportModal: React.FC<ComprehensiveCaseReportModalProps> = ({
  caseData,
  clients,
  users,
  sessions,
  onClose,
  onSendWhatsApp
}) => {
  const matchedClient = clients.find(cl => cl.id === caseData.clientId || cl.name === caseData.clientName);
  const assignedLawyer = users.find(u => u.id === caseData.assignedLawyerId);
  const effStage = getEffectiveStageInfo(caseData);
  const caseSessions = [...sessions.filter(s => s.caseId === caseData.id)].sort((a, b) => a.date.localeCompare(b.date));
  const timelineStages = buildLitigationTimeline(caseData, caseSessions);
  const formattedDate = new Date().toISOString().split('T')[0];
  const reportCode = `R-REP-${caseData.caseNumberFirstInstance}-${caseData.caseYearFirstInstance || '2024'}`;
  const filesList = caseData.files || [];

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة لطباعة التقرير');
      return;
    }
    const htmlContent = generateCaseReportHTML(caseData, clients, users, caseSessions, {
      reportDate: formattedDate,
      generatedBy: assignedLawyer?.fullName || 'أ. عربي رميح'
    });
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      
      {/* Top Modal Header */}
      <div className="bg-[#0b1b2b] border border-amber-500/30 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        <div className="px-5 py-3.5 border-b border-slate-800 flex justify-between items-center bg-[#0b1b2b] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                التقرير القضائي والقانوني الشامل لملف الدعوى
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {effStage.degreeLabel}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                قضية رقم <span className="text-amber-400 font-bold">{effStage.caseNumber || caseData.caseNumberFirstInstance}</span> لسنة {effStage.caseYear || caseData.caseYearFirstInstance} - {effStage.court}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSendWhatsApp && (
              <button
                onClick={onSendWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">إرسال للموكل واتساب</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-amber-400/30"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 text-slate-900 font-sans leading-relaxed">
          <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-xs relative" style={{ fontFamily: "'Cairo', sans-serif" }}>
            
            {/* 1. TOP HEADER BANNER (NAVY & GOLD) */}
            <div className="bg-gradient-to-r from-[#0b1b2b] via-[#112233] to-[#0b1b2b] text-white rounded-xl p-5 border-b-4 border-amber-500 shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                
                {/* Firm Logo & Info */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 text-2xl shrink-0 shadow-inner">
                    ⚖️
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white tracking-tight">مؤسسة رميح للمحاماة</h2>
                    <p className="text-[10px] text-amber-400 font-bold">والاستشارات القانونية وأعمال الطعن</p>
                    <p className="text-[9px] text-slate-300 mt-0.5">تأسست عام ١٩٨٥ | هاتف: ٠١٠٠٢٢٢٠٠٠</p>
                  </div>
                </div>

                {/* Report Title & Ornament */}
                <div className="text-center">
                  <h1 className="text-lg font-black text-amber-400 tracking-wide">تقرير شامل عن القضية</h1>
                  <div className="text-amber-500 text-xs my-0.5">✧ ⚖ ✧</div>
                  <div className="inline-block bg-white/10 border border-amber-500/40 text-white text-xs font-bold px-3 py-1 rounded-full shadow-inner">
                    رقم القضية: {caseData.caseNumberFirstInstance} لسنة {caseData.caseYearFirstInstance} ({caseData.type})
                  </div>
                </div>

                {/* Metadata & Code */}
                <div className="bg-white/5 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-lg p-1 flex items-center justify-center shrink-0 border border-amber-400/30">
                    <div className="w-full h-full bg-slate-900 rounded flex items-center justify-center text-amber-400 font-mono text-[8px] font-black text-center leading-none">
                      QR<br/>CODE
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-300 space-y-0.5">
                    <div>التاريخ: <strong className="text-amber-400">{formattedDate}</strong></div>
                    <div>المحرر: <strong className="text-white">{assignedLawyer?.fullName || 'أ. عربي رميح'}</strong></div>
                    <div>الكود: <strong className="text-amber-300 font-mono">{reportCode}</strong></div>
                  </div>
                </div>

              </div>
            </div>

            {/* 2. METRICS RIBBON (بيانات القضية) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
              <div className="bg-[#0b1b2b] text-amber-400 px-4 py-2 font-black text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>بيانات ومعرفات القضية الأساسية</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-x-reverse divide-slate-200 bg-slate-50 text-center">
                <div className="p-2.5">
                  <div className="text-[10px] text-slate-500 font-bold mb-1">🏛️ المحكمة والدائرة</div>
                  <div className="font-extrabold text-slate-900">{effStage.court} - د/{effStage.circuit}</div>
                </div>
                <div className="p-2.5">
                  <div className="text-[10px] text-slate-500 font-bold mb-1">📁 تصنيف القضية</div>
                  <div className="font-extrabold text-slate-900">{caseData.subject || caseData.type}</div>
                </div>
                <div className="p-2.5">
                  <div className="text-[10px] text-slate-500 font-bold mb-1">⚖️ نوع الدعوى</div>
                  <div className="font-extrabold text-amber-700">{caseData.type} ({effStage.degreeLabel})</div>
                </div>
                <div className="p-2.5">
                  <div className="text-[10px] text-slate-500 font-bold mb-1">📅 تاريخ القيد</div>
                  <div className="font-extrabold text-slate-900">{timelineStages[0]?.date || formattedDate}</div>
                </div>
                <div className="p-2.5">
                  <div className="text-[10px] text-slate-500 font-bold mb-1">💰 قيمة الدعوى والأتعاب</div>
                  <div className="font-extrabold text-amber-700">{caseData.totalFees ? `${caseData.totalFees.toLocaleString()} ج.م` : 'غير محدد'}</div>
                </div>
              </div>
            </div>

            {/* 3. TWO COLUMN BODY GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* RIGHT SIDEBAR COLUMN (1 col) */}
              <div className="space-y-4 md:col-span-1">
                
                {/* 1. أطراف الدعوى */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs">
                  <h4 className="bg-[#0b1b2b] text-white text-xs font-black px-3 py-1.5 rounded-lg border-r-4 border-amber-500 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    أطراف الخصومة والدعوى
                  </h4>

                  {/* Clients */}
                  {caseData.clientsList && caseData.clientsList.length > 0 ? caseData.clientsList.map((cl, idx) => (
                    <div key={idx} className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-emerald-950">
                      <p className="font-extrabold text-emerald-900">الموكل ({idx + 1}): {cl.name}</p>
                      <p className="text-[10px] text-emerald-700 mt-0.5">الصفة: {cl.role || 'مدعي'} | الهاتف: {cl.phone || 'غير مدون'}</p>
                    </div>
                  )) : (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-emerald-950">
                      <p className="font-extrabold text-emerald-900">الموكل: {caseData.clientName}</p>
                      <p className="text-[10px] text-emerald-700 mt-0.5">الهاتف: {matchedClient?.phone || 'غير مدون'}</p>
                      <p className="text-[10px] text-emerald-700">الرقم القومي: {matchedClient?.nationalId || 'غير مدون'}</p>
                    </div>
                  )}

                  {/* Opponents */}
                  {caseData.opponentsList && caseData.opponentsList.length > 0 ? caseData.opponentsList.map((opp, idx) => (
                    <div key={idx} className="bg-rose-50/70 border border-rose-200 rounded-lg p-2.5 text-rose-950">
                      <p className="font-extrabold text-rose-900">الخصم ({idx + 1}): {opp.name}</p>
                      <p className="text-[10px] text-rose-700 mt-0.5">الصفة: {opp.role} | محاميه: {opp.lawyer || 'لا يوجد'}</p>
                    </div>
                  )) : (
                    <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-2.5 text-rose-950">
                      <p className="font-extrabold text-rose-900">الخصم: {caseData.opponent.name}</p>
                      <p className="text-[10px] text-rose-700 mt-0.5">الصفة: {caseData.opponent.role}</p>
                      <p className="text-[10px] text-rose-700">العنوان: {caseData.opponent.address || 'غير مدون'}</p>
                      <p className="text-[10px] text-rose-700">محامي الخصم: {caseData.opponent.lawyer || 'لا يوجد'}</p>
                    </div>
                  )}
                </div>

                {/* 2. محامي القضية وفريق العمل */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <h4 className="bg-[#0b1b2b] text-white text-xs font-black px-3 py-1.5 rounded-lg border-r-4 border-amber-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    هيئة الدفاع والمتابعة
                  </h4>
                  <ul className="text-[11px] text-slate-700 space-y-1 pr-1">
                    <li>• <strong>المحامي المسند إليه القضية:</strong> {assignedLawyer ? assignedLawyer.fullName : 'غير مسند لمحامٍ محدد'}</li>
                    {assignedLawyer?.phone && <li>• <strong>هاتف المحامي:</strong> {assignedLawyer.phone}</li>}
                    <li>• <strong>رقم الملف بالمكتب:</strong> <span className="font-mono font-bold text-amber-700">{caseData.officeFileNo || 'R-' + caseData.caseNumberFirstInstance}</span></li>
                  </ul>
                </div>

                {/* 3. الملخص المالي */}
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-xs">
                  <h4 className="bg-[#0b1b2b] text-white text-xs font-black px-3 py-1.5 rounded-lg border-r-4 border-amber-500 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    ملخص الموقف المالي
                  </h4>
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>إجمالي الأتعاب:</span>
                      <span className="font-bold text-sky-700">{caseData.totalFees.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>المسدد المقبوض:</span>
                      <span className="font-bold text-emerald-700">{caseData.paidFees.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-700 pt-1.5 border-t border-slate-100 font-extrabold">
                      <span>المتبقي المستحق:</span>
                      <span className="text-sm">{caseData.remainingFees.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* 4. الجلسة القادمة */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-1 shadow-xs">
                  <h4 className="text-amber-900 font-black text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    الجلسة القادمة المرتقبة
                  </h4>
                  <p className="font-extrabold text-amber-800 text-xs">
                    {caseData.nextHearingDate ? `📅 ${caseData.nextHearingDate} ${caseData.nextHearingTime ? 'الساعة ' + caseData.nextHearingTime : ''}` : '❌ لم تحدد بعد'}
                  </p>
                  <p className="text-[10px] text-amber-700 font-bold">الموقف الحالي: {caseData.status}</p>
                </div>

              </div>

              {/* LEFT MAIN COLUMN (2 cols) */}
              <div className="space-y-5 md:col-span-2">
                
                {/* 1. ملخص موضوع القضية */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                  <div className="bg-gradient-to-r from-[#0b1b2b] to-[#1e293b] text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex justify-between items-center border-r-4 border-amber-500">
                    <span>📝 ملخص وقائع الدعوى والطلبات القانونية</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">الحالة: {caseData.status}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 leading-relaxed text-xs">
                    {caseData.subject && <p className="font-bold text-amber-800 mb-1">📌 الموضوع والطلبات: {caseData.subject}</p>}
                    {caseData.notes || `دعوى مقيدة برقم (${caseData.caseNumberFirstInstance} لسنة ${caseData.caseYearFirstInstance}) أمام محكمة ${caseData.court} الدائرة ${caseData.circuit}، دفاعاً عن الموكل (${caseData.clientName}) في مواجهة الخصم (${caseData.opponent.name}).`}
                  </div>
                </div>

                {/* 2. الخط الزمني الشامل لمراحل الدعوى */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="bg-gradient-to-r from-[#0b1b2b] to-[#1e293b] text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex justify-between items-center border-r-4 border-amber-500">
                    <span>⏳ المراحل القضائية والخط الزمني للإجراءات</span>
                    <span className="text-[10px] text-amber-400 font-bold">{timelineStages.length} مرحلة متتالية</span>
                  </div>

                  <div className="pr-4 border-r-2 border-slate-200 space-y-3 mr-2 relative">
                    {timelineStages.map((stg) => (
                      <div key={stg.stepNumber} className="relative pr-6">
                        <div className="absolute -right-[31px] top-1.5 w-5 h-5 rounded-full bg-[#0b1b2b] text-amber-400 border-2 border-amber-400 flex items-center justify-center font-black text-[10px]">
                          {stg.stepNumber}
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-slate-900 text-xs">{stg.icon} {stg.title}</span>
                            <div className="flex items-center gap-2">
                              <span className="bg-amber-50 text-amber-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">
                                {stg.date}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                stg.badgeColor === 'green' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                {stg.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{stg.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. جدول الجلسات */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="bg-gradient-to-r from-[#0b1b2b] to-[#1e293b] text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex justify-between items-center border-r-4 border-amber-500">
                    <span>📅 جدول الجلسات المعتمد والقرارات الصادرة</span>
                    <span className="text-[10px] text-amber-400 font-bold">إجمالي: {caseSessions.length} جلسة</span>
                  </div>

                  {caseSessions.length === 0 ? (
                    <p className="p-3 text-slate-500 italic text-center bg-slate-50 rounded-lg">لا توجد جلسات مسجلة بملف القضية حتى تاريخه.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                            <th className="p-2 w-1/4">التاريخ</th>
                            <th className="p-2 w-1/4">موضوع الجلسة</th>
                            <th className="p-2 w-1/4">ما تم بالجلسة</th>
                            <th className="p-2 w-1/4">القرار الصادر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {caseSessions.map((sess) => {
                            const isFuture = sess.date > new Date().toISOString().split('T')[0];
                            const whatHappenedText = isFuture 
                              ? 'جلسة قادمة (لم تنعقد بعد)' 
                              : (sess.whatHappened?.trim() || 'غير مدون');
                            const decisionText = isFuture 
                              ? 'جلسة قادمة' 
                              : (sess.decision?.trim() || 'غير مدون');
                            return (
                              <tr key={sess.id} className="hover:bg-slate-50/60">
                                <td className="p-2 font-mono font-bold text-amber-800">{sess.date} {sess.time ? `(${sess.time})` : ''}</td>
                                <td className="p-2 font-bold text-slate-900">{sess.subject || 'نظر الدعوى'}</td>
                                <td className="p-2 text-slate-600">{whatHappenedText}</td>
                                <td className="p-2 font-extrabold text-slate-900 bg-amber-50/50">{decisionText}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. تفاصيل الخبراء (إن وجدت) */}
                {(caseData.isReferredToExperts || caseData.expertReferral?.isReferred || (caseData.expertReferral && (caseData.expertReferral.expertOffice || caseData.expertReferral.expertName))) && (
                  <div className="bg-amber-50/50 border border-amber-300 rounded-xl p-4 shadow-xs space-y-2">
                    <div className="bg-gradient-to-r from-amber-900 to-amber-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex justify-between items-center">
                      <span>🔍 ملف وسجل إحالة القضية للخبراء</span>
                      <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded">
                        {caseData.expertReferral?.status || 'قيد المباشرة'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 space-y-1 bg-white p-3 rounded-lg border border-amber-200">
                      <div>• <strong>مكتب الخبراء:</strong> {caseData.expertReferral?.expertOffice || 'غير محدد'} | <strong>الخبير المباشر:</strong> {caseData.expertReferral?.expertName || 'لم يحدد'} {caseData.expertReferral?.expertPhone ? `(${caseData.expertReferral.expertPhone})` : ''}</div>
                      <div>• <strong>رقم الملف:</strong> <span className="font-mono font-bold text-amber-800">{caseData.expertReferral?.fileNumber || 'غير مدون'}</span> | <strong>تاريخ الإحالة:</strong> {caseData.expertReferral?.referralDate || 'غير مدون'}</div>
                      {caseData.expertReferral?.report?.summary && (
                        <div className="bg-amber-100/70 border border-amber-300 p-2 rounded text-amber-950 font-bold mt-1">
                          📊 ملخص تقرير الخبير: {caseData.expertReferral.report.summary}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. المستندات */}
                {filesList.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="bg-gradient-to-r from-[#0b1b2b] to-[#1e293b] text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex justify-between items-center border-r-4 border-amber-500">
                      <span>📂 المستندات والمذكرات المودعة بالملف</span>
                      <span className="text-[10px] text-amber-400 font-bold">{filesList.length} مستند</span>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                            <th className="p-2">اسم المستند</th>
                            <th className="p-2">التصنيف</th>
                            <th className="p-2">تاريخ الإيداع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filesList.map((f, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="p-2 font-bold text-slate-900">📄 {f.name}</td>
                              <td className="p-2 text-slate-600">{f.category || f.type || 'مستند قانوني'}</td>
                              <td className="p-2 font-mono text-slate-500">{f.uploadDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* 4. FOOTER & SIGNATURES */}
            <div className="pt-6 border-t-2 border-slate-200 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center items-center">
                <div>
                  <p className="font-extrabold text-slate-900 text-xs">إعداد التقرير والمتابعة:</p>
                  <p className="text-[11px] text-slate-600 mt-1">المحامي/ {assignedLawyer?.fullName || 'أ. عربي رميح'}</p>
                  <div className="mt-6 border-b border-dotted border-slate-400 w-28 mx-auto" />
                </div>

                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full border-2 border-double border-amber-600 p-1 transform -rotate-6 opacity-90 flex flex-col items-center justify-center text-amber-700">
                    <div className="w-full h-full border border-dashed border-amber-600 rounded-full flex flex-col items-center justify-center text-[7.5px] font-black leading-tight text-center">
                      <span>⚖️</span>
                      <span>مؤسسة رميح للمحاماة</span>
                      <span>معتمد ورسمي</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="font-extrabold text-slate-900 text-xs">اعتماد الإدارة العليا:</p>
                  <p className="text-[11px] text-slate-600 mt-1">المدير العام/ أ. عربي رميح</p>
                  <div className="mt-6 border-b border-dotted border-slate-400 w-28 mx-auto" />
                </div>
              </div>

              <div className="bg-[#0b1b2b] text-slate-300 p-2.5 rounded-xl flex flex-col sm:flex-row justify-between items-center text-[10px] gap-2 border-t-2 border-amber-500">
                <div>📞 الهاتف الرئيسي: <strong className="text-amber-400">0100222000 / +20 123 456 7890</strong></div>
                <div>📍 المقر الرئيسي: <strong className="text-white">القاهرة - جمهورية مصر العربية</strong></div>
                <div>🌐 نظام إدارة القضايا الذكي - مؤسسة رميح للمحاماة © {new Date().getFullYear()}</div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default ComprehensiveCaseReportModal;
