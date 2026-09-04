import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, User, X, DollarSign, Coins, CheckCircle, Clock,
  AlertTriangle, Calendar, FileText, Printer, RotateCcw,
  Users, Home, Phone, CreditCard, Hash, ChevronLeft, ShieldCheck,
  Sparkles, Tag
} from 'lucide-react';
import {
  CommissionPropertySummaryGroup,
  CommissionStatementItem
} from './CommissionCollectModal';
import { ReProperty, ReOwner, ReTenant, ReUnit, User as AuthUser } from '../../types';
import { useBackHandler } from '../../utils/navigationManager';

interface PropertyCommissionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: CommissionPropertySummaryGroup | null;
  property?: ReProperty | null;
  owner?: ReOwner | null;
  tenants?: ReTenant[];
  units?: ReUnit[];
  onCollectStatement: (stmt: CommissionStatementItem) => void;
  onCollectAll: (group: CommissionPropertySummaryGroup) => void;
  onRevertStatement: (stmt: CommissionStatementItem) => Promise<void>;
  onPrint?: (reportType: string) => void;
  currentUser?: AuthUser;
}

export default function PropertyCommissionDetailsModal({
  isOpen,
  onClose,
  group,
  property,
  owner,
  tenants = [],
  units = [],
  onCollectStatement,
  onCollectAll,
  onRevertStatement,
  onPrint,
  currentUser
}: PropertyCommissionDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'statements' | 'units'>('statements');
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmRevertStmt, setConfirmRevertStmt] = useState<CommissionStatementItem | null>(null);

  useBackHandler(isOpen, onClose);

  if (!isOpen || !group) return null;

  const propUnits = units.filter(u => u.propertyId === group.propertyId);
  const propTenants = tenants.filter(t => t.propertyId === group.propertyId);

  const isFullyCollected = group.remainingCommission <= 0 && group.earnedCommission > 0;
  const isPartiallyCollected = group.amountCollectedFromOwner > 0 && group.remainingCommission > 0;

  const handleConfirmRevert = async () => {
    if (!confirmRevertStmt) return;
    setRevertingId(confirmRevertStmt.id);
    try {
      await onRevertStatement(confirmRevertStmt);
      setConfirmRevertStmt(null);
    } catch (err) {
      console.error('Failed to revert commission:', err);
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-gradient-to-b from-[#0F1C2E] to-[#0A121E] border border-[#D4A84F]/40 rounded-3xl p-5 sm:p-6 w-full max-w-5xl shadow-2xl relative text-[#F8F9FB] my-6 flex flex-col max-h-[90vh]"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute left-5 top-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/10 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#D4A84F]/20">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#D4A84F]/30 to-[#D4A84F]/10 border border-[#D4A84F]/40 text-[#D4A84F] shadow-lg">
              <Building2 className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-[#F8F9FB]">
                  {group.propertyName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black font-mono">
                  {group.commissionRateText}
                </span>
                {isFullyCollected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> تم تحصيل كامل العمولات
                  </span>
                ) : isPartiallyCollected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> تحصيل جزئي
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> بانتظار التحصيل
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[#9EA7B8] font-bold flex-wrap">
                <span className="flex items-center gap-1 text-[#F8F9FB]">
                  <User className="w-3.5 h-3.5 text-[#D4A84F]" />
                  المالك: {group.ownerName}
                </span>
                {owner?.phone && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300 font-mono">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      {owner.phone}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-300">
                  <Calendar className="w-3.5 h-3.5 text-[#D4A84F]" />
                  عدد الفترات: {group.monthsCount} شهر
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {group.remainingCommission > 0 && (
              <button
                type="button"
                onClick={() => onCollectAll(group)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md border border-emerald-400/40 transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] active:scale-95"
              >
                <Coins className="w-4 h-4 text-amber-300" />
                <span>تحصيل إجمالي المتبقي ({group.remainingCommission.toLocaleString('ar-EG')} ج.م)</span>
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint('office_commissions')}
                className="px-3.5 py-2 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة</span>
              </button>
            )}
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 py-4">
          <div className="p-3 rounded-2xl bg-[#132238]/90 border border-white/10 text-center">
            <span className="text-[10px] text-[#9EA7B8] block font-bold mb-0.5">إجمالي الإيجارات المستحقة</span>
            <span className="text-xs sm:text-sm font-black font-mono text-[#F8F9FB]">
              {group.totalDueRent.toLocaleString('ar-EG')} <span className="text-[9px] font-sans">ج.م</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#132238]/90 border border-white/10 text-center">
            <span className="text-[10px] text-[#9EA7B8] block font-bold mb-0.5">الإيجارات المحصلة فعلياً</span>
            <span className="text-xs sm:text-sm font-black font-mono text-emerald-400">
              {group.totalCollectedRent.toLocaleString('ar-EG')} <span className="text-[9px] font-sans">ج.م</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#132238]/90 border border-amber-500/20 text-center">
            <span className="text-[10px] text-amber-300 block font-bold mb-0.5">إجمالي عمولة المكتب</span>
            <span className="text-xs sm:text-sm font-black font-mono text-amber-300">
              {group.earnedCommission.toLocaleString('ar-EG')} <span className="text-[9px] font-sans">ج.م</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#132238]/90 border border-emerald-500/20 text-center">
            <span className="text-[10px] text-emerald-300 block font-bold mb-0.5">العمولة المحصلة من المالك</span>
            <span className="text-xs sm:text-sm font-black font-mono text-emerald-400">
              {group.amountCollectedFromOwner.toLocaleString('ar-EG')} <span className="text-[9px] font-sans">ج.م</span>
            </span>
          </div>

          <div className={`p-3 rounded-2xl border text-center ${group.remainingCommission > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
            <span className={`text-[10px] block font-bold mb-0.5 ${group.remainingCommission > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              المتبقي للتحصيل
            </span>
            <span className={`text-xs sm:text-sm font-black font-mono ${group.remainingCommission > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {group.remainingCommission.toLocaleString('ar-EG')} <span className="text-[9px] font-sans">ج.م</span>
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#132238]/90 border border-white/10 text-center">
            <span className="text-[10px] text-[#9EA7B8] block font-bold mb-0.5">حالة الشهور</span>
            <span className="text-xs sm:text-sm font-black font-mono text-slate-200">
              {group.collectedMonthsCount} / {group.monthsCount} <span className="text-[9px] font-sans">محصل</span>
            </span>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('statements')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'statements'
                ? 'bg-[#D4A84F] text-slate-950 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>كشف الشهور والعمولات ({group.statements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'units'
                ? 'bg-[#D4A84F] text-slate-950 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>الوحدات والمستأجرين ({propUnits.length})</span>
          </button>
        </div>

        {/* Tab 1: Monthly Statements */}
        {activeTab === 'statements' && (
          <div className="flex-1 overflow-y-auto min-h-[220px] rounded-2xl border border-white/10 bg-[#08111F]/80">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-[#132238] text-[#9EA7B8] font-bold border-b border-white/10 text-[11px] z-10">
                <tr>
                  <th className="p-3 text-center w-10">#</th>
                  <th className="p-3">الشهر / الفترة</th>
                  <th className="p-3">المستأجرين</th>
                  <th className="p-3 text-center">إيجار الشهر</th>
                  <th className="p-3 text-center">الإيجار المحصل</th>
                  <th className="p-3 text-center text-amber-300">عمولة المكتب</th>
                  <th className="p-3 text-center text-emerald-400">المحصل</th>
                  <th className="p-3 text-center">المتبقي</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">بيانات السداد</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {group.statements.map((stmt, idx) => {
                  const isStmtFullyPaid = (stmt.remainingCommission || 0) <= 0 && (stmt.earnedCommission || 0) > 0;
                  const isStmtPartial = (stmt.amountCollectedFromOwner || 0) > 0 && (stmt.remainingCommission || 0) > 0;

                  return (
                    <tr key={stmt.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{idx + 1}</td>
                      <td className="p-3 font-mono font-black text-slate-200">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                          {stmt.forMonthYear}
                        </span>
                      </td>
                      <td className="p-3 max-w-[150px]">
                        <span className="text-slate-300 text-[11px] block truncate" title={stmt.tenantNamesList || 'جميع المستأجرين'}>
                          {stmt.tenantNamesList || `${stmt.tenantCount || 0} مستأجرين`}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-300">
                        {stmt.totalDueRent.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-400">
                        {stmt.totalCollectedRent.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="p-3 text-center font-mono text-amber-300 font-black">
                        {stmt.earnedCommission.toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-400 font-black">
                        {(stmt.amountCollectedFromOwner || 0).toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className={`p-3 text-center font-mono font-black ${(stmt.remainingCommission || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {(stmt.remainingCommission || 0).toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="p-3 text-center">
                        {isStmtFullyPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-400" /> تم التحصيل
                          </span>
                        ) : isStmtPartial ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" /> تحصيل جزئي
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" /> غير محصل
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center text-[10px] text-[#9EA7B8]">
                        {stmt.collectionDate ? (
                          <div className="space-y-0.5">
                            <span className="text-slate-300 font-mono block">{stmt.collectionDate}</span>
                            <span className="text-[#D4A84F] block">{stmt.paymentMethod || 'نقدي'}</span>
                            {stmt.referenceNumber && (
                              <span className="text-slate-400 font-mono block">سند: {stmt.referenceNumber}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {stmt.remainingCommission > 0 ? (
                            <button
                              type="button"
                              onClick={() => onCollectStatement(stmt)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                              title="تحصيل عمولة هذا الشهر"
                            >
                              <Coins className="w-3 h-3 text-amber-300" />
                              <span>تحصيل</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevertStmt(stmt)}
                              disabled={revertingId === stmt.id}
                              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              title="تراجع عن تحصيل عمولة هذا الشهر"
                            >
                              <RotateCcw className="w-3 h-3 text-rose-400" />
                              <span>تراجع</span>
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
        )}

        {/* Tab 2: Units & Active Tenants */}
        {activeTab === 'units' && (
          <div className="flex-1 overflow-y-auto min-h-[220px] rounded-2xl border border-white/10 bg-[#08111F]/80">
            {propUnits.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Home className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs">لا توجد وحدات مسجلة لهذا العقار بعد.</p>
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-[#132238] text-[#9EA7B8] font-bold border-b border-white/10 text-[11px] z-10">
                  <tr>
                    <th className="p-3 text-center w-10">#</th>
                    <th className="p-3">رقم الوحدة</th>
                    <th className="p-3">نوع الوحدة</th>
                    <th className="p-3">المستأجر الحالي</th>
                    <th className="p-3">هاتف المستأجر</th>
                    <th className="p-3 text-center">القيمة الإيجارية</th>
                    <th className="p-3 text-center">حالة الوحدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {propUnits.map((u, idx) => {
                    const tenant = tenants.find(t => t.unitId === u.id);
                    const activityTypeLabel = u.activityType === "commercial" ? "تجاري" : u.activityType === "administrative" ? "إداري" : "سكني";
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{idx + 1}</td>
                        <td className="p-3 font-bold text-[#F8F9FB] flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-[#D4A84F]" />
                          <span>وحدة {u.unitNumber} {u.floor ? `(طابق ${u.floor})` : ""}</span>
                        </td>
                        <td className="p-3 text-slate-300">{activityTypeLabel}</td>
                        <td className="p-3 font-bold text-slate-200">
                          {tenant ? tenant.fullName : <span className="text-slate-500 font-normal">شاغرة / غير مؤجرة</span>}
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {tenant?.phone || "-"}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-amber-300">
                          {(tenant?.rentAmount || u.rentValue || 0).toLocaleString("ar-EG")} ج.م
                        </td>
                        <td className="p-3 text-center">
                          {tenant || u.status === "rented" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              مؤجرة
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                              شاغرة
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Confirmation Modal for Reverting Commission */}
        {confirmRevertStmt && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#132238] border border-rose-500/40 rounded-2xl p-5 w-full max-w-md shadow-2xl text-[#F8F9FB] space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm">تأكيد التراجع عن تحصيل العمولة</h3>
                  <p className="text-xs text-[#9EA7B8] mt-0.5">
                    عن فترة: <span className="font-mono text-amber-300">{confirmRevertStmt.forMonthYear}</span>
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-[#08111F]/70 p-3 rounded-xl border border-white/10">
                هل أنت متأكد من إلغاء وتصفير سند التحصيل المسجل لهذه الفترة؟ ستعود حالة العمولة إلى غير محصلة وسيعود المبلغ المتبقي كما كان.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmRevertStmt(null)}
                  disabled={!!revertingId}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer border border-white/10"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevert}
                  disabled={!!revertingId}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {revertingId ? 'جاري التراجع...' : 'تأكيد التراجع'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10 text-xs">
          <div className="text-[11px] text-[#9EA7B8] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#D4A84F]" />
            <span>بيانات العمولة محدثة ومتزامنة سحابياً مع سجلات الإيجارات والملاك</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs transition-colors cursor-pointer border border-white/10"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
}
