import React, { useState, useMemo } from 'react';
import RealEstateReportModal, { 
  generateRealEstateReportHTML, 
  printReportDirectly, 
  ReportType 
} from './RealEstateReportModal';
import { 
  Wallet, Receipt, Building, Users, Calendar, AlertCircle, 
  CheckCircle, Clock, DollarSign, Printer, Search, Filter, 
  ArrowUpRight, ArrowDownLeft, FileText, Landmark, RefreshCw, 
  ChevronLeft, ShieldCheck, Eye, Plus, Check, SlidersHorizontal,
  TrendingUp, PieChart, FileBarChart, CreditCard, ChevronRight,
  AlertTriangle, Lock, Unlock, HelpCircle, UserCheck, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, 
  ReRentDue, User 
} from '../../types';

interface RealEstateFinancialsProps {
  dues: ReRentDue[];
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  collections: ReCollectionReceipt[];
  payouts: RePayout[];
  expenses: RePropertyExpense[];
  currentUser: User;
  activeSubTab: string;
  onNavigateSubTab: (subTab: any) => void;
  onCollectRent: (due: ReRentDue) => void;
  onPayoutOwner: (due: ReRentDue) => void;
  onCloseMonthDue?: (dueId: string) => void;
}

export default function RealEstateFinancials({
  dues,
  owners,
  properties,
  units,
  tenants,
  collections,
  payouts,
  expenses,
  currentUser,
  activeSubTab,
  onNavigateSubTab,
  onCollectRent,
  onPayoutOwner,
  onCloseMonthDue
}: RealEstateFinancialsProps) {

  // Current Date defaults
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthISO = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Internal Navigation State inside Financials
  const [currentTab, setCurrentTab] = useState<
    'overview' | 'dues' | 'payouts' | 'property_statements' | 'owner_statements' | 'tenant_statements' | 'closing' | 'reports'
  >(() => {
    if (activeSubTab === 'payouts') return 'payouts';
    if (activeSubTab === 'reports') return 'reports';
    if (activeSubTab === 'property_statements') return 'property_statements';
    if (activeSubTab === 'owner_statements') return 'owner_statements';
    if (activeSubTab === 'tenant_statements') return 'tenant_statements';
    if (activeSubTab === 'closing') return 'closing';
    if (activeSubTab === 'overview' || activeSubTab === 'financials') return 'overview';
    return 'dues';
  });

  // Filter States
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthISO);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payoutFilter, setPayoutFilter] = useState<string>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  // Report Specific Selector
  const [reportType, setReportType] = useState<
    'property_monthly' | 'owner_statement' | 'tenant_statement' | 'owner_payouts' | 'tenant_collections' | 'arrears' | 'office_commissions' | 'office_advances'
  >('property_monthly');

  // Payouts sub-tab state
  const [payoutSubTab, setPayoutSubTab] = useState<'urgent' | 'post_collection' | 'property_calculation'>('urgent');

  // Compute status helpers
  const getDuePayoutStatus = (due: ReRentDue): 'paid_out' | 'pending_payout' => {
    if (due.payoutStatus === 'paid_out' || due.status === 'paid_out' || due.payoutDate) {
      return 'paid_out';
    }
    return 'pending_payout';
  };

  const getDueCollectionStatus = (due: ReRentDue): 'collected' | 'overdue' | 'pending_collection' => {
    if (due.collectionStatus === 'collected' || due.status === 'collected' || due.collectedAmount! > 0 || due.paidDate) {
      return 'collected';
    }
    if (due.dueDate < todayISO || due.forMonthYear < currentMonthISO) {
      return 'overdue';
    }
    return 'pending_collection';
  };

  const getDueReconciliationStatus = (due: ReRentDue) => {
    const pStatus = getDuePayoutStatus(due);
    const cStatus = getDueCollectionStatus(due);

    if (due.monthClosingStatus === 'closed') {
      return { label: 'مغلق ومطابق 🔒', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    }
    if (pStatus === 'paid_out' && cStatus === 'collected') {
      return { label: 'جاهز للإغلاق 🟢', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
    }
    if (pStatus === 'paid_out' && cStatus !== 'collected') {
      return { label: 'سلفة مكتب (صرف مقدماً) 🔵', color: 'bg-sky-500/20 text-sky-400 border-sky-500/40' };
    }
    if (cStatus === 'collected' && pStatus !== 'paid_out') {
      return { label: 'محصل (بانتظار المالك) 🟡', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    }
    if (cStatus === 'overdue') {
      return { label: 'متأخر في السداد ⚠️', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
    }
    return { label: 'معلق (بانتظار إجراء) ⏳', color: 'bg-[#9EA7B8]/20 text-[#9EA7B8] border-[#9EA7B8]/30' };
  };

  // FINANCIAL DASHBOARD METRICS
  const metrics = useMemo(() => {
    let totalDueRents = 0;
    let totalCollectedRents = 0;
    let totalDisbursedToOwners = 0;
    let totalOfficeCommission = 0;
    let totalOfficeAdvances = 0; // Paid to owners but NOT yet collected from tenants
    let totalOverdueRents = 0;
    let overdueCount = 0;

    dues.forEach(due => {
      totalDueRents += due.rentAmount;

      const pStatus = getDuePayoutStatus(due);
      const cStatus = getDueCollectionStatus(due);

      if (cStatus === 'collected') {
        const collected = due.collectedAmount || due.rentAmount;
        totalCollectedRents += collected;
        totalOfficeCommission += due.commissionAmount;
      }

      if (pStatus === 'paid_out') {
        totalDisbursedToOwners += due.netOwnerAmount;
        // Office Advance: office paid owner, but tenant has NOT paid yet!
        if (cStatus !== 'collected') {
          totalOfficeAdvances += due.netOwnerAmount;
        }
      }

      if (cStatus === 'overdue') {
        totalOverdueRents += due.rentAmount;
        overdueCount++;
      }
    });

    return {
      totalDueRents,
      totalCollectedRents,
      totalDisbursedToOwners,
      totalOfficeCommission,
      totalOfficeAdvances,
      totalOverdueRents,
      overdueCount
    };
  }, [dues, todayISO, currentMonthISO]);

  // PROPERTY BALANCES SUMMARY
  const propertyBalances = useMemo(() => {
    return properties.map(prop => {
      const propDues = dues.filter(d => d.propertyId === prop.id);
      const owner = owners.find(o => o.id === prop.ownerId);

      let dueSum = 0;
      let collectedSum = 0;
      let disbursedSum = 0;
      let commissionSum = 0;
      let officeAdvanceSum = 0;

      propDues.forEach(d => {
        dueSum += d.rentAmount;
        const pStatus = getDuePayoutStatus(d);
        const cStatus = getDueCollectionStatus(d);

        if (cStatus === 'collected') {
          collectedSum += d.collectedAmount || d.rentAmount;
          commissionSum += d.commissionAmount;
        }
        if (pStatus === 'paid_out') {
          disbursedSum += d.netOwnerAmount;
          if (cStatus !== 'collected') {
            officeAdvanceSum += d.netOwnerAmount;
          }
        }
      });

      return {
        property: prop,
        owner,
        dueSum,
        collectedSum,
        disbursedSum,
        commissionSum,
        officeAdvanceSum,
        netCashFlow: collectedSum - disbursedSum - commissionSum
      };
    });
  }, [properties, dues, owners, todayISO, currentMonthISO]);

  // OWNER BALANCES SUMMARY
  const ownerBalances = useMemo(() => {
    return owners.map(owner => {
      const ownerDues = dues.filter(d => d.ownerId === owner.id);

      let totalOwnerDueRent = 0;
      let totalOwnerCollected = 0;
      let totalOwnerDisbursed = 0;
      let totalPendingPayout = 0;
      let totalOfficeAdvanceGiven = 0;

      ownerDues.forEach(d => {
        totalOwnerDueRent += d.rentAmount;
        const pStatus = getDuePayoutStatus(d);
        const cStatus = getDueCollectionStatus(d);

        if (cStatus === 'collected') {
          totalOwnerCollected += d.collectedAmount || d.rentAmount;
          if (pStatus !== 'paid_out') {
            totalPendingPayout += d.netOwnerAmount;
          }
        }
        if (pStatus === 'paid_out') {
          totalOwnerDisbursed += d.netOwnerAmount;
          if (cStatus !== 'collected') {
            totalOfficeAdvanceGiven += d.netOwnerAmount;
          }
        }
      });

      return {
        owner,
        totalOwnerDueRent,
        totalOwnerCollected,
        totalOwnerDisbursed,
        totalPendingPayout,
        totalOfficeAdvanceGiven
      };
    });
  }, [owners, dues, todayISO, currentMonthISO]);

  // FILTERED DUES FOR MAIN TABLE
  const filteredDues = useMemo(() => {
    return dues.filter(due => {
      const pStatus = getDuePayoutStatus(due);
      const cStatus = getDueCollectionStatus(due);

      const matchesMonth = selectedMonthYear === 'all' || due.forMonthYear === selectedMonthYear;

      const matchesSearch = !searchQuery ? true : (
        due.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (due.propertyName && due.propertyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (due.unitNumber && due.unitNumber.includes(searchQuery)) ||
        (due.ownerName && due.ownerName.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      const matchesOwner = selectedOwnerId === 'all' || due.ownerId === selectedOwnerId;
      const matchesProperty = selectedPropertyId === 'all' || due.propertyId === selectedPropertyId;

      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (statusFilter === 'payout_done') matchesStatus = pStatus === 'paid_out';
        else if (statusFilter === 'payout_pending') matchesStatus = pStatus === 'pending_payout';
        else if (statusFilter === 'collected') matchesStatus = cStatus === 'collected';
        else if (statusFilter === 'overdue') matchesStatus = cStatus === 'overdue';
        else if (statusFilter === 'advance_paid') matchesStatus = (pStatus === 'paid_out' && cStatus !== 'collected');
      }

      return matchesMonth && matchesSearch && matchesOwner && matchesProperty && matchesStatus;
    });
  }, [dues, selectedMonthYear, searchQuery, selectedOwnerId, selectedPropertyId, statusFilter, todayISO, currentMonthISO]);

  // Modal State for Official Report Preview & Printing
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [modalReportType, setModalReportType] = useState<ReportType>('property_monthly');

  const handleOpenReportPreview = (type?: ReportType) => {
    if (type) setModalReportType(type);
    else setModalReportType(reportType);
    setIsReportModalOpen(true);
  };

  const handlePrintReportDirectly = (type?: ReportType) => {
    const activeType = type || reportType;
    const html = generateRealEstateReportHTML({
      reportType: activeType,
      dues,
      owners,
      properties,
      units,
      tenants,
      selectedPropertyId,
      selectedOwnerId,
      selectedTenantId,
      selectedMonthYear,
      currentUser
    });
    printReportDirectly(html);
  };

  return (
    <div className="space-y-6 text-[#F8F9FB]" dir="rtl">
      
      {/* 1. KEY FINANCIAL KPI DASHBOARD HEADER (6 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        
        {/* KPI 1: Total Due Rents */}
        <div className="bg-[#132238]/60 backdrop-blur-md p-4 rounded-2xl border border-[#D4A84F]/15 shadow-xl relative overflow-hidden group hover:border-[#D4A84F]/40 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] text-[#9EA7B8] font-bold">إجمالي الإيجارات المستحقة</span>
            <div className="p-2 rounded-xl bg-[#D4A84F]/10 text-[#D4A84F]">
              <Receipt className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-lg font-black text-[#F8F9FB] font-mono tracking-tight mt-1">
            {metrics.totalDueRents.toLocaleString('ar-EG')} <span className="text-[10px] text-[#D4A84F] font-sans">ج.م</span>
          </p>
          <span className="text-[9px] text-[#9EA7B8] block mt-1">إجمالي استحقاقات العقود</span>
        </div>

        {/* KPI 2: Total Collected Rents */}
        <div className="bg-[#132238]/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] text-[#9EA7B8] font-bold">الإيجارات المحصلة</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-lg font-black text-emerald-400 font-mono tracking-tight mt-1">
            {metrics.totalCollectedRents.toLocaleString('ar-EG')} <span className="text-[10px] text-emerald-300 font-sans">ج.م</span>
          </p>
          <span className="text-[9px] text-emerald-500/80 block mt-1">سندات القبض المودعة</span>
        </div>

        {/* KPI 3: Total Disbursed to Owners */}
        <div className="bg-[#132238]/60 backdrop-blur-md p-4 rounded-2xl border border-sky-500/20 shadow-xl relative overflow-hidden group hover:border-sky-500/40 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] text-[#9EA7B8] font-bold">المصروف للملاك</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Landmark className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-lg font-black text-sky-400 font-mono tracking-tight mt-1">
            {metrics.totalDisbursedToOwners.toLocaleString('ar-EG')} <span className="text-[10px] text-sky-300 font-sans">ج.م</span>
          </p>
          <span className="text-[9px] text-sky-500/80 block mt-1">إجمالي المستحقات المسلمة</span>
        </div>

        {/* KPI 4: Total Office Commission */}
        <div className="bg-[#132238]/60 backdrop-blur-md p-4 rounded-2xl border border-amber-500/20 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] text-[#9EA7B8] font-bold">عمولات المكتب</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-lg font-black text-amber-400 font-mono tracking-tight mt-1">
            {metrics.totalOfficeCommission.toLocaleString('ar-EG')} <span className="text-[10px] text-amber-300 font-sans">ج.م</span>
          </p>
          <span className="text-[9px] text-amber-500/80 block mt-1">إجمالي إيراد الإدارة العقارية</span>
        </div>

        {/* KPI 5: Office Advance Balance (Paid to owners, uncollected from tenants) */}
        <div className="bg-[#132238]/60 backdrop-blur-md p-4 rounded-2xl border border-purple-500/30 shadow-xl relative overflow-hidden group hover:border-purple-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] text-[#9EA7B8] font-bold">سُلف المكتب للملاك</span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <Wallet className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-lg font-black text-purple-300 font-mono tracking-tight mt-1">
            {metrics.totalOfficeAdvances.toLocaleString('ar-EG')} <span className="text-[10px] text-purple-200 font-sans">ج.م</span>
          </p>
          <span className="text-[9px] text-purple-400 block mt-1 font-bold">مدفوعة للمالك وقيد التحصيل</span>
        </div>

        {/* KPI 6: Overdue Rent */}
        <div className="bg-[#132238]/60 backdrop-blur-md p-4 rounded-2xl border border-rose-500/30 shadow-xl relative overflow-hidden group hover:border-rose-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[11px] text-[#9EA7B8] font-bold">إيجارات متأخرة</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertCircle className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-lg font-black text-rose-400 font-mono tracking-tight mt-1">
            {metrics.totalOverdueRents.toLocaleString('ar-EG')} <span className="text-[10px] text-rose-300 font-sans">ج.م</span>
          </p>
          <span className="text-[9px] text-rose-400/90 block mt-1 font-bold">{metrics.overdueCount} مستأجر متأخر في السداد</span>
        </div>

      </div>

      {/* 2. SUB-NAVIGATION BAR FOR FINANCIAL TOOLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#132238]/40 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'overview', label: 'اللوحة المالية الشاملة', icon: PieChart },
            { id: 'dues', label: 'الإيجارات والتحصيل', icon: Receipt },
            { id: 'payouts', label: 'مستحقات الملاك والسُلف', icon: Wallet },
            { id: 'property_statements', label: 'كشف حساب العقارات', icon: Building },
            { id: 'owner_statements', label: 'كشف حساب الملاك', icon: Users },
            { id: 'tenant_statements', label: 'كشف حساب المستأجرين', icon: FileText },
            { id: 'closing', label: 'المطابقة والإغلاق المالي', icon: Lock },
            { id: 'reports', label: 'التقارير المالية والطباعة', icon: Printer }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentTab(tab.id as any);
                onNavigateSubTab(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                currentTab === tab.id
                  ? 'bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 shadow-lg shadow-[#D4A84F]/20'
                  : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenReportPreview(reportType)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/30 text-[#D4A84F] hover:bg-[#D4A84F]/10 text-xs font-bold transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>معاينة التقرير</span>
          </button>
          <button
            onClick={() => handlePrintReportDirectly(reportType)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 text-xs font-black hover:brightness-110 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>طباعة التقرير الرسمي PDF</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: اللوحة المالية الشاملة (FINANCIAL OVERVIEW) */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Office Advance Notice Banner */}
          {metrics.totalOfficeAdvances > 0 && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-purple-300">سُلف ومستحقات معلقة للمكتب طرف المستأجرين</h4>
                  <p className="text-[11px] text-[#9EA7B8] font-bold">
                    قام المكتب بصرف مبلغ <strong className="text-purple-300 font-mono">{metrics.totalOfficeAdvances.toLocaleString('ar-EG')} ج.م</strong> للملاك مقدماً قبل تحصيل الإيجار من المستأجرين. يرجى متابعة التحصيل لإغلاق الذمة المالية.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentTab('dues')}
                className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-black hover:bg-purple-500/30 transition-all cursor-pointer whitespace-nowrap"
              >
                متابعة التحصيل
              </button>
            </div>
          )}

          {/* Property Balances Summary Cards */}
          <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-[#D4A84F]" />
                <h3 className="text-xs font-black text-[#F8F9FB]">ملخص الموقف المالي ورصيد كل عقار</h3>
              </div>
              <span className="text-[10px] text-[#9EA7B8] font-bold">{properties.length} عقار مسجل</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#08111F]/80 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/10">
                    <th className="p-3">اسم العقار والمالك</th>
                    <th className="p-3">إجمالي الإيجار المستحق</th>
                    <th className="p-3">المحصل من المستأجرين</th>
                    <th className="p-3">المصروف للمالك</th>
                    <th className="p-3">عمولة المكتب</th>
                    <th className="p-3">سُلف المكتب (فرق الصرف)</th>
                    <th className="p-3 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                  {propertyBalances.map(pb => (
                    <tr key={pb.property.id} className="hover:bg-[#08111F]/40 transition-all">
                      <td className="p-3">
                        <div className="font-extrabold text-[#F8F9FB]">{pb.property.name}</div>
                        <span className="text-[10px] text-[#D4A84F]">{pb.owner?.name || 'مالك'}</span>
                      </td>
                      <td className="p-3 font-mono text-[#F8F9FB]">{pb.dueSum.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-emerald-400">{pb.collectedSum.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-sky-400">{pb.disbursedSum.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-amber-400">{pb.commissionSum.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-purple-300">
                        {pb.officeAdvanceSum > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-black">
                            {pb.officeAdvanceSum.toLocaleString('ar-EG')} ج.م
                          </span>
                        ) : (
                          '0 ج.م'
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedPropertyId(pb.property.id);
                            setCurrentTab('property_statements');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#D4A84F]/10 text-[#D4A84F] hover:bg-[#D4A84F]/20 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          كشف الحساب
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Owner Balances Summary */}
          <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D4A84F]" />
                <h3 className="text-xs font-black text-[#F8F9FB]">ملخص المستحقات والسيولة لكل مالك</h3>
              </div>
              <span className="text-[10px] text-[#9EA7B8] font-bold">{owners.length} مالك مسجل</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#08111F]/80 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/10">
                    <th className="p-3">اسم المالك</th>
                    <th className="p-3">آلية العمولة</th>
                    <th className="p-3">إجمالي الإيجارات</th>
                    <th className="p-3">المحصل من إيجاراته</th>
                    <th className="p-3">المصروف له بالفعل</th>
                    <th className="p-3">مستحقات معلقة للصرف</th>
                    <th className="p-3">سُلف مسددة له مقدماً</th>
                    <th className="p-3 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                  {ownerBalances.map(ob => (
                    <tr key={ob.owner.id} className="hover:bg-[#08111F]/40 transition-all">
                      <td className="p-3 font-extrabold text-[#F8F9FB]">{ob.owner.name}</td>
                      <td className="p-3 text-[#9EA7B8]">
                        {ob.owner.commissionType === 'percentage' ? `${ob.owner.commissionValue}% نسبة` : `${ob.owner.commissionValue} ج.م`}
                      </td>
                      <td className="p-3 font-mono text-[#F8F9FB]">{ob.totalOwnerDueRent.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-emerald-400">{ob.totalOwnerCollected.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-sky-400">{ob.totalOwnerDisbursed.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-amber-400">{ob.totalPendingPayout.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 font-mono text-purple-300">{ob.totalOfficeAdvanceGiven.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedOwnerId(ob.owner.id);
                            setCurrentTab('owner_statements');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#D4A84F]/10 text-[#D4A84F] hover:bg-[#D4A84F]/20 text-[11px] font-bold transition-all cursor-pointer"
                        >
                          كشف الحساب
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: الإيجارات المستحقة والتحصيل (DUES & COLLECTION) */}
      {currentTab === 'dues' && (
        <div className="space-y-4">
          
          {/* Controls & Search Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
            
            {/* Search input */}
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-[#9EA7B8] absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث باسم المستأجر، العقار، المالك، رقم الوحدة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] placeholder-[#9EA7B8] focus:border-[#D4A84F] outline-none font-bold"
              />
            </div>

            {/* Month & Year Picker */}
            <div>
              <input
                type="month"
                value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] focus:border-[#D4A84F] outline-none font-bold"
              />
            </div>

            {/* Owner Filter */}
            <div>
              <select
                value={selectedOwnerId}
                onChange={e => setSelectedOwnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] focus:border-[#D4A84F] outline-none font-bold"
              >
                <option value="all">جميع الملاك</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Property Filter */}
            <div>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] focus:border-[#D4A84F] outline-none font-bold"
              >
                <option value="all">جميع العقارات</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] focus:border-[#D4A84F] outline-none font-bold"
              >
                <option value="all">جميع الحالات</option>
                <option value="payout_pending">بانتظار صرف المالك</option>
                <option value="payout_done">تم الصرف للمالك</option>
                <option value="collected">تم تحصيل المستأجر</option>
                <option value="overdue">متأخر عن السداد ⚠️</option>
                <option value="advance_paid">سُلفة مكتب (صرف قبل التحصيل)</option>
              </select>
            </div>

          </div>

          {/* Rent Dues Main Table */}
          <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#D4A84F]/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#D4A84F]" />
                <h3 className="text-xs font-black text-[#F8F9FB]">
                  جدول استحقاقات الإيجار والصرف والتحصيل ({selectedMonthYear === 'all' ? 'جميع الشهور' : selectedMonthYear})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4A84F]/15 text-[#D4A84F]">
                  {filteredDues.length} عقد/استحقاق
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                    <th className="p-3">الشهر / المستأجر</th>
                    <th className="p-3">العقار والوحدة</th>
                    <th className="p-3">المالك</th>
                    <th className="p-3">الإيجار / العمولة</th>
                    <th className="p-3">صافي المالك</th>
                    <th className="p-3">حالة صرف المالك</th>
                    <th className="p-3">حالة تحصيل المستأجر</th>
                    <th className="p-3">حالة المطابقة</th>
                    <th className="p-3 text-center">الإجراءات والتحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A84F]/10">
                  {filteredDues.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[#9EA7B8]">
                        <Clock className="w-8 h-8 text-[#D4A84F]/40 mx-auto mb-2" />
                        <p className="text-xs font-bold">لا توجد سجلات إيجارات مستحقة مطابقة للفلاتر المختارة.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDues.map((due) => {
                      const pStatus = getDuePayoutStatus(due);
                      const cStatus = getDueCollectionStatus(due);
                      const recon = getDueReconciliationStatus(due);
                      
                      return (
                        <tr key={due.id} className="hover:bg-[#08111F]/40 transition-all">
                          <td className="p-3">
                            <div className="font-extrabold text-[#F8F9FB]">{due.tenantName}</div>
                            <span className="text-[10px] text-[#9EA7B8] font-mono">{due.monthNameAr || due.forMonthYear}</span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-[#F8F9FB]">{due.propertyName || 'عقار'}</div>
                            <span className="text-[10px] text-[#D4A84F] font-bold">وحدة {due.unitNumber}</span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-[#9EA7B8]">{due.ownerName || 'مالك'}</div>
                            <span className="text-[10px] text-[#9EA7B8] font-mono">{due.contractNumber || 'عقد'}</span>
                          </td>
                          <td className="p-3 font-mono">
                            <div className="font-extrabold text-[#F8F9FB]">{due.rentAmount.toLocaleString('ar-EG')} <span className="text-[9px] text-[#9EA7B8]">ج.م</span></div>
                            <span className="text-[10px] text-amber-400 font-bold">عمولة: {due.commissionAmount.toLocaleString('ar-EG')} ج.م</span>
                          </td>
                          <td className="p-3 font-mono text-[#D4A84F] font-extrabold text-sm">
                            {due.netOwnerAmount.toLocaleString('ar-EG')} <span className="text-[9px] text-[#D4A84F]">ج.م</span>
                          </td>
                          
                          {/* Owner Payout Status */}
                          <td className="p-3">
                            {pStatus === 'paid_out' ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle className="w-3 h-3" /> تم الصرف
                                </span>
                                <span className="block text-[9px] text-[#9EA7B8] font-mono">{due.payoutDate || due.paidDate || ''}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="w-3 h-3" /> بانتظار الصرف
                              </span>
                            )}
                          </td>

                          {/* Tenant Collection Status */}
                          <td className="p-3">
                            {cStatus === 'collected' ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle className="w-3 h-3" /> تم التحصيل
                                </span>
                                <span className="block text-[9px] text-emerald-300 font-mono">إيصال #{due.receiptNumber || 'محصل'}</span>
                              </div>
                            ) : cStatus === 'overdue' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                <AlertCircle className="w-3 h-3" /> متأخر
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-slate-500/15 text-slate-300 border border-slate-500/30">
                                <Clock className="w-3 h-3" /> بانتظار السداد
                              </span>
                            )}
                          </td>

                          {/* Matching Status */}
                          <td className="p-3">
                            <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-black border ${recon.color}`}>
                              {recon.label}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Button to Disburse to Owner */}
                              {pStatus !== 'paid_out' && (
                                <button
                                  onClick={() => onPayoutOwner(due)}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 text-[11px] font-black hover:brightness-110 shadow-md shadow-[#D4A84F]/10 transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="صرف مستحق المالك (حتى قبل تحصيل المستأجر)"
                                >
                                  <Wallet className="w-3 h-3 stroke-[2.2]" />
                                  <span>صرف المالك</span>
                                </button>
                              )}

                              {/* 2. Button to Collect from Tenant */}
                              {cStatus !== 'collected' && (
                                <button
                                  onClick={() => onCollectRent(due)}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 text-[11px] font-black hover:brightness-110 shadow-md shadow-emerald-500/10 transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="تحصيل مبلغ الإيجار من المستأجر"
                                >
                                  <DollarSign className="w-3 h-3 stroke-[2.5]" />
                                  <span>تحصيل الإيجار</span>
                                </button>
                              )}

                              {pStatus === 'paid_out' && cStatus === 'collected' && (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> مكتمل
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 3: مستحقات الملاك وسُلف المكتب (OWNER PAYOUTS & ADVANCE QUEUE) */}
      {currentTab === 'payouts' && (
        <div className="space-y-4">
          
          {/* Header Banner & Summary */}
          <div className="p-4 bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#D4A84F]/15 text-[#D4A84F]">
                <Wallet className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#F8F9FB]">دورة مستحقات الملاك والسُلف المالية والمطابقة</h3>
                <p className="text-xs text-[#9EA7B8]">
                  يتم صرف مستحقات المالك أولاً (عاجل/سُلفة) مع خصم عمولة المكتب تلقائياً، ثم متابعة التحصيل من المستأجرين لاحقاً للتحقيق والمطابقة.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-left font-mono">
              <div className="bg-[#08111F]/60 px-3 py-1.5 rounded-xl border border-[#D4A84F]/10">
                <span className="text-[10px] text-[#9EA7B8] block font-bold">المصروف للملاك:</span>
                <span className="text-lg font-black text-emerald-400">
                  {metrics.totalDisbursedToOwners.toLocaleString('ar-EG')} <span className="text-xs font-sans">ج.م</span>
                </span>
              </div>
              <div className="bg-[#08111F]/60 px-3 py-1.5 rounded-xl border border-[#D4A84F]/10">
                <span className="text-[10px] text-[#9EA7B8] block font-bold">سُلف المكتب (فرق التحصيل):</span>
                <span className="text-lg font-black text-purple-300">
                  {metrics.totalOfficeAdvances.toLocaleString('ar-EG')} <span className="text-xs font-sans">ج.م</span>
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Selector inside Payouts */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#132238]/40 p-2 rounded-2xl border border-[#D4A84F]/15">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPayoutSubTab('urgent')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  payoutSubTab === 'urgent'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>1. مستحقات عاجلة (قبل التحصيل - سُلف)</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/30 text-slate-900 font-mono">
                  {dues.filter(d => getDuePayoutStatus(d) !== 'paid_out').length}
                </span>
              </button>

              <button
                onClick={() => setPayoutSubTab('post_collection')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  payoutSubTab === 'post_collection'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>2. مستحقات مؤجلة ومطابقة (بعد التحصيل)</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/30 text-slate-900 font-mono">
                  {dues.filter(d => getDuePayoutStatus(d) === 'paid_out' || getDueCollectionStatus(d) === 'collected').length}
                </span>
              </button>

              <button
                onClick={() => setPayoutSubTab('property_calculation')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  payoutSubTab === 'property_calculation'
                    ? 'bg-[#D4A84F] text-slate-950 shadow-lg shadow-[#D4A84F]/20'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <FileBarChart className="w-3.5 h-3.5" />
                <span>3. طريقة الاحتساب التلقائي لكل عقار وشهر</span>
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <select
                value={selectedOwnerId}
                onChange={e => setSelectedOwnerId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#08111F]/80 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold outline-none"
              >
                <option value="all">جميع الملاك</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>

              <input
                type="month"
                value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                className="px-3 py-1.5 rounded-xl bg-[#08111F]/80 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold outline-none"
              />
            </div>
          </div>

          {/* SUB-VIEW 1: Urgent Payouts Queue (Before Tenant Collection) */}
          {payoutSubTab === 'urgent' && (
            <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-amber-500/20 overflow-hidden shadow-xl space-y-3">
              <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                  <h4 className="text-xs font-black">المستحقات العاجلة للملاك الواجب صرفها فوراً (خصم العمولة تلقائياً قبل الصرف)</h4>
                </div>
                <span className="text-[10px] text-amber-200/80 font-bold">
                  يتم الاحتساب والتحديث تلقائياً لكل شهر وعقار
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                      <th className="p-3">#</th>
                      <th className="p-3">المالك والعقار</th>
                      <th className="p-3">المستأجر والوحدة</th>
                      <th className="p-3">الشهر المستحق</th>
                      <th className="p-3">إجمالي الإيجار</th>
                      <th className="p-3">عمولة المكتب (تخصم تلقائياً)</th>
                      <th className="p-3">صافي مستحق المالك</th>
                      <th className="p-3">حالة الصرف</th>
                      <th className="p-3 text-center">إجراء الصرف العاجل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                    {(() => {
                      const urgentDues = dues.filter(d => {
                        const pStatus = getDuePayoutStatus(d);
                        const matchOwner = selectedOwnerId === 'all' || d.ownerId === selectedOwnerId;
                        const matchMonth = selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear;
                        return pStatus !== 'paid_out' && matchOwner && matchMonth;
                      });

                      if (urgentDues.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-[#9EA7B8]">
                              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                              <p className="text-xs font-bold text-emerald-400">ممتاز! تم صرف جميع مستحقات الملاك العاجلة المفلترة.</p>
                            </td>
                          </tr>
                        );
                      }

                      let sumRent = 0;
                      let sumComm = 0;
                      let sumNet = 0;

                      return (
                        <>
                          {urgentDues.map((due, idx) => {
                            sumRent += due.rentAmount;
                            sumComm += due.commissionAmount;
                            sumNet += due.netOwnerAmount;

                            return (
                              <tr key={due.id} className="hover:bg-[#08111F]/40 transition-all">
                                <td className="p-3 text-[#9EA7B8] font-mono">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-extrabold text-[#F8F9FB]">{due.ownerName}</div>
                                  <span className="text-[10px] text-[#D4A84F]">{due.propertyName}</span>
                                </td>
                                <td className="p-3">
                                  <div className="text-[#F8F9FB]">{due.tenantName}</div>
                                  <span className="text-[10px] text-[#9EA7B8]">وحدة {due.unitNumber}</span>
                                </td>
                                <td className="p-3 font-mono text-[#F8F9FB]">{due.monthNameAr || due.forMonthYear}</td>
                                <td className="p-3 font-mono text-[#F8F9FB]">{due.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-amber-400">{due.commissionAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-[#D4A84F] font-black text-sm">{due.netOwnerAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <Clock className="w-3 h-3" /> بانتظار الصرف
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => onPayoutOwner(due)}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 shadow-lg shadow-[#D4A84F]/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                  >
                                    <Wallet className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>صرف صافي المستحق</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          
                          {/* Totals Summary Row */}
                          <tr className="bg-[#08111F]/90 border-t-2 border-[#D4A84F]/30 text-xs font-black">
                            <td colSpan={4} className="p-3 text-left text-[#D4A84F]">إجمالي المستحقات العاجلة المعلقة للصرف:</td>
                            <td className="p-3 font-mono text-[#F8F9FB]">{sumRent.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-amber-400">{sumComm.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-[#D4A84F] text-base">{sumNet.toLocaleString('ar-EG')} ج.م</td>
                            <td colSpan={2} className="p-3 text-center text-[#9EA7B8]">{urgentDues.length} إذن صرف عاجل</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: Post-Collection & Reconciliation Queue */}
          {payoutSubTab === 'post_collection' && (
            <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-emerald-500/20 overflow-hidden shadow-xl space-y-3">
              <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                  <h4 className="text-xs font-black">المستحقات المصروفة والمحصّلة (المطابقة المالية وإغلاق الشهر)</h4>
                </div>
                <span className="text-[10px] text-emerald-200/80 font-bold">تطابق مبالغ التحصيل مع مبالغ الصرف</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                      <th className="p-3">#</th>
                      <th className="p-3">المالك والعقار</th>
                      <th className="p-3">المستأجر والشهر</th>
                      <th className="p-3">صافي المستحق</th>
                      <th className="p-3">المصروف للمالك</th>
                      <th className="p-3">المحصل من المستأجر</th>
                      <th className="p-3">فرق السُلفة (الرصيد)</th>
                      <th className="p-3">حالة المطابقة والتحصيل</th>
                      <th className="p-3 text-center">إغلاق/اعتماد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                    {(() => {
                      const matchedDues = dues.filter(d => {
                        const pStatus = getDuePayoutStatus(d);
                        const cStatus = getDueCollectionStatus(d);
                        const matchOwner = selectedOwnerId === 'all' || d.ownerId === selectedOwnerId;
                        const matchMonth = selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear;
                        return (pStatus === 'paid_out' || cStatus === 'collected') && matchOwner && matchMonth;
                      });

                      if (matchedDues.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-[#9EA7B8]">
                              <Clock className="w-8 h-8 text-[#9EA7B8]/40 mx-auto mb-2" />
                              <p className="text-xs font-bold">لا توجد سجلات مطابقة حالياً.</p>
                            </td>
                          </tr>
                        );
                      }

                      return matchedDues.map((due, idx) => {
                        const pStatus = getDuePayoutStatus(due);
                        const cStatus = getDueCollectionStatus(due);
                        const disbursed = pStatus === 'paid_out' ? due.netOwnerAmount : 0;
                        const collected = cStatus === 'collected' ? (due.collectedAmount || due.rentAmount) : 0;
                        const diffAdvance = disbursed - collected;

                        return (
                          <tr key={due.id} className="hover:bg-[#08111F]/40 transition-all">
                            <td className="p-3 text-[#9EA7B8] font-mono">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-extrabold text-[#F8F9FB]">{due.ownerName}</div>
                              <span className="text-[10px] text-[#D4A84F]">{due.propertyName}</span>
                            </td>
                            <td className="p-3">
                              <div className="text-[#F8F9FB]">{due.tenantName}</div>
                              <span className="text-[10px] text-[#9EA7B8] font-mono">{due.monthNameAr}</span>
                            </td>
                            <td className="p-3 font-mono text-[#D4A84F] font-black">{due.netOwnerAmount.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono">
                              {pStatus === 'paid_out' ? (
                                <span className="text-emerald-400">{disbursed.toLocaleString('ar-EG')} ج.م ({due.payoutDate || 'تم'})</span>
                              ) : (
                                <span className="text-amber-400">غير مصروف</span>
                              )}
                            </td>
                            <td className="p-3 font-mono">
                              {cStatus === 'collected' ? (
                                <span className="text-emerald-400">{collected.toLocaleString('ar-EG')} ج.م (إيصال #{due.receiptNumber || 'تم'})</span>
                              ) : (
                                <span className="text-rose-400">لم يُحصل بعد</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-purple-300 font-bold">
                              {diffAdvance > 0 ? (
                                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {diffAdvance.toLocaleString('ar-EG')} ج.م سُلفة
                                </span>
                              ) : (
                                '0 ج.م'
                              )}
                            </td>
                            <td className="p-3">
                              {due.monthClosingStatus === 'closed' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🔒 مغلق ومطابق</span>
                              ) : pStatus === 'paid_out' && cStatus === 'collected' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">🟢 مطابق وجاهز للإغلاق</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">🔵 سُلفة مكتب قيد التحصيل</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {due.monthClosingStatus === 'closed' ? (
                                <span className="text-[10px] text-emerald-400 font-bold">مغلق</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (onCloseMonthDue) onCloseMonthDue(due.id);
                                    else alert('✅ تم اعتماد وإغلاق هذا الشهر لهذا العقد بنجاح!');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] hover:brightness-110 transition-all cursor-pointer"
                                >
                                  إغلاق الشهر
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: Automatic Calculation Breakdown per Property & Month */}
          {payoutSubTab === 'property_calculation' && (
            <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-xl space-y-3 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#D4A84F]/15">
                <div className="flex items-center gap-2 text-[#D4A84F]">
                  <FileBarChart className="w-5 h-5" />
                  <h4 className="text-xs font-black">جدول الاحتساب التلقائي الشهري لكل عقار (الإيجارات، العمولات، الصرف، المحصل، الرصيد)</h4>
                </div>
                <span className="text-[10px] text-[#9EA7B8] font-bold">محسوبة تلقائياً حسب عقود الإيجار</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                      <th className="p-3">اسم العقار والمالك</th>
                      <th className="p-3">الشهر</th>
                      <th className="p-3">إجمالي الإيجارات المستحقة</th>
                      <th className="p-3">المحصل من المستأجرين</th>
                      <th className="p-3">عمولة المكتب</th>
                      <th className="p-3">صافي مستحق المالك</th>
                      <th className="p-3">المصروف بالفعل للمالك</th>
                      <th className="p-3">رصيد/فرق المكتب (سُلفة)</th>
                      <th className="p-3 text-center">حالة الشهر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                    {(() => {
                      // Group dues by propertyId + forMonthYear
                      const groupsMap = new Map<string, {
                        property: ReProperty | undefined;
                        owner: ReOwner | undefined;
                        monthYear: string;
                        monthNameAr: string;
                        totalDueRent: number;
                        totalCollected: number;
                        totalCommission: number;
                        totalNetOwner: number;
                        totalDisbursed: number;
                        isClosed: boolean;
                      }>();

                      dues.forEach(d => {
                        const matchOwner = selectedOwnerId === 'all' || d.ownerId === selectedOwnerId;
                        const matchProperty = selectedPropertyId === 'all' || d.propertyId === selectedPropertyId;
                        const matchMonth = selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear;
                        if (!matchOwner || !matchProperty || !matchMonth) return;

                        const key = `${d.propertyId}_${d.forMonthYear}`;
                        if (!groupsMap.has(key)) {
                          const prop = properties.find(p => p.id === d.propertyId);
                          const owner = owners.find(o => o.id === (d.ownerId || prop?.ownerId));
                          groupsMap.set(key, {
                            property: prop,
                            owner,
                            monthYear: d.forMonthYear,
                            monthNameAr: d.monthNameAr || d.forMonthYear,
                            totalDueRent: 0,
                            totalCollected: 0,
                            totalCommission: 0,
                            totalNetOwner: 0,
                            totalDisbursed: 0,
                            isClosed: true
                          });
                        }

                        const group = groupsMap.get(key)!;
                        group.totalDueRent += d.rentAmount;
                        group.totalCommission += d.commissionAmount;
                        group.totalNetOwner += d.netOwnerAmount;

                        const pStatus = getDuePayoutStatus(d);
                        const cStatus = getDueCollectionStatus(d);

                        if (cStatus === 'collected') {
                          group.totalCollected += (d.collectedAmount || d.rentAmount);
                        }
                        if (pStatus === 'paid_out') {
                          group.totalDisbursed += d.netOwnerAmount;
                        }
                        if (d.monthClosingStatus !== 'closed') {
                          group.isClosed = false;
                        }
                      });

                      const groups = Array.from(groupsMap.values());

                      if (groups.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-[#9EA7B8]">
                              <p className="text-xs font-bold">لا توجد سجلات شهري للعقارات مطابقة للفلاتر.</p>
                            </td>
                          </tr>
                        );
                      }

                      return groups.map((g, idx) => {
                        const officeAdvance = g.totalDisbursed - g.totalCollected;
                        let monthStatusLabel = 'بانتظار الصرف ⏳';
                        let monthStatusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';

                        if (g.isClosed) {
                          monthStatusLabel = 'مغلق ومطابق 🔒';
                          monthStatusColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                        } else if (g.totalDisbursed >= g.totalNetOwner && g.totalCollected >= g.totalDueRent) {
                          monthStatusLabel = 'مكتمل ومطابق 🟢';
                          monthStatusColor = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
                        } else if (g.totalDisbursed >= g.totalNetOwner && g.totalCollected < g.totalDueRent) {
                          monthStatusLabel = 'تم الصرف وبانتظار التحصيل 🔵';
                          monthStatusColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
                        } else if (g.totalCollected >= g.totalDueRent && g.totalDisbursed < g.totalNetOwner) {
                          monthStatusLabel = 'بانتظار الصرف بعد التحصيل 🟡';
                          monthStatusColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                        }

                        return (
                          <tr key={idx} className="hover:bg-[#08111F]/40 transition-all">
                            <td className="p-3">
                              <div className="font-extrabold text-[#F8F9FB]">{g.property?.name || 'عقار'}</div>
                              <span className="text-[10px] text-[#D4A84F]">{g.owner?.name || 'مالك'}</span>
                            </td>
                            <td className="p-3 font-mono text-[#F8F9FB]">{g.monthNameAr}</td>
                            <td className="p-3 font-mono text-[#F8F9FB]">{g.totalDueRent.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-emerald-400">{g.totalCollected.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-amber-400">{g.totalCommission.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-[#D4A84F] font-black">{g.totalNetOwner.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-sky-400">{g.totalDisbursed.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-purple-300">
                              {officeAdvance > 0 ? (
                                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {officeAdvance.toLocaleString('ar-EG')} ج.م
                                </span>
                              ) : (
                                '0 ج.م'
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black border ${monthStatusColor}`}>
                                {monthStatusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* VIEW 4: كشف حساب العقارات (PROPERTY STATEMENTS) */}
      {currentTab === 'property_statements' && (
        <div className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر العقار:</label>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع العقارات</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">شهر كشف الحساب:</label>
              <input
                type="month"
                value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => handleOpenReportPreview('property_monthly')}
                className="flex-1 py-2 rounded-xl bg-[#08111F]/80 border border-[#D4A84F]/30 text-[#D4A84F] font-bold text-xs hover:bg-[#D4A84F]/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> معاينة
              </button>
              <button
                onClick={() => handlePrintReportDirectly('property_monthly')}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#D4A84F]/20"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" /> طباعة كشف العقار PDF
              </button>
            </div>
          </div>

          <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-5 space-y-4">
            <h3 className="text-xs font-black text-[#D4A84F]">كشف الحساب والمطابقة الشهري للعقار</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#08111F]/80 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/10">
                    <th className="p-3">الوحدة والمستأجر</th>
                    <th className="p-3">الإيجار الشهرى</th>
                    <th className="p-3">صرف مستحق المالك</th>
                    <th className="p-3">تحصيل الإيجار من المستأجر</th>
                    <th className="p-3">فرق الصرف (سلفة مكتب)</th>
                    <th className="p-3">حالة الشهر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                  {dues.filter(d => (selectedPropertyId === 'all' || d.propertyId === selectedPropertyId) && (selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear)).map(d => {
                    const pStatus = getDuePayoutStatus(d);
                    const cStatus = getDueCollectionStatus(d);
                    const diff = (pStatus === 'paid_out' ? d.netOwnerAmount : 0) - (cStatus === 'collected' ? (d.collectedAmount || d.rentAmount) : 0);

                    return (
                      <tr key={d.id} className="hover:bg-[#08111F]/40 transition-all">
                        <td className="p-3">
                          <div className="font-extrabold text-[#F8F9FB]">{d.propertyName} - وحدة {d.unitNumber}</div>
                          <span className="text-[10px] text-[#9EA7B8] font-mono">{d.tenantName} ({d.monthNameAr})</span>
                        </td>
                        <td className="p-3 font-mono text-[#F8F9FB]">{d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3">
                          {pStatus === 'paid_out' ? (
                            <span className="text-emerald-400 font-mono">تم الصرف ({d.netOwnerAmount.toLocaleString('ar-EG')} ج.م)</span>
                          ) : (
                            <span className="text-amber-400">بانتظار الصرف</span>
                          )}
                        </td>
                        <td className="p-3">
                          {cStatus === 'collected' ? (
                            <span className="text-emerald-400 font-mono">تم التحصيل (إيصال #{d.receiptNumber || 'محصل'})</span>
                          ) : (
                            <span className="text-rose-400">لم يحصل بعد</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-purple-300">
                          {diff > 0 ? `${diff.toLocaleString('ar-EG')} ج.م سلفة مكتب` : '0 ج.م'}
                        </td>
                        <td className="p-3">
                          {d.monthClosingStatus === 'closed' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">مغلق ومطابق</span>
                          ) : pStatus === 'paid_out' && cStatus === 'collected' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">مطابق وجاهز للإغلاق</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">مفتوح وقيد المتابعة</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 5: كشف حساب المالك التفصيلي (OWNER ACCOUNT STATEMENT) */}
      {currentTab === 'owner_statements' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">تحديد المالك:</label>
              <select
                value={selectedOwnerId}
                onChange={e => setSelectedOwnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع الملاك المسجلين</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">شهر كشف الحساب:</label>
              <input
                type="month"
                value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">تصفية حسب العقار:</label>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع العقارات</option>
                {properties.filter(p => selectedOwnerId === 'all' || p.ownerId === selectedOwnerId).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => handleOpenReportPreview('owner_statement')}
                className="flex-1 py-2 rounded-xl bg-[#08111F]/80 border border-[#D4A84F]/30 text-[#D4A84F] font-bold text-xs hover:bg-[#D4A84F]/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> معاينة
              </button>
              <button
                onClick={() => handlePrintReportDirectly('owner_statement')}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#D4A84F]/20"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" /> طباعة كشف الحساب الرسمي PDF
              </button>
            </div>
          </div>

          {/* Owner Account Statement Detailed Container */}
          {(() => {
            const statementDues = dues.filter(d => {
              const matchOwner = selectedOwnerId === 'all' || d.ownerId === selectedOwnerId;
              const matchMonth = selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear;
              const matchProp = selectedPropertyId === 'all' || d.propertyId === selectedPropertyId;
              return matchOwner && matchMonth && matchProp;
            });

            const currentOwnerObj = owners.find(o => o.id === selectedOwnerId);

            let totalRentSum = 0;
            let totalCommissionSum = 0;
            let totalNetOwnerSum = 0;
            let totalDisbursedSum = 0;
            let totalCollectedSum = 0;
            let totalBalanceSum = 0;

            statementDues.forEach(d => {
              totalRentSum += d.rentAmount;
              totalCommissionSum += d.commissionAmount;
              totalNetOwnerSum += d.netOwnerAmount;

              const pStatus = getDuePayoutStatus(d);
              const cStatus = getDueCollectionStatus(d);

              const disbursed = pStatus === 'paid_out' ? d.netOwnerAmount : 0;
              const collected = cStatus === 'collected' ? (d.collectedAmount || d.rentAmount) : 0;
              const remBalance = d.netOwnerAmount - disbursed;

              totalDisbursedSum += disbursed;
              totalCollectedSum += collected;
              totalBalanceSum += remBalance;
            });

            return (
              <div className="space-y-4">
                
                {/* Selected Owner Info & KPI Box */}
                {currentOwnerObj && (
                  <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/30 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">اسم المالك المعني:</span>
                      <h3 className="text-sm font-black text-[#F8F9FB]">{currentOwnerObj.name}</h3>
                      <p className="text-[11px] text-[#D4A84F]">هاتف: {currentOwnerObj.phone || 'غير مدخل'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">آلية عمولة المكتب:</span>
                      <p className="text-xs font-bold text-[#F8F9FB]">
                        {currentOwnerObj.commissionType === 'percentage'
                          ? `نسبة مئوية (${currentOwnerObj.commissionValue}%)`
                          : `مبلغ ثابت (${currentOwnerObj.commissionValue} ج.م)`}
                      </p>
                      <p className="text-[11px] text-[#9EA7B8]">خصم تلقائي قبل الصرف</p>
                    </div>

                    <div className="space-y-1 font-mono">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">صافي مستحقات المالك:</span>
                      <p className="text-base font-black text-[#D4A84F]">{totalNetOwnerSum.toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-[10px] text-emerald-400">المصروف: {totalDisbursedSum.toLocaleString('ar-EG')} ج.م</p>
                    </div>

                    <div className="space-y-1 font-mono">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">الرصيد المتبقي للصرف:</span>
                      <p className={`text-base font-black ${totalBalanceSum > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {totalBalanceSum.toLocaleString('ar-EG')} ج.م
                      </p>
                      <p className="text-[10px] text-purple-300">المحصل من المستأجرين: {totalCollectedSum.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                  </div>
                )}

                {/* Statement Table */}
                <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-[#D4A84F]/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D4A84F]" />
                      <h3 className="text-xs font-black text-[#F8F9FB]">
                        كشف حساب المالك التفصيلي ({selectedOwnerId === 'all' ? 'جميع الملاك' : currentOwnerObj?.name}) - {selectedMonthYear === 'all' ? 'جميع الشهور' : selectedMonthYear}
                      </h3>
                    </div>
                    <span className="text-[10px] text-[#9EA7B8] font-mono">{statementDues.length} استحقاق/سجل</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                          <th className="p-3 text-center">الرقم المسلسل</th>
                          <th className="p-3">اسم العقار والوحدة</th>
                          <th className="p-3">الشهر</th>
                          <th className="p-3">إجمالي الإيجار</th>
                          <th className="p-3">قيمة عمولة المكتب</th>
                          <th className="p-3">صافي مستحق المالك</th>
                          <th className="p-3">المبلغ الذي تم صرفه</th>
                          <th className="p-3">تاريخ الصرف</th>
                          <th className="p-3">المبلغ المحصل من المستأجرين</th>
                          <th className="p-3">الرصيد المتبقي</th>
                          <th className="p-3 text-center">الحالة المالية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                        {statementDues.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-8 text-center text-[#9EA7B8]">
                              <Clock className="w-8 h-8 text-[#D4A84F]/40 mx-auto mb-2" />
                              <p className="text-xs font-bold">لا توجد بيانات كشف حساب مطابقة للشروط المختارة.</p>
                            </td>
                          </tr>
                        ) : (
                          statementDues.map((d, idx) => {
                            const pStatus = getDuePayoutStatus(d);
                            const cStatus = getDueCollectionStatus(d);

                            const disbursed = pStatus === 'paid_out' ? d.netOwnerAmount : 0;
                            const collected = cStatus === 'collected' ? (d.collectedAmount || d.rentAmount) : 0;
                            const balance = d.netOwnerAmount - disbursed;

                            let statusBadge = 'بانتظار الصرف ⏳';
                            let statusColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';

                            if (pStatus === 'paid_out' && cStatus === 'collected') {
                              statusBadge = 'تم الصرف والتحصيل 🟢';
                              statusColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                            } else if (pStatus === 'paid_out' && cStatus !== 'collected') {
                              statusBadge = 'تم الصرف (سُلفة مكتب) 🔵';
                              statusColor = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
                            } else if (cStatus === 'collected' && pStatus !== 'paid_out') {
                              statusBadge = 'محصل وبانتظار الصرف 🟡';
                              statusColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                            }

                            return (
                              <tr key={d.id} className="hover:bg-[#08111F]/40 transition-all">
                                <td className="p-3 text-center font-mono text-[#9EA7B8]">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-extrabold text-[#F8F9FB]">{d.propertyName}</div>
                                  <span className="text-[10px] text-[#D4A84F]">وحدة {d.unitNumber} ({d.ownerName})</span>
                                </td>
                                <td className="p-3 font-mono text-[#F8F9FB]">{d.monthNameAr || d.forMonthYear}</td>
                                <td className="p-3 font-mono text-[#F8F9FB]">{d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-amber-400">{d.commissionAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-[#D4A84F] font-extrabold">{d.netOwnerAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-emerald-400">{disbursed.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-[#9EA7B8] text-[11px]">{d.payoutDate || d.paidDate || '—'}</td>
                                <td className="p-3 font-mono text-emerald-300">{collected.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-rose-300">{balance.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black border ${statusColor}`}>
                                    {statusBadge}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {/* Totals Summary Row */}
                        {statementDues.length > 0 && (
                          <tr className="bg-[#08111F] text-[#F8F9FB] font-black border-t-2 border-[#D4A84F]/30 text-xs">
                            <td colSpan={3} className="p-3 text-left text-[#D4A84F]">الإجمالي الكلي:</td>
                            <td className="p-3 font-mono text-[#F8F9FB]">{totalRentSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-amber-400">{totalCommissionSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-[#D4A84F] text-sm">{totalNetOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-emerald-400">{totalDisbursedSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 text-center text-[#9EA7B8]">—</td>
                            <td className="p-3 font-mono text-emerald-300">{totalCollectedSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-rose-300">{totalBalanceSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 text-center text-[#D4A84F] font-mono">{statementDues.length} سجل</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })()}

        </div>
      )}

      {/* VIEW 6: كشف حساب المستأجرين (TENANT STATEMENTS) */}
      {currentTab === 'tenant_statements' && (
        <div className="space-y-4">
          
          {/* Top Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر المستأجر:</label>
              <select
                value={selectedTenantId}
                onChange={e => setSelectedTenantId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع المستأجرين</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.fullName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">شهر الاستحقاق:</label>
              <input
                type="month"
                value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">حالة السداد:</label>
              <select
                value={collectionFilter}
                onChange={e => setCollectionFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="paid">مسدد بالكامل ✅</option>
                <option value="unpaid">غير مسدد (بانتظار السداد) ⏳</option>
                <option value="overdue">متأخر عن السداد ⚠️</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => handleOpenReportPreview('tenant_statement')}
                className="flex-1 py-2 rounded-xl bg-[#08111F]/80 border border-[#D4A84F]/30 text-[#D4A84F] font-bold text-xs hover:bg-[#D4A84F]/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> معاينة
              </button>
              <button
                onClick={() => handlePrintReportDirectly('tenant_statement')}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#D4A84F]/20"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" /> طباعة كشف المستأجر PDF
              </button>
            </div>
          </div>

          {/* Tenant Summary Cards & Monthly Account Table */}
          {(() => {
            const filteredTenantDues = dues.filter(d => {
              const matchesTenant = selectedTenantId === 'all' || d.tenantId === selectedTenantId;
              const matchesMonth = selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear;
              let matchesStatus = true;
              const cStatus = getDueCollectionStatus(d);
              if (collectionFilter === 'paid') matchesStatus = cStatus === 'collected';
              if (collectionFilter === 'unpaid') matchesStatus = cStatus !== 'collected';
              if (collectionFilter === 'overdue') matchesStatus = cStatus === 'overdue';
              return matchesTenant && matchesMonth && matchesStatus;
            });

            let sumRequired = 0;
            let sumCollected = 0;
            let sumRemaining = 0;
            let countPaidMonths = 0;
            let countUnpaidMonths = 0;

            filteredTenantDues.forEach(d => {
              sumRequired += d.rentAmount;
              const cStatus = getDueCollectionStatus(d);
              if (cStatus === 'collected') {
                sumCollected += (d.collectedAmount || d.rentAmount);
                countPaidMonths++;
              } else {
                sumRemaining += d.rentAmount;
                countUnpaidMonths++;
              }
            });

            const currentTenantObj = tenants.find(t => t.id === selectedTenantId);

            return (
              <div className="space-y-4">
                {/* Summary Cards Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-[#D4A84F]/20">
                    <span className="text-[10px] text-[#9EA7B8] font-bold block">إجمالي الإيجارات المطلوبة</span>
                    <p className="text-lg font-black font-mono text-[#F8F9FB] mt-0.5">
                      {sumRequired.toLocaleString('ar-EG')} <span className="text-[10px] text-[#D4A84F] font-sans">ج.م</span>
                    </p>
                    <span className="text-[9px] text-[#9EA7B8] block mt-1">{filteredTenantDues.length} شهر / استحقاق</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-[#9EA7B8] font-bold block">المبلغ المسدد (المحصل)</span>
                    <p className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                      {sumCollected.toLocaleString('ar-EG')} <span className="text-[10px] text-emerald-300 font-sans">ج.م</span>
                    </p>
                    <span className="text-[9px] text-emerald-400 block mt-1">{countPaidMonths} أشهر مسددة</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-rose-500/20">
                    <span className="text-[10px] text-[#9EA7B8] font-bold block">المتبقي / المديونية والديون</span>
                    <p className="text-lg font-black font-mono text-rose-400 mt-0.5">
                      {sumRemaining.toLocaleString('ar-EG')} <span className="text-[10px] text-rose-300 font-sans">ج.م</span>
                    </p>
                    <span className="text-[9px] text-rose-400 block mt-1">{countUnpaidMonths} أشهر غير مسددة</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-sky-500/20">
                    <span className="text-[10px] text-[#9EA7B8] font-bold block">بيانات المستأجر الحالي</span>
                    <p className="text-xs font-black text-sky-400 mt-1 truncate">
                      {currentTenantObj ? currentTenantObj.fullName : 'جميع المستأجرين'}
                    </p>
                    {currentTenantObj && (
                      <span className="text-[9px] text-[#9EA7B8] block mt-0.5 font-mono">
                        هاتف: {currentTenantObj.phone} | عقد: #{currentTenantObj.contractNumber || 'ساري'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Table of Monthly Statement */}
                <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      كشف الحساب الشهري وسجل السداد للمستأجر ({selectedTenantId === 'all' ? 'جميع المستأجرين' : currentTenantObj?.fullName})
                    </h3>
                    <span className="text-[10px] text-[#9EA7B8] font-bold">
                      عدد الشهور والمعاملات: {filteredTenantDues.length}
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[#08111F]/80 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/10 text-[11px]">
                          <th className="p-3">اسم المستأجر والعقار</th>
                          <th className="p-3">الشهر المستحق</th>
                          <th className="p-3">تاريخ الاستحقاق</th>
                          <th className="p-3">الإيجار المطلوب</th>
                          <th className="p-3">المبلغ المسدد</th>
                          <th className="p-3">المتبقي</th>
                          <th className="p-3">رقم الإيصال والتاريخ</th>
                          <th className="p-3">حالة السداد</th>
                          <th className="p-3 text-center">التحكم والتحصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                        {filteredTenantDues.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-[#9EA7B8]">
                              <Clock className="w-8 h-8 text-[#D4A84F]/40 mx-auto mb-2" />
                              <p className="text-xs font-bold">لا توجد سجلات كشف حساب مطابقة للفلاتر الحالية.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredTenantDues.map(d => {
                            const cStatus = getDueCollectionStatus(d);
                            const paidAmt = d.collectedAmount || (cStatus === 'collected' ? d.rentAmount : 0);
                            const remainingAmt = Math.max(0, d.rentAmount - paidAmt);

                            return (
                              <tr key={d.id} className="hover:bg-[#08111F]/40 transition-all">
                                <td className="p-3">
                                  <div className="font-extrabold text-[#F8F9FB]">{d.tenantName}</div>
                                  <span className="text-[10px] text-[#D4A84F]">{d.propertyName} - وحدة {d.unitNumber}</span>
                                </td>
                                <td className="p-3 font-mono text-[#F8F9FB] font-extrabold">
                                  {d.monthNameAr || d.forMonthYear}
                                </td>
                                <td className="p-3 font-mono text-[#9EA7B8]">{d.dueDate}</td>
                                <td className="p-3 font-mono text-[#F8F9FB] font-black">{d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-emerald-400 font-extrabold">{paidAmt.toLocaleString('ar-EG')} ج.م</td>
                                <td className="p-3 font-mono text-rose-400 font-extrabold">
                                  {remainingAmt > 0 ? `${remainingAmt.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}
                                </td>
                                <td className="p-3 font-mono text-[#9EA7B8]">
                                  {cStatus === 'collected' ? (
                                    <div className="space-y-0.5">
                                      <span className="block text-emerald-300 font-bold">إيصال #{d.receiptNumber || 'محصل'}</span>
                                      <span className="block text-[9px] text-[#9EA7B8]">{d.paidDate || ''} ({d.paymentMethod || 'نقدي'})</span>
                                    </div>
                                  ) : (
                                    <span className="text-rose-400/80">غير مسدد</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {cStatus === 'collected' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      <CheckCircle className="w-3 h-3" /> تم السداد
                                    </span>
                                  ) : cStatus === 'overdue' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                      <AlertCircle className="w-3 h-3" /> متأخر عن السداد
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-500/15 text-slate-300 border border-slate-500/30">
                                      <Clock className="w-3 h-3" /> بانتظار السداد
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {cStatus !== 'collected' ? (
                                    <button
                                      onClick={() => onCollectRent(d)}
                                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-black text-xs hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                      title="تسجيل سداد وتحصيل إيجار الشهر"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>تم السداد (تحصيل)</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => onCollectRent(d)}
                                      className="px-2.5 py-1 rounded-lg bg-[#D4A84F]/10 text-[#D4A84F] hover:bg-[#D4A84F]/20 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                      title="عرض / تعديل سند التحصيل"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>عرض السند</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* VIEW 7: المطابقة والإغلاق المالي (MONTH CLOSING & RECONCILIATION) */}
      {currentTab === 'closing' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#D4A84F]/15 text-[#D4A84F]">
                <Lock className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#F8F9FB]">شاشة المطابقة واعتماد الإغلاق المالي للشهور</h3>
                <p className="text-xs text-[#9EA7B8]">
                  تتيح لك هذه الشاشة مطابقة مبالغ الصرف والتحصيل لكل شهر وإغلاق الشهر ماليًا ومنع التعديل عليه.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر الشهر المراد إغلاقه:</label>
                <input
                  type="month"
                  value={selectedMonthYear}
                  onChange={e => setSelectedMonthYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#08111F]/80 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/10">
                    <th className="p-3">العقار والوحدة</th>
                    <th className="p-3">المستأجر</th>
                    <th className="p-3">إجمالي الإيجار</th>
                    <th className="p-3">حالة صرف المالك</th>
                    <th className="p-3">حالة تحصيل المستأجر</th>
                    <th className="p-3">حالة المطابقة</th>
                    <th className="p-3 text-center">إغلاق الشهر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                  {dues.filter(d => selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear).map(d => {
                    const pStatus = getDuePayoutStatus(d);
                    const cStatus = getDueCollectionStatus(d);
                    const isFullyMatched = pStatus === 'paid_out' && cStatus === 'collected';

                    return (
                      <tr key={d.id} className="hover:bg-[#08111F]/40 transition-all">
                        <td className="p-3 font-extrabold text-[#F8F9FB]">
                          {d.propertyName} - وحدة {d.unitNumber}
                        </td>
                        <td className="p-3 text-[#9EA7B8]">{d.tenantName}</td>
                        <td className="p-3 font-mono text-[#F8F9FB]">{d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3">
                          {pStatus === 'paid_out' ? <span className="text-emerald-400">تم الصرف</span> : <span className="text-amber-400">بانتظار الصرف</span>}
                        </td>
                        <td className="p-3">
                          {cStatus === 'collected' ? <span className="text-emerald-400">تم التحصيل</span> : <span className="text-rose-400">بانتظار التحصيل</span>}
                        </td>
                        <td className="p-3">
                          {d.monthClosingStatus === 'closed' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">مغلق رسمياً 🔒</span>
                          ) : isFullyMatched ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">جاهز للإغلاق 🟢</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">غير مكتمل المطابقة ⚠️</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {d.monthClosingStatus === 'closed' ? (
                            <span className="text-[10px] text-emerald-400 font-bold">تم الإغلاق بواسطة {d.closedBy || 'النظام'}</span>
                          ) : (
                            <button
                              onClick={() => {
                                if (!isFullyMatched) {
                                  if (!confirm('⚠️ انتبه: العمليتان (الصرف والتحصيل) لم تكتمل كلياً بعد. هل أنت متأكد من اعتماد إغلاق هذا الشهر لهذا العقد يدوياً؟')) return;
                                }
                                if (onCloseMonthDue) onCloseMonthDue(d.id);
                                else alert('✅ تم إغلاق الشهر وتأكيد مطابقة الحساب بنجاح!');
                              }}
                              className="px-3 py-1 rounded-lg bg-[#D4A84F] text-slate-950 font-black text-xs hover:bg-[#E5B95F] transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3" /> اعتماد الإغلاق
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 8: نظام التقارير المالية واحترافية الطباعة (REPORTS & PRINT ENGINE) */}
      {currentTab === 'reports' && (
        <div className="space-y-4">
          
          {/* Report Type Selector */}
          <div className="flex flex-wrap items-center gap-2 p-2 bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15">
            {[
              { id: 'property_monthly', label: '1. تقرير شهري لكل عقار' },
              { id: 'owner_statement', label: '2. تقرير كشف حساب مالك' },
              { id: 'tenant_statement', label: '3. تقرير كشف حساب مستأجر' },
              { id: 'owner_payouts', label: '4. تقرير المصروف للملاك' },
              { id: 'tenant_collections', label: '5. تقرير المحصل من المستأجرين' },
              { id: 'arrears', label: '6. تقرير المتأخرات والديون' },
              { id: 'office_commissions', label: '7. تقرير عمولات المكتب' },
              { id: 'office_advances', label: '8. تقرير سُلف المكتب والفرق' }
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setReportType(r.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  reportType === r.id
                    ? 'bg-[#D4A84F] text-slate-950 shadow-md font-bold'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">تصفية حسب العقار:</label>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع العقارات</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">تصفية حسب المالك:</label>
              <select
                value={selectedOwnerId}
                onChange={e => setSelectedOwnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع الملاك</option>
                {owners.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">شهر التقرير:</label>
              <input
                type="month"
                value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => handleOpenReportPreview(reportType)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#08111F]/80 border border-[#D4A84F]/30 text-[#D4A84F] font-bold text-xs hover:bg-[#D4A84F]/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> معاينة التقرير
              </button>
              <button
                onClick={() => handlePrintReportDirectly(reportType)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 shadow-lg shadow-[#D4A84F]/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" /> طباعة التقرير الرسمي PDF
              </button>
            </div>
          </div>

          {/* Printable Official Paper Container */}
          <div className="p-8 bg-[#132238]/90 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 space-y-6 shadow-2xl print:bg-white print:text-black print:p-0 print:border-none">
            
            {/* Official Rumaich Law Firm Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#D4A84F] print:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#D4A84F] text-slate-950 font-black">
                  <Landmark className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#F8F9FB] print:text-black">مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
                  <p className="text-xs text-[#D4A84F] font-bold print:text-slate-800">قطاع الإدارة العقارية والتحصيل والخدمات المالية والتوثيق</p>
                </div>
              </div>

              <div className="text-left">
                <span className="text-[10px] text-[#9EA7B8] print:text-slate-600 block font-bold">تاريخ وساعة الإصدار:</span>
                <span className="text-xs font-mono font-bold text-[#F8F9FB] print:text-black">{new Date().toLocaleString('ar-EG')}</span>
                <span className="text-[9px] block text-[#D4A84F] font-mono mt-0.5">رقم السيريال: RUM-RE-{Math.floor(100000 + Math.random() * 900000)}</span>
              </div>
            </div>

            {/* Report Title */}
            <div className="text-center py-2.5 bg-[#08111F]/80 rounded-xl border border-[#D4A84F]/20 print:bg-slate-100 print:text-black print:border-slate-300">
              <h3 className="text-sm font-black text-[#D4A84F] print:text-black">
                {reportType === 'property_monthly' && 'التقرير الشهري المالي والإشغالي للعقار'}
                {reportType === 'owner_statement' && 'تقرير كشف حساب وتسوية مستحقات المالك'}
                {reportType === 'tenant_statement' && 'تقرير كشف حساب ومدفوعات وتأخيرات المستأجر'}
                {reportType === 'owner_payouts' && 'تقرير المبالغ المصروفة للملاك'}
                {reportType === 'tenant_collections' && 'تقرير المبالغ المحصلة من المستأجرين'}
                {reportType === 'arrears' && 'تقرير المتأخرات والديون المستحقة عن العقود'}
                {reportType === 'office_commissions' && 'تقرير أرباح وعمولات المكتب عن الإدارة العقارية'}
                {reportType === 'office_advances' && 'تقرير سُلف المكتب والفرق بين المصروف والمحصل'}
              </h3>
            </div>

            {/* Printable Report Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#08111F] text-[#D4A84F] font-black border-b border-[#D4A84F]/20 print:bg-slate-200 print:text-black text-[11px]">
                    <th className="p-2.5">الشهر</th>
                    <th className="p-2.5">اسم المالك</th>
                    <th className="p-2.5">اسم العقار</th>
                    <th className="p-2.5">رقم الوحدة</th>
                    <th className="p-2.5">اسم المستأجر (العقد الفعّال)</th>
                    <th className="p-2.5 text-center">إيجار الشهر</th>
                    <th className="p-2.5 text-center">عمولة المكتب</th>
                    <th className="p-2.5 text-center">صافي مستحق المالك</th>
                    <th className="p-2.5 text-center">حالة سداد المستأجر</th>
                    <th className="p-2.5 text-center">حالة صرف المالك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4A84F]/10 print:divide-slate-300">
                  {dues.filter(d => {
                    if (selectedMonthYear !== 'all' && d.forMonthYear !== selectedMonthYear) return false;
                    if (selectedOwnerId !== 'all' && d.ownerId !== selectedOwnerId) return false;
                    if (selectedPropertyId !== 'all' && d.propertyId !== selectedPropertyId) return false;
                    if (reportType === 'arrears' && getDueCollectionStatus(d) !== 'overdue') return false;
                    if (reportType === 'office_advances' && (getDuePayoutStatus(d) !== 'paid_out' || getDueCollectionStatus(d) === 'collected')) return false;
                    return true;
                  }).map(d => {
                    const pStatus = getDuePayoutStatus(d);
                    const cStatus = getDueCollectionStatus(d);

                    return (
                      <tr key={d.id} className="print:text-black font-bold hover:bg-white/5 transition-all">
                        <td className="p-2.5 font-mono text-[#F8F9FB] print:text-black">{d.monthNameAr || d.forMonthYear}</td>
                        <td className="p-2.5 text-[#F8F9FB] print:text-black font-extrabold">{d.ownerName}</td>
                        <td className="p-2.5 text-[#D4A84F] print:text-slate-800">{d.propertyName}</td>
                        <td className="p-2.5 font-mono text-[#F8F9FB] print:text-black">وحدة {d.unitNumber}</td>
                        <td className="p-2.5 text-[#F8F9FB] print:text-black font-extrabold">{d.tenantName}</td>
                        <td className="p-2.5 font-mono text-center text-[#F8F9FB] print:text-black font-black">{d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-2.5 font-mono text-center text-amber-400 print:text-slate-800">{d.commissionAmount.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-2.5 font-mono text-center text-[#D4A84F] print:text-black font-black">{d.netOwnerAmount.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-2.5 text-center">
                          {cStatus === 'collected' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:bg-none print:text-emerald-800">تم السداد (محصل)</span>
                          ) : cStatus === 'overdue' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 print:bg-none print:text-rose-800">متأخر عن السداد</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 print:bg-none print:text-slate-800">بانتظار السداد</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {pStatus === 'paid_out' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 print:bg-none print:text-emerald-800">تم الصرف للمالك</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 print:bg-none print:text-slate-800">بانتظار الصرف</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Official Signatures Block for Print */}
            <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs font-bold text-[#F8F9FB] print:text-black border-t border-[#D4A84F]/15 print:border-slate-400">
              <div className="space-y-10">
                <p className="text-[#9EA7B8] print:text-slate-600">إعداد المحاسب المسؤول</p>
                <p className="border-t border-[#D4A84F]/20 pt-2 w-32 mx-auto print:border-slate-400">التوقيع: .....................</p>
              </div>
              <div className="space-y-10">
                <p className="text-[#9EA7B8] print:text-slate-600">مراجعة مدير قطاع العقارات</p>
                <p className="border-t border-[#D4A84F]/20 pt-2 w-32 mx-auto print:border-slate-400">التوقيع: .....................</p>
              </div>
              <div className="space-y-10">
                <p className="text-[#9EA7B8] print:text-slate-600">اعتماد رئيس المؤسسة والختم الرسمى</p>
                <p className="border-t border-[#D4A84F]/20 pt-2 w-32 mx-auto print:border-slate-400">الختم والتوقيع</p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Real Estate Report Preview & Printable Modal */}
      <RealEstateReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        reportType={modalReportType}
        dues={dues}
        owners={owners}
        properties={properties}
        units={units}
        tenants={tenants}
        selectedPropertyId={selectedPropertyId}
        selectedOwnerId={selectedOwnerId}
        selectedTenantId={selectedTenantId}
        selectedMonthYear={selectedMonthYear}
        currentUser={currentUser}
      />

    </div>
  );
}
