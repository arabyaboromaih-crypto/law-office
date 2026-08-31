import React, { useState, useMemo } from 'react';
import RealEstateReportModal, { 
  generateRealEstateReportHTML, 
  printReportDirectly, 
  ReportType 
} from './RealEstateReportModal';
import { 
  Wallet, Receipt, Building, Building2, Users, ExternalLink, Calendar, AlertCircle, 
  CheckCircle, CheckCircle2, Clock, DollarSign, Printer, Search, Filter, 
  ArrowUpRight, ArrowDownLeft, FileText, Landmark, RefreshCw, 
  ChevronLeft, ShieldCheck, Eye, Plus, Check, SlidersHorizontal,
  TrendingUp, PieChart, FileBarChart, CreditCard, ChevronRight,
  AlertTriangle, Lock, Unlock, HelpCircle, UserCheck, ShieldAlert,
  Coins, Edit2, X, Trash2, ArrowUpDown, Phone, Home, User as UserIcon, XCircle, ArrowRight, Sparkles, RotateCcw,
  Banknote, Calculator
} from 'lucide-react';
import { addFirestoreDoc, updateFirestoreDoc, deleteFirestoreDoc, executeRevertRentCollectionBatch, RevertBatchItem } from '../../services/dbSync';
import { motion, AnimatePresence } from 'motion/react';
import { useBackHandler } from '../../utils/navigationManager';
import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReOwnerAdvance, ReAdvanceDeductionEntry,
  ReRentDue, User, ReCommissionStatus, ReRentAdjustment 
} from '../../types';
import { getDueCollectionStatus, isDueCollected, calculateCommissionFromSettings, getDueCommissionAmount, getPropertyCommissionSettings, getSectionCommissionForPropertyMonth, calculatePropertyStatementsData, calculateOwnerStatementsData, isTenantMonthSuspended, getMatchingCollectionReceipts, isAdvanceDeductedFromEntitlement, getAdvanceDeductedAmount, getAdvanceDeductedFromEntitlementAmount } from './RealEstateData';
import SearchableTenantDropdown from './SearchableTenantDropdown';
import TenantCollectionReceiptsModal from './TenantCollectionReceiptsModal';
import { PropertyPayoutReceiptsModal } from './PropertyPayoutReceiptsModal';
import { AdvanceDeductionModal, getDeductionMethodBadge, handlePrintAdvanceVoucher } from './AdvanceDeductionModal';
import { AdvanceDeductionReceiptsModal } from './AdvanceDeductionReceiptsModal';

const AR_MONTHS = [
  { value: 'all', label: 'جميع الشهور' },
  { value: '01', label: '01 - يناير' },
  { value: '02', label: '02 - فبراير' },
  { value: '03', label: '03 - مارس' },
  { value: '04', label: '04 - أبريل' },
  { value: '05', label: '05 - مايو' },
  { value: '06', label: '06 - يونيو' },
  { value: '07', label: '07 - يوليو' },
  { value: '08', label: '08 - أغسطس' },
  { value: '09', label: '09 - سبتمبر' },
  { value: '10', label: '10 - أكتوبر' },
  { value: '11', label: '11 - نوفمبر' },
  { value: '12', label: '12 - ديسمبر' },
];

export interface PropertyCommissionSummary {
  id: string; // `${propertyId}_${forMonthYear}`
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  forMonthYear: string; // e.g. "2026-07"
  monthNameAr: string; // e.g. "يوليو 2026"
  totalDueRent: number;
  totalCollectedRent: number;
  commissionType: 'percentage' | 'fixed_per_thousand' | 'fixed_flat';
  commissionValue: number;
  commissionLabel: string;
  dueCommission: number;
  collectedCommission: number;
  commissionDiff: number; // dueCommission - collectedCommission
  isCollectedFromOwner: boolean;
  amountCollectedFromOwner?: number;
  collectionDate?: string;
  notes?: string;
  unitDetails: Array<{
    unitId: string;
    unitNumber: string;
    tenantName: string;
    dueRent: number;
    collectedRent: number;
    dueComm: number;
    collComm: number;
    isCollected: boolean;
  }>;
}

interface RealEstateFinancialsProps {
  dues: ReRentDue[];
  rentAdjustments?: ReRentAdjustment[];
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  collections: ReCollectionReceipt[];
  payouts: RePayout[];
  expenses: RePropertyExpense[];
  advances?: ReOwnerAdvance[];
  commissionStatuses?: ReCommissionStatus[];
  currentUser: User;
  activeSubTab: string;
  onNavigateSubTab: (subTab: any) => void;
  onCollectRent: (due: ReRentDue | ReRentDue[]) => void;
  onPayoutOwner: (due: ReRentDue) => void;
  onCloseMonthDue?: (dueId: string) => void;
  onSaveCommissionStatus?: (statusRecord: ReCommissionStatus) => Promise<void> | void;
  onEditTenant?: (tenant: ReTenant) => void;
  onCleanDuplicateDues?: () => Promise<number> | void;
  isCleaningDuplicates?: boolean;
  onDeleteRentDue?: (dueId: string) => void;
  onDeleteAdvance?: (advanceId: string) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onDeleteCollection?: (collectionId: string) => void;
  onDeletePayout?: (payoutId: string) => void;
  onDeleteTenant?: (tenantId: string, tenantName: string, unitId?: string) => void;
  isOwnerStatementsCleared?: boolean;
  onClearOwnerStatements?: () => void;
  onRestoreOwnerStatements?: () => void;
}

export default function RealEstateFinancials({
  dues,
  rentAdjustments = [],
  owners,
  properties,
  units,
  tenants,
  collections,
  payouts,
  expenses,
  advances = [],
  commissionStatuses = [],
  currentUser,
  activeSubTab,
  onNavigateSubTab,
  onCollectRent,
  onPayoutOwner,
  onCloseMonthDue,
  onSaveCommissionStatus,
  onEditTenant,
  onCleanDuplicateDues,
  isCleaningDuplicates = false,
  onDeleteRentDue,
  onDeleteAdvance,
  onDeleteExpense,
  onDeleteCollection,
  onDeletePayout,
  onDeleteTenant,
  isOwnerStatementsCleared = false,
  onClearOwnerStatements,
  onRestoreOwnerStatements
}: RealEstateFinancialsProps) {

  // Current Date defaults
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthISO = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Compute status helpers
  const getDuePayoutStatus = (due: ReRentDue): 'paid_out' | 'pending_payout' => {
    if (due.payoutStatus === 'paid_out' || due.status === 'paid_out' || due.payoutDate) {
      return 'paid_out';
    }
    return 'pending_payout';
  };

  const getDueReconciliationStatus = (due: ReRentDue) => {
    const pStatus = getDuePayoutStatus(due);
    const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);

    if (due.monthClosingStatus === 'closed') {
      return { label: 'مغلق ومطابق 🔒', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    }
    if (pStatus === 'paid_out' && (cStatus === 'collected' || cStatus === 'prepaid')) {
      return { label: 'جاهز للإغلاق 🟢', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
    }
    if (pStatus === 'paid_out' && cStatus !== 'collected' && cStatus !== 'prepaid') {
      return { label: 'سلفة مكتب (صرف مقدماً) 🔵', color: 'bg-sky-500/20 text-sky-400 border-sky-500/40' };
    }
    if (cStatus === 'prepaid' && pStatus !== 'paid_out') {
      return { label: 'مسدد مسبقًا 🟣', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
    }
    if (cStatus === 'collected' && pStatus !== 'paid_out') {
      return { label: 'محصل (بانتظار المالك) 🟡', color: 'bg-[#D4A84F] text-slate-950 border-[#D4A84F]' };
    }
    if (cStatus === 'overdue') {
      return { label: 'متأخر في السداد ⚠️', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
    }
    return { label: 'في انتظار الاستحقاق ⏳', color: 'bg-[#9EA7B8]/20 text-[#9EA7B8] border-[#9EA7B8]/30' };
  };

  // Internal Navigation State inside Financials
  const [currentTab, setCurrentTab] = useState<
    'overview' | 'dues' | 'payouts' | 'property_statements' | 'owner_statements' | 'tenant_statements' | 'commissions' | 'reports' | 'rent_collections' | 'advances_expenses'
  >(() => {
    if (activeSubTab === 'rent_collections') return 'rent_collections';
    if (activeSubTab === 'advances_expenses') return 'advances_expenses';
    if (activeSubTab === 'owner_statements') return 'owner_statements';
    if (activeSubTab === 'tenant_statements') return 'tenant_statements';
    if (activeSubTab === 'property_statements') return 'property_statements';
    if (activeSubTab === 'commissions') return 'commissions';
    if (activeSubTab === 'reports') return 'reports';
    if (activeSubTab === 'dues') return 'dues';
    return 'rent_collections';
  });

  React.useEffect(() => {
    if (['rent_collections', 'advances_expenses', 'owner_statements', 'tenant_statements', 'property_statements', 'commissions'].includes(activeSubTab)) {
      setCurrentTab(activeSubTab as any);
      if (activeSubTab === 'rent_collections') {
        setSelectedTenantId('all');
        setSelectedPropertyId('all');
        setSearchQuery('');
        setRentFilterMode('all');
      }
    }
  }, [activeSubTab]);

  // Filter States
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payoutFilter, setPayoutFilter] = useState<string>('all');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [ownerPayoutTypeFilter, setOwnerPayoutTypeFilter] = useState<'all' | 'immediate' | 'deferred'>('all');
  const [tenantFromMonth, setTenantFromMonth] = useState<string>('');
  const [tenantToMonth, setTenantToMonth] = useState<string>('');
  const [tenantSortOrder, setTenantSortOrder] = useState<'asc' | 'desc'>('asc');

  // Segmented control filter states (لم يتم التحصيل | تم التحصيل | الكل) - Default is 'all'
  const [ownerStatementsFilter, setOwnerStatementsFilter] = useState<'all' | 'uncollected' | 'collected'>('all');
  const [propertyStatementsFilter, setPropertyStatementsFilter] = useState<'all' | 'uncollected' | 'collected'>('all');
  const [commissionsFilter, setCommissionsFilter] = useState<'all' | 'uncollected' | 'collected'>('all');

  // Account Type Filter states (حسابات شهرية | حسابات إجمالية) - Default is 'monthly'
  const [ownerAccountType, setOwnerAccountType] = useState<'monthly' | 'total'>('monthly');
  const [propertyAccountType, setPropertyAccountType] = useState<'monthly' | 'total'>('monthly');
  const [commAccountType, setCommAccountType] = useState<'monthly' | 'total'>('monthly');

  // Expanded property rows states
  const [expandedOwnerPropIds, setExpandedOwnerPropIds] = useState<Set<string>>(new Set());
  const [expandedPropIds, setExpandedPropIds] = useState<Set<string>>(new Set());
  const [expandedCommPropIds, setExpandedCommPropIds] = useState<Set<string>>(new Set());

  // Tenants Modal State for Property Statements
  const [propertyTenantsModalGroup, setPropertyTenantsModalGroup] = useState<any | null>(null);
  const [propertyTenantSearchQuery, setPropertyTenantSearchQuery] = useState<string>('');

  // Property Payout Receipts Modal State (سندات الصرف للعقار والمالك)
  const [propertyPayoutsModalGroup, setPropertyPayoutsModalGroup] = useState<{
    propertyId: string;
    propertyName: string;
    ownerId: string;
    ownerName: string;
    dues?: ReRentDue[];
  } | null>(null);

  const togglePropertyExpand = (propId: string) => {
    setExpandedPropIds(prev => {
      const next = new Set(prev);
      if (next.has(propId)) next.delete(propId);
      else next.add(propId);
      return next;
    });
  };

  const toggleOwnerPropExpand = (propId: string) => {
    setExpandedOwnerPropIds(prev => {
      const next = new Set(prev);
      if (next.has(propId)) next.delete(propId);
      else next.add(propId);
      return next;
    });
  };

  const toggleCommPropExpand = (propId: string) => {
    setExpandedCommPropIds(prev => {
      const next = new Set(prev);
      if (next.has(propId)) next.delete(propId);
      else next.add(propId);
      return next;
    });
  };

  // CANONICAL SOURCE OF TRUTH (قسم الإيجارات والتحصيل - Single Financial Source of Truth)
  // All financial panels, account statements, reports, and metrics read strictly from validDues.
  // Ignores orphan records (deleted tenants/properties) and eliminates duplicate/phantom entries.
  const validDues = useMemo(() => {
    if (!dues || dues.length === 0) return [];

    const existingTenantIds = new Set(tenants.map(t => t.id));
    const existingTenantNames = new Set(tenants.map(t => (t.fullName || '').trim().toLowerCase()));
    const tenantMap = new Map(tenants.map(t => [t.id, t]));
    const tenantNameMap = new Map(tenants.map(t => [(t.fullName || '').trim().toLowerCase(), t]));

    // Map active collection receipts for fast lookup
    const activeCollectionsKeySet = new Set<string>();
    (collections || []).forEach(c => {
      if (c && c.status !== 'reverted' && !c.isCancelled && (c.amountPaid || 0) > 0) {
        if (c.tenantId && c.forMonthYear) {
          activeCollectionsKeySet.add(`${c.tenantId}_${c.forMonthYear}`);
        }
      }
    });

    // 1. Filter out orphaned dues and phantom dues outside the tenant's contract period
    const activeDues = dues.filter(d => {
      if (!d || !d.id) return false;
      const matchesTenantId = d.tenantId && existingTenantIds.has(d.tenantId);
      const matchesTenantName = d.tenantName && existingTenantNames.has((d.tenantName || '').trim().toLowerCase());
      if (!matchesTenantId && !matchesTenantName && d.tenantName) {
        return false; // Ignore dues without a corresponding active tenant
      }

      // Find tenant object
      const tenant = (d.tenantId ? tenantMap.get(d.tenantId) : null) ||
                     (d.tenantName ? tenantNameMap.get((d.tenantName || '').trim().toLowerCase()) : null);

      if (tenant) {
        // Contract date boundaries check: hide phantom dues prior to lease start
        const regDateStr = tenant.accountingStartMonth || tenant.contractStartDate || tenant.createdAt;
        if (regDateStr && d.forMonthYear) {
          const startMonthStr = regDateStr.slice(0, 7);
          if (startMonthStr && d.forMonthYear < startMonthStr) {
            const key = `${tenant.id}_${d.forMonthYear}`;
            const isCollected = activeCollectionsKeySet.has(key);
            if (!isCollected) return false;
          }
        }

        if ((tenant.contractEndDate || tenant.accountingEndMonth) && d.forMonthYear) {
          let endMonthStr = tenant.contractEndDate ? tenant.contractEndDate.slice(0, 7) : '';
          if (tenant.accountingEndMonth && tenant.accountingEndMonth.trim() !== '') {
            const accEndMonth = tenant.accountingEndMonth.slice(0, 7);
            if (!endMonthStr || accEndMonth < endMonthStr) {
              endMonthStr = accEndMonth;
            }
          }
          if (endMonthStr && d.forMonthYear > endMonthStr) {
            const key = `${tenant.id}_${d.forMonthYear}`;
            const isCollected = activeCollectionsKeySet.has(key);
            if (!isCollected) return false;
          }
        }

        // Suspension check: hide uncollected dues that fall within suspended periods
        if (d.forMonthYear && isTenantMonthSuspended(d.forMonthYear, tenant)) {
          const key = `${tenant.id}_${d.forMonthYear}`;
          const isCollected = activeCollectionsKeySet.has(key);
          if (!isCollected) return false;
        }
      }

      return true;
    });

    // 2. Enrich dues with collection status and apply rent adjustments strictly
    const enrichedDues = activeDues.map(d => {
      // Find matching rent adjustment for this tenant and month if any
      const matchedAdj = (rentAdjustments || []).find(a => 
        ((a.tenantId && a.tenantId === d.tenantId) || 
         (a.tenantName && (a.tenantName || '').trim().toLowerCase() === (d.tenantName || '').trim().toLowerCase())) &&
        a.forMonthYear === d.forMonthYear
      );

      const effectiveRent = matchedAdj?.adjustedRentAmount ?? d.adjustedRentAmount ?? d.rentAmount;
      const isAdjusted = !!matchedAdj || !!d.isAdjusted;
      const commAmount = matchedAdj?.commissionAmount ?? d.commissionAmount;
      const netOwner = matchedAdj?.netOwnerAmount ?? (effectiveRent !== undefined && commAmount !== undefined ? Math.max(0, effectiveRent - commAmount) : d.netOwnerAmount);

      const dueWithAdj: ReRentDue = {
        ...d,
        rentAmount: effectiveRent,
        isAdjusted,
        adjustedRentAmount: effectiveRent,
        commissionAmount: commAmount,
        netOwnerAmount: netOwner
      };

      const cStat = getDueCollectionStatus(dueWithAdj, todayISO, currentMonthISO, collections);
      if (cStat === 'collected' || cStat === 'prepaid') {
        const matchingReceipts = getMatchingCollectionReceipts(dueWithAdj, collections);
        const matchingReceipt = matchingReceipts[0];
        const totalPaid = matchingReceipts.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
        return {
          ...dueWithAdj,
          status: 'collected' as const,
          collectionStatus: cStat,
          collectedAmount: totalPaid || dueWithAdj.rentAmount,
          paidDate: matchingReceipt?.paymentDate || dueWithAdj.paidDate,
          receiptNumber: matchingReceipt?.receiptNumber || dueWithAdj.receiptNumber
        };
      }
      return {
        ...dueWithAdj,
        status: (cStat === 'overdue' ? 'overdue' : 'pending_collection') as any,
        collectionStatus: cStat,
        collectedAmount: 0,
        paidDate: undefined,
        receiptNumber: undefined
      };
    });

    // 3. Deduplicate dues by unique key: (tenantId || tenantName) + '_' + (unitId || unitNumber) + '_' + forMonthYear
    const uniqueDuesMap = new Map<string, ReRentDue>();
    enrichedDues.forEach(d => {
      const tenantKey = d.tenantId || (d.tenantName || 't').trim().toLowerCase();
      const unitKey = d.unitId || d.unitNumber || 'u';
      const mYKey = d.forMonthYear || 'my';
      const key = `${tenantKey}_${unitKey}_${mYKey}`;

      if (!uniqueDuesMap.has(key)) {
        uniqueDuesMap.set(key, d);
      } else {
        const existing = uniqueDuesMap.get(key)!;
        const isDCollected = isDueCollected(d, todayISO, currentMonthISO, collections);
        const isExistCollected = isDueCollected(existing, todayISO, currentMonthISO, collections);
        
        const isDPaidOut = d.payoutStatus === 'paid_out' || !!d.payoutDate;
        const isExistPaidOut = existing.payoutStatus === 'paid_out' || !!existing.payoutDate;

        const isDAdjusted = !!d.isAdjusted;
        const isExistAdjusted = !!existing.isAdjusted;

        const dUpdated = d.updatedAt || d.createdAt || '';
        const existUpdated = existing.updatedAt || existing.createdAt || '';

        if ((isDCollected && !isExistCollected) || 
            (isDPaidOut && !isExistPaidOut) || 
            (isDAdjusted && !isExistAdjusted) ||
            (dUpdated > existUpdated)) {
          uniqueDuesMap.set(key, d);
        }
      }
    });

    return Array.from(uniqueDuesMap.values());
  }, [dues, tenants, collections, rentAdjustments, todayISO, currentMonthISO]);

  // Rent Collections Tab Specific States
  const [rentFilterMode, setRentFilterMode] = useState<'uncollected' | 'collected' | 'all'>('all');
  const [selectedRentYear, setSelectedRentYear] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedRentMonth, setSelectedRentMonth] = useState<string>('all');
  const [expandedPastDuesTenantId, setExpandedPastDuesTenantId] = useState<string | null>(null);
  const [editingRentDue, setEditingRentDue] = useState<ReRentDue | null>(null);
  const [newRentAmount, setNewRentAmount] = useState<number>(0);
  const [updateTenantContractRent, setUpdateTenantContractRent] = useState<boolean>(true);
  const [isSavingRentEdit, setIsSavingRentEdit] = useState<boolean>(false);

  // Arrears Batch Collection Modal States
  const [arrearsModalData, setArrearsModalData] = useState<{
    tenant: ReTenant;
    unitObj?: ReUnit;
    propObj?: ReProperty;
    ownerObj?: ReOwner;
    uncollectedDues: ReRentDue[];
  } | null>(null);
  const [arrearsModalTab, setArrearsModalTab] = useState<'arrears' | 'prepayment'>('arrears');
  const [selectedDueIdsForBatch, setSelectedDueIdsForBatch] = useState<string[]>([]);
  const [batchPaymentMethod, setBatchPaymentMethod] = useState<string>('نقداً');
  const [batchPaymentDate, setBatchPaymentDate] = useState<string>(todayISO);
  const [batchNotes, setBatchNotes] = useState<string>('');
  const [isProcessingBatchCollection, setIsProcessingBatchCollection] = useState<boolean>(false);

  // Revert Collection Modal States (Requirements 1 & 2)
  const [revertModalData, setRevertModalData] = useState<{
    tenant: ReTenant;
    unitObj?: ReUnit;
    propObj?: ReProperty;
    ownerObj?: ReOwner;
    collectedDues: ReRentDue[];
    latestBatchDues: ReRentDue[];
    olderDues: ReRentDue[];
    isPrepaymentRevert?: boolean;
    latestBatchInfo?: {
      receiptNumber?: string;
      date?: string;
      count: number;
    };
  } | null>(null);
  const [selectedDueIdsForRevert, setSelectedDueIdsForRevert] = useState<string[]>([]);
  const [isProcessingRevert, setIsProcessingRevert] = useState<boolean>(false);

  // Open Revert Collection Modal (Requirements 1, 2, 7, 8)
  const handleOpenRevertModal = (
    tenant: ReTenant, 
    unitObj?: ReUnit, 
    propObj?: ReProperty, 
    ownerObj?: ReOwner, 
    initialSelectedDueId?: string
  ) => {
    // 1. Get all collected dues for this tenant
    const tenantCollectedDues = validDues
      .filter(d => d.tenantId === tenant.id && getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'collected')
      .sort((a, b) => (b.forMonthYear || '').localeCompare(a.forMonthYear || ''));

    if (tenantCollectedDues.length === 0) {
      alert('⚠️ لا توجد شهور محصلة مسجلة لهذا المستأجر للرجوع عنها.');
      return;
    }

    // 2. Group collected dues into payment transactions / batches
    const batchMap = new Map<string, {
      key: string;
      receiptNumber?: string;
      date: string;
      dues: ReRentDue[];
    }>();

    tenantCollectedDues.forEach(due => {
      let key = '';
      if (due.receiptNumber && due.receiptNumber.trim() !== '' && due.receiptNumber !== '—') {
        key = `receipt_${due.receiptNumber.trim()}`;
      } else if (due.paidDate && due.paidDate.trim() !== '') {
        key = `date_${due.paidDate}_${due.paymentMethod || 'cash'}`;
      } else {
        key = `due_${due.id}`;
      }

      if (!batchMap.has(key)) {
        batchMap.set(key, {
          key,
          receiptNumber: due.receiptNumber && due.receiptNumber !== '—' ? due.receiptNumber : undefined,
          date: due.paidDate || '1970-01-01',
          dues: []
        });
      }
      batchMap.get(key)!.dues.push(due);
    });

    // Sort payment batches by date descending, then highest month descending
    const batches = Array.from(batchMap.values()).sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      const aMaxMonth = a.dues.map(d => d.forMonthYear || '').sort().reverse()[0] || '';
      const bMaxMonth = b.dues.map(d => d.forMonthYear || '').sort().reverse()[0] || '';
      return bMaxMonth.localeCompare(aMaxMonth);
    });

    const topBatch = batches[0];
    let latestBatchDues = topBatch ? topBatch.dues : [];
    if (latestBatchDues.length === 0 && tenantCollectedDues.length > 0) {
      latestBatchDues = tenantCollectedDues;
    }
    const latestBatchIds = new Set(latestBatchDues.map(d => d.id));
    const olderDues = tenantCollectedDues.filter(d => !latestBatchIds.has(d.id));

    // Alert if user tried to revert an older payment operation directly
    if (initialSelectedDueId && olderDues.some(d => d.id === initialSelectedDueId)) {
      alert(`⚠️ تنبيه مهم: لا يمكن الرجوع عن عمليات سداد أقدم قبل الرجوع عن العمليات الأحدث حفاظاً على تسلسل القيود الحسابية.\n\nتم تحديد أحدث عملية سداد تلقائياً (${latestBatchDues.length} أشهر).`);
    }

    setRevertModalData({
      tenant,
      unitObj,
      propObj,
      ownerObj,
      collectedDues: tenantCollectedDues,
      latestBatchDues,
      olderDues,
      isPrepaymentRevert: false,
      latestBatchInfo: topBatch ? {
        receiptNumber: topBatch.receiptNumber,
        date: topBatch.date,
        count: topBatch.dues.length
      } : undefined
    });

    // Default: Select all months in the latest payment batch
    setSelectedDueIdsForRevert(latestBatchDues.map(d => d.id));
  };

  // Open Revert Prepayment Modal (الرجوع عن الدفع المسبق)
  const handleOpenRevertPrepaymentModal = (
    tenant: ReTenant, 
    unitObj?: ReUnit, 
    propObj?: ReProperty, 
    ownerObj?: ReOwner, 
    initialSelectedDueId?: string
  ) => {
    // 1. Get all prepaid dues for this tenant (future months forMonthYear > currentMonthISO that are collected/prepaid)
    const tenantPrepaidDues = validDues
      .filter(d => {
        if (d.tenantId !== tenant.id) return false;
        if (!d.forMonthYear || d.forMonthYear <= currentMonthISO) return false;
        const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
        return cStat === 'prepaid' || cStat === 'collected' || ((d.collectedAmount || 0) > 0);
      })
      .sort((a, b) => (b.forMonthYear || '').localeCompare(a.forMonthYear || ''));

    if (tenantPrepaidDues.length === 0) {
      alert('⚠️ لا توجد شهور مسددة مسبقاً مسجلة لهذا المستأجر للرجوع عنها.');
      return;
    }

    // 2. Group prepaid dues into payment transactions / batches
    const batchMap = new Map<string, {
      key: string;
      receiptNumber?: string;
      date: string;
      dues: ReRentDue[];
    }>();

    tenantPrepaidDues.forEach(due => {
      let key = '';
      if (due.receiptNumber && due.receiptNumber.trim() !== '' && due.receiptNumber !== '—') {
        key = `receipt_${due.receiptNumber.trim()}`;
      } else if (due.paidDate && due.paidDate.trim() !== '') {
        key = `date_${due.paidDate}_${due.paymentMethod || 'cash'}`;
      } else {
        key = `due_${due.id}`;
      }

      if (!batchMap.has(key)) {
        batchMap.set(key, {
          key,
          receiptNumber: due.receiptNumber && due.receiptNumber !== '—' ? due.receiptNumber : undefined,
          date: due.paidDate || '1970-01-01',
          dues: []
        });
      }
      batchMap.get(key)!.dues.push(due);
    });

    const batches = Array.from(batchMap.values()).sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      const aMaxMonth = a.dues.map(d => d.forMonthYear || '').sort().reverse()[0] || '';
      const bMaxMonth = b.dues.map(d => d.forMonthYear || '').sort().reverse()[0] || '';
      return bMaxMonth.localeCompare(aMaxMonth);
    });

    const topBatch = batches[0];
    let latestBatchDues = topBatch ? topBatch.dues : [];
    if (latestBatchDues.length === 0 && tenantPrepaidDues.length > 0) {
      latestBatchDues = tenantPrepaidDues;
    }
    const latestBatchIds = new Set(latestBatchDues.map(d => d.id));
    const olderDues = tenantPrepaidDues.filter(d => !latestBatchIds.has(d.id));

    if (initialSelectedDueId && olderDues.some(d => d.id === initialSelectedDueId)) {
      alert(`⚠️ تنبيه مهم: لا يمكن الرجوع عن عمليات سداد أقدم قبل الرجوع عن أحدث عملية سداد مسبق حفاظاً على تسلسل القيود الحسابية.\n\nتم تحديد أحدث عملية سداد مسبق تلقائياً (${latestBatchDues.length} أشهر).`);
    }

    setRevertModalData({
      tenant,
      unitObj,
      propObj,
      ownerObj,
      collectedDues: tenantPrepaidDues,
      latestBatchDues,
      olderDues,
      isPrepaymentRevert: true,
      latestBatchInfo: topBatch ? {
        receiptNumber: topBatch.receiptNumber,
        date: topBatch.date,
        count: topBatch.dues.length
      } : undefined
    });

    // Default: Select all months in the latest payment batch
    setSelectedDueIdsForRevert(latestBatchDues.map(d => d.id));
  };

  // Confirm Revert Batch (Requirements 1, 2, 3, 4, 5, 6, 7)
  const handleConfirmRevertBatch = async () => {
    if (!revertModalData || selectedDueIdsForRevert.length === 0) {
      alert('⚠️ يرجى تحديد شهر واحد على الأقل للرجوع عن تحصيله.');
      return;
    }

    // Verify selected dues are strictly from latestBatchDues (LIFO Rule 7)
    const validLatestIds = new Set(revertModalData.latestBatchDues.map(d => d.id));
    const invalidSelections = selectedDueIdsForRevert.filter(id => !validLatestIds.has(id));
    if (invalidSelections.length > 0) {
      alert('⚠️ لا يمكن الرجوع إلا عن الأشهر التابعة لآخر عملية سداد فقط.');
      return;
    }

    const isPrepayment = !!revertModalData.isPrepaymentRevert;
    const confirmMsg = isPrepayment
      ? `⚠️ هل أنت متأكد من الرجوع عن الدفع المسبق لـ (${selectedDueIdsForRevert.length}) شهر للمستأجر (${revertModalData.tenant.fullName})؟\n\nستتحول هذه الأشهر المستقبلية إلى (غير مدفوعة) ولن تظهر كمتأخرات إلا عند حلول شهر محاسبتها الفعلي.`
      : `⚠️ هل أنت متأكد من الرجوع عن تحصيل (${selectedDueIdsForRevert.length}) شهر للمستأجر (${revertModalData.tenant.fullName})؟\n\nستتم إعادة هذه الأشهر فوراً إلى قائمة المتأخرات وغير المحصلة وتحديث جميع الكشوفات والتقارير المالية.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsProcessingRevert(true);
    try {
      const { tenant, unitObj, propObj, ownerObj } = revertModalData;
      const revertItems: RevertBatchItem[] = [];

      for (const dueId of selectedDueIdsForRevert) {
        const targetDue = validDues.find(d => d.id === dueId) || dues.find(d => d.id === dueId);

        const forMonthYear = targetDue?.forMonthYear || '';
        const dueDate = targetDue?.dueDate || (forMonthYear ? `${forMonthYear}-01` : todayISO);
        const rentAmount = targetDue?.rentAmount || tenant.rentAmount || unitObj?.rentValue || 0;
        const monthNameAr = targetDue?.monthNameAr || formatMonthYearAr(forMonthYear);

        const isOverdue = !isPrepayment && ((dueDate && dueDate < todayISO) || (forMonthYear && forMonthYear < currentMonthISO));
        const newStatus = isOverdue ? 'overdue' : 'pending';
        const newCollectionStatus = isOverdue ? 'overdue' : 'pending_collection';

        const dueDataToSet: ReRentDue = {
          id: dueId,
          tenantId: tenant.id,
          tenantName: tenant.fullName || '',
          propertyId: tenant.propertyId || unitObj?.propertyId || propObj?.id || '',
          unitId: tenant.unitId || unitObj?.id || '',
          unitNumber: unitObj?.unitNumber || targetDue?.unitNumber || '',
          ownerId: tenant.ownerId || propObj?.ownerId || ownerObj?.id || '',
          forMonthYear: forMonthYear,
          monthNameAr: monthNameAr,
          rentAmount: rentAmount,
          commissionType: targetDue?.commissionType || 'percentage',
          commissionValue: targetDue?.commissionValue || 0,
          commissionAmount: targetDue?.commissionAmount || 0,
          netOwnerAmount: targetDue?.netOwnerAmount || rentAmount,
          dueDate: dueDate,
          status: newStatus,
          collectionStatus: newCollectionStatus,
          collectedAmount: 0,
          paidDate: '',
          receiptNumber: '',
          paymentMethod: '',
          collectedBy: '',
          collectionNotes: isPrepayment ? 'تم الرجوع عن الدفع المسبق' : 'تم الرجوع عن التحصيل',
          lastRevertDate: new Date().toISOString().slice(0, 10),
          isPrepaid: false,
          payoutStatus: 'pending_payout',
          payoutDate: '',
          payoutReceiptNumber: '',
          monthClosingStatus: 'open',
          updatedAt: new Date().toISOString(),
          createdAt: targetDue?.createdAt || new Date().toISOString()
        };

        // 1. Find matching collection receipts in re_collections
        const matchingColls = (collections || []).filter(c => 
          (c.dueId && c.dueId === dueId) ||
          (c.receiptNumber && targetDue?.receiptNumber && c.receiptNumber === targetDue.receiptNumber && c.receiptNumber !== '—') ||
          (c.tenantId === tenant.id && c.forMonthYear === forMonthYear && c.status !== 'reverted')
        );
        const collectionIdsToRevert = matchingColls.map(c => c.id);

        // 2. Find matching payouts in re_payouts
        const matchingPayouts = (payouts || []).filter(p => 
          (p.dueId && p.dueId === dueId) ||
          (p.receiptNumber && targetDue?.receiptNumber && p.receiptNumber === targetDue.receiptNumber && p.receiptNumber !== '—') ||
          (p.tenantId === tenant.id && p.forMonthYear === forMonthYear && p.status !== 'reverted')
        );
        const payoutIdsToRevert = matchingPayouts.map(p => p.id);

        // 3. Find matching commission statuses in re_commission_statuses
        const matchingComms = (commissionStatuses || []).filter(cs => 
          cs.dueId === dueId ||
          (cs.tenantId === tenant.id && cs.forMonthYear === forMonthYear)
        );
        const commissionStatusIdsToReset = matchingComms.map(cs => cs.id);

        revertItems.push({
          dueId,
          dueDataToSet,
          collectionIdsToRevert,
          payoutIdsToRevert,
          commissionStatusIdsToReset
        });
      }

      // Execute atomic WriteBatch in Firestore
      await executeRevertRentCollectionBatch(revertItems);

      // Log revert action in Firestore
      await addFirestoreDoc('re_logs', {
        type: isPrepayment ? 'prepayment_revert' : 'collection_revert',
        action: isPrepayment ? 'الرجوع عن الدفع المسبق' : 'الرجوع عن تحصيل إيجارات',
        description: isPrepayment 
          ? `تم الرجوع عن تحصيل الدفع المسبق لـ (${selectedDueIdsForRevert.length}) شهر للمستأجر ${tenant.fullName}`
          : `تم الرجوع عن تحصيل (${selectedDueIdsForRevert.length}) شهر للمستأجر ${tenant.fullName}`,
        performedBy: currentUser?.fullName || currentUser?.username || 'مستخدم النظام',
        createdAt: new Date().toISOString()
      }).catch(() => {});

      alert(isPrepayment 
        ? `✅ تم الرجوع عن الدفع المسبق لـ (${selectedDueIdsForRevert.length}) شهر بنجاح وإلغاء تسجيل الدفع المسبق لها.`
        : `✅ تم الرجوع عن تحصيل (${selectedDueIdsForRevert.length}) شهر بنجاح وإعادتها فوراً لقائمة المتأخرات وغير المحصلة في جميع أقسام النظام.`
      );
      setRevertModalData(null);
      setSelectedDueIdsForRevert([]);
    } catch (err) {
      console.error('Error batch reverting dues:', err);
      alert('❌ حدث خطأ أثناء الرجوع عن التحصيل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessingRevert(false);
    }
  };

  // Available Years list for Rent Collection Filter
  const availableRentYears = useMemo(() => {
    const yearsSet = new Set<string>();
    const currentY = new Date().getFullYear();
    for (let y = currentY - 3; y <= currentY + 4; y++) {
      yearsSet.add(y.toString());
    }
    validDues.forEach(d => {
      if (d.forMonthYear && d.forMonthYear.includes('-')) {
        const yr = d.forMonthYear.split('-')[0];
        if (yr) yearsSet.add(yr);
      }
    });
    return Array.from(yearsSet).sort();
  }, [validDues]);

  // Advances & Expenses SubTab Specific States
  const [advancesSubTab, setAdvancesSubTab] = useState<'owner_advances' | 'property_expenses'>('owner_advances');
  const [advancesSearchQuery, setAdvancesSearchQuery] = useState<string>('');
  const [advancesOwnerFilter, setAdvancesOwnerFilter] = useState<string>('all');
  const [advancesPropertyFilter, setAdvancesPropertyFilter] = useState<string>('all');
  const [advancesStatusFilter, setAdvancesStatusFilter] = useState<'all' | 'deducted' | 'pending'>('all');

  // Add Advance Modal State
  const [isAddAdvanceModalOpen, setIsAddAdvanceModalOpen] = useState<boolean>(false);
  const [advanceOwnerId, setAdvanceOwnerId] = useState<string>('');
  const [advancePropertyId, setAdvancePropertyId] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('');
  const [advanceDate, setAdvanceDate] = useState<string>(todayISO);
  const [advanceNotes, setAdvanceNotes] = useState<string>('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>('تحويل بنكي');
  const [isSavingAdvance, setIsSavingAdvance] = useState<boolean>(false);

  // Advance Deduction Modal State (نافذة خصم وتسوية السلفة)
  const [advanceDeductionModalData, setAdvanceDeductionModalData] = useState<{
    advance: ReOwnerAdvance;
    availableNetEntitlement: number;
  } | null>(null);
  const [isSubmittingAdvanceDeduction, setIsSubmittingAdvanceDeduction] = useState<boolean>(false);

  // Keep active advance modal synchronized with updated advances list
  React.useEffect(() => {
    if (advanceDeductionModalData?.advance?.id) {
      const currentAdv = advances.find(a => a.id === advanceDeductionModalData.advance.id);
      if (currentAdv) {
        setAdvanceDeductionModalData(prev => prev ? {
          ...prev,
          advance: currentAdv
        } : null);
      }
    }
  }, [advances]);

  // Advance Deduction Receipts Modal State (نافذة سندات الخصم والتسوية)
  const [isAdvanceReceiptsModalOpen, setIsAdvanceReceiptsModalOpen] = useState<boolean>(false);
  const [selectedAdvanceForReceipts, setSelectedAdvanceForReceipts] = useState<ReOwnerAdvance | null>(null);

  // Add Expense Modal State
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState<boolean>(false);
  const [expensePropertyId, setExpensePropertyId] = useState<string>('');
  const [expenseOwnerId, setExpenseOwnerId] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('صيانة عامة ونظافة');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState<string>(todayISO);
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseAttachmentUrl, setExpenseAttachmentUrl] = useState<string>('');
  const [expenseAttachmentName, setExpenseAttachmentName] = useState<string>('');
  const [isSavingExpense, setIsSavingExpense] = useState<boolean>(false);

  // Commissions Tab Specific States & Modals
  const [commSelectedOwnerId, setCommSelectedOwnerId] = useState<string>('all');
  const [commSelectedPropertyId, setCommSelectedPropertyId] = useState<string>('all');
  const [commSelectedTenantId, setCommSelectedTenantId] = useState<string>('all');
  const [commSelectedMonth, setCommSelectedMonth] = useState<string>('all');
  const [commSelectedYear, setCommSelectedYear] = useState<string>('all');
  const [commSelectedStatus, setCommSelectedStatus] = useState<string>('all');
  const [commSearchTerm, setCommSearchTerm] = useState<string>('');

  const commSelectedMonthYear = useMemo(() => {
    if (commSelectedYear !== 'all' && commSelectedMonth !== 'all') {
      return `${commSelectedYear}-${commSelectedMonth}`;
    }
    if (commSelectedYear !== 'all') return `سنة ${commSelectedYear}`;
    if (commSelectedMonth !== 'all') return `شهر ${commSelectedMonth}`;
    return 'all';
  }, [commSelectedYear, commSelectedMonth]);

  const [editingCommRecord, setEditingCommRecord] = useState<{
    id: string;
    propertyId: string;
    propertyName: string;
    ownerId: string;
    ownerName: string;
    forMonthYear: string;
    totalDueRent: number;
    totalCollectedRent: number;
    earnedCommission: number;
    collectedRentCommission: number;
    status: 'not_claimed' | 'claimed' | 'collected' | 'overdue';
    amountCollectedFromOwner: number;
    collectionDate: string;
    paymentMethod: string;
    referenceNumber: string;
    notes: string;
  } | null>(null);

  // Owner Statements Property Payout Modal States
  const [ownerPayoutModalGroup, setOwnerPayoutModalGroup] = useState<{
    propertyId: string;
    propertyName: string;
    ownerId: string;
    ownerName: string;
    dues: ReRentDue[];
    totalRentSum: number;
    totalCommissionSum: number;
    totalNetOwnerSum: number;
    totalDisbursedSum: number;
    totalCollectedSum: number;
    totalBalanceSum: number;
    totalDeductionsSum?: number;
    netBalanceAfterDeductions?: number;
  } | null>(null);

  const [ownerPayoutAmount, setOwnerPayoutAmount] = useState<number | ''>('');
  const [ownerPayoutDate, setOwnerPayoutDate] = useState<string>(todayISO);
  const [ownerPayoutMethod, setOwnerPayoutMethod] = useState<'نقدي' | 'تحويل بنكي' | 'اتصالات كاش' | 'فودافون كاش' | string>('تحويل بنكي');
  const [ownerPayoutRefNo, setOwnerPayoutRefNo] = useState<string>('');
  const [ownerPayoutNotes, setOwnerPayoutNotes] = useState<string>('');
  const [isSavingOwnerPropertyPayout, setIsSavingOwnerPropertyPayout] = useState<boolean>(false);

  const [commModalStatus, setCommModalStatus] = useState<'not_claimed' | 'claimed' | 'collected' | 'overdue'>('not_claimed');
  const [commModalAmount, setCommModalAmount] = useState<number | ''>('');
  const [commModalDate, setCommModalDate] = useState<string>(todayISO);
  const [commModalPaymentMethod, setCommModalPaymentMethod] = useState<string>('نقدي');
  const [commModalRefNo, setCommModalRefNo] = useState<string>('');
  const [commModalNotes, setCommModalNotes] = useState<string>('');
  const [isSavingCommStatus, setIsSavingCommStatus] = useState<boolean>(false);

  const [isCommReportPreviewOpen, setIsCommReportPreviewOpen] = useState<boolean>(false);
  const [viewDetailCommRecord, setViewDetailCommRecord] = useState<typeof commissionStatements[0] | null>(null);

  // Memoized Commission Statements per Property - Grouped per Property & Filtered strictly from validDues
  const commissionStatements = useMemo(() => {
    // 1. Filter validDues by commissionsFilter (uncollected | collected | all)
    const duesFilteredByCommFilter = validDues.filter(d => {
      const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
      const isCollected = cStatus === 'collected';
      if (commissionsFilter === 'uncollected') return !isCollected;
      if (commissionsFilter === 'collected') return isCollected;
      return true;
    });

    const statements: Array<{
      id: string;
      propertyId: string;
      propertyName: string;
      ownerId: string;
      ownerName: string;
      forMonthYear: string;
      totalDueRent: number;
      totalCollectedRent: number;
      commissionRateText: string;
      earnedCommission: number;
      collectedRentCommission: number;
      status: 'not_claimed' | 'claimed' | 'collected' | 'overdue';
      amountCollectedFromOwner: number;
      remainingCommission: number;
      collectionDate: string;
      paymentMethod: string;
      referenceNumber: string;
      notes: string;
      updatedAt: string;
      tenantCount: number;
      tenantNamesList: string;
      dues: ReRentDue[];
    }> = [];

    const existingTenantIds = new Set(tenants.map(t => t.id));
    const existingTenantNames = new Set(tenants.map(t => (t.fullName || '').trim().toLowerCase()));

    properties.forEach(prop => {
      const owner = owners.find(o => o.id === prop.ownerId);
      const ownerName = owner?.name || 'مالك غير محدد';
      const commSettings = getPropertyCommissionSettings(prop, owner);

      const propActiveTenants = tenants.filter(t => {
        if (t.propertyId && t.propertyId === prop.id) return true;
        const u = units.find(unit => unit.id === t.unitId);
        return u?.propertyId === prop.id;
      });

      let rateText = 'حسب العقد';
      if (commSettings.commissionType === 'percentage') {
        rateText = `نسبة (${commSettings.commissionValue}%)`;
      } else if (commSettings.commissionType === 'fixed_per_thousand') {
        rateText = `لكل 1000 (${commSettings.commissionValue} ج.م)`;
      } else if (commSettings.commissionType === 'fixed_flat') {
        rateText = `مبلغ ثابت (${commSettings.commissionValue} ج.م)`;
      }

      // Filter all dues belonging to this property
      const propDues = duesFilteredByCommFilter.filter(d => {
        if (d.propertyId !== prop.id) return false;

        // Month and Year filter cutoff
        if (commAccountType === 'monthly') {
          if (commSelectedYear !== 'all' && commSelectedMonth !== 'all') {
            const targetMY = `${commSelectedYear}-${commSelectedMonth}`;
            if (d.forMonthYear !== targetMY) return false;
          } else if (commSelectedYear !== 'all' && commSelectedMonth === 'all') {
            if (!d.forMonthYear.startsWith(`${commSelectedYear}-`)) return false;
          } else if (commSelectedYear === 'all' && commSelectedMonth !== 'all') {
            if (!d.forMonthYear.endsWith(`-${commSelectedMonth}`)) return false;
          } else {
            // Both month and year are 'all'
            const isCollected = getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'collected';
            if (d.forMonthYear > currentMonthISO && !isCollected) return false;
          }
        }

        // Must belong to an existing tenant
        const matchesTenantId = d.tenantId && existingTenantIds.has(d.tenantId);
        const matchesTenantName = d.tenantName && existingTenantNames.has((d.tenantName || '').trim().toLowerCase());
        if (!matchesTenantId && !matchesTenantName) return false;

        // Tenant dropdown filter if selected
        if (commSelectedTenantId !== 'all') {
          if (d.tenantId !== commSelectedTenantId) {
            const selT = tenants.find(t => t.id === commSelectedTenantId);
            if (!selT || (selT.fullName || '').trim().toLowerCase() !== (d.tenantName || '').trim().toLowerCase()) {
              return false;
            }
          }
        }

        return true;
      });

      if (commAccountType === 'monthly') {
        const monthYearsSet = new Set<string>();
        propDues.forEach(d => { if (d.forMonthYear) monthYearsSet.add(d.forMonthYear); });
        (commissionStatuses || []).filter(cs => cs.propertyId === prop.id).forEach(cs => {
          if (cs.forMonthYear && cs.forMonthYear !== 'all') monthYearsSet.add(cs.forMonthYear);
        });

        const monthYearsList = Array.from(monthYearsSet).filter(my => {
          if (commSelectedYear !== 'all' && commSelectedMonth !== 'all') {
            return my === `${commSelectedYear}-${commSelectedMonth}`;
          }
          if (commSelectedYear !== 'all') {
            if (!my.startsWith(`${commSelectedYear}-`)) return false;
          }
          if (commSelectedMonth !== 'all') {
            if (!my.endsWith(`-${commSelectedMonth}`)) return false;
          }
          return true;
        }).sort(); // Ascending chronological order (من الأقدم إلى الأحدث)

        monthYearsList.forEach(my => {
          const myDues = propDues.filter(d => d.forMonthYear === my);
          const statusObj = (commissionStatuses || []).find(cs => cs.propertyId === prop.id && cs.forMonthYear === my);

          if (myDues.length === 0 && !statusObj) return;

          const totalDueRent = myDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
          const totalCollectedRent = myDues.reduce((sum, d) => {
            const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
            return sum + (cStatus === 'collected' ? (d.collectedAmount || d.rentAmount || 0) : 0);
          }, 0);

          const earnedCommission = calculateCommissionFromSettings(totalDueRent, commSettings);
          const collectedRentCommission = calculateCommissionFromSettings(totalCollectedRent, commSettings);

          let statusVal: string = 'not_claimed';
          if (statusObj?.status) {
            statusVal = statusObj.status;
          } else if (statusObj?.isCollectedFromOwner) {
            statusVal = 'collected';
          }

          const amountCollectedFromOwner = statusVal === 'collected'
            ? (statusObj?.amountCollectedFromOwner ?? earnedCommission)
            : (statusObj?.amountCollectedFromOwner || 0);

          const remainingCommission = Math.max(0, earnedCommission - amountCollectedFromOwner);

          const tenantNames = Array.from(new Set(myDues.map(d => d.tenantName).filter(Boolean)));
          const finalTenantNames = tenantNames.length > 0 ? tenantNames : propActiveTenants.map(t => t.fullName);
          const uniqueTenantNames = Array.from(new Set(finalTenantNames));

          statements.push({
            id: `${prop.id}_${my}`,
            propertyId: prop.id,
            propertyName: prop.name,
            ownerId: prop.ownerId || owner?.id || '',
            ownerName: ownerName,
            forMonthYear: my,
            totalDueRent,
            totalCollectedRent,
            commissionRateText: rateText,
            earnedCommission,
            collectedRentCommission,
            status: statusVal as any,
            amountCollectedFromOwner,
            remainingCommission,
            collectionDate: statusObj?.collectionDate || '',
            paymentMethod: statusObj?.paymentMethod || 'نقدي',
            referenceNumber: statusObj?.referenceNumber || '',
            notes: statusObj?.notes || '',
            updatedAt: statusObj?.updatedAt || '',
            tenantCount: uniqueTenantNames.length,
            tenantNamesList: uniqueTenantNames.join(' ، '),
            dues: myDues,
          });
        });
      } else {
        const statusId = `${prop.id}_all`;
        const statusObj = (commissionStatuses || []).find(cs => cs.propertyId === prop.id && cs.forMonthYear === 'all');

        if (propDues.length === 0 && !statusObj) return;

        const totalDueRent = propDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
        const totalCollectedRent = propDues.reduce((sum, d) => {
          const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
          return sum + (cStatus === 'collected' ? (d.collectedAmount || d.rentAmount || 0) : 0);
        }, 0);

        const earnedCommission = calculateCommissionFromSettings(totalDueRent, commSettings);
        const collectedRentCommission = calculateCommissionFromSettings(totalCollectedRent, commSettings);

        let statusVal: string = 'not_claimed';
        if (statusObj?.status) {
          statusVal = statusObj.status;
        } else if (statusObj?.isCollectedFromOwner) {
          statusVal = 'collected';
        }

        const amountCollectedFromOwner = statusVal === 'collected'
          ? (statusObj?.amountCollectedFromOwner ?? earnedCommission)
          : (statusObj?.amountCollectedFromOwner || 0);

        const remainingCommission = Math.max(0, earnedCommission - amountCollectedFromOwner);

        const tenantNames = Array.from(new Set(propDues.map(d => d.tenantName).filter(Boolean)));
        const finalTenantNames = tenantNames.length > 0 ? tenantNames : propActiveTenants.map(t => t.fullName);
        const uniqueTenantNames = Array.from(new Set(finalTenantNames));

        statements.push({
          id: statusId,
          propertyId: prop.id,
          propertyName: prop.name,
          ownerId: prop.ownerId || owner?.id || '',
          ownerName: ownerName,
          forMonthYear: 'حساب إجمالي شامل',
          totalDueRent,
          totalCollectedRent,
          commissionRateText: rateText,
          earnedCommission,
          collectedRentCommission,
          status: statusVal as any,
          amountCollectedFromOwner,
          remainingCommission,
          collectionDate: statusObj?.collectionDate || '',
          paymentMethod: statusObj?.paymentMethod || 'نقدي',
          referenceNumber: statusObj?.referenceNumber || '',
          notes: statusObj?.notes || '',
          updatedAt: statusObj?.updatedAt || '',
          tenantCount: uniqueTenantNames.length,
          tenantNamesList: uniqueTenantNames.join(' ، '),
          dues: propDues,
        });
      }
    });

    // Sort all statements chronologically ascending (من الأقدم إلى الأحدث) by forMonthYear
    statements.sort((a, b) => {
      const myA = a.forMonthYear || '';
      const myB = b.forMonthYear || '';
      if (myA !== myB) {
        return myA.localeCompare(myB);
      }
      const propComp = a.propertyName.localeCompare(b.propertyName, 'ar');
      if (propComp !== 0) return propComp;
      return a.ownerName.localeCompare(b.ownerName, 'ar');
    });

    return statements;
  }, [properties, owners, validDues, tenants, units, commissionStatuses, currentMonthISO, commSelectedTenantId, commSelectedMonth, commSelectedYear, commSelectedMonthYear, commissionsFilter, commAccountType]);

  const filteredCommStatements = useMemo(() => {
    return commissionStatements.filter(stmt => {
      if (commSelectedOwnerId !== 'all' && stmt.ownerId !== commSelectedOwnerId) return false;
      if (commSelectedPropertyId !== 'all' && stmt.propertyId !== commSelectedPropertyId) return false;
      if (commSelectedStatus !== 'all' && stmt.status !== commSelectedStatus) return false;
      if (commSearchTerm.trim()) {
        const q = commSearchTerm.trim().toLowerCase();
        const match = stmt.propertyName.toLowerCase().includes(q) ||
                      stmt.ownerName.toLowerCase().includes(q) ||
                      stmt.tenantNamesList.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [commissionStatements, commSelectedOwnerId, commSelectedPropertyId, commSelectedStatus, commSearchTerm]);

  const propertyCommGroups = useMemo(() => {
    const map = new Map<string, {
      propertyId: string;
      propertyName: string;
      ownerId: string;
      ownerName: string;
      commissionRateText: string;
      statements: typeof filteredCommStatements;
      totalDueRent: number;
      totalCollectedRent: number;
      earnedCommission: number;
      collectedRentCommission: number;
      amountCollectedFromOwner: number;
      remainingCommission: number;
      monthsCount: number;
      collectedMonthsCount: number;
    }>();

    filteredCommStatements.forEach(item => {
      const existing = map.get(item.propertyId);
      if (!existing) {
        map.set(item.propertyId, {
          propertyId: item.propertyId,
          propertyName: item.propertyName,
          ownerId: item.ownerId,
          ownerName: item.ownerName,
          commissionRateText: item.commissionRateText,
          statements: [item],
          totalDueRent: item.totalDueRent,
          totalCollectedRent: item.totalCollectedRent,
          earnedCommission: item.earnedCommission,
          collectedRentCommission: item.collectedRentCommission,
          amountCollectedFromOwner: item.amountCollectedFromOwner,
          remainingCommission: item.remainingCommission,
          monthsCount: 1,
          collectedMonthsCount: item.status === 'collected' ? 1 : 0,
        });
      } else {
        existing.statements.push(item);
        existing.totalDueRent += item.totalDueRent;
        existing.totalCollectedRent += item.totalCollectedRent;
        existing.earnedCommission += item.earnedCommission;
        existing.collectedRentCommission += item.collectedRentCommission;
        existing.amountCollectedFromOwner += item.amountCollectedFromOwner;
        existing.remainingCommission += item.remainingCommission;
        existing.monthsCount += 1;
        if (item.status === 'collected') {
          existing.collectedMonthsCount += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [filteredCommStatements]);

  const [selectedPropertyCommPropertyId, setSelectedPropertyCommPropertyId] = useState<string | null>(null);

  const selectedPropertyCommGroup = useMemo(() => {
    if (!selectedPropertyCommPropertyId) return null;
    return propertyCommGroups.find(g => g.propertyId === selectedPropertyCommPropertyId) || null;
  }, [selectedPropertyCommPropertyId, propertyCommGroups]);

  const commTotals = useMemo(() => {
    let sumDueRent = 0;
    let sumCollectedRent = 0;
    let sumEarnedComm = 0;
    let sumCollectedRentComm = 0;
    let sumCollectedFromOwner = 0;
    let sumRemainingComm = 0;

    filteredCommStatements.forEach(s => {
      sumDueRent += s.totalDueRent;
      sumCollectedRent += s.totalCollectedRent;
      sumEarnedComm += s.earnedCommission;
      sumCollectedRentComm += s.collectedRentCommission;
      sumCollectedFromOwner += s.amountCollectedFromOwner;
      sumRemainingComm += s.remainingCommission;
    });

    return {
      sumDueRent,
      sumCollectedRent,
      sumEarnedComm,
      sumCollectedRentComm,
      sumCollectedFromOwner,
      sumRemainingComm,
      count: filteredCommStatements.length
    };
  }, [filteredCommStatements]);

  const allAvailableCommYears = useMemo(() => {
    const set = new Set<string>();
    validDues.forEach(d => {
      if (d.forMonthYear && d.forMonthYear.includes('-')) {
        const y = d.forMonthYear.split('-')[0];
        if (y && y.length === 4) set.add(y);
      }
    });
    const currentYearStr = new Date().getFullYear().toString();
    set.add(currentYearStr);
    return Array.from(set).sort().reverse();
  }, [validDues]);

  const handleOpenEditCommStatusModal = (record: typeof commissionStatements[0]) => {
    setEditingCommRecord(record);
    // Default status to 'collected' when opening collection modal
    setCommModalStatus('collected');
    setCommModalAmount(record.amountCollectedFromOwner > 0 ? record.amountCollectedFromOwner : record.earnedCommission);
    setCommModalDate(record.collectionDate || todayISO);
    setCommModalPaymentMethod(record.paymentMethod || 'نقدي');
    setCommModalRefNo(record.referenceNumber || '');
    setCommModalNotes(record.notes || '');
  };

  const handleSaveCommissionStatusRecord = async () => {
    if (!editingCommRecord) return;
    setIsSavingCommStatus(true);
    try {
      const isCollected = commModalStatus === 'collected';
      
      let docId = editingCommRecord.id ? String(editingCommRecord.id).trim() : '';
      if (!docId || docId === 'all') {
        docId = `${editingCommRecord.propertyId}_${editingCommRecord.forMonthYear || commSelectedMonthYear}`;
      }

      const statusRecord: ReCommissionStatus = {
        id: docId,
        propertyId: editingCommRecord.propertyId,
        propertyName: editingCommRecord.propertyName,
        ownerId: editingCommRecord.ownerId,
        ownerName: editingCommRecord.ownerName,
        forMonthYear: editingCommRecord.forMonthYear,
        status: commModalStatus,
        isCollectedFromOwner: isCollected,
        amountCollectedFromOwner: isCollected ? Number(commModalAmount) : 0,
        collectionDate: isCollected ? commModalDate : undefined,
        paymentMethod: commModalPaymentMethod,
        referenceNumber: commModalRefNo,
        notes: commModalNotes,
        updatedAt: new Date().toISOString().slice(0, 10),
        updatedBy: currentUser.fullName || currentUser.username
      };

      if (onSaveCommissionStatus) {
        await onSaveCommissionStatus(statusRecord);
      }
      setEditingCommRecord(null);
    } catch (err: any) {
      console.error(err?.message || err, err?.stack || '');
      alert(`حدث خطأ أثناء حفظ حالة العمولة: ${err?.message || err}`);
    } finally {
      setIsSavingCommStatus(false);
    }
  };

  const handleRevertCommissionStatus = async (record: typeof commissionStatements[0]) => {
    const confirmMsg = `تنبيه هام:\nهل أنت متأكد من التراجع عن تحصيل عمولة عقار "${record.propertyName}" عن المدة (${record.forMonthYear})؟\n\nسيتم إلغاء سجل التحصيل وقدره (${(record.amountCollectedFromOwner || record.earnedCommission).toLocaleString('ar-EG')} ج.م) وإعادة العمولة إلى غير محصلة.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSavingCommStatus(true);
    try {
      let docId = record.id ? String(record.id).trim() : '';
      if (!docId || docId === 'all') {
        docId = `${record.propertyId}_${record.forMonthYear || commSelectedMonthYear}`;
      }

      const statusRecord: ReCommissionStatus = {
        id: docId,
        propertyId: record.propertyId,
        propertyName: record.propertyName,
        ownerId: record.ownerId,
        ownerName: record.ownerName,
        forMonthYear: record.forMonthYear,
        status: 'not_claimed',
        isCollectedFromOwner: false,
        amountCollectedFromOwner: 0,
        collectionDate: undefined,
        paymentMethod: 'نقدي',
        referenceNumber: '',
        notes: `تم التراجع عن تحصيل العمولة بتاريخ ${new Date().toLocaleDateString('ar-EG')}`,
        updatedAt: new Date().toISOString().slice(0, 10),
        updatedBy: currentUser.fullName || currentUser.username
      };

      if (onSaveCommissionStatus) {
        await onSaveCommissionStatus(statusRecord);
      }
      if (editingCommRecord?.id === record.id) {
        setEditingCommRecord(null);
      }
    } catch (err: any) {
      console.error(err?.message || err, err?.stack || '');
      alert(`حدث خطأ أثناء التراجع عن تحصيل العمولة: ${err?.message || err}`);
    } finally {
      setIsSavingCommStatus(false);
    }
  };

  const handleOpenOwnerPropertyPayoutModal = (group: {
    propertyId: string;
    propertyName: string;
    ownerId: string;
    ownerName: string;
    dues: ReRentDue[];
    totalRentSum: number;
    totalCommissionSum: number;
    totalNetOwnerSum: number;
    totalDisbursedSum: number;
    totalCollectedSum: number;
    totalBalanceSum: number;
    totalDeductionsSum?: number;
    netBalanceAfterDeductions?: number;
  }) => {
    // Auto-fill payout amount with current total net due of the owner
    const netDueCurrent = group.netBalanceAfterDeductions !== undefined && group.netBalanceAfterDeductions > 0
      ? group.netBalanceAfterDeductions
      : (group.totalBalanceSum > 0 ? group.totalBalanceSum : Math.max(0, group.totalNetOwnerSum - group.totalDisbursedSum));

    setOwnerPayoutAmount(netDueCurrent > 0 ? netDueCurrent : group.totalNetOwnerSum);
    setOwnerPayoutDate(todayISO);
    setOwnerPayoutMethod('تحويل بنكي');
    setOwnerPayoutRefNo('');
    setOwnerPayoutNotes(`صرف مستحقات إيجار عقار ${group.propertyName} للمالك ${group.ownerName} بعد خصم عمولة المكتب والخصومات المعتمدة`);
    setOwnerPayoutModalGroup(group);
  };

  const handleConfirmOwnerPropertyPayout = async () => {
    if (!ownerPayoutModalGroup) return;
    if (isSavingOwnerPropertyPayout) return;

    const amountToDisburse = typeof ownerPayoutAmount === 'number' ? ownerPayoutAmount : parseFloat(String(ownerPayoutAmount || '0'));
    if (!amountToDisburse || amountToDisburse <= 0 || isNaN(amountToDisburse)) {
      alert('يرجى إدخال مبلغ صرف صحيح أكبر من 0 قبل تأكيد الحفظ.');
      return;
    }

    setIsSavingOwnerPropertyPayout(true);
    try {
      const receiptNumber = `PAY-${Date.now().toString().slice(-6)}`;
      const pendingDues = ownerPayoutModalGroup.dues.filter(d => getDuePayoutStatus(d) !== 'paid_out');

      // 1. Add payout record in re_payouts
      const newPayoutRecord: Omit<RePayout, 'id'> = {
        receiptNumber,
        ownerId: ownerPayoutModalGroup.ownerId,
        propertyId: ownerPayoutModalGroup.propertyId,
        totalCollected: ownerPayoutModalGroup.totalCollectedSum || ownerPayoutModalGroup.totalRentSum,
        commissionDeducted: ownerPayoutModalGroup.totalCommissionSum,
        expensesDeducted: ownerPayoutModalGroup.totalDeductionsSum || 0,
        netAmountPaid: amountToDisburse,
        payoutDate: ownerPayoutDate,
        paymentMethod: ownerPayoutMethod as any,
        bankTransactionRef: ownerPayoutRefNo,
        createdBy: currentUser.fullName || currentUser.username,
        notes: ownerPayoutNotes || `صرف مستحقات إيجار عقار ${ownerPayoutModalGroup.propertyName} للمالك ${ownerPayoutModalGroup.ownerName}`,
        status: 'payout_completed',
        isCancelled: false,
        signedByOwner: true,
        signatureDate: ownerPayoutDate,
        forMonthYear: selectedMonthYear !== 'all' ? selectedMonthYear : currentMonthISO,
        createdAt: new Date().toISOString()
      };
      await addFirestoreDoc('re_payouts', newPayoutRecord);

      // 2. Update matching dues to paid_out status
      if (pendingDues.length > 0) {
        for (const due of pendingDues) {
          await updateFirestoreDoc('re_dues', due.id, {
            status: 'paid_out',
            payoutStatus: 'paid_out',
            payoutDate: ownerPayoutDate,
            payoutMethod: ownerPayoutMethod,
            payoutRefNo: ownerPayoutRefNo,
            payoutNotes: ownerPayoutNotes,
            payoutReceiptNumber: receiptNumber,
            payoutRecordedBy: currentUser.fullName || currentUser.username
          });
        }
      }

      // 3. Log action
      await addFirestoreDoc('re_logs', {
        type: 'payout',
        action: 'صرف مستحقات إيجار للمالك (سند صرف)',
        details: `تم إصدار سند صرف رقم ${receiptNumber} بمبلغ ${amountToDisburse.toLocaleString('ar-EG')} ج.م بطريقة (${ownerPayoutMethod}) لعقار ${ownerPayoutModalGroup.propertyName} للمالك ${ownerPayoutModalGroup.ownerName}.`,
        timestamp: new Date().toISOString(),
        user: currentUser.fullName || currentUser.username
      });

      alert(`✅ تم حفظ سند الصرف بنجاح برقم (${receiptNumber}) وخصم المبلغ (${amountToDisburse.toLocaleString('ar-EG')} ج.م) من مستحقات المالك.`);
      setOwnerPayoutModalGroup(null);
    } catch (err: any) {
      console.error('Error saving property owner payout:', err);
      alert(`حدث خطأ أثناء حفظ سند الصرف: ${err?.message || err}`);
    } finally {
      setIsSavingOwnerPropertyPayout(false);
    }
  };

  const handleRevertSinglePayout = async (payout: RePayout) => {
    const confirmMsg = `تنبيه هام:\n\nهل أنت متأكد من التراجع عن سند الصرف رقم "${payout.receiptNumber || payout.id}" بمبلغ (${(payout.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م)؟\n\nسيتم إلغاء السند وإعادة المبلغ المصروف فوراً إلى رصيد المالك المستحق.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSavingOwnerPropertyPayout(true);
    try {
      // 1. Mark payout doc as reverted
      await updateFirestoreDoc('re_payouts', payout.id, {
        status: 'reverted',
        isCancelled: true,
        netAmountPaid: 0,
        notes: `${payout.notes || ''} [تم إلغاء السند والتراجع عن الصرف بتاريخ ${todayISO}]`
      });

      // 2. Revert any linked dues
      const linkedDues = validDues.filter(d => 
        (payout.dueId && d.id === payout.dueId) ||
        (d.payoutReceiptNumber && payout.receiptNumber && d.payoutReceiptNumber === payout.receiptNumber) ||
        (d.ownerId === payout.ownerId && d.propertyId === payout.propertyId && d.payoutDate === payout.payoutDate)
      );

      for (const due of linkedDues) {
        const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);
        await updateFirestoreDoc('re_dues', due.id, {
          status: cStatus === 'collected' ? 'collected' : 'pending',
          payoutStatus: 'pending_payout',
          payoutDate: '',
          payoutMethod: '',
          payoutRefNo: '',
          payoutNotes: '',
          payoutReceiptNumber: '',
          payoutRecordedBy: ''
        });
      }

      // 3. Log
      await addFirestoreDoc('re_logs', {
        type: 'payout_revert',
        action: 'إلغاء وتراجع عن سند صرف مالك',
        details: `تم إلغاء سند الصرف رقم ${payout.receiptNumber || payout.id} بمبلغ ${(payout.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م وإعادة المبلغ إلى صافي مستحق المالك.`,
        timestamp: new Date().toISOString(),
        user: currentUser.fullName || currentUser.username
      });

      alert('✅ تم إلغاء سند الصرف بنجاح وإعادة المبلغ المسترجع إلى رصيد المالك المستحق.');
    } catch (err: any) {
      console.error('Error reverting payout:', err);
      alert(`حدث خطأ أثناء إلغاء سند الصرف: ${err?.message || err}`);
    } finally {
      setIsSavingOwnerPropertyPayout(false);
    }
  };

  const handleRevertPropertyOwnerPayout = async (group: {
    propertyId: string;
    propertyName: string;
    ownerId: string;
    ownerName: string;
    dues: ReRentDue[];
    totalRentSum: number;
    totalCommissionSum: number;
    totalNetOwnerSum: number;
    totalDisbursedSum: number;
    totalCollectedSum: number;
    totalBalanceSum: number;
  }) => {
    const paidOutDues = group.dues.filter(d => getDuePayoutStatus(d) === 'paid_out');
    const groupPayouts = payouts.filter(p => 
      p.propertyId === group.propertyId && 
      p.ownerId === group.ownerId && 
      p.status !== 'reverted' && 
      !p.isCancelled
    );

    if (paidOutDues.length === 0 && groupPayouts.length === 0) {
      alert('لا توجد عمليات صرف مسجلة لهذا العقار للتراجع عنها.');
      return;
    }

    const confirmMsg = `تنبيه هام قبل التراجع عن الصرف:\n\nهل أنت متأكد من التراجع عن صرف إيجار عقار "${group.propertyName}" للمالك (${group.ownerName})؟\n\nسيتم إلغاء سندات الصرف المسجلة وقدرها (${group.totalDisbursedSum.toLocaleString('ar-EG')} ج.م) وإعادة حالة الاستحقاقات إلى "بانتظار الصرف".`;
    if (!window.confirm(confirmMsg)) return;

    setIsSavingOwnerPropertyPayout(true);
    try {
      // 1. Revert matching payouts
      for (const payout of groupPayouts) {
        await updateFirestoreDoc('re_payouts', payout.id, {
          status: 'reverted',
          isCancelled: true,
          netAmountPaid: 0,
          notes: 'تم التراجع عن سند الصرف'
        });
      }

      // 2. Revert dues
      for (const due of paidOutDues) {
        const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);
        await updateFirestoreDoc('re_dues', due.id, {
          status: cStatus === 'collected' ? 'collected' : 'pending',
          payoutStatus: 'pending_payout',
          payoutDate: '',
          payoutMethod: '',
          payoutRefNo: '',
          payoutNotes: '',
          payoutReceiptNumber: '',
          payoutRecordedBy: ''
        });
      }

      // 3. Log revert action
      await addFirestoreDoc('re_logs', {
        type: 'payout_revert',
        action: 'الرجوع في صرف إيجار مالك',
        details: `تم التراجع عن صرف إيجار عقار ${group.propertyName} للمالك ${group.ownerName} وإعادة الاستحقاقات إلى بانتظار الصرف.`,
        timestamp: new Date().toISOString(),
        user: currentUser.fullName || currentUser.username
      });

      alert('✅ تم التراجع عن عملية صرف الإيجار بنجاح وإعادة الحساب إلى بانتظار الصرف.');
    } catch (err: any) {
      console.error('Error reverting property owner payout:', err);
      alert(`حدث خطأ أثناء التراجع عن صرف الإيجار: ${err?.message || err}`);
    } finally {
      setIsSavingOwnerPropertyPayout(false);
    }
  };

  const handlePrintCommissionReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const ownerFilterText = commSelectedOwnerId === 'all' ? 'جميع الملاك' : owners.find(o => o.id === commSelectedOwnerId)?.name || 'محدد';
    const propertyFilterText = commSelectedPropertyId === 'all' ? 'جميع العقارات' : properties.find(p => p.id === commSelectedPropertyId)?.name || 'محدد';
    const monthFilterText = commSelectedMonthYear === 'all' ? 'جميع الشهور' : commSelectedMonthYear;
    const statusFilterText = commSelectedStatus === 'all' ? 'جميع الحالات' : 
      commSelectedStatus === 'collected' ? 'تم التحصيل' :
      commSelectedStatus === 'claimed' ? 'تمت المطالبة' :
      commSelectedStatus === 'overdue' ? 'متأخرة' : 'لم تتم المطالبة';

    const issuedAtText = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' });
    const serialNo = `RUM-COMM-${Math.floor(100000 + Math.random() * 900000)}`;

    const rowsHTML = filteredCommStatements.map((item, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="font-weight: bold;">${item.propertyName}</td>
        <td>${item.ownerName}</td>
        <td style="text-align: center; font-family: monospace;">${item.forMonthYear}</td>
        <td style="text-align: center; font-family: monospace;">${item.totalDueRent.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align: center; font-family: monospace;">${item.totalCollectedRent.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align: center;">${item.commissionRateText}</td>
        <td style="text-align: center; font-family: monospace; font-weight: bold; color: #b45309;">${item.earnedCommission.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align: center; font-family: monospace;">${item.collectedRentCommission.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align: center; font-family: monospace; font-weight: bold; color: #047857;">${item.amountCollectedFromOwner.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align: center; font-family: monospace; font-weight: bold; color: ${item.remainingCommission > 0 ? '#b91c1c' : '#047857'};">${item.remainingCommission.toLocaleString('ar-EG')} ج.م</td>
        <td style="text-align: center; font-weight: bold;">
          ${item.status === 'collected' ? '<span style="color: #047857; background: #d1fae5; padding: 2px 8px; border-radius: 4px;">تم التحصيل</span>' :
            item.status === 'claimed' ? '<span style="color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;">تمت المطالبة</span>' :
            item.status === 'overdue' ? '<span style="color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 4px;">متأخرة</span>' :
            '<span style="color: #475569; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">لم تتم المطالبة</span>'}
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير كشف حساب وتصفية عمولات المكتب - مؤسسة رميح للمحاماة</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            background: #fff;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 10pt;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #d97706;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .brand-title {
            font-size: 14pt;
            font-weight: 900;
            color: #0f172a;
          }
          .brand-sub {
            font-size: 9pt;
            color: #d97706;
            font-weight: bold;
          }
          .meta-info {
            text-align: left;
            font-size: 8.5pt;
            color: #475569;
          }
          .serial {
            font-family: monospace;
            font-weight: bold;
            color: #d97706;
            margin-top: 3px;
          }
          .report-title {
            text-align: center;
            background: #fffbebfb;
            border: 1px solid #fcd34d;
            padding: 10px;
            border-radius: 8px;
            font-size: 12pt;
            font-weight: 900;
            color: #92400e;
            margin-bottom: 15px;
          }
          .filters-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 8.5pt;
            margin-bottom: 15px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 15px;
          }
          .summary-card {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            border-radius: 6px;
            text-align: center;
            background: #fafafa;
          }
          .summary-card .lbl { font-size: 8pt; color: #64748b; font-weight: bold; display: block; }
          .summary-card .val { font-size: 11pt; font-weight: 900; margin-top: 4px; display: block; font-family: monospace; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            margin-bottom: 20px;
          }
          th {
            background: #0f172a;
            color: #f8fafc;
            padding: 8px 6px;
            border: 1px solid #0f172a;
            font-weight: bold;
          }
          td {
            padding: 6px;
            border: 1px solid #cbd5e1;
          }
          tr:nth-child(even) { background: #f8fafc; }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
            font-size: 9pt;
            text-align: center;
          }
          .sig-box { width: 30%; }
          .sig-line { margin-top: 35px; border-bottom: 1px solid #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">⚖️ مؤسسة رميح للمحاماة والاستشارات القانونية</div>
            <div class="brand-sub">قطاع الإدارة العقارية والعمولات والخدمات المالية</div>
          </div>
          <div class="meta-info">
            <div>تاريخ الإصدار: ${issuedAtText}</div>
            <div>مُعد التقرير: ${currentUser.fullName || currentUser.username}</div>
            <div class="serial">السيريال: ${serialNo}</div>
          </div>
        </div>

        <div class="report-title">
          كشف حساب وتصفية عمولات المكتب عن الإدارة العقارية
        </div>

        <div class="filters-bar">
          <div><strong>المالك:</strong> ${ownerFilterText}</div>
          <div><strong>العقار:</strong> ${propertyFilterText}</div>
          <div><strong>الشهر المالي:</strong> ${monthFilterText}</div>
          <div><strong>الحالة:</strong> ${statusFilterText}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <span class="lbl">إجمالي الإيجارات المستحقة</span>
            <span class="val">${commTotals.sumDueRent.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div class="summary-card">
            <span class="lbl">إجمالي العمولة المستحقة</span>
            <span class="val" style="color: #b45309;">${commTotals.sumEarnedComm.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div class="summary-card">
            <span class="lbl">المحصل من الملاك</span>
            <span class="val" style="color: #047857;">${commTotals.sumCollectedFromOwner.toLocaleString('ar-EG')} ج.م</span>
          </div>
          <div class="summary-card">
            <span class="lbl">المتبقي / المتأخر</span>
            <span class="val" style="color: ${commTotals.sumRemainingComm > 0 ? '#b91c1c' : '#047857'};">${commTotals.sumRemainingComm.toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>العقار</th>
              <th>المالك</th>
              <th>الشهر</th>
              <th>إيجارات مستحقة</th>
              <th>إيجارات محصلة</th>
              <th>الآلية</th>
              <th>عمولة مستحقة</th>
              <th>عمولة الإيجار</th>
              <th>محصل من المالك</th>
              <th>المتبقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <strong>المحاسب المسؤول</strong>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <strong>اعتماد المدير العام</strong>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <strong>ختم المؤسسة الرسمية</strong>
            <div class="sig-line"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Advance Actions
  const handleSaveNewAdvance = async () => {
    if (!advanceOwnerId || !advancePropertyId || !advanceAmount || Number(advanceAmount) <= 0) {
      alert('يرجى اختيار المالك والعقار وإدخال مبلغ السلفة بشكل صحيح');
      return;
    }
    setIsSavingAdvance(true);
    try {
      const ownerObj = owners.find(o => o.id === advanceOwnerId);
      const propObj = properties.find(p => p.id === advancePropertyId);

      const newAdvance: Omit<ReOwnerAdvance, 'id'> = {
        ownerId: advanceOwnerId,
        ownerName: ownerObj?.name || '',
        propertyId: advancePropertyId,
        propertyName: propObj?.name || '',
        amount: Number(advanceAmount),
        advanceDate,
        notes: advanceNotes || 'سلفة مالك عاجلة',
        paymentMethod: advancePaymentMethod,
        isDeducted: false,
        recordedBy: currentUser.fullName,
        createdAt: new Date().toISOString()
      };

      await addFirestoreDoc('re_advances', newAdvance);

      await addFirestoreDoc('re_logs', {
        actionType: 'add',
        entityName: 'سلفة مالك',
        details: `تسجيل سلفة جديدة بقيمة ${advanceAmount} ج.م للمالك (${ownerObj?.name || 'مالك'}) - عقار (${propObj?.name || 'عقار'})`,
        username: currentUser.fullName,
        timestamp: new Date().toLocaleString('ar-EG')
      });

      setIsAddAdvanceModalOpen(false);
      setAdvanceOwnerId('');
      setAdvancePropertyId('');
      setAdvanceAmount('');
      setAdvanceNotes('');
    } catch (err) {
      console.error('Error saving advance:', err);
      alert('حدث خطأ أثناء حفظ السلفة');
    } finally {
      setIsSavingAdvance(false);
    }
  };

  const handleDeductAdvance = (advance: ReOwnerAdvance) => {
    const targetOwnerId = advance.ownerId;
    const ownerObj = owners.find(o => o.id === targetOwnerId);
    const ownerName = advance.ownerName || ownerObj?.name || 'المالك';

    // Calculate total net dues for this owner
    const ownerDues = validDues.filter(d => {
      const pOwnerId = properties.find(p => p.id === d.propertyId)?.ownerId;
      return d.ownerId === targetOwnerId || pOwnerId === targetOwnerId;
    });
    const totalOwnerNetDues = ownerDues.reduce((sum, d) => sum + (d.netOwnerAmount || 0), 0);

    // Already deducted advances (only those deducted from entitlement) and expenses for this owner
    const alreadyDeductedAdvSum = advances
      .filter(a => a.ownerId === targetOwnerId && a.id !== advance.id)
      .reduce((sum, a) => sum + getAdvanceDeductedFromEntitlementAmount(a), 0);

    const alreadyDeductedExpSum = expenses
      .filter(e => e.isDeducted && (e.ownerId === targetOwnerId || properties.find(p => p.id === e.propertyId)?.ownerId === targetOwnerId) && e.id !== advance.id)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalAlreadyDeducted = alreadyDeductedAdvSum + alreadyDeductedExpSum;
    const availableNetEntitlement = Math.max(0, totalOwnerNetDues - totalAlreadyDeducted);

    setAdvanceDeductionModalData({
      advance,
      availableNetEntitlement,
    });
  };

  const handleConfirmAdvanceDeduction = async ({
    deductionMethod,
    settlementAmount,
    deductionDate,
    deductionRef,
    deductionNotes
  }: {
    deductionMethod: string;
    settlementAmount?: number;
    deductionDate: string;
    deductionRef: string;
    deductionNotes: string;
  }) => {
    if (!advanceDeductionModalData?.advance) return;
    const advance = advanceDeductionModalData.advance;
    const targetOwnerId = advance.ownerId;
    const ownerObj = owners.find(o => o.id === targetOwnerId);
    const ownerName = advance.ownerName || ownerObj?.name || 'المالك';
    const nowStr = new Date().toLocaleString('ar-EG');
    const amountToDeduct = settlementAmount && settlementAmount > 0 ? settlementAmount : (advance.amount || 0);

    setIsSubmittingAdvanceDeduction(true);
    try {
      // Build previous deductions list
      const existingDeductions: ReAdvanceDeductionEntry[] = (advance.deductions && advance.deductions.length > 0)
        ? [...advance.deductions]
        : (advance.isDeducted && advance.deductedAmount ? [{
            id: 'ded_' + Date.now() + '_legacy',
            amount: advance.deductedAmount,
            deductionDate: advance.deductedAt || advance.deductionDate || todayISO,
            deductionMethod: advance.deductionMethod || 'خصم من المستحق',
            deductionRef: advance.deductionRef || '',
            deductionNotes: advance.deductionNotes || '',
            deductedBy: advance.deductedBy || currentUser.fullName,
            createdAt: advance.createdAt || new Date().toISOString()
          }] : []);

      // Create new deduction entry
      const newEntry: ReAdvanceDeductionEntry = {
        id: 'ded_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        amount: amountToDeduct,
        deductionDate: deductionDate || todayISO,
        deductionMethod,
        deductionRef: deductionRef || '',
        deductionNotes: deductionNotes || '',
        deductedBy: currentUser.fullName,
        createdAt: new Date().toISOString()
      };

      const updatedDeductions = [...existingDeductions, newEntry];
      const newTotalDeducted = updatedDeductions.reduce((sum, d) => sum + (d.amount || 0), 0);
      const newRemaining = Math.max(0, (advance.amount || 0) - newTotalDeducted);
      const isFullyDeducted = newTotalDeducted >= (advance.amount || 0) && (advance.amount || 0) > 0;

      await updateFirestoreDoc('re_advances', advance.id, {
        isDeducted: isFullyDeducted,
        deductedAt: deductionDate || nowStr,
        deductedBy: currentUser.fullName,
        deductedAmount: newTotalDeducted,
        remainingAmount: newRemaining,
        deductions: updatedDeductions,
        deductionMethod,
        deductionDate: deductionDate || todayISO,
        deductionRef: deductionRef || '',
        deductionNotes: deductionNotes || ''
      });

      const isFromEntitlement = deductionMethod === 'خصم من المستحق' || deductionMethod === 'من المستحق للمالك' || deductionMethod === 'from_entitlement';
      const actionDesc = isFromEntitlement
        ? `تم خصم مبلغ ${amountToDeduct} ج.م من سلفة المالك (${ownerName}) [المتبقي: ${newRemaining} ج.م من إجمالي ${advance.amount} ج.م] من مستحقات المالك للعقار (${advance.propertyName || 'عقار'})`
        : `تم سداد مبلغ ${amountToDeduct} ج.م من سلفة المالك (${ownerName}) [المتبقي: ${newRemaining} ج.م من إجمالي ${advance.amount} ج.م] بطريقة (${deductionMethod})${deductionRef ? ` برقم إيصال/مرجع #${deductionRef}` : ''}`;

      await addFirestoreDoc('re_logs', {
        actionType: 'payout',
        entityName: 'سلفة مالك',
        details: actionDesc,
        username: currentUser.fullName,
        timestamp: nowStr
      });

      setAdvanceDeductionModalData(null);
    } catch (err) {
      console.error('Error deducting advance:', err);
      alert('حدث خطأ أثناء خصم وتسوية السلفة');
    } finally {
      setIsSubmittingAdvanceDeduction(false);
    }
  };

  const handleRevertAdvanceDeduction = async (advance: ReOwnerAdvance, deductionEntryId?: string) => {
    const nowStr = new Date().toLocaleString('ar-EG');
    try {
      if (deductionEntryId && advance.deductions && advance.deductions.length > 0) {
        const targetEntry = advance.deductions.find(d => d.id === deductionEntryId);
        const updatedDeductions = advance.deductions.filter(d => d.id !== deductionEntryId);
        const newTotalDeducted = updatedDeductions.reduce((sum, d) => sum + (d.amount || 0), 0);
        const newRemaining = Math.max(0, (advance.amount || 0) - newTotalDeducted);
        const isDeducted = newTotalDeducted >= (advance.amount || 0) && newTotalDeducted > 0;

        await updateFirestoreDoc('re_advances', advance.id, {
          isDeducted,
          deductedAmount: newTotalDeducted,
          remainingAmount: newRemaining,
          deductions: updatedDeductions,
          unDeductedAt: nowStr,
          unDeductedBy: currentUser.fullName,
        });

        await addFirestoreDoc('re_logs', {
          actionType: 'edit',
          entityName: 'سلفة مالك',
          details: `تم إلغاء حركة خصم بقيمة ${targetEntry?.amount || 0} ج.م من سلفة المالك (${advance.ownerName || 'مالك'}) [المتبقي بعد الإلغاء: ${newRemaining} ج.م]`,
          username: currentUser.fullName,
          timestamp: nowStr
        });
      } else {
        await updateFirestoreDoc('re_advances', advance.id, {
          isDeducted: false,
          unDeductedAt: nowStr,
          unDeductedBy: currentUser.fullName,
          deductionMethod: null,
          deductionDate: null,
          deductionRef: null,
          deductionNotes: null,
          deductedAmount: 0,
          remainingAmount: advance.amount || 0,
          deductions: [],
          deductedAt: null,
          deductedBy: null
        });

        await addFirestoreDoc('re_logs', {
          actionType: 'edit',
          entityName: 'سلفة مالك',
          details: `تم إلغاء كافة خصومات سلفة المالك (${advance.ownerName || 'مالك'}) بقيمة ${advance.amount} ج.م وإعادة السلفة جارية بالكامل`,
          username: currentUser.fullName,
          timestamp: nowStr
        });
      }

      if (advanceDeductionModalData?.advance?.id === advance.id) {
        setAdvanceDeductionModalData(null);
      }
    } catch (err) {
      console.error('Error reverting advance deduction:', err);
      alert('حدث خطأ أثناء الرجوع عن خصم السلفة');
    }
  };

  // Expense Actions
  const handleSaveNewExpense = async () => {
    if (!expensePropertyId || !expenseAmount || Number(expenseAmount) <= 0) {
      alert('يرجى اختيار العقار وإدخال مبلغ المصروف بشكل صحيح');
      return;
    }
    setIsSavingExpense(true);
    try {
      const propObj = properties.find(p => p.id === expensePropertyId);
      const resolvedOwnerId = expenseOwnerId || propObj?.ownerId || '';
      const ownerObj = owners.find(o => o.id === resolvedOwnerId);

      const newExpense: Omit<RePropertyExpense, 'id'> = {
        propertyId: expensePropertyId,
        propertyName: propObj?.name || '',
        ownerId: resolvedOwnerId,
        ownerName: ownerObj?.name || '',
        category: expenseCategory,
        amount: Number(expenseAmount),
        expenseDate,
        description: expenseDescription || 'مصروف عقار',
        attachmentUrl: expenseAttachmentUrl || '',
        attachmentName: expenseAttachmentName || '',
        recordedBy: currentUser.fullName,
        isDeducted: false,
        createdAt: new Date().toISOString()
      };

      await addFirestoreDoc('re_expenses', newExpense);

      await addFirestoreDoc('re_logs', {
        actionType: 'add',
        entityName: 'مصروف عقار',
        details: `تسجيل مصروف عقار جديد بقيمة ${expenseAmount} ج.م (${expenseCategory}) للعقار (${propObj?.name || 'عقار'})`,
        username: currentUser.fullName,
        timestamp: new Date().toLocaleString('ar-EG')
      });

      setIsAddExpenseModalOpen(false);
      setExpensePropertyId('');
      setExpenseOwnerId('');
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseAttachmentUrl('');
      setExpenseAttachmentName('');
    } catch (err) {
      console.error('Error saving expense:', err);
      alert('حدث خطأ أثناء حفظ المصروف');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeductExpense = async (expense: RePropertyExpense) => {
    if (expense.isDeducted) {
      alert('⚠️ هذا المصروف مخصوم بالفعل من كشف حساب المالك!');
      return;
    }

    const propObj = properties.find(p => p.id === expense.propertyId);
    const targetOwnerId = expense.ownerId || propObj?.ownerId || '';
    const ownerObj = owners.find(o => o.id === targetOwnerId);
    const ownerName = expense.ownerName || ownerObj?.name || 'المالك';

    // Calculate total net dues for this owner
    const ownerDues = validDues.filter(d => {
      const pOwnerId = properties.find(p => p.id === d.propertyId)?.ownerId;
      return d.ownerId === targetOwnerId || pOwnerId === targetOwnerId;
    });
    const totalOwnerNetDues = ownerDues.reduce((sum, d) => sum + (d.netOwnerAmount || 0), 0);

    // Already deducted advances and expenses for this owner
    const alreadyDeductedAdvSum = advances
      .filter(a => a.isDeducted && a.ownerId === targetOwnerId && a.id !== expense.id)
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const alreadyDeductedExpSum = expenses
      .filter(e => e.isDeducted && (e.ownerId === targetOwnerId || properties.find(p => p.id === e.propertyId)?.ownerId === targetOwnerId) && e.id !== expense.id)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalAlreadyDeducted = alreadyDeductedAdvSum + alreadyDeductedExpSum;
    const availableNetEntitlement = totalOwnerNetDues - totalAlreadyDeducted;

    // Check if owner has sufficient balance
    if (expense.amount > availableNetEntitlement) {
      alert(
        `⚠️ عفواً، لا يمكن تنفيذ الخصم!\n\n` +
        `لا توجد مستحقات كافية للمالك (${ownerName}) لإجراء الخصم.\n\n` +
        `• إجمالي مستحقات الإيجار المتاحة للمالك: ${Math.max(0, availableNetEntitlement).toLocaleString('ar-EG')} ج.م\n` +
        `• قيمة المصروف المطلوب خصمه: ${expense.amount.toLocaleString('ar-EG')} ج.م\n\n` +
        `يرجى التأكد من توفر مستحقات إيجارية كافية للمالك في النظام أولاً قبل إجراء الخصم.`
      );
      return;
    }

    const remainingAfterDeduction = availableNetEntitlement - expense.amount;
    if (!confirm(`هل أنت تأكد من خصم المصروف بقيمة ${expense.amount.toLocaleString('ar-EG')} ج.م من مستحقات المالك (${ownerName})؟\n\nالمستحقات المتاحة للمالك حالياً: ${availableNetEntitlement.toLocaleString('ar-EG')} ج.م\nالمستحقات المتبقية بعد الخصم: ${remainingAfterDeduction.toLocaleString('ar-EG')} ج.م`)) return;

    const nowStr = new Date().toLocaleString('ar-EG');
    try {
      await updateFirestoreDoc('re_expenses', expense.id, {
        isDeducted: true,
        deductedAt: nowStr,
        deductedBy: currentUser.fullName,
        deductedAmount: expense.amount
      });

      await addFirestoreDoc('re_logs', {
        actionType: 'payout',
        entityName: 'مصروف عقار',
        details: `تم خصم مصروف عقار بقيمة ${expense.amount} ج.م (${expense.category}) للعقار (${expense.propertyName || 'عقار'}) من مستحقات المالك (${ownerName}) عند التسوية المالية (المستحقات المتبقية: ${remainingAfterDeduction} ج.م)`,
        username: currentUser.fullName,
        timestamp: nowStr
      });
    } catch (err) {
      console.error('Error deducting expense:', err);
      alert('حدث خطأ أثناء خصم المصروف');
    }
  };

  const handleRevertExpenseDeduction = async (expense: RePropertyExpense) => {
    if (!confirm(`هل أنت تأكد من إلغاء خصم هذا المصروف وإعادته إلى قائمة المصروفات المعلقة؟`)) return;
    const nowStr = new Date().toLocaleString('ar-EG');
    try {
      await updateFirestoreDoc('re_expenses', expense.id, {
        isDeducted: false,
        unDeductedAt: nowStr,
        unDeductedBy: currentUser.fullName
      });

      await addFirestoreDoc('re_logs', {
        actionType: 'edit',
        entityName: 'مصروف عقار',
        details: `تم إلغاء خصم مصروف عقار بقيمة ${expense.amount} ج.م (${expense.category}) للعقار (${expense.propertyName || 'عقار'})`,
        username: currentUser.fullName,
        timestamp: nowStr
      });
    } catch (err) {
      console.error('Error reverting expense deduction:', err);
    }
  };

  const handlePrintAdvancesList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filtered = advances.filter(a => {
      const ownerName = a.ownerName || owners.find(o => o.id === a.ownerId)?.name || '';
      const propName = a.propertyName || properties.find(p => p.id === a.propertyId)?.name || '';
      const matchSearch = !advancesSearchQuery || 
        ownerName.includes(advancesSearchQuery) || 
        propName.includes(advancesSearchQuery) || 
        (a.notes || '').includes(advancesSearchQuery);
      const matchOwner = advancesOwnerFilter === 'all' || a.ownerId === advancesOwnerFilter;
      const matchProp = advancesPropertyFilter === 'all' || a.propertyId === advancesPropertyFilter;
      const matchStatus = advancesStatusFilter === 'all' || 
        (advancesStatusFilter === 'deducted' && a.isDeducted) || 
        (advancesStatusFilter === 'pending' && !a.isDeducted);
      return matchSearch && matchOwner && matchProp && matchStatus;
    });

    const rowsHTML = filtered.map((a, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${a.ownerName || owners.find(o => o.id === a.ownerId)?.name || '-'}</td>
        <td>${a.propertyName || properties.find(p => p.id === a.propertyId)?.name || '-'}</td>
        <td>${a.advanceDate}</td>
        <td style="font-weight: bold; color: #b38734;">${a.amount.toLocaleString('ar-EG')} ج.م</td>
        <td>${a.paymentMethod || 'نقدي'}</td>
        <td>${a.notes || '-'}</td>
        <td style="text-align: center;">${a.isDeducted ? 'مخصومة 🟢' : 'غير مخصومة 🟠'}</td>
        <td>${a.deductedAt ? `${a.deductedAt} (${a.deductedBy || ''})` : '-'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير سُلف الملاك</title>
          <style>
            body { font-family: sans-serif; padding: 20px; direction: rtl; background: #fff; color: #111; }
            h2 { text-align: center; margin-bottom: 5px; color: #1e293b; }
            p.subtitle { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .footer { margin-top: 30px; text-align: left; font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <h2>مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
          <p class="subtitle">سجل سُلف الملاك والتسويات الماليّة — تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم المالك</th>
                <th>العقار المرتبط</th>
                <th>تاريخ السلفة</th>
                <th>المبلغ</th>
                <th>طريقة السداد</th>
                <th>البيان</th>
                <th>حالة الخصم</th>
                <th>تاريخ الخصم</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="9" style="text-align:center;">لا توجد بيانات مطابقة</td></tr>'}
            </tbody>
          </table>
          <div class="footer">تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} — توقيع المحاسب المالي</div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintExpensesList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filtered = expenses.filter(e => {
      const ownerName = e.ownerName || owners.find(o => o.id === e.ownerId)?.name || '';
      const propName = e.propertyName || properties.find(p => p.id === e.propertyId)?.name || '';
      const matchSearch = !advancesSearchQuery || 
        ownerName.includes(advancesSearchQuery) || 
        propName.includes(advancesSearchQuery) || 
        (e.description || '').includes(advancesSearchQuery) ||
        (e.category || '').includes(advancesSearchQuery);
      const matchOwner = advancesOwnerFilter === 'all' || e.ownerId === advancesOwnerFilter;
      const matchProp = advancesPropertyFilter === 'all' || e.propertyId === advancesPropertyFilter;
      const matchStatus = advancesStatusFilter === 'all' || 
        (advancesStatusFilter === 'deducted' && e.isDeducted) || 
        (advancesStatusFilter === 'pending' && !e.isDeducted);
      return matchSearch && matchOwner && matchProp && matchStatus;
    });

    const rowsHTML = filtered.map((e, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${e.propertyName || properties.find(p => p.id === e.propertyId)?.name || '-'}</td>
        <td>${e.ownerName || owners.find(o => o.id === e.ownerId)?.name || '-'}</td>
        <td>${e.category}</td>
        <td>${e.expenseDate}</td>
        <td style="font-weight: bold; color: #b38734;">${e.amount.toLocaleString('ar-EG')} ج.م</td>
        <td>${e.description || '-'}</td>
        <td style="text-align: center;">${e.isDeducted ? 'مخصوم 🟢' : 'غير مخصوم 🟠'}</td>
        <td>${e.deductedAt ? `${e.deductedAt} (${e.deductedBy || ''})` : '-'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير مصروفات العقارات</title>
          <style>
            body { font-family: sans-serif; padding: 20px; direction: rtl; background: #fff; color: #111; }
            h2 { text-align: center; margin-bottom: 5px; color: #1e293b; }
            p.subtitle { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .footer { margin-top: 30px; text-align: left; font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <h2>مؤسسة رميح للمحاماة والاستشارات القانونية</h2>
          <p class="subtitle">سجل مصروفات العقارات الصيانة والخدمات — تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>العقار</th>
                <th>اسم المالك</th>
                <th>نوع المصروف</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>البيان</th>
                <th>حالة الخصم</th>
                <th>تاريخ الخصم</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML || '<tr><td colspan="9" style="text-align:center;">لا توجد بيانات مطابقة</td></tr>'}
            </tbody>
          </table>
          <div class="footer">تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} — توقيع المحاسب المالي</div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleOpenEditRentModal = (due: ReRentDue) => {
    setEditingRentDue(due);
    setNewRentAmount(due.rentAmount || 0);
    setUpdateTenantContractRent(false);
  };

  const handleSaveRentEdit = async () => {
    if (!editingRentDue) return;
    setIsSavingRentEdit(true);
    try {
      const rentVal = Number(newRentAmount) || 0;
      const targetMonthYear = editingRentDue.forMonthYear;
      const targetTenantId = editingRentDue.tenantId;

      // Recalculate commission and owner net independently for this specific month/due
      const propObj = properties.find(p => p.id === editingRentDue.propertyId);
      const ownerObj = owners.find(o => o.id === (editingRentDue.ownerId || propObj?.ownerId));
      const commSettings = getPropertyCommissionSettings(propObj, ownerObj, dues);

      let commAmt = 0;
      if (commSettings.commissionType === 'percentage') {
        commAmt = Math.round((rentVal * (commSettings.commissionValue || 0)) / 100);
      } else if (commSettings.commissionType === 'fixed_per_thousand') {
        commAmt = Math.floor(rentVal / 1000) * (commSettings.commissionValue || 0);
      } else if (commSettings.commissionType === 'fixed_flat') {
        commAmt = commSettings.commissionValue || 0;
      }
      const netOwner = Math.max(0, rentVal - commAmt);

      // Determine deterministic document ID for this specific tenant + month/year
      const matchedExistingDue = dues.find(d => 
        (editingRentDue.id && d.id === editingRentDue.id) || 
        (d.tenantId === targetTenantId && d.forMonthYear === targetMonthYear)
      );
      const dueDocId = editingRentDue.id || matchedExistingDue?.id || `due-${targetTenantId}-${targetMonthYear}`;

      const nowISO = new Date().toISOString();

      // 1. Save persistent adjustment record in re_rent_adjustments
      const adjDocId = `adj_${targetTenantId}_${targetMonthYear}`;
      const adjustmentRecord: ReRentAdjustment = {
        id: adjDocId,
        tenantId: targetTenantId,
        tenantName: editingRentDue.tenantName,
        unitId: editingRentDue.unitId,
        propertyId: editingRentDue.propertyId,
        forMonthYear: targetMonthYear,
        adjustedRentAmount: rentVal,
        originalRentAmount: editingRentDue.rentAmount,
        commissionType: commSettings.commissionType,
        commissionValue: commSettings.commissionValue,
        commissionAmount: commAmt,
        netOwnerAmount: netOwner,
        updatedAt: nowISO
      };
      await updateFirestoreDoc('re_rent_adjustments', adjDocId, adjustmentRecord);

      // 2. Update the specific due document in re_dues
      const dueDataToSave: ReRentDue = {
        ...editingRentDue,
        id: dueDocId,
        rentAmount: rentVal,
        isAdjusted: true,
        adjustedRentAmount: rentVal,
        commissionType: commSettings.commissionType,
        commissionValue: commSettings.commissionValue,
        commissionAmount: commAmt,
        netOwnerAmount: netOwner,
        updatedAt: nowISO
      };

      await updateFirestoreDoc('re_dues', dueDocId, dueDataToSave);

      // 3. Update contract rent on tenant if requested
      if (updateTenantContractRent && targetTenantId) {
        await updateFirestoreDoc('re_tenants', targetTenantId, {
          rentAmount: rentVal,
          updatedAt: nowISO
        });
      }

      alert(`✅ تم تعديل وحفظ إيجار شهر (${editingRentDue.monthNameAr || targetMonthYear}) للمستأجر بنجاح إلى ${rentVal.toLocaleString('ar-EG')} ج.م.\nتم تثبيت التعديل في قاعدة البيانات السحابية كمصدر وحيد ومستمر.`);

      if (arrearsModalData) {
        setArrearsModalData(prev => prev ? {
          ...prev,
          uncollectedDues: prev.uncollectedDues.map(d =>
            (d.id === dueDocId || (d.tenantId === targetTenantId && d.forMonthYear === targetMonthYear))
              ? { ...d, rentAmount: rentVal, commissionAmount: commAmt, netOwnerAmount: netOwner }
              : d
          )
        } : null);
      }
      setEditingRentDue(null);
    } catch (err) {
      console.error('Error updating rent amount:', err);
      alert('❌ حدث خطأ أثناء تعديل القيمة الإيجارية');
    } finally {
      setIsSavingRentEdit(false);
    }
  };

  // Add future month to tenant reserve payment list
  const handleAddFutureReserveMonth = async () => {
    if (!arrearsModalData) return;
    const uncollectedOnly = arrearsModalData.uncollectedDues.filter(d => {
      const st = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
      return st !== 'collected' && st !== 'prepaid';
    });
    const arrearsCount = uncollectedOnly.filter(d => !d.forMonthYear || d.forMonthYear <= currentMonthISO).length;
    if (arrearsCount > 0) {
      alert('⚠️ يجب سداد جميع المتأخرات أولًا قبل إجراء الدفع المسبق.');
      return;
    }
    const tenant = arrearsModalData.tenant;

    let lastMonthStr = currentMonthISO;
    if (arrearsModalData.uncollectedDues.length > 0) {
      const sorted = [...arrearsModalData.uncollectedDues].sort((a,b) => b.forMonthYear.localeCompare(a.forMonthYear));
      if (sorted[0].forMonthYear >= lastMonthStr) {
        lastMonthStr = sorted[0].forMonthYear;
      }
    }
    const [yStr, mStr] = lastMonthStr.split('-');
    let y = parseInt(yStr);
    let m = parseInt(mStr) + 1;
    if (m > 12) { m = 1; y += 1; }
    const nextMonthISO = `${y}-${String(m).padStart(2, '0')}`;

    const uObj = arrearsModalData.unitObj;
    const pObj = arrearsModalData.propObj;
    const oObj = arrearsModalData.ownerObj;

    const newDue: Omit<ReRentDue, 'id'> = {
      tenantId: tenant.id,
      tenantName: tenant.fullName,
      propertyId: pObj?.id || tenant.propertyId || '',
      propertyName: pObj?.name || 'عقار',
      unitId: uObj?.id || tenant.unitId || '',
      unitNumber: uObj?.unitNumber || '',
      ownerId: oObj?.id || pObj?.ownerId || '',
      ownerName: oObj?.name || '',
      forMonthYear: nextMonthISO,
      dueDate: `${nextMonthISO}-01`,
      rentAmount: tenant.rentAmount || uObj?.rentValue || 0,
      collectedAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      commissionAmount: 0,
      netOwnerAmount: tenant.rentAmount || uObj?.rentValue || 0,
      status: 'pending',
      collectionStatus: 'pending_collection',
      payoutStatus: 'pending_payout',
      monthClosingStatus: 'open',
      monthNameAr: formatMonthYearAr(nextMonthISO),
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addFirestoreDoc('re_dues', newDue);
      const createdDue: ReRentDue = { ...newDue, id: docRef.id };

      setArrearsModalData({
        ...arrearsModalData,
        uncollectedDues: [...arrearsModalData.uncollectedDues, createdDue]
      });
      setSelectedDueIdsForBatch(prev => [...prev, createdDue.id]);
      alert(`✅ تم إضافة شهر (${formatMonthYearAr(nextMonthISO)}) لقائمة السداد الاحتياطي للمستأجر!`);
    } catch (err) {
      console.error('Error adding future reserve due:', err);
      alert('❌ حدث خطأ أثناء إضافة الشهر الاحتياطي');
    }
  };

  // Report Specific Selector
  const [reportType, setReportType] = useState<
    'property_monthly' | 'owner_statement' | 'tenant_statement' | 'owner_payouts' | 'tenant_collections' | 'arrears' | 'office_commissions' | 'office_advances'
  >('property_monthly');

  // Payouts sub-tab state
  const [payoutSubTab, setPayoutSubTab] = useState<'urgent' | 'post_collection' | 'property_calculation'>('urgent');

  // FINANCIAL DASHBOARD METRICS
  const metrics = useMemo(() => {
    let totalDueRents = 0;
    let totalCollectedRents = 0;
    let totalDisbursedToOwners = 0;
    let totalOfficeCommission = 0;
    let totalOfficeAdvances = 0; // Paid to owners but NOT yet collected from tenants
    let totalOverdueRents = 0;
    let overdueCount = 0;

    validDues.forEach(due => {
      const pStatus = getDuePayoutStatus(due);
      const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);
      const isCollected = cStatus === 'collected' || cStatus === 'prepaid';

      // Exclude uncollected future reserve months from Overview metrics unless actually collected
      const isFutureUncollected = due.forMonthYear && due.forMonthYear > currentMonthISO && !isCollected;
      if (isFutureUncollected) return;

      totalDueRents += due.rentAmount;

      if (isCollected) {
        const collected = due.collectedAmount || due.rentAmount;
        totalCollectedRents += collected;
        totalOfficeCommission += getDueCommissionAmount(due, owners, properties);
      }

      if (pStatus === 'paid_out') {
        const comm = getDueCommissionAmount(due, owners, properties);
        const netOwner = Math.max(0, (due.rentAmount || 0) - comm);
        const disbursedVal = due.netOwnerAmount || netOwner;
        totalDisbursedToOwners += disbursedVal;
        // Office Advance: office paid owner, but tenant has NOT paid yet!
        if (!isCollected) {
          totalOfficeAdvances += disbursedVal;
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
  }, [validDues, todayISO, currentMonthISO, collections, owners, properties]);

  // PROPERTY BALANCES SUMMARY
  const propertyBalances = useMemo(() => {
    return properties.map(prop => {
      const propDues = validDues.filter(d => d.propertyId === prop.id);
      const owner = owners.find(o => o.id === prop.ownerId);

      let dueSum = 0;
      let collectedSum = 0;
      let disbursedSum = 0;
      let commissionSum = 0;
      let officeAdvanceSum = 0;

      propDues.forEach(d => {
        const pStatus = getDuePayoutStatus(d);
        const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
        const isCollected = cStatus === 'collected' || cStatus === 'prepaid';

        // Exclude uncollected future reserve months from property balance sums unless collected
        const isFutureUncollected = d.forMonthYear && d.forMonthYear > currentMonthISO && !isCollected;
        if (isFutureUncollected) return;

        dueSum += d.rentAmount;

        const comm = getDueCommissionAmount(d, owners, properties);
        const netOwner = Math.max(0, (d.rentAmount || 0) - comm);

        if (isCollected) {
          collectedSum += d.collectedAmount || d.rentAmount;
          commissionSum += comm;
        }
        if (pStatus === 'paid_out') {
          const disbursedVal = d.netOwnerAmount || netOwner;
          disbursedSum += disbursedVal;
          if (!isCollected) {
            officeAdvanceSum += disbursedVal;
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
  }, [properties, validDues, owners, todayISO, currentMonthISO, collections]);

  // OWNER BALANCES SUMMARY
  const ownerBalances = useMemo(() => {
    const registeredPropIds = new Set((properties || []).map(p => p.id).filter(Boolean));
    return owners.map(owner => {
      const ownerDues = validDues.filter(d => 
        d.ownerId === owner.id && d.propertyId && registeredPropIds.has(d.propertyId)
      );

      let totalOwnerDueRent = 0;
      let totalOwnerCollected = 0;
      let totalOwnerDisbursed = 0;
      let totalPendingPayout = 0;
      let totalOfficeAdvanceGiven = 0;

      ownerDues.forEach(d => {
        const pStatus = getDuePayoutStatus(d);
        const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
        const isCollected = cStatus === 'collected' || cStatus === 'prepaid';

        // Exclude uncollected future reserve months from owner balance sums unless collected
        const isFutureUncollected = d.forMonthYear && d.forMonthYear > currentMonthISO && !isCollected;
        if (isFutureUncollected) return;

        totalOwnerDueRent += d.rentAmount;

        if (isCollected) {
          totalOwnerCollected += d.collectedAmount || d.rentAmount;
          if (pStatus !== 'paid_out') {
            totalPendingPayout += d.netOwnerAmount;
          }
        }
        if (pStatus === 'paid_out') {
          totalOwnerDisbursed += d.netOwnerAmount;
          if (!isCollected) {
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
  }, [owners, properties, validDues, todayISO, currentMonthISO, collections]);

  // FILTERED DUES FOR MAIN TABLE
  const filteredDues = useMemo(() => {
    return validDues.filter(due => {
      const pStatus = getDuePayoutStatus(due);
      const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);

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
        else if (statusFilter === 'collected') matchesStatus = cStatus === 'collected' || cStatus === 'prepaid';
        else if (statusFilter === 'overdue') matchesStatus = cStatus === 'overdue';
        else if (statusFilter === 'advance_paid') matchesStatus = (pStatus === 'paid_out' && cStatus !== 'collected' && cStatus !== 'prepaid');
      }

      return matchesMonth && matchesSearch && matchesOwner && matchesProperty && matchesStatus;
    });
  }, [validDues, selectedMonthYear, searchQuery, selectedOwnerId, selectedPropertyId, statusFilter, todayISO, currentMonthISO, collections]);

  // Modal State for Official Report Preview & Printing
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [modalReportType, setModalReportType] = useState<ReportType>('property_monthly');

  // Modal State for Tenant Collection Receipts (سندات التحصيل الخاصة بالمستأجر)
  const [tenantReceiptsModalTenant, setTenantReceiptsModalTenant] = useState<ReTenant | null>(null);
  const [selectedReceiptForPreview, setSelectedReceiptForPreview] = useState<ReCollectionReceipt | null>(null);

  useBackHandler(!!editingRentDue, () => setEditingRentDue(null));
  useBackHandler(!!arrearsModalData, () => setArrearsModalData(null));
  useBackHandler(!!tenantReceiptsModalTenant, () => {
    if (selectedReceiptForPreview) {
      setSelectedReceiptForPreview(null);
    } else {
      setTenantReceiptsModalTenant(null);
    }
  });
  useBackHandler(isAddAdvanceModalOpen, () => setIsAddAdvanceModalOpen(false));
  useBackHandler(isAddExpenseModalOpen, () => setIsAddExpenseModalOpen(false));
  useBackHandler(isReportModalOpen, () => setIsReportModalOpen(false));
  useBackHandler(!!propertyTenantsModalGroup, () => setPropertyTenantsModalGroup(null));
  useBackHandler(!!ownerPayoutModalGroup, () => setOwnerPayoutModalGroup(null));
  useBackHandler(currentTab === 'tenant_statements' && selectedTenantId !== 'all', () => setSelectedTenantId('all'));

  const formatMonthYearAr = (myStr: string) => {
    if (!myStr) return '';
    if (myStr === 'all' || myStr.includes('all')) return 'جميع الشهور';
    if (!myStr.includes('-')) return myStr;
    const [y, m] = myStr.split('-');
    const months: Record<string, string> = {
      '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
      '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
      '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    };
    return `${months[m] || m} ${y}`;
  };

  const handleOpenReportPreview = (type?: ReportType) => {
    if (type) setModalReportType(type);
    else setModalReportType(reportType);
    setIsReportModalOpen(true);
  };

  const handlePrintReportDirectly = (type?: ReportType) => {
    const activeType = type || reportType;
    const html = generateRealEstateReportHTML({
      reportType: activeType,
      dues: validDues,
      collections,
      owners,
      properties,
      units,
      tenants,
      advances,
      expenses,
      commissionStatuses,
      rentAdjustments,
      selectedPropertyId: activeType === 'office_commissions' ? commSelectedPropertyId : selectedPropertyId,
      selectedOwnerId: activeType === 'office_commissions' ? commSelectedOwnerId : selectedOwnerId,
      selectedTenantId: activeType === 'office_commissions' ? commSelectedTenantId : selectedTenantId,
      selectedMonthYear: activeType === 'office_commissions' ? commSelectedMonthYear : selectedMonthYear,
      ownerPayoutType: ownerPayoutTypeFilter,
      tenantFromMonth,
      tenantToMonth,
      ownerStatementsFilter,
      ownerAccountType,
      accountType: commAccountType,
      commissionsFilter,
      commSearchTerm,
      commStatements: filteredCommStatements,
      currentUser
    });
    printReportDirectly(html);
  };

  return (
    <div className="space-y-6 text-[#F8F9FB]" dir="rtl">
      
      {/* 1. KEY FINANCIAL KPI DASHBOARD HEADER (6 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        
        {/* KPI 1: Total Due Rents */}
        <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-[#D4A84F]/30 shadow-xl relative overflow-hidden group hover:border-[#D4A84F]/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-200 font-extrabold">إجمالي الإيجارات المستحقة</span>
            <div className="p-2.5 rounded-xl bg-[#D4A84F]/15 border border-[#D4A84F]/30 text-[#D4A84F] shadow-sm">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#F8F9FB] font-mono tracking-tight mt-1">
            {metrics.totalDueRents.toLocaleString('ar-EG')} <span className="text-xs text-[#D4A84F] font-sans font-black">ج.م</span>
          </p>
          <span className="text-[10px] text-slate-300 block mt-1.5 font-bold">إجمالي استحقاقات العقود</span>
        </div>

        {/* KPI 2: Total Collected Rents */}
        <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-emerald-500/35 shadow-xl relative overflow-hidden group hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-200 font-extrabold">الإيجارات المحصلة</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <CheckCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight mt-1">
            {metrics.totalCollectedRents.toLocaleString('ar-EG')} <span className="text-xs text-emerald-300 font-sans font-black">ج.م</span>
          </p>
          <span className="text-[10px] text-emerald-300/90 block mt-1.5 font-bold">سندات القبض المودعة</span>
        </div>

        {/* KPI 3: Total Disbursed to Owners */}
        <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-sky-500/35 shadow-xl relative overflow-hidden group hover:border-sky-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-200 font-extrabold">المصروف للملاك</span>
            <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 shadow-sm">
              <Landmark className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-sky-400 font-mono tracking-tight mt-1">
            {metrics.totalDisbursedToOwners.toLocaleString('ar-EG')} <span className="text-xs text-sky-300 font-sans font-black">ج.م</span>
          </p>
          <span className="text-[10px] text-sky-300/90 block mt-1.5 font-bold">إجمالي المستحقات المسلمة</span>
        </div>

        {/* KPI 4: Total Office Commission */}
        <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-amber-500/35 shadow-xl relative overflow-hidden group hover:border-amber-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-200 font-extrabold">عمولات المكتب</span>
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight mt-1">
            {metrics.totalOfficeCommission.toLocaleString('ar-EG')} <span className="text-xs text-amber-300 font-sans font-black">ج.م</span>
          </p>
          <span className="text-[10px] text-amber-300/90 block mt-1.5 font-bold">إجمالي إيراد الإدارة العقارية</span>
        </div>

        {/* KPI 5: Office Advance Balance (Paid to owners, uncollected from tenants) */}
        <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-purple-500/35 shadow-xl relative overflow-hidden group hover:border-purple-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-200 font-extrabold">سُلف المكتب للملاك</span>
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 shadow-sm">
              <Wallet className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-purple-300 font-mono tracking-tight mt-1">
            {metrics.totalOfficeAdvances.toLocaleString('ar-EG')} <span className="text-xs text-purple-200 font-sans font-black">ج.م</span>
          </p>
          <span className="text-[10px] text-purple-300 block mt-1.5 font-extrabold">مدفوعة للمالك وقيد التحصيل</span>
        </div>

        {/* KPI 6: Overdue Rent */}
        <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-rose-500/35 shadow-xl relative overflow-hidden group hover:border-rose-500/60 transition-all">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-slate-200 font-extrabold">إيجارات متأخرة</span>
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-sm">
              <AlertCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-400 font-mono tracking-tight mt-1">
            {metrics.totalOverdueRents.toLocaleString('ar-EG')} <span className="text-xs text-rose-300 font-sans font-black">ج.م</span>
          </p>
          <span className="text-[10px] text-rose-300 block mt-1.5 font-extrabold">{metrics.overdueCount} مستأجر متأخر في السداد</span>
        </div>

      </div>

      {/* 2. SUB-NAVIGATION BAR FOR FINANCIAL TOOLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/25 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {[
            { id: 'rent_collections', label: 'الإيجارات والتحصيل', icon: Coins },
            { id: 'advances_expenses', label: 'السلف ومصروفات العقار', icon: Landmark },
            { id: 'owner_statements', label: 'كشف حساب الملاك', icon: Users },
            { id: 'tenant_statements', label: 'كشف حساب المستأجرين', icon: FileText },
            { id: 'property_statements', label: 'كشف حساب العقارات', icon: Building },
            { id: 'commissions', label: 'العمولات', icon: DollarSign }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentTab(tab.id as any);
                onNavigateSubTab(tab.id);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                currentTab === tab.id
                  ? 'bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 shadow-lg shadow-[#D4A84F]/25 ring-1 ring-[#D4A84F]/50 scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4 stroke-[2.2]" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* VIEW: الإيجارات والتحصيل (RENT & COLLECTIONS) */}
      {currentTab === 'rent_collections' && (() => {
        const isAllYears = selectedRentYear === 'all';
        const isAllMonths = selectedRentMonth === 'all';
        // Selected target period: "YYYY-MM" or "all"
        const targetMonthYear = (isAllYears || isAllMonths) ? 'all' : `${selectedRentYear}-${selectedRentMonth}`;
        // Get list of candidate tenants filtered by property, tenant, and search query
        const filteredTenants = tenants.filter(t => {
          // Filter by selectedPropertyId
          if (selectedPropertyId !== 'all') {
            const matchProp = (t.propertyId && t.propertyId === selectedPropertyId) ||
              units.find(u => u.id === t.unitId)?.propertyId === selectedPropertyId;
            if (!matchProp) return false;
          }

          // Filter by selectedTenantId
          if (selectedTenantId !== 'all' && t.id !== selectedTenantId) {
            return false;
          }

          // Search query filter
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const uObj = units.find(u => u.id === t.unitId);
            const pObj = properties.find(p => p.id === t.propertyId || p.id === uObj?.propertyId);
            const oObj = owners.find(o => o.id === pObj?.ownerId);

            const match = (t.fullName || '').toLowerCase().includes(q) ||
              (t.phone || '').includes(q) ||
              (uObj?.unitNumber || '').toLowerCase().includes(q) ||
              (pObj?.name || '').toLowerCase().includes(q) ||
              (oObj?.name || '').toLowerCase().includes(q);
            
            if (!match) return false;
          }

          return true;
        });

        // Map filtered tenants to unique tenant rows
        const tenantRows = filteredTenants.map(tObj => {
          const uObj = units.find(u => u.id === tObj.unitId);
          const pObj = properties.find(p => p.id === tObj.propertyId || p.id === uObj?.propertyId);
          const oObj = owners.find(o => o.id === pObj?.ownerId);

          // All dues for this tenant in validDues
          const allTenantDues = validDues.filter(d => d.tenantId === tObj.id);

          // Filter dues matching selected year & month
          const tenantDues = allTenantDues.filter(d => {
            if (!d.forMonthYear) return false;
            if (!isAllYears && !d.forMonthYear.startsWith(`${selectedRentYear}-`)) return false;
            if (!isAllMonths && !d.forMonthYear.endsWith(`-${selectedRentMonth}`)) return false;
            return true;
          });

          const allUncollectedDues = allTenantDues
            .filter(d => !isDueCollected(d, todayISO, currentMonthISO, collections))
            .sort((a, b) => a.forMonthYear.localeCompare(b.forMonthYear));

          const allCollectedDues = allTenantDues
            .filter(d => isDueCollected(d, todayISO, currentMonthISO, collections))
            .sort((a, b) => a.forMonthYear.localeCompare(b.forMonthYear));

          if (isAllMonths || isAllYears) {
            const currentMonthDue = tenantDues.find(d => d.forMonthYear === currentMonthISO) || tenantDues[0] || allTenantDues[0];
            const pastUncollectedDues = allTenantDues.filter(d => d.forMonthYear < currentMonthISO && !isDueCollected(d, todayISO, currentMonthISO, collections));
            const targetMonthCollected = tenantDues.length > 0 
              ? tenantDues.every(d => isDueCollected(d, todayISO, currentMonthISO, collections))
              : pastUncollectedDues.length === 0;
            const isTargetAdvance = false;

            const totalRequired = tenantDues.length > 0
              ? tenantDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0)
              : (tObj.rentAmount || uObj?.rentValue || 0);

            const totalCollected = tenantDues
              .filter(d => isDueCollected(d, todayISO, currentMonthISO, collections))
              .reduce((sum, d) => sum + (d.collectedAmount || d.rentAmount || 0), 0);

            const totalRemaining = Math.max(0, totalRequired - totalCollected);

            return {
              tenant: tObj,
              unitObj: uObj,
              propObj: pObj,
              ownerObj: oObj,
              currentMonthDue,
              tenantDues,
              allUncollectedDues,
              pastUncollectedDues,
              targetMonthCollected,
              isTargetAdvance,
              rentAmount: totalRequired,
              monthlyContractRent: tObj.rentAmount || uObj?.rentValue || currentMonthDue?.rentAmount || 0,
              totalRequired,
              totalCollected,
              totalRemaining
            };
          } else {
            const currentMonthDue = allTenantDues.find(d => d.forMonthYear === targetMonthYear);

            const pastUncollectedDues = allTenantDues.filter(d => 
              d.forMonthYear < targetMonthYear &&
              !isDueCollected(d, todayISO, currentMonthISO, collections)
            ).sort((a, b) => a.forMonthYear.localeCompare(b.forMonthYear));

            const targetMonthCollected = currentMonthDue ? isDueCollected(currentMonthDue, todayISO, currentMonthISO, collections) : false;
            const isTargetAdvance = currentMonthDue ? currentMonthDue.forMonthYear > currentMonthISO : (targetMonthYear > currentMonthISO);

            const monthRequired = currentMonthDue?.rentAmount || tObj.rentAmount || uObj?.rentValue || 0;
            const monthCollected = (targetMonthCollected && currentMonthDue) ? (currentMonthDue.collectedAmount || currentMonthDue.rentAmount) : 0;
            const monthRemaining = Math.max(0, monthRequired - monthCollected);

            return {
              tenant: tObj,
              unitObj: uObj,
              propObj: pObj,
              ownerObj: oObj,
              currentMonthDue,
              tenantDues,
              allUncollectedDues,
              pastUncollectedDues,
              targetMonthCollected,
              isTargetAdvance,
              rentAmount: monthRequired,
              monthlyContractRent: tObj.rentAmount || uObj?.rentValue || currentMonthDue?.rentAmount || 0,
              totalRequired: monthRequired,
              totalCollected: monthCollected,
              totalRemaining: monthRemaining
            };
          }
        });

        // Filter tenant rows according to rentFilterMode ('uncollected' | 'collected' | 'all')
        const displayedTenantRows = tenantRows.filter(r => {
          if (rentFilterMode === 'collected') return r.targetMonthCollected && r.allUncollectedDues.length === 0;
          if (rentFilterMode === 'uncollected') return !r.targetMonthCollected || r.allUncollectedDues.length > 0;
          return true;
        });

        // TOP SUMMARY CARDS CALCULATIONS (Requirements)
        const totalTenantsCount = displayedTenantRows.length;
        const uncollectedTenantsCount = displayedTenantRows.filter(r => !r.targetMonthCollected || r.allUncollectedDues.length > 0).length;
        const totalRequiredAmount = displayedTenantRows.reduce((sum, r) => sum + r.totalRequired, 0);
        const totalCollectedAmount = displayedTenantRows.reduce((sum, r) => sum + r.totalCollected, 0);
        const totalRemainingAmount = Math.max(0, totalRequiredAmount - totalCollectedAmount);

        const activePropObj = properties.find(p => p.id === selectedPropertyId);
        const activeOwnerObj = activePropObj ? owners.find(o => o.id === activePropObj.ownerId) : null;

        return (
          <div className="space-y-5">
            {/* 1. TOP SUMMARY METRICS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Card 1: عدد المستأجرين */}
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-[#D4A84F]/30 shadow-xl relative overflow-hidden flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-200 font-extrabold block mb-1">عدد المستأجرين</span>
                  <p className="text-2xl font-black text-[#F8F9FB] font-mono tracking-tight">
                    {totalTenantsCount} <span className="text-xs text-[#D4A84F] font-sans font-black">مستأجر</span>
                  </p>
                  <span className="text-[10px] text-slate-300 block mt-1 font-bold">حسب ترشيح الفلتر</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#D4A84F]/15 border border-[#D4A84F]/30 text-[#D4A84F] shadow-sm">
                  <Users className="w-5 h-5 stroke-[2.2]" />
                </div>
              </div>

              {/* Card 2: عدد المتأخرين / غير المحصل */}
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-amber-500/35 shadow-xl relative overflow-hidden flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-200 font-extrabold block mb-1">عدد المتأخرين</span>
                  <p className="text-2xl font-black text-amber-400 font-mono tracking-tight">
                    {uncollectedTenantsCount} <span className="text-xs text-amber-300 font-sans font-black">مستأجر</span>
                  </p>
                  <span className="text-[10px] text-amber-300 block mt-1 font-bold">بانتظار التحصيل للشهر</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                </div>
              </div>

              {/* Card 3: إجمالي المستحق */}
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-sky-500/35 shadow-xl relative overflow-hidden flex items-center justify-between">
                <div>
                  <span className="text-xs text-sky-200 font-extrabold block mb-1">إجمالي المستحق</span>
                  <p className="text-2xl font-black text-sky-400 font-mono tracking-tight">
                    {totalRequiredAmount.toLocaleString('ar-EG')} <span className="text-xs text-sky-300 font-sans font-black">ج.م</span>
                  </p>
                  <span className="text-[10px] text-sky-300 block mt-1 font-bold">قيمة الإيجارات المطلوبة</span>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 shadow-sm">
                  <Wallet className="w-5 h-5 stroke-[2.2]" />
                </div>
              </div>

              {/* Card 4: إجمالي المحصل */}
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-emerald-500/35 shadow-xl relative overflow-hidden flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-200 font-extrabold block mb-1">إجمالي المحصل</span>
                  <p className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                    {totalCollectedAmount.toLocaleString('ar-EG')} <span className="text-xs text-emerald-300 font-sans font-black">ج.م</span>
                  </p>
                  <span className="text-[10px] text-emerald-300 block mt-1 font-bold">المبالغ المحصلة فعلياً</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm">
                  <CheckCircle className="w-5 h-5 stroke-[2.2]" />
                </div>
              </div>

              {/* Card 5: إجمالي المتبقي */}
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md p-4 rounded-2xl border border-rose-500/35 shadow-xl relative overflow-hidden flex items-center justify-between">
                <div>
                  <span className="text-xs text-rose-200 font-extrabold block mb-1">إجمالي المتبقي</span>
                  <p className="text-2xl font-black text-rose-400 font-mono tracking-tight">
                    {totalRemainingAmount.toLocaleString('ar-EG')} <span className="text-xs text-rose-300 font-sans font-black">ج.م</span>
                  </p>
                  <span className="text-[10px] text-rose-300 block mt-1 font-bold">المبلغ المتبقي للتحصيل</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-sm">
                  <AlertCircle className="w-5 h-5 stroke-[2.2]" />
                </div>
              </div>
            </div>

            {/* 2. TOP FILTER HEADER & SELECTORS */}
            <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/25 p-4 space-y-4 shadow-xl relative z-30">
              
              {/* Main Mode Toggle Buttons & Header Title */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#D4A84F]/15">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#D4A84F]/20 to-amber-500/10 border border-[#D4A84F]/30 text-[#D4A84F] shadow-sm">
                    <Receipt className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#F8F9FB]">قسم الإيجارات والتحصيل</h3>
                    <p className="text-xs text-slate-300 font-extrabold">
                      إدارة استحقاقات المستأجرين وتحصيل الإيجارات والمتأخرات {
                        isAllYears && isAllMonths
                          ? 'لكافة السنوات والشهور'
                          : isAllYears
                          ? `لشهر ${selectedRentMonth} (جميع السنوات)`
                          : isAllMonths
                          ? `لسنة ${selectedRentYear} (جميع الشهور)`
                          : `لشهر ${formatMonthYearAr(targetMonthYear)}`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#08111F]/90 p-1.5 rounded-2xl border border-[#D4A84F]/25 shadow-inner">
                  {/* Button 1: لم يتم التحصيل */}
                  <button
                    onClick={() => setRentFilterMode('uncollected')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                      rentFilterMode === 'uncollected'
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 shadow-lg shadow-amber-500/25 ring-1 ring-amber-400/50 scale-[1.02]'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>لم يتم التحصيل</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      rentFilterMode === 'uncollected' ? 'bg-slate-950/30 text-slate-950' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {tenantRows.filter(r => !r.targetMonthCollected).length}
                    </span>
                  </button>

                  {/* Button 2: تم التحصيل */}
                  <button
                    onClick={() => setRentFilterMode('collected')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                      rentFilterMode === 'collected'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/50 scale-[1.02]'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>تم التحصيل</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      rentFilterMode === 'collected' ? 'bg-slate-950/30 text-slate-950' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {tenantRows.filter(r => r.targetMonthCollected).length}
                    </span>
                  </button>

                  {/* Button 3: الكل */}
                  <button
                    onClick={() => setRentFilterMode('all')}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                      rentFilterMode === 'all'
                        ? 'bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 shadow-md ring-1 ring-[#D4A84F]/50'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    عرض الكل ({tenantRows.length})
                  </button>
                </div>
              </div>

              {/* UNIFIED SELECTORS: Year, Month, Property, Tenant, Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                
                {/* 1. Year Selector (السنة - الافتراضي السنة الحالية) */}
                <div>
                  <label className="text-xs text-[#D4A84F] block mb-1 font-black flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#D4A84F]" />
                    اختر السنة:
                  </label>
                  <select
                    value={selectedRentYear}
                    onChange={e => setSelectedRentYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/40 text-xs sm:text-sm text-[#F8F9FB] font-extrabold focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none shadow-sm"
                  >
                    <option value="all">جميع السنوات</option>
                    {availableRentYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Month Selector (الشهر - الافتراضي الشهر الحالي) */}
                <div>
                  <label className="text-xs text-[#D4A84F] block mb-1 font-black flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#D4A84F]" />
                    اختر الشهر:
                  </label>
                  <select
                    value={selectedRentMonth}
                    onChange={e => setSelectedRentMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/40 text-xs sm:text-sm text-[#F8F9FB] font-extrabold focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none shadow-sm"
                  >
                    <option value="all">جميع الشهور</option>
                    <option value="01">01 - يناير</option>
                    <option value="02">02 - فبراير</option>
                    <option value="03">03 - مارس</option>
                    <option value="04">04 - أبريل</option>
                    <option value="05">05 - مايو</option>
                    <option value="06">06 - يونيو</option>
                    <option value="07">07 - يوليو</option>
                    <option value="08">08 - أغسطس</option>
                    <option value="09">09 - سبتمبر</option>
                    <option value="10">10 - أكتوبر</option>
                    <option value="11">11 - نوفمبر</option>
                    <option value="12">12 - ديسمبر</option>
                  </select>
                </div>

                {/* 3. Property Filter */}
                <div>
                  <label className="text-xs text-slate-200 block mb-1 font-extrabold">اختر العقار:</label>
                  <select
                    value={selectedPropertyId}
                    onChange={e => {
                      const newPropId = e.target.value;
                      setSelectedPropertyId(newPropId);
                      if (newPropId !== 'all') {
                        const matchingTenants = tenants.filter(t => {
                          if (t.propertyId && t.propertyId === newPropId) return true;
                          const u = units.find(unit => unit.id === t.unitId);
                          return u?.propertyId === newPropId;
                        });
                        if (!matchingTenants.some(t => t.id === selectedTenantId)) {
                          setSelectedTenantId('all');
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] font-extrabold focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none shadow-sm"
                  >
                    <option value="all">جميع العقارات ({properties.length})</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Tenant Filter (Searchable Dropdown with Collection Receipts button) */}
                <SearchableTenantDropdown
                  tenants={tenants}
                  properties={properties}
                  units={units}
                  selectedTenantId={selectedTenantId}
                  onSelectTenant={setSelectedTenantId}
                  selectedPropertyId={selectedPropertyId}
                  label="اختر المستأجر:"
                  placeholder="بحث باسم المستأجر، الوحدة، الهاتف..."
                  actionButton={
                    <button
                      type="button"
                      id="view-tenant-receipts-header-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedTenantId !== 'all') {
                          const targetTenant = tenants.find(t => t.id === selectedTenantId);
                          if (targetTenant) {
                            setTenantReceiptsModalTenant(targetTenant);
                          }
                        } else {
                          const firstTenant = displayedTenantRows[0]?.tenant || tenants[0];
                          if (firstTenant) {
                            setSelectedTenantId(firstTenant.id);
                            setTenantReceiptsModalTenant(firstTenant);
                          }
                        }
                      }}
                      className={`text-[11px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        selectedTenantId !== 'all'
                          ? 'bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 border-[#D4A84F] hover:brightness-110 ring-1 ring-[#D4A84F]/50'
                          : 'bg-[#D4A84F]/15 text-[#D4A84F] border-[#D4A84F]/40 hover:bg-[#D4A84F]/25'
                      }`}
                      title={
                        selectedTenantId !== 'all'
                          ? 'عرض وطباعة كافة سندات التحصيل لهذا المستأجر'
                          : 'عرض سندات التحصيل للمستأجر'
                      }
                    >
                      <Receipt className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>سندات التحصيل</span>
                      {selectedTenantId !== 'all' && (() => {
                        const count = (collections || []).filter(
                          c => c && c.tenantId === selectedTenantId && c.status !== 'reverted' && !c.isCancelled
                        ).length;
                        return count > 0 ? (
                          <span className="px-1.5 py-0.2 bg-slate-950 text-[#D4A84F] text-[10px] rounded-full font-mono font-bold">
                            {count}
                          </span>
                        ) : null;
                      })()}
                    </button>
                  }
                />

                {/* 5. Fast Search Bar */}
                <div>
                  <label className="text-xs text-slate-200 block mb-1 font-extrabold">البحث السريع:</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#D4A84F] absolute right-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="اسم، وحدة، هاتف..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/30 text-xs sm:text-sm text-[#F8F9FB] placeholder:text-slate-400 font-extrabold focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F] outline-none shadow-sm"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* 3. PROPERTY & OWNER BANNER (IF PROPERTY SELECTED) */}
            {selectedPropertyId !== 'all' && activePropObj && (
              <div className="p-4 bg-gradient-to-r from-[#132238] via-[#0D1B2D] to-[#0B1524] rounded-2xl border border-[#D4A84F]/35 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-[#D4A84F]/15 border border-[#D4A84F]/30 text-[#D4A84F] shadow-sm">
                    <Building2 className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-base font-black text-[#F8F9FB]">{activePropObj.name}</h4>
                      <span className="text-xs px-3 py-1 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] font-extrabold border border-[#D4A84F]/30">
                        {activePropObj.address || 'عقار تحت الإدارة'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 font-extrabold mt-1">
                      مالك العقار: <span className="text-[#D4A84F] font-black">{activeOwnerObj?.name || 'غير محدد'}</span> {activeOwnerObj?.phone ? `(${activeOwnerObj.phone})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold">
                  <div className="bg-[#08111F]/90 px-3.5 py-2 rounded-xl border border-[#D4A84F]/20 shadow-inner">
                    <span className="text-slate-300 block text-[10px] font-extrabold">عدد الوحدات:</span>
                    <span className="text-[#F8F9FB] font-black text-sm">{units.filter(u => u.propertyId === activePropObj.id).length} وحدة</span>
                  </div>
                  <div className="bg-[#08111F]/90 px-3.5 py-2 rounded-xl border border-[#D4A84F]/20 shadow-inner">
                    <span className="text-slate-300 block text-[10px] font-extrabold">مستأجري العقار:</span>
                    <span className="text-[#D4A84F] font-black text-sm">{tenants.filter(t => t.propertyId === activePropObj.id || units.find(u => u.id === t.unitId)?.propertyId === activePropObj.id).length} مستأجر</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. SINGLE ROW PER TENANT TABLE */}
            <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/25 p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D4A84F]/15">
                <h3 className="text-sm font-black text-[#D4A84F] flex items-center gap-2">
                  <Building className="w-4 h-4 stroke-[2.2]" />
                  قائمة المستأجرين وحالة تحصيل {
                    isAllYears && isAllMonths
                      ? 'جميع الشهور والسنوات'
                      : isAllYears
                      ? `شهر ${selectedRentMonth} (جميع السنوات)`
                      : isAllMonths
                      ? `جميع شهور سنة ${selectedRentYear}`
                      : `شهر ${formatMonthYearAr(targetMonthYear)}`
                  } ({displayedTenantRows.length} من أصل {tenants.length} مستأجر)
                </h3>
                <span className="text-xs text-slate-300 font-extrabold">
                  لكل مستأجر صف واحد فقط مع شارة المتأخرات إن وجدت
                </span>
              </div>

              {(selectedTenantId !== 'all' || selectedPropertyId !== 'all' || searchQuery.trim() !== '' || rentFilterMode !== 'all' || selectedRentYear !== 'all' || selectedRentMonth !== 'all') && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#08111F]/80 rounded-xl border border-[#D4A84F]/30 text-xs font-bold text-slate-200">
                  <span>
                    🔍 الفلاتر نشطة (المعروض حالياً: <strong className="text-[#D4A84F] font-mono">{displayedTenantRows.length}</strong> مستأجر)
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTenantId('all');
                      setSelectedPropertyId('all');
                      setSelectedRentYear('all');
                      setSelectedRentMonth('all');
                      setSearchQuery('');
                      setRentFilterMode('all');
                    }}
                    className="text-xs bg-[#D4A84F]/20 hover:bg-[#D4A84F]/30 text-[#D4A84F] font-black px-3 py-1 rounded-lg border border-[#D4A84F]/40 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> إلغاء التصفية وعرض كافة المستأجرين ({tenants.length})
                  </button>
                </div>
              )}

              {displayedTenantRows.length === 0 ? (
                <div className="py-12 text-center text-slate-300 font-extrabold space-y-2">
                  <AlertCircle className="w-10 h-10 text-[#D4A84F] mx-auto opacity-70" />
                  <p className="text-sm">لا يوجد مستأجرون يطابقون خيارات الفلترة المحددة حالياً.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#D4A84F]/20">
                  <table className="w-full text-right text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-[#08111F] text-slate-200 font-extrabold border-b border-[#D4A84F]/20 text-xs">
                        <th className="p-3.5">المستأجر</th>
                        <th className="p-3.5">العقار والوحدة</th>
                        <th className="p-3.5">الشهر المستهدف</th>
                        <th className="p-3.5">القيمة الإيجارية</th>
                        <th className="p-3.5">حالة هذا الشهر</th>
                        <th className="p-3.5">المتأخرات السابقة</th>
                        <th className="p-3.5 text-center">إجراءات التحصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4A84F]/15 font-extrabold">
                      {displayedTenantRows.map(row => {
                        const {
                          tenant,
                          unitObj,
                          propObj,
                          ownerObj,
                          currentMonthDue,
                          allUncollectedDues,
                          pastUncollectedDues,
                          targetMonthCollected,
                          isTargetAdvance,
                          rentAmount
                        } = row;

                        const tenantName = tenant.fullName || 'غير محدد';
                        const propertyName = propObj?.name || 'غير محدد';
                        const ownerName = ownerObj?.name || 'غير محدد';
                        const unitNumber = unitObj?.unitNumber || 'غير محدد';

                        const pastArrearsCount = pastUncollectedDues.length;

                        // Open modal for arrears / batch collection or prepayment
                        const handleOpenBatchOrCollect = (initialTab: 'arrears' | 'prepayment' = 'arrears') => {
                          const uncollectedOnly = allUncollectedDues.filter(d => {
                            const st = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                            return st !== 'collected' && st !== 'prepaid';
                          });
                          const pastAndCurrentUncollected = uncollectedOnly.filter(d => !d.forMonthYear || d.forMonthYear <= currentMonthISO);
                          const pastArrearsCountOnly = pastAndCurrentUncollected.length;
                          const hasReserveDues = uncollectedOnly.some(d => d.forMonthYear > currentMonthISO);

                          if (initialTab === 'prepayment') {
                            if (pastArrearsCountOnly > 0) {
                              alert('⚠️ يجب سداد جميع المتأخرات أولًا قبل إجراء الدفع المسبق.');
                              return;
                            }
                            setArrearsModalTab('prepayment');
                            setArrearsModalData({
                              tenant,
                              unitObj,
                              propObj,
                              ownerObj,
                              uncollectedDues: uncollectedOnly
                            });
                            const reserveDues = uncollectedOnly.filter(d => d.forMonthYear > currentMonthISO);
                            setSelectedDueIdsForBatch(reserveDues.map(d => d.id));
                            return;
                          }

                          if (uncollectedOnly.length > 1 || pastArrearsCountOnly > 0 || hasReserveDues) {
                            // Open Arrears Multi-Month Collection Modal
                            setArrearsModalTab('arrears');
                            setArrearsModalData({
                              tenant,
                              unitObj,
                              propObj,
                              ownerObj,
                              uncollectedDues: uncollectedOnly
                            });
                            // Automatically select all uncollected dues for current and past months
                            const arrearsDues = uncollectedOnly.filter(d => !d.forMonthYear || d.forMonthYear <= currentMonthISO);
                            setSelectedDueIdsForBatch(arrearsDues.map(d => d.id));
                          } else if (uncollectedOnly.length === 1) {
                            // Single month direct collection modal
                            onCollectRent(uncollectedOnly[0]);
                          } else {
                            alert('⚠️ لا يوجد استحقاق غير محصل مسجل لهذا المستأجر.');
                          }
                        };

                        return (
                          <tr key={tenant.id} className="hover:bg-white/[0.04] transition-colors">
                            
                            {/* 1. المستأجر */}
                            <td className="p-3.5">
                              <div className="font-black text-sm text-[#F8F9FB]">{tenantName}</div>
                              {tenant.phone && (
                                <div className="text-xs text-slate-300 font-mono font-bold mt-0.5">{tenant.phone}</div>
                              )}
                            </td>

                            {/* 2. العقار والوحدة */}
                            <td className="p-3.5">
                              <div className="text-[#F8F9FB] font-black text-xs sm:text-sm">{propertyName}</div>
                              <div className="text-xs text-[#D4A84F] font-black mt-0.5">
                                وحدة {unitNumber} {ownerName !== 'غير محدد' ? `(${ownerName})` : ''}
                              </div>
                            </td>

                            {/* 3. الشهر المستهدف */}
                            <td className="p-3.5 font-mono text-slate-100 font-black text-xs sm:text-sm">
                              {
                                isAllYears && isAllMonths
                                  ? 'جميع الشهور والسنوات'
                                  : isAllYears
                                  ? `شهر ${selectedRentMonth} (جميع السنوات)`
                                  : isAllMonths
                                  ? `جميع شهور ${selectedRentYear}`
                                  : formatMonthYearAr(targetMonthYear)
                              }
                            </td>

                            {/* 4. القيمة الإيجارية */}
                            <td className="p-3.5">
                              <span className="font-black font-mono text-base text-[#D4A84F]">
                                {rentAmount.toLocaleString('ar-EG')}
                              </span>
                              <span className="text-xs text-slate-300 font-bold mr-1">ج.م</span>
                            </td>

                            {/* 5. حالة التحصيل */}
                            <td className="p-3.5">
                              {targetMonthCollected ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>{isAllMonths || isAllYears ? 'مُحصّل بالكامل' : 'تم التحصيل'}</span>
                                </span>
                              ) : isTargetAdvance ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm">
                                  <Clock className="w-4 h-4" />
                                  <span>مدفوع مقدماً</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>{isAllMonths || isAllYears ? 'يوجد غير محصل' : 'مستحق الشهر الحالي'}</span>
                                </span>
                              )}
                            </td>

                            {/* 6. المتأخرات السابقة */}
                            <td className="p-3.5">
                              {pastArrearsCount > 0 ? (
                                <button
                                  onClick={() => handleOpenBatchOrCollect('arrears')}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-500/25 text-amber-200 border border-amber-500/50 hover:bg-amber-500/40 transition-all cursor-pointer shadow-sm ring-1 ring-amber-400/20"
                                  title="اضغط لتحصيل المتأخرات"
                                >
                                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                                  <span>يوجد متأخرات - {pastArrearsCount} شهر</span>
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 font-bold">لا توجد متأخرات</span>
                              )}
                            </td>

                            {/* 7. إجراءات التحصيل */}
                            <td className="p-3 text-center">
                              {(() => {
                                const tenantDues = validDues.filter(d => d.tenantId === tenant.id);
                                const collectedDuesForTenant = tenantDues.filter(d => getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'collected');
                                const hasCollectedMonths = collectedDuesForTenant.length > 0;

                                return (
                                  <div className="flex flex-wrap items-center justify-center gap-2">
                                    {/* زر الدفع المثبّت الرئيسي لكافة الحالات */}
                                    <button
                                      onClick={() => {
                                        if (pastArrearsCount > 0 || !targetMonthCollected) {
                                          handleOpenBatchOrCollect('arrears');
                                        } else {
                                          handleOpenBatchOrCollect('prepayment');
                                        }
                                      }}
                                      className="px-3.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-md shadow-amber-500/20 active:scale-95"
                                      title="تسجيل وتوثيق عملية الدفع (تحصيل إيجار / متأخرات / دفع مسبق)"
                                    >
                                      <Coins className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>الدفع</span>
                                      {pastArrearsCount > 0 && (
                                        <span className="bg-slate-950 text-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-400/40">
                                          {pastArrearsCount} متأخر
                                        </span>
                                      )}
                                    </button>

                                    {/* زر الرجوع عن التحصيل (يظهر دائماً طالما لدى المستأجر أي شهر محصل) */}
                                    {hasCollectedMonths && (
                                      <button
                                        onClick={() => handleOpenRevertModal(tenant, unitObj, propObj, ownerObj, collectedDuesForTenant[0]?.id || currentMonthDue?.id)}
                                        className="px-2.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer inline-flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 shadow-sm"
                                        title="الرجوع عن تحصيل الشهور المحصلة لهذا المستأجر"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>الرجوع عن التحصيل</span>
                                      </button>
                                    )}

                                    {/* زر سندات التحصيل الخاصة بالمستأجر */}
                                    <button
                                      type="button"
                                      onClick={() => setTenantReceiptsModalTenant(tenant)}
                                      className="px-2.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer inline-flex items-center gap-1 bg-[#132238] text-[#D4A84F] hover:bg-[#D4A84F]/20 border border-[#D4A84F]/40 shadow-sm active:scale-95"
                                      title="عرض كافة سندات التحصيل الموثقة لهذا المستأجر وطباعتها"
                                    >
                                      <Receipt className="w-3.5 h-3.5 text-[#D4A84F] stroke-[2.2]" />
                                      <span>سندات التحصيل</span>
                                      {(() => {
                                        const count = (collections || []).filter(
                                          c => c && c.tenantId === tenant.id && c.status !== 'reverted' && !c.isCancelled
                                        ).length;
                                        return count > 0 ? (
                                          <span className="bg-[#D4A84F]/20 text-[#D4A84F] text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border border-[#D4A84F]/40">
                                            {count}
                                          </span>
                                        ) : null;
                                      })()}
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* VIEW: السلف ومصروفات العقار (ADVANCES & EXPENSES) */}
      {currentTab === 'advances_expenses' && (
        <div className="space-y-6">
          {/* Subtabs Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdvancesSubTab('owner_advances')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  advancesSubTab === 'owner_advances'
                    ? 'bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 shadow-lg shadow-[#D4A84F]/20'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <Coins className="w-4 h-4 stroke-[2.5]" />
                <span>سلف المالك ({advances.length})</span>
              </button>
              <button
                onClick={() => setAdvancesSubTab('property_expenses')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  advancesSubTab === 'property_expenses'
                    ? 'bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 shadow-lg shadow-[#D4A84F]/20'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <Building className="w-4 h-4 stroke-[2.5]" />
                <span>مصروفات العقار ({expenses.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {advancesSubTab === 'owner_advances' ? (
                <>
                  <button
                    onClick={() => setIsAddAdvanceModalOpen(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>تسجيل سلفة جديدة</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAdvanceForReceipts(null);
                      setIsAdvanceReceiptsModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-[#132238] hover:bg-[#1C2E46] text-amber-300 hover:text-amber-200 border border-[#D4A84F]/40 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    title="فتح سجل وكافة سندات الخصم والتسوية"
                  >
                    <Receipt className="w-4 h-4 text-[#D4A84F]" />
                    <span>سندات الخصم ({advances.length})</span>
                  </button>
                  <button
                    onClick={handlePrintAdvancesList}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة التقرير</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsAddExpenseModalOpen(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>تسجيل مصروف جديد</span>
                  </button>
                  <button
                    onClick={handlePrintExpensesList}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة التقرير</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* KPI Statistics Bar */}
          {advancesSubTab === 'owner_advances' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md border border-[#D4A84F]/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-xs text-slate-200 font-extrabold block mb-1">إجمالي السلف المسجلة</span>
                  <p className="text-2xl font-black text-[#F8F9FB] mt-0.5 font-mono">
                    {advances.reduce((acc, a) => acc + (a.amount || 0), 0).toLocaleString('ar-EG')} <span className="text-xs text-[#D4A84F] font-black">ج.م</span>
                  </p>
                  <span className="text-xs text-slate-300 font-extrabold font-mono mt-1 block">{advances.length} سلفة في النظام</span>
                </div>
                <div className="p-3 bg-[#D4A84F]/15 rounded-xl text-[#D4A84F] border border-[#D4A84F]/30 shadow-sm">
                  <Coins className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md border border-emerald-500/35 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-xs text-emerald-200 font-extrabold block mb-1">إجمالي السلف المخصومة</span>
                  <p className="text-2xl font-black text-emerald-300 mt-0.5 font-mono">
                    {advances.filter(a => a.isDeducted).reduce((acc, a) => acc + (a.amount || 0), 0).toLocaleString('ar-EG')} <span className="text-xs text-emerald-400 font-black">ج.م</span>
                  </p>
                  <span className="text-xs text-emerald-300 font-extrabold font-mono mt-1 block">
                    {advances.filter(a => a.isDeducted).length} سلفة مخصومة
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400 border border-emerald-500/30 shadow-sm">
                  <CheckCircle className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md border border-amber-500/35 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-xs text-amber-200 font-extrabold block mb-1">السلف الجارية (غير المخصومة)</span>
                  <p className="text-2xl font-black text-amber-300 mt-0.5 font-mono">
                    {advances.filter(a => !a.isDeducted).reduce((acc, a) => acc + (a.amount || 0), 0).toLocaleString('ar-EG')} <span className="text-xs text-amber-400 font-black">ج.م</span>
                  </p>
                  <span className="text-xs text-amber-300 font-extrabold font-mono mt-1 block">
                    {advances.filter(a => !a.isDeducted).length} سلفة بانتظار الخصم
                  </span>
                </div>
                <div className="p-3 bg-amber-500/15 rounded-xl text-amber-400 border border-amber-500/30 shadow-sm">
                  <Clock className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md border border-[#D4A84F]/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-xs text-slate-200 font-extrabold block mb-1">إجمالي مصروفات العقارات</span>
                  <p className="text-2xl font-black text-[#F8F9FB] mt-0.5 font-mono">
                    {expenses.reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString('ar-EG')} <span className="text-xs text-[#D4A84F] font-black">ج.م</span>
                  </p>
                  <span className="text-xs text-slate-300 font-extrabold font-mono mt-1 block">{expenses.length} مصروف في النظام</span>
                </div>
                <div className="p-3 bg-[#D4A84F]/15 rounded-xl text-[#D4A84F] border border-[#D4A84F]/30 shadow-sm">
                  <Building className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md border border-emerald-500/35 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-xs text-emerald-200 font-extrabold block mb-1">المصروفات المخصومة من الملاك</span>
                  <p className="text-2xl font-black text-emerald-300 mt-0.5 font-mono">
                    {expenses.filter(e => e.isDeducted).reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString('ar-EG')} <span className="text-xs text-emerald-400 font-black">ج.م</span>
                  </p>
                  <span className="text-xs text-emerald-300 font-extrabold font-mono mt-1 block">
                    {expenses.filter(e => e.isDeducted).length} مصروف تم خصمه
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/15 rounded-xl text-emerald-400 border border-emerald-500/30 shadow-sm">
                  <CheckCircle className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#132238] to-[#0A121E] backdrop-blur-md border border-amber-500/35 rounded-2xl p-4 flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-xs text-amber-200 font-extrabold block mb-1">المصروفات غير المخصومة (معلقة)</span>
                  <p className="text-2xl font-black text-amber-300 mt-0.5 font-mono">
                    {expenses.filter(e => !e.isDeducted).reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString('ar-EG')} <span className="text-xs text-amber-400 font-black">ج.م</span>
                  </p>
                  <span className="text-xs text-amber-300 font-extrabold font-mono mt-1 block">
                    {expenses.filter(e => !e.isDeducted).length} مصروف قيد التسوية
                  </span>
                </div>
                <div className="p-3 bg-amber-500/15 rounded-xl text-amber-400 border border-amber-500/30 shadow-sm">
                  <Clock className="w-6 h-6 stroke-[2.2]" />
                </div>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/25 flex flex-wrap items-center gap-3 shadow-xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4A84F]" />
              <input
                type="text"
                value={advancesSearchQuery}
                onChange={(e) => setAdvancesSearchQuery(e.target.value)}
                placeholder="البحث باسم المالك أو العقار أو البيان..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#08111F] border border-[#D4A84F]/30 rounded-xl text-xs sm:text-sm text-[#F8F9FB] placeholder:text-slate-400 font-extrabold focus:outline-none focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F]"
              />
            </div>

            <select
              value={advancesOwnerFilter}
              onChange={(e) => setAdvancesOwnerFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-[#08111F] border border-[#D4A84F]/30 rounded-xl text-xs sm:text-sm font-extrabold text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F]"
            >
              <option value="all">جميع الملاك</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            <select
              value={advancesPropertyFilter}
              onChange={(e) => setAdvancesPropertyFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-[#08111F] border border-[#D4A84F]/30 rounded-xl text-xs sm:text-sm font-extrabold text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F]"
            >
              <option value="all">جميع العقارات</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={advancesStatusFilter}
              onChange={(e) => setAdvancesStatusFilter(e.target.value as any)}
              className="px-3.5 py-2.5 bg-[#08111F] border border-[#D4A84F]/30 rounded-xl text-xs sm:text-sm font-extrabold text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F] focus:ring-1 focus:ring-[#D4A84F]"
            >
              <option value="all">جميع الحالات</option>
              <option value="fully_deducted">مخصومة بالكامل 🟢</option>
              <option value="partially_deducted">مخصومة جزئياً 🟡</option>
              <option value="pending">غير مخصومة (جارية) 🟠</option>
            </select>
          </div>

          {/* SUBTAB 1: OWNER ADVANCES TABLE */}
          {advancesSubTab === 'owner_advances' && (() => {
            const filteredAdvances = advances.filter(a => {
              const ownerName = a.ownerName || owners.find(o => o.id === a.ownerId)?.name || '';
              const propName = a.propertyName || properties.find(p => p.id === a.propertyId)?.name || '';
              const matchSearch = !advancesSearchQuery || 
                ownerName.includes(advancesSearchQuery) || 
                propName.includes(advancesSearchQuery) || 
                (a.notes || '').includes(advancesSearchQuery);
              const matchOwner = advancesOwnerFilter === 'all' || a.ownerId === advancesOwnerFilter;
              const matchProp = advancesPropertyFilter === 'all' || a.propertyId === advancesPropertyFilter;
              
              const totalDeducted = getAdvanceDeductedAmount(a);
              const origAmount = a.amount || 0;
              const isFull = a.isDeducted || (totalDeducted >= origAmount && origAmount > 0);
              const isPartial = totalDeducted > 0 && totalDeducted < origAmount;
              const isNone = totalDeducted === 0 && !a.isDeducted;

              const matchStatus = advancesStatusFilter === 'all' || 
                (advancesStatusFilter === 'deducted' && (isFull || isPartial)) ||
                (advancesStatusFilter === 'fully_deducted' && isFull) || 
                (advancesStatusFilter === 'partially_deducted' && isPartial) || 
                (advancesStatusFilter === 'pending' && isNone);

              return matchSearch && matchOwner && matchProp && matchStatus;
            });

            return (
              <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/25 overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-[#D4A84F]/20 flex flex-wrap items-center justify-between gap-3 bg-[#0B1524]">
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-5 h-5 text-[#D4A84F] stroke-[2.2]" />
                    <div>
                      <h3 className="text-sm font-black text-[#F8F9FB]">جدول سلف الملاك المباشرة</h3>
                      <p className="text-[11px] text-slate-400 font-bold">إدارة السلف، تنفيذ الخصم الجزئي والكامل، سندات الخصم والرجوع</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAdvanceForReceipts(null);
                        setIsAdvanceReceiptsModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      title="عرض كافة سندات الخصم لجميع السلف"
                    >
                      <Receipt className="w-4 h-4 text-[#D4A84F]" />
                      <span>سجل كافة سندات الخصم</span>
                    </button>
                    <span className="text-xs text-slate-300 font-extrabold font-mono bg-[#08111F] px-2.5 py-1 rounded-lg border border-[#D4A84F]/20">
                      {filteredAdvances.length} سجل
                    </span>
                  </div>
                </div>

                {filteredAdvances.length === 0 ? (
                  <div className="p-12 text-center text-slate-300 space-y-3">
                    <Coins className="w-12 h-12 text-[#D4A84F]/40 mx-auto" />
                    <p className="text-sm font-extrabold">لا توجد سُلف مسجلة تطابق محددات البحث الحالية</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#08111F] text-slate-200 text-xs font-extrabold border-b border-[#D4A84F]/20">
                          <th className="p-3.5 text-center">#</th>
                          <th className="p-3.5">اسم المالك</th>
                          <th className="p-3.5">العقار المرتبط</th>
                          <th className="p-3.5 text-center">تاريخ السلفة</th>
                          <th className="p-3.5 text-center">قيمة السلفة والمتبقي</th>
                          <th className="p-3.5 text-center">طريقة السداد</th>
                          <th className="p-3.5">البيان / السبب</th>
                          <th className="p-3.5 text-center">حالة الخصم</th>
                          <th className="p-3.5 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/15 text-[#F8F9FB] font-extrabold">
                        {filteredAdvances.map((adv, idx) => {
                          const ownerObj = owners.find(o => o.id === adv.ownerId);
                          const propObj = properties.find(p => p.id === adv.propertyId);

                          const origAmount = adv.amount || 0;
                          const totalDeducted = getAdvanceDeductedAmount(adv);
                          const remainingAmount = Math.max(0, origAmount - totalDeducted);
                          const isFullyDeducted = adv.isDeducted || (totalDeducted >= origAmount && origAmount > 0);
                          const isPartiallyDeducted = totalDeducted > 0 && totalDeducted < origAmount;
                          const deductionsCount = (adv.deductions && adv.deductions.length > 0) ? adv.deductions.length : (adv.isDeducted ? 1 : 0);

                          return (
                            <tr key={adv.id} className="hover:bg-white/[0.04] transition-colors">
                              <td className="p-3.5 text-center font-mono text-xs text-slate-300">{idx + 1}</td>
                              <td className="p-3.5 font-black text-[#D4A84F] text-sm">
                                {adv.ownerName || ownerObj?.name || 'مالك غير محدد'}
                              </td>
                              <td className="p-3.5 font-extrabold text-slate-100">
                                {adv.propertyName || propObj?.name || 'جميع العقارات'}
                              </td>
                              <td className="p-3.5 text-center font-mono text-xs text-slate-200">
                                {adv.advanceDate}
                              </td>
                              <td className="p-3.5 text-center">
                                <div className="font-mono font-black text-base text-amber-300">
                                  {origAmount.toLocaleString('ar-EG')} ج.م
                                </div>
                                {isPartiallyDeducted && (
                                  <div className="text-[11px] font-mono text-rose-300 font-bold mt-0.5">
                                    متبقي: {remainingAmount.toLocaleString('ar-EG')} ج.م
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#08111F] border border-[#D4A84F]/30 text-[#D4A84F]">
                                  {adv.paymentMethod || 'نقدي'}
                                </span>
                              </td>
                              <td className="p-3.5 text-slate-300 text-xs max-w-[200px] truncate font-bold">
                                {adv.notes || '-'}
                              </td>
                              <td className="p-3.5 text-center">
                                {isFullyDeducted ? (
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-black border flex items-center gap-1 shadow-sm ${getDeductionMethodBadge(adv.deductionMethod)}`}>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>مخصومة بالكامل ({totalDeducted.toLocaleString('ar-EG')} ج.م)</span>
                                    </span>
                                    {adv.deductedAt && (
                                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                                        {adv.deductedAt} {adv.deductedBy ? `(${adv.deductedBy})` : ''}
                                      </span>
                                    )}
                                    {deductionsCount > 1 && (
                                      <span className="text-[10px] text-amber-300 font-mono">
                                        ({deductionsCount} حركات خصم)
                                      </span>
                                    )}
                                  </div>
                                ) : isPartiallyDeducted ? (
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>مخصومة جزئياً</span>
                                    </span>
                                    <div className="text-[10px] font-mono font-bold text-slate-300">
                                      خصم: {totalDeducted.toLocaleString('ar-EG')} | متبقي: {remainingAmount.toLocaleString('ar-EG')}
                                    </div>
                                    <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-amber-500/30">
                                      <div 
                                        className="bg-amber-400 h-full rounded-full" 
                                        style={{ width: `${Math.min(100, Math.round((totalDeducted / origAmount) * 100))}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-800/80 text-slate-300 border border-slate-700 flex items-center gap-1 shadow-sm">
                                    <Clock className="w-3.5 h-3.5 text-amber-400" /> غير مخصومة (جارية)
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeductAdvance(adv)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md ${
                                      isFullyDeducted
                                        ? 'bg-[#08111F] hover:bg-[#132238] text-emerald-300 border border-emerald-500/40 hover:border-emerald-400'
                                        : isPartiallyDeducted
                                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-amber-500/20'
                                          : 'bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black shadow-emerald-500/20'
                                    }`}
                                    title="فتح نافذة خصم السلف (تنفيذ الخصم، سندات الخصم، الرجوع)"
                                  >
                                    <Coins className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>خصم السلف</span>
                                    {deductionsCount > 0 && (
                                      <span className="text-[10px] font-mono bg-slate-950/80 text-amber-300 px-1.5 py-0.5 rounded-md">
                                        {deductionsCount}
                                      </span>
                                    )}
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
            );
          })()}

          {/* SUBTAB 2: PROPERTY EXPENSES TABLE */}
          {advancesSubTab === 'property_expenses' && (() => {
            const filteredExpenses = expenses.filter(e => {
              const ownerName = e.ownerName || owners.find(o => o.id === e.ownerId)?.name || '';
              const propName = e.propertyName || properties.find(p => p.id === e.propertyId)?.name || '';
              const matchSearch = !advancesSearchQuery || 
                ownerName.includes(advancesSearchQuery) || 
                propName.includes(advancesSearchQuery) || 
                (e.description || '').includes(advancesSearchQuery) ||
                (e.category || '').includes(advancesSearchQuery);
              const matchOwner = advancesOwnerFilter === 'all' || e.ownerId === advancesOwnerFilter;
              const matchProp = advancesPropertyFilter === 'all' || e.propertyId === advancesPropertyFilter;
              const matchStatus = advancesStatusFilter === 'all' || 
                (advancesStatusFilter === 'deducted' && e.isDeducted) || 
                (advancesStatusFilter === 'pending' && !e.isDeducted);
              return matchSearch && matchOwner && matchProp && matchStatus;
            });

            return (
              <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-[#D4A84F]/15 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#D4A84F]" />
                    <h3 className="text-xs font-black text-[#F8F9FB]">جدول مصروفات وصيانة العقارات</h3>
                  </div>
                  <span className="text-[10px] text-[#9EA7B8] font-mono">{filteredExpenses.length} سجل</span>
                </div>

                {filteredExpenses.length === 0 ? (
                  <div className="p-12 text-center text-[#9EA7B8] space-y-3">
                    <Building className="w-10 h-10 text-[#D4A84F]/30 mx-auto" />
                    <p className="text-xs font-bold">لا توجد مصروفات مسجلة تطابق محددات البحث الحالية</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                          <th className="p-3 text-center">#</th>
                          <th className="p-3">العقار</th>
                          <th className="p-3">اسم المالك</th>
                          <th className="p-3">نوع المصروف</th>
                          <th className="p-3 text-center">التاريخ</th>
                          <th className="p-3 text-center">القيمة</th>
                          <th className="p-3">البيان التفصيلي</th>
                          <th className="p-3 text-center">المرفق / الفاتورة</th>
                          <th className="p-3 text-center">حالة الخصم</th>
                          <th className="p-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/10 text-[#F8F9FB]">
                        {filteredExpenses.map((exp, idx) => {
                          const propObj = properties.find(p => p.id === exp.propertyId);
                          const ownerObj = owners.find(o => o.id === exp.ownerId || o.id === propObj?.ownerId);

                          return (
                            <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{idx + 1}</td>
                              <td className="p-3 font-bold text-[#F8F9FB]">
                                {exp.propertyName || propObj?.name || 'عقار غير محدد'}
                              </td>
                              <td className="p-3 font-black text-[#D4A84F]">
                                {exp.ownerName || ownerObj?.name || 'مالك غير محدد'}
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#08111F] border border-[#D4A84F]/20 text-[#D4A84F]">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-[11px]">
                                {exp.expenseDate}
                              </td>
                              <td className="p-3 text-center font-mono font-black text-rose-400">
                                {exp.amount.toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 text-[#9EA7B8] text-[11px] max-w-[200px] truncate">
                                {exp.description || '-'}
                              </td>
                              <td className="p-3 text-center">
                                {exp.attachmentUrl ? (
                                  <a
                                    href={exp.attachmentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:underline"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>عرض المستند</span>
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-[#9EA7B8]/50">بدون مرفق</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {exp.isDeducted ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> مخصوم من المالك
                                    </span>
                                    {exp.deductedAt && (
                                      <span className="text-[9px] text-emerald-400/70 font-mono mt-0.5">
                                        {exp.deductedAt} ({exp.deductedBy || 'المحاسب'})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> غير مخصوم (معلق)
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {!exp.isDeducted ? (
                                    <button
                                      onClick={() => handleDeductExpense(exp)}
                                      className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-[11px] font-black rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-500/10"
                                      title="خصم هذا المصروف من مستحقات المالك"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>خصم المصروف</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRevertExpenseDeduction(exp)}
                                      className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-black rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                      title="إلغاء خصم المصروف وإعادته لقائمة المعلقات"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      <span>الرجوع عن الخصم</span>
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
              </div>
            );
          })()}

          {/* MODAL: ADD NEW ADVANCE */}
          {isAddAdvanceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#132238] border border-[#D4A84F]/30 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl text-[#F8F9FB]">
                <div className="flex items-center justify-between border-b border-[#D4A84F]/20 pb-4">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-[#D4A84F]" />
                    <h3 className="text-sm font-black">تسجيل سلفة مالك جديدة</h3>
                  </div>
                  <button
                    onClick={() => setIsAddAdvanceModalOpen(false)}
                    className="p-1 hover:bg-white/10 rounded-lg text-[#9EA7B8] hover:text-[#F8F9FB]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs font-bold">
                  <div>
                    <label className="block text-[#9EA7B8] mb-1">اختيار المالك <span className="text-rose-400">*</span></label>
                    <select
                      value={advanceOwnerId}
                      onChange={(e) => {
                        setAdvanceOwnerId(e.target.value);
                        const ownerProps = properties.filter(p => p.ownerId === e.target.value);
                        if (ownerProps.length === 1) setAdvancePropertyId(ownerProps[0].id);
                      }}
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    >
                      <option value="">-- اختر المالك --</option>
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#9EA7B8] mb-1">اختيار العقار المرتبط <span className="text-rose-400">*</span></label>
                    <select
                      value={advancePropertyId}
                      onChange={(e) => setAdvancePropertyId(e.target.value)}
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    >
                      <option value="">-- اختر العقار --</option>
                      {properties
                        .filter(p => !advanceOwnerId || p.ownerId === advanceOwnerId)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#9EA7B8] mb-1">قيمة السلفة (ج.م) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        min="1"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] font-mono focus:outline-none focus:border-[#D4A84F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#9EA7B8] mb-1">تاريخ السلفة</label>
                      <input
                        type="date"
                        value={advanceDate}
                        onChange={(e) => setAdvanceDate(e.target.value)}
                        className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] font-mono focus:outline-none focus:border-[#D4A84F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#9EA7B8] mb-1">طريقة السداد / التحويل</label>
                    <select
                      value={advancePaymentMethod}
                      onChange={(e) => setAdvancePaymentMethod(e.target.value)}
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    >
                      <option value="نقدي">نقدي خزينة</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="انستا باي">انستا باي (InstaPay)</option>
                      <option value="فودافون كاش">فودافون كاش / محفظة إلكترونية</option>
                      <option value="شيك">شيك بنكي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#9EA7B8] mb-1">البيان / سبب السلفة</label>
                    <textarea
                      rows={2}
                      value={advanceNotes}
                      onChange={(e) => setAdvanceNotes(e.target.value)}
                      placeholder="أدخل تفاصيل أو سبب السلفة العاجلة..."
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4A84F]/20">
                  <button
                    onClick={() => setIsAddAdvanceModalOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#9EA7B8] text-xs font-bold rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    disabled={isSavingAdvance}
                    onClick={handleSaveNewAdvance}
                    className="px-5 py-2 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAdvance ? 'جاري الحفظ...' : 'حفظ السلفة'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: ADD NEW EXPENSE */}
          {isAddExpenseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#132238] border border-[#D4A84F]/30 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl text-[#F8F9FB]">
                <div className="flex items-center justify-between border-b border-[#D4A84F]/20 pb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-[#D4A84F]" />
                    <h3 className="text-sm font-black">تسجيل مصروف عقار جديد</h3>
                  </div>
                  <button
                    onClick={() => setIsAddExpenseModalOpen(false)}
                    className="p-1 hover:bg-white/10 rounded-lg text-[#9EA7B8] hover:text-[#F8F9FB]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs font-bold">
                  <div>
                    <label className="block text-[#9EA7B8] mb-1">اختيار العقار <span className="text-rose-400">*</span></label>
                    <select
                      value={expensePropertyId}
                      onChange={(e) => {
                        setExpensePropertyId(e.target.value);
                        const p = properties.find(prop => prop.id === e.target.value);
                        if (p) setExpenseOwnerId(p.ownerId || '');
                      }}
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    >
                      <option value="">-- اختر العقار --</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#9EA7B8] mb-1">نوع المصروف</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    >
                      <option value="صيانة عامة ونظافة">صيانة عامة ونظافة</option>
                      <option value="كهرباء ومرافق">كهرباء ومرافق</option>
                      <option value="سباكة وطوارئ">سباكة وطوارئ</option>
                      <option value="حراسة وأمن">حراسة وأمن</option>
                      <option value="تراخيص ورسوم حكومية">تراخيص ورسوم حكومية</option>
                      <option value="مصاريف إدارية وقانونية">مصاريف إدارية وقانونية</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#9EA7B8] mb-1">قيمة المصروف (ج.م) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        min="1"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] font-mono focus:outline-none focus:border-[#D4A84F]"
                      />
                    </div>
                    <div>
                      <label className="block text-[#9EA7B8] mb-1">تاريخ المصروف</label>
                      <input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] font-mono focus:outline-none focus:border-[#D4A84F]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#9EA7B8] mb-1">البيان / تفاصيل المصروف</label>
                    <textarea
                      rows={2}
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      placeholder="أدخل وصفاً تفصيلياً لسبب المصروف وما تم إنجازه..."
                      className="w-full p-2.5 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl text-[#F8F9FB] focus:outline-none focus:border-[#D4A84F]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4A84F]/20">
                  <button
                    onClick={() => setIsAddExpenseModalOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#9EA7B8] text-xs font-bold rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    disabled={isSavingExpense}
                    onClick={handleSaveNewExpense}
                    className="px-5 py-2 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSavingExpense ? 'جاري الحفظ...' : 'حفظ المصروف'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                      const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);
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
                            ) : cStatus === 'prepaid' ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  <Sparkles className="w-3 h-3" /> مسدد مسبقًا
                                </span>
                                <span className="block text-[9px] text-purple-300 font-mono">إيصال #{due.receiptNumber || 'مسبق'}</span>
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
                              {cStatus !== 'collected' && cStatus !== 'prepaid' && (
                                <button
                                  onClick={() => onCollectRent(due)}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 text-[11px] font-black hover:brightness-110 shadow-md shadow-emerald-500/10 transition-all cursor-pointer inline-flex items-center gap-1"
                                  title="تحصيل مبلغ الإيجار من المستأجر"
                                >
                                  <DollarSign className="w-3 h-3 stroke-[2.5]" />
                                  <span>تحصيل الإيجار</span>
                                </button>
                              )}

                              {pStatus === 'paid_out' && (cStatus === 'collected' || cStatus === 'prepaid') && (
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
                  {dues.filter(d => getDuePayoutStatus(d) === 'paid_out' || getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'collected').length}
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
                      const urgentDues = validDues.filter(d => {
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
                                  <div className="flex items-center justify-center gap-2">

                                    <button
                                      onClick={() => onPayoutOwner(due)}
                                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#B38734] text-slate-950 font-black text-xs hover:brightness-110 shadow-lg shadow-[#D4A84F]/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                      <Wallet className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>صرف صافي المستحق</span>
                                    </button>
                                  </div>
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
                      const matchedDues = validDues.filter(d => {
                        const pStatus = getDuePayoutStatus(d);
                        const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
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
                        const cStatus = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);
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
                              <div className="flex items-center justify-center gap-1.5">
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


                              </div>
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

                      validDues.forEach(d => {
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
                        const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);

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

      {/* VIEW 4: كشف حسابات العقارات (PROPERTY STATEMENTS) */}
      {currentTab === 'property_statements' && (
        <div className="space-y-4">
          {(() => {
            const calculatedData = calculatePropertyStatementsData({
              dues: validDues,
              collections,
              properties,
              owners,
              units,
              expenses,
              advances,
              commissionStatuses,
              rentAdjustments,
              filters: {
                selectedPropertyId,
                selectedOwnerId,
                selectedTenantId,
                selectedMonthYear,
                propertyStatementsFilter,
                propertyAccountType,
                todayISO,
                currentMonthISO,
              }
            });

            const {
              filteredDues: statementDues,
              propertyGroups,
              grandTotalRent,
              grandTotalCollected,
              grandTotalArrears: totalArrears,
              grandTotalCommission,
              grandTotalNetOwner,
              grandTotalDisbursed,
              grandTotalBalance,
              leasedUnitsCount,
              vacantUnitsCount,
              occupancyRate,
              collectionRate,
            } = calculatedData;

            return (
              <div className="space-y-4">
                {/* Segmented Control Filter */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center bg-[#132238]/80 p-3 rounded-2xl border border-[#D4A84F]/30 justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#D4A84F] ms-1" />
              <span className="text-xs font-bold text-[#F8F9FB]">تصفية حسابات العقارات حسب حالة التحصيل:</span>
            </div>
            <div className="flex items-center bg-[#08111F]/90 p-1 rounded-xl border border-[#D4A84F]/20 w-full sm:w-auto justify-stretch">
              <button
                type="button"
                onClick={() => setPropertyStatementsFilter('all')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  propertyStatementsFilter === 'all'
                    ? 'bg-[#D4A84F] text-slate-950 shadow-md font-black'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setPropertyStatementsFilter('collected')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  propertyStatementsFilter === 'collected'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                }`}
              >
                تم التحصيل
              </button>
              <button
                type="button"
                onClick={() => setPropertyStatementsFilter('uncollected')}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  propertyStatementsFilter === 'uncollected'
                    ? 'bg-rose-500 text-white shadow-md font-black'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                }`}
              >
                لم يتم التحصيل
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">تحديد العقار:</label>
              <select
                value={selectedPropertyId}
                onChange={e => setSelectedPropertyId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none"
              >
                <option value="all">جميع العقارات المسجلة</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">نوع الحساب:</label>
              <select
                value={propertyAccountType}
                onChange={e => setPropertyAccountType(e.target.value as 'monthly' | 'total')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#D4A84F] font-black focus:border-[#D4A84F] outline-none"
              >
                <option value="monthly">1- حسابات شهرية</option>
                <option value="total">2- حسابات إجمالية</option>
              </select>
            </div>

            {propertyAccountType === 'monthly' && (
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">الشهر المالي:</label>
                <input
                  type="month"
                  value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                  onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none font-mono"
                />
              </div>
            )}

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

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleOpenReportPreview('property_monthly')}
                className="px-4 py-2.5 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة التقرير</span>
              </button>
              <button
                onClick={() => handlePrintReportDirectly('property_monthly')}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير</span>
              </button>
            </div>
          </div>

          {/* Property Account Summary KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-[#D4A84F]/15">
                    <span className="text-[10px] text-[#9EA7B8] block font-bold mb-1">إجمالي الإيراد الإيجاري</span>
                    <div className="text-base font-black text-[#D4A84F] font-mono">{grandTotalRent.toLocaleString('ar-EG')} ج.م</div>
                    <span className="text-[9px] text-[#9EA7B8]">قبل العمولات أو المصروفات</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-[#9EA7B8] block font-bold mb-1">الإيجارات المحصلة</span>
                    <div className="text-base font-black text-emerald-400 font-mono">{grandTotalCollected.toLocaleString('ar-EG')} ج.م</div>
                    <span className="text-[9px] text-emerald-300">متحصلات فعلية من المستأجرين</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-amber-500/20">
                    <span className="text-[10px] text-[#9EA7B8] block font-bold mb-1">عمولات المكتب</span>
                    <div className="text-base font-black text-amber-400 font-mono">{grandTotalCommission.toLocaleString('ar-EG')} ج.م</div>
                    <span className="text-[9px] text-amber-300">إجمالي مستحقات المكتب</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-[#D4A84F]/20">
                    <span className="text-[10px] text-[#9EA7B8] block font-bold mb-1">صافي مستحق الملاك</span>
                    <div className="text-base font-black text-[#D4A84F] font-mono">{grandTotalNetOwner.toLocaleString('ar-EG')} ج.م</div>
                    <span className="text-[9px] text-[#9EA7B8]">الإيجار الصافي المتبقي للمالك</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-teal-500/20">
                    <span className="text-[10px] text-[#9EA7B8] block font-bold mb-1">المصروف للملاك</span>
                    <div className="text-base font-black text-teal-300 font-mono">{grandTotalDisbursed.toLocaleString('ar-EG')} ج.م</div>
                    <span className="text-[9px] text-teal-300">مبالغ تم صرفها فعلياً للملاك</span>
                  </div>

                  <div className="bg-[#132238]/60 p-3.5 rounded-2xl border border-rose-500/20">
                    <span className="text-[10px] text-[#9EA7B8] block font-bold mb-1">الرصيد المتبقي / المتأخرات</span>
                    <div className="text-base font-black text-rose-400 font-mono">{grandTotalBalance.toLocaleString('ar-EG')} ج.م</div>
                    <span className="text-[9px] text-sky-300">نسبة التحصيل: {collectionRate}% ({leasedUnitsCount} مؤجرة / {vacantUnitsCount} شاغرة)</span>
                  </div>
                </div>

                {/* Main Statement Table - Grouped per Property */}
                <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-[#D4A84F]/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#D4A84F]" />
                      <h3 className="text-xs font-black text-[#F8F9FB]">
                        كشف حسابات العقارات المجمع شهرياً ({selectedPropertyId === 'all' ? 'جميع العقارات' : properties.find(p => p.id === selectedPropertyId)?.name}) - {propertyAccountType === 'monthly' ? (selectedMonthYear === 'all' ? 'جميع الشهور' : selectedMonthYear) : 'حساب إجمالي'}
                      </h3>
                    </div>
                    <span className="text-[10px] text-[#9EA7B8] font-mono font-bold">
                      عدد العقارات: {propertyGroups.length} | عدد الاستحقاقات: {statementDues.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                          <th className="p-3 text-center">#</th>
                          <th className="p-3">اسم العقار والمالك</th>
                          <th className="p-3 text-center">عدد الاستحقاقات</th>
                          <th className="p-3">إجمالي الإيجار</th>
                          <th className="p-3">الإيجار المحصل</th>
                          <th className="p-3">عمولة المكتب</th>
                          <th className="p-3">صافي مستحق المالك</th>
                          <th className="p-3">المصروف للمالك</th>
                          <th className="p-3">الرصيد المتبقي</th>
                          <th className="p-3 text-center font-bold">تفاصيل وتعديلات المستأجرين</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                        {propertyGroups.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-[#9EA7B8]">
                              <Clock className="w-8 h-8 text-[#D4A84F]/40 mx-auto mb-2" />
                              <p className="text-xs font-bold">لا توجد بيانات كشف حساب عقارات مطابقة للشروط المختارة.</p>
                            </td>
                          </tr>
                        ) : (
                          propertyGroups.map((group, idx) => {
                            const isExpanded = expandedPropIds.has(group.propertyId);

                            return (
                              <React.Fragment key={group.propertyId}>
                                <tr 
                                  onClick={() => togglePropertyExpand(group.propertyId)}
                                  className="hover:bg-[#08111F]/60 transition-all cursor-pointer bg-[#132238]/40"
                                >
                                  <td className="p-3 text-center font-mono text-[#9EA7B8]">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="font-extrabold text-[#F8F9FB] flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-[#D4A84F]" />
                                      <span>{group.propertyName}</span>
                                    </div>
                                    <span className="text-[10px] text-[#D4A84F]">المالك: {group.ownerName}</span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#08111F] text-[#D4A84F] border border-[#D4A84F]/20 text-[11px] font-mono">
                                      {group.dues.length} استحقاق
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-[#F8F9FB]">{group.totalRentSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-emerald-400 font-bold">{group.totalCollectedSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-amber-400">{group.totalCommissionSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-[#D4A84F] font-extrabold">{group.totalNetOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-teal-300">{group.totalDisbursedSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-rose-300">{group.totalBalanceSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      
                                      {/* Tenants Icon / Button to open standalone Tenants Modal */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPropertyTenantsModalGroup(group);
                                          setPropertyTenantSearchQuery('');
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black text-xs shadow-md border border-sky-400/30 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                                        title="عرض قائمة وبيانات المستأجرين المرتبطين بهذا العقار"
                                      >
                                        <Users className="w-3.5 h-3.5 text-sky-200" />
                                        <span>المستأجرين</span>
                                      </button>

                                      {/* Toggle Expand Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePropertyExpand(group.propertyId);
                                        }}
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                                          isExpanded 
                                            ? 'bg-[#D4A84F] text-slate-950 border-[#D4A84F] shadow-md' 
                                            : 'bg-[#08111F] text-[#D4A84F] hover:bg-[#D4A84F]/20 border-[#D4A84F]/30'
                                        }`}
                                        title={isExpanded ? 'إخفاء الحساب الشهري والمستأجرين' : 'عرض الحساب الشهري والمستأجرين'}
                                      >
                                        <span>{isExpanded ? 'إخفاء' : 'الحساب الشهري'}</span>
                                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Expanded Inner Section for Property */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={10} className="p-4 bg-[#08111F]/90 border-t border-b border-[#D4A84F]/20">
                                      <div className="p-4 bg-[#132238]/80 rounded-xl border border-[#D4A84F]/20 space-y-4">
                                        
                                        {/* Section 1: Monthly Aggregated Rent for this Property */}
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between pb-2 border-b border-[#D4A84F]/15">
                                            <span className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                                              <Calendar className="w-4 h-4 text-[#D4A84F]" />
                                              <span>إجمالي القيمة الإيجارية شهرياً لعقار: <strong className="text-[#F8F9FB]">{group.propertyName}</strong></span>
                                              <span className="px-2 py-0.5 rounded-full bg-[#D4A84F]/15 text-[#D4A84F] border border-[#D4A84F]/30 text-[10px] font-mono">
                                                {group.dues.length} استحقاق
                                              </span>
                                            </span>
                                            <span className="text-[10px] text-emerald-300 font-bold bg-[#08111F] px-2.5 py-1 rounded-lg border border-[#D4A84F]/10">
                                              مجموع إيجار العقار لكل شهر بترتيب زمني
                                            </span>
                                          </div>

                                          <div className="overflow-x-auto rounded-lg border border-[#D4A84F]/10">
                                            <table className="w-full text-right text-xs">
                                              <thead>
                                                <tr className="bg-[#08111F] text-[#9EA7B8] font-bold border-b border-[#D4A84F]/15 text-[11px]">
                                                  <th className="p-2.5 text-center w-10">#</th>
                                                  <th className="p-2.5">الشهر المالي</th>
                                                  <th className="p-2.5 text-center">عدد المستأجرين</th>
                                                  <th className="p-2.5">إجمالي إيجار العقار</th>
                                                  <th className="p-2.5">الإيجار المحصل</th>
                                                  <th className="p-2.5 text-rose-300">المتأخرات</th>
                                                  <th className="p-2.5">عمولة المكتب</th>
                                                  <th className="p-2.5 text-center">حالة تحصيل العمولة</th>
                                                  <th className="p-2.5 text-rose-400 font-extrabold">السلف والمصروفات</th>
                                                  <th className="p-2.5">صافي مستحق المالك</th>
                                                  <th className="p-2.5">المصروف للمالك</th>
                                                  <th className="p-2.5">الرصيد المتبقي</th>
                                                  <th className="p-2.5 text-center">حالة الصرف والتسوية</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-white/5 font-bold">
                                                {group.months.map((m, mIdx) => {
                                                  const arrearsVal = m.arrearsSum;
                                                  const remBal = m.balanceSum;
                                                  let statusBadge = 'لم يُصرف';
                                                  let statusBadgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                                                  if (m.paidOutCount === m.tenantCount && m.tenantCount > 0) {
                                                    statusBadge = 'صُرف بالكامل';
                                                    statusBadgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                                                  } else if (m.disbursedSum > 0 || m.paidOutCount > 0) {
                                                    statusBadge = 'صُرف جزئياً';
                                                    statusBadgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                                                  }

                                                  let commBadgeText = 'لم يتم التحصيل';
                                                  let commBadgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                                                  if (m.isCommissionCollected || m.commissionStatus === 'collected') {
                                                    commBadgeText = 'تم التحصيل';
                                                    commBadgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                                                  } else if ((m.collectedCommission || 0) > 0) {
                                                    commBadgeText = 'تحصيل جزئي';
                                                    commBadgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                                                  }

                                                  return (
                                                    <tr key={m.forMonthYear} className="hover:bg-white/5 transition-colors">
                                                      <td className="p-2.5 text-center font-mono text-[#9EA7B8] text-[11px]">{mIdx + 1}</td>
                                                      <td className="p-2.5 font-bold text-[#F8F9FB] font-mono">{m.monthNameAr || m.forMonthYear}</td>
                                                      <td className="p-2.5 text-center font-mono text-[#D4A84F]">{m.tenantCount} مستأجر</td>
                                                      <td className="p-2.5 font-mono text-[#F8F9FB] font-black">{m.rentSum.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 font-mono text-emerald-400 font-bold">{m.collectedSum.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 font-mono text-rose-400 font-bold">{arrearsVal > 0 ? `${arrearsVal.toLocaleString('ar-EG')} ج.م` : '—'}</td>
                                                      <td className="p-2.5 font-mono text-amber-400">{m.commissionSum.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 text-center">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${commBadgeColor}`}>
                                                          {commBadgeText}
                                                        </span>
                                                      </td>
                                                      <td className="p-2.5 font-mono text-rose-400 font-extrabold">{m.totalDeductionsSum > 0 ? `-${m.totalDeductionsSum.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                                                      <td className="p-2.5 font-mono text-[#D4A84F] font-black">{m.netOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 font-mono text-teal-300">{m.disbursedSum.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 font-mono text-rose-300">{remBal.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 text-center">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadgeColor}`}>
                                                          {statusBadge}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                        {/* Section 2: Detailed Tenants List in this Property */}

                                        <div className="space-y-2 pt-2 border-t border-[#D4A84F]/15">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                                              <Users className="w-4 h-4 text-[#D4A84F]" />
                                              <span>قائمة المستأجرين وحدات العقار ({group.propertyName})</span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPropertyTenantsModalGroup(group);
                                                setPropertyTenantSearchQuery('');
                                              }}
                                              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline flex items-center gap-1 cursor-pointer"
                                            >
                                              <span>فتح القائمة المكبرة</span>
                                              <ExternalLink className="w-3 h-3" />
                                            </button>
                                          </div>

                                          <div className="overflow-x-auto rounded-lg border border-[#D4A84F]/10">
                                            <table className="w-full text-right text-xs">
                                              <thead>
                                                <tr className="bg-[#08111F] text-[#9EA7B8] font-bold border-b border-[#D4A84F]/15 text-[11px]">
                                                  <th className="p-2.5">اسم المستأجر</th>
                                                  <th className="p-2.5 font-mono">الإيجار المستحق</th>
                                                  <th className="p-2.5 font-mono">الإيجار المحصل</th>
                                                  <th className="p-2.5 font-mono">الإيجار المتأخر</th>
                                                  <th className="p-2.5 text-center">آخر شهر سداد</th>
                                                  <th className="p-2.5 text-center">عدد الشهور المتأخرة</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-white/5 font-bold">
                                                {(() => {
                                                  const propTenantsMap = new Map<string, {
                                                    tenantName: string;
                                                    dueRent: number;
                                                    collectedRent: number;
                                                    arrearsRent: number;
                                                    lastPaidMonth: string;
                                                    lastPaidMonthKey: string;
                                                    overdueMonthsCount: number;
                                                  }>();

                                                  group.dues.forEach(d => {
                                                    const tKey = d.tenantId || d.tenantName || 'unknown';
                                                    if (!propTenantsMap.has(tKey)) {
                                                      const tObj = tenants.find(t => t.id === d.tenantId);
                                                      propTenantsMap.set(tKey, {
                                                        tenantName: d.tenantName || tObj?.fullName || 'مستأجر',
                                                        dueRent: 0,
                                                        collectedRent: 0,
                                                        arrearsRent: 0,
                                                        lastPaidMonth: '—',
                                                        lastPaidMonthKey: '',
                                                        overdueMonthsCount: 0,
                                                      });
                                                    }

                                                    const entry = propTenantsMap.get(tKey)!;
                                                    const rent = d.rentAmount || 0;
                                                    const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                                                    const isCollected = cStat === 'collected' || cStat === 'prepaid';
                                                    const collected = isCollected ? (d.collectedAmount || d.rentAmount || 0) : (d.collectedAmount || 0);
                                                    const arrears = Math.max(0, rent - collected);

                                                    entry.dueRent += rent;
                                                    entry.collectedRent += collected;

                                                    if ((isCollected || collected > 0) && d.forMonthYear) {
                                                      if (!entry.lastPaidMonthKey || d.forMonthYear > entry.lastPaidMonthKey) {
                                                        entry.lastPaidMonthKey = d.forMonthYear;
                                                        entry.lastPaidMonth = d.monthNameAr || formatMonthYearAr(d.forMonthYear);
                                                      }
                                                    }

                                                    if (d.forMonthYear && d.forMonthYear <= currentMonthISO && arrears > 0) {
                                                      entry.overdueMonthsCount += 1;
                                                    }
                                                  });

                                                  propTenantsMap.forEach(entry => {
                                                    entry.arrearsRent = Math.max(0, entry.dueRent - entry.collectedRent);
                                                  });

                                                  const propTenantList = Array.from(propTenantsMap.values());

                                                  if (propTenantList.length === 0) {
                                                    return (
                                                      <tr>
                                                        <td colSpan={6} className="p-4 text-center text-[#9EA7B8] text-xs">
                                                          لا توجد سجلات مستأجرين مرابطة بهذا العقار حالياً.
                                                        </td>
                                                      </tr>
                                                    );
                                                  }

                                                  return propTenantList.map((t, tIdx) => (
                                                    <tr key={tIdx} className="hover:bg-white/5 transition-colors">
                                                      <td className="p-2.5 font-bold text-[#F8F9FB]">{t.tenantName}</td>
                                                      <td className="p-2.5 font-mono text-[#F8F9FB] font-black">{t.dueRent.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 font-mono text-emerald-400 font-bold">{t.collectedRent.toLocaleString('ar-EG')} ج.م</td>
                                                      <td className="p-2.5 font-mono text-rose-400 font-bold">{t.arrearsRent > 0 ? `${t.arrearsRent.toLocaleString('ar-EG')} ج.م` : '—'}</td>
                                                      <td className="p-2.5 text-center font-mono text-amber-300 font-bold">{t.lastPaidMonth}</td>
                                                      <td className="p-2.5 text-center font-mono font-extrabold">
                                                        {t.overdueMonthsCount > 0 ? (
                                                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                            {t.overdueMonthsCount} شهر
                                                          </span>
                                                        ) : (
                                                          <span className="text-emerald-400">0</span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ));
                                                })()}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>

                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
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

      {/* VIEW 5: كشف حساب المالك التفصيلي (OWNER ACCOUNT STATEMENT) */}
      {currentTab === 'owner_statements' && (
        <div className="space-y-4">
          
          {/* Segmented Control Filter (الكل | تم التحصيل | لم يتم التحصيل) & Clear Action */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center bg-[#132238]/80 p-3.5 rounded-2xl border border-[#D4A84F]/30 justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#D4A84F] ms-1" />
              <span className="text-xs font-bold text-[#F8F9FB]">تصفية الحسابات حسب حالة التحصيل:</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center bg-[#08111F]/90 p-1 rounded-xl border border-[#D4A84F]/20 flex-1 sm:flex-initial justify-stretch">
                <button
                  type="button"
                  onClick={() => setOwnerStatementsFilter('all')}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ownerStatementsFilter === 'all'
                      ? 'bg-[#D4A84F] text-slate-950 shadow-md font-black'
                      : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerStatementsFilter('collected')}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ownerStatementsFilter === 'collected'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  تم التحصيل
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerStatementsFilter('uncollected')}
                  className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ownerStatementsFilter === 'uncollected'
                      ? 'bg-rose-500 text-white shadow-md font-black'
                      : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  لم يتم التحصيل
                </button>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15">
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
              <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">نوع الحساب:</label>
              <select
                value={ownerAccountType}
                onChange={e => setOwnerAccountType(e.target.value as 'monthly' | 'total')}
                className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#D4A84F] font-black focus:border-[#D4A84F] outline-none"
              >
                <option value="monthly">1- حسابات شهرية</option>
                <option value="total">2- حسابات إجمالية</option>
              </select>
            </div>

            {ownerAccountType === 'monthly' && (
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">الشهر المالي:</label>
                <input
                  type="month"
                  value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                  onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/70 border border-[#D4A84F]/15 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none font-mono"
                />
              </div>
            )}

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

            <div className="flex items-center gap-2 flex-wrap">
              {onCleanDuplicateDues && (
                <button
                  onClick={() => onCleanDuplicateDues()}
                  disabled={isCleaningDuplicates}
                  className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="حذف الاستحقاقات المكررة مباشرة من قاعدة البيانات"
                >
                  <RefreshCw className={`w-4 h-4 ${isCleaningDuplicates ? 'animate-spin' : ''}`} />
                  <span>{isCleaningDuplicates ? 'جاري التنظيف...' : 'تنظيف التكرار من قاعدة البيانات'}</span>
                </button>
              )}
              <button
                onClick={() => handleOpenReportPreview('owner_statement')}
                className="px-4 py-2.5 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة التقرير</span>
              </button>
              <button
                onClick={() => handlePrintReportDirectly('owner_statement')}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير</span>
              </button>
            </div>
          </div>

          {/* Owner Account Statement Detailed Container */}
          {(() => {
            const {
              statementDues,
              ownerPropertyGroups,
              ownerTotalRentSum,
              ownerTotalCommissionSum,
              ownerTotalNetOwnerSum,
              ownerTotalDisbursedSum,
              ownerTotalCollectedSum,
              ownerTotalBalanceSum,
              ownerAdvancesDeducted,
              ownerExpensesDeducted,
              sumDeductedAdvances,
              sumDeductedExpenses,
              totalOwnerDeductions,
              finalNetSettlement,
              finalRemainingBalance,
              allOwnerPayouts,
            } = calculateOwnerStatementsData({
              dues: validDues,
              collections: collections || [],
              properties: properties || [],
              owners: owners || [],
              units: units || [],
              expenses: expenses || [],
              advances: advances || [],
              payouts: payouts || [],
              commissionStatuses: commissionStatuses || [],
              rentAdjustments: rentAdjustments || [],
              filters: {
                selectedPropertyId,
                selectedOwnerId,
                selectedMonthYear,
                ownerStatementsFilter: ownerStatementsFilter || 'all',
                ownerAccountType: ownerAccountType || 'monthly',
                todayISO,
                currentMonthISO,
              }
            });

            const currentOwnerObj = owners.find(o => o.id === selectedOwnerId);

            return (
              <div className="space-y-4">
                
                {/* Selected Owner Info & KPI Box */}
                {currentOwnerObj && (
                  <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/30 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">اسم المالك المعني:</span>
                      <h3 className="text-sm font-black text-[#F8F9FB]">{currentOwnerObj.name}</h3>
                      <p className="text-[11px] text-[#D4A84F]">هاتف: {currentOwnerObj.phone || 'غير مدخل'}</p>
                    </div>

                    <div className="space-y-1 font-mono">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">مستحقات الإيجار الصافية:</span>
                      <p className="text-base font-black text-[#D4A84F]">{ownerTotalNetOwnerSum.toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-[10px] text-emerald-400">تم صرفه: {ownerTotalDisbursedSum.toLocaleString('ar-EG')} ج.م</p>
                    </div>

                    <div className="space-y-1 font-mono">
                      <span className="text-[10px] text-rose-400 font-bold block">خصومات (سلف + مصروفات):</span>
                      <p className="text-base font-black text-rose-300">{totalOwnerDeductions.toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-[10px] text-[#9EA7B8]">سلف: {sumDeductedAdvances.toLocaleString('ar-EG')} | مصاريف: {sumDeductedExpenses.toLocaleString('ar-EG')}</p>
                    </div>

                    <div className="space-y-1 font-mono">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">صافي مستحق المالك النهائي:</span>
                      <p className="text-base font-black text-emerald-400">{finalNetSettlement.toLocaleString('ar-EG')} ج.م</p>
                      <p className="text-[10px] text-teal-300">بعد خصم جميع السلف والمصروفات</p>
                    </div>

                    <div className="space-y-1 font-mono">
                      <span className="text-[10px] text-[#9EA7B8] font-bold block">الرصيد المتبقي للصرف:</span>
                      <p className={`text-base font-black ${finalRemainingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {finalRemainingBalance.toLocaleString('ar-EG')} ج.م
                      </p>
                      <p className="text-[10px] text-purple-300">المحصل من المستأجرين: {ownerTotalCollectedSum.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                  </div>
                )}

                {/* Statement Table - Grouped per Property */}
                <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-[#D4A84F]/15 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#D4A84F]" />
                      <h3 className="text-xs font-black text-[#F8F9FB]">
                        كشف حساب المالك مجمع لكل عقار ({selectedOwnerId === 'all' ? 'جميع الملاك' : currentOwnerObj?.name}) - {selectedMonthYear === 'all' ? 'جميع الشهور' : selectedMonthYear}
                      </h3>
                    </div>
                    <span className="text-[10px] text-[#9EA7B8] font-mono font-bold">
                      عدد العقارات: {ownerPropertyGroups.length} | عدد الاستحقاقات: {statementDues.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                          <th className="p-3 text-center">#</th>
                          <th className="p-3">اسم العقار والمالك</th>
                          <th className="p-3 text-center">عدد المستأجرين</th>
                          <th className="p-3">إجمالي الإيجار</th>
                          <th className="p-3">عمولة المكتب</th>
                          <th className="p-3">صافي مستحق المالك</th>
                          <th className="p-3 text-rose-400 font-extrabold">السلف والمصروفات</th>
                          <th className="p-3">المصروف للمالك</th>
                          <th className="p-3">المحصل من المستأجرين</th>
                          <th className="p-3">الرصيد المتبقي</th>
                          <th className="p-3 text-center font-bold">إجراءات الصرف والتفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                        {ownerPropertyGroups.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="p-8 text-center text-[#9EA7B8]">
                              <Clock className="w-8 h-8 text-[#D4A84F]/40 mx-auto mb-2" />
                              <p className="text-xs font-bold">لا توجد بيانات كشف حساب مطابقة للشروط المختارة.</p>
                            </td>
                          </tr>
                        ) : (
                          ownerPropertyGroups.map((group, idx) => {
                            const isExpanded = expandedOwnerPropIds.has(group.propertyId);
                            const pendingDues = group.dues.filter(d => getDuePayoutStatus(d) !== 'paid_out');
                            const paidOutDues = group.dues.filter(d => getDuePayoutStatus(d) === 'paid_out');
                            const hasPendingDues = pendingDues.length > 0;
                            const hasPaidOutDues = paidOutDues.length > 0;

                            const groupDeductionsSum = group.totalDeductionsSum;
                            const netBalanceAfterDeductions = group.netBalanceAfterDeductions;

                            return (
                              <React.Fragment key={group.propertyId}>
                                <tr 
                                  onClick={() => toggleOwnerPropExpand(group.propertyId)}
                                  className="hover:bg-[#08111F]/60 transition-all cursor-pointer bg-[#132238]/40"
                                >
                                  <td className="p-3 text-center font-mono text-[#9EA7B8]">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPropertyPayoutsModalGroup({
                                            propertyId: group.propertyId,
                                            propertyName: group.propertyName,
                                            ownerId: group.ownerId,
                                            ownerName: group.ownerName,
                                            dues: group.dues
                                          });
                                        }}
                                        className="w-8 h-8 rounded-xl bg-[#08111F] hover:bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30 flex items-center justify-center transition-all cursor-pointer shadow-sm group shrink-0"
                                        title="عرض سندات الصرف المسجلة لهذا العقار والمالك"
                                      >
                                        <Building2 className="w-4 h-4 text-[#D4A84F] group-hover:scale-110 transition-transform" />
                                      </button>
                                      <div>
                                        <div className="font-extrabold text-[#F8F9FB] flex items-center gap-1.5">
                                          <span>{group.propertyName}</span>
                                        </div>
                                        <span className="text-[10px] text-[#D4A84F]">المالك: {group.ownerName}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className="px-2.5 py-1 rounded-lg bg-[#08111F] text-[#D4A84F] border border-[#D4A84F]/20 text-[11px] font-mono">
                                      {group.dues.length} استحقاق
                                    </span>
                                  </td>
                                  <td className="p-3 font-mono text-[#F8F9FB]">{group.totalRentSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-amber-400">{group.totalCommissionSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-[#D4A84F] font-extrabold">{group.totalNetOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-rose-400 font-extrabold">{groupDeductionsSum > 0 ? `${groupDeductionsSum.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                                  <td className="p-3 font-mono text-emerald-400">{group.totalDisbursedSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 font-mono text-emerald-300">{group.totalCollectedSum.toLocaleString('ar-EG')} ج.م</td>
                                  <td className={`p-3 font-mono font-extrabold ${netBalanceAfterDeductions > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {netBalanceAfterDeductions.toLocaleString('ar-EG')} ج.م
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      {/* زر سندات الصرف للعقار */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPropertyPayoutsModalGroup({
                                            propertyId: group.propertyId,
                                            propertyName: group.propertyName,
                                            ownerId: group.ownerId,
                                            ownerName: group.ownerName,
                                            dues: group.dues
                                          });
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl bg-[#D4A84F]/15 hover:bg-[#D4A84F]/25 text-[#D4A84F] border border-[#D4A84F]/30 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                                        title="عرض وطباعة كافة سندات الصرف المسجلة لهذا العقار والمالك"
                                      >
                                        <Receipt className="w-3.5 h-3.5 text-[#D4A84F]" />
                                        <span>سندات الصرف</span>
                                        {(() => {
                                          const propPayoutsCount = payouts.filter(p => p.propertyId === group.propertyId && (!p.ownerId || p.ownerId === group.ownerId) && p.status !== 'reverted' && !p.isCancelled).length;
                                          return propPayoutsCount > 0 ? (
                                            <span className="px-1.5 py-0.5 rounded-full bg-[#D4A84F] text-slate-950 text-[10px] font-black font-mono">
                                              {propPayoutsCount}
                                            </span>
                                          ) : null;
                                        })()}
                                      </button>

                                      {hasPendingDues ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenOwnerPropertyPayoutModal(group);
                                          }}
                                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md hover:shadow-emerald-500/20 border border-emerald-400/30 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                                          title="صرف مستحقات الإيجار للمالك بعد خصم العمولات"
                                        >
                                          <Wallet className="w-3.5 h-3.5 text-amber-300" />
                                          <span>{group.totalDisbursedSum > 0 ? 'صرف المتبقي' : 'صرف الإيجار'}</span>
                                        </button>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>تم الصرف</span>
                                        </span>
                                      )}

                                      {hasPaidOutDues && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRevertPropertyOwnerPayout(group);
                                          }}
                                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                                          title="الرجوع في عملية صرف الإيجار للمالك"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" />
                                          <span>الرجوع في الصرف</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleOwnerPropExpand(group.propertyId);
                                        }}
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer border ${
                                          isExpanded 
                                            ? 'bg-[#D4A84F] text-slate-950 border-[#D4A84F] shadow-md' 
                                            : 'bg-[#08111F] text-[#D4A84F] hover:bg-[#D4A84F]/20 border-[#D4A84F]/30'
                                        }`}
                                        title={isExpanded ? 'إخفاء المستأجرين' : 'عرض المستأجرين'}
                                      >
                                        <Users className="w-3.5 h-3.5" />
                                        <span>{isExpanded ? 'إخفاء' : 'المستأجرون'}</span>
                                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Expanded Tenant Information Sub-Table (No financial items/duplicates) */}
                                {isExpanded && (() => {
                                  const propertyUnits = units.filter(u => u.propertyId === group.propertyId);
                                  const propertyUnitIds = new Set(propertyUnits.map(u => u.id));

                                  const uniquePropertyTenantsMap = new Map<string, {
                                    id: string;
                                    fullName: string;
                                    unitDetails: string;
                                    unitNumber: string;
                                    contractStartDate: string;
                                    contractEndDate: string;
                                    statusLabel: string;
                                    statusBadgeColor: string;
                                    rentAmount: number;
                                    phone: string;
                                  }>();

                                  // 1. Process from tenants prop
                                  tenants.forEach(t => {
                                    const isMatchUnit = t.unitId && propertyUnitIds.has(t.unitId);
                                    const isMatchProperty = (t as any).propertyId === group.propertyId;
                                    const isMatchDues = group.dues.some(d => d.tenantId === t.id || d.tenantName === t.fullName);

                                    if (isMatchUnit || isMatchProperty || isMatchDues) {
                                      const matchedUnit = units.find(u => u.id === t.unitId) || 
                                        units.find(u => u.propertyId === group.propertyId && u.unitNumber === (t as any).unitNumber);

                                      let unitTypeLabel = 'شقة / وحدة سكنية';
                                      if (matchedUnit) {
                                        if (matchedUnit.activityType === 'commercial') unitTypeLabel = 'محل تجاري';
                                        else if (matchedUnit.activityType === 'administrative') unitTypeLabel = 'مكتب إداري';
                                        else if (matchedUnit.activityType === 'residential') unitTypeLabel = 'شقة سكنية';
                                      }

                                      const unitNum = matchedUnit?.unitNumber || (t as any).unitNumber || '';
                                      const unitDetails = unitNum ? `${unitTypeLabel} - رقم ${unitNum}` : unitTypeLabel;

                                      let statusLabel = 'نشط / ساري';
                                      let statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

                                      if (t.status === 'expired') {
                                        statusLabel = 'منتهي';
                                        statusBadgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                                      } else if (t.status === 'evicted') {
                                        statusLabel = 'مفسوخ / مخلى';
                                        statusBadgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                                      }

                                      const tenantKey = t.id || `${t.fullName}_${unitNum}`;
                                      const matchedDue = group.dues.find(d => d.tenantId === t.id);

                                      if (!uniquePropertyTenantsMap.has(tenantKey)) {
                                        uniquePropertyTenantsMap.set(tenantKey, {
                                          id: t.id,
                                          fullName: t.fullName,
                                          unitDetails,
                                          unitNumber: unitNum || '—',
                                          contractStartDate: t.contractStartDate || '—',
                                          contractEndDate: t.contractEndDate || '—',
                                          statusLabel,
                                          statusBadgeColor,
                                          rentAmount: matchedDue?.rentAmount || t.rentAmount || matchedUnit?.rentValue || 0,
                                          phone: t.phone || 'غير متاح',
                                        });
                                      }
                                    }
                                  });

                                  // 2. Fallback process from group.dues
                                  group.dues.forEach(d => {
                                    const tenantKey = d.tenantId || `${d.tenantName}_${d.unitNumber}`;

                                    if (!uniquePropertyTenantsMap.has(tenantKey) && d.tenantName) {
                                      const matchedTenant = tenants.find(t => t.id === d.tenantId || t.fullName === d.tenantName);
                                      const matchedUnit = units.find(u => u.id === d.unitId || (u.propertyId === group.propertyId && u.unitNumber === d.unitNumber));

                                      let unitTypeLabel = 'شقة / وحدة سكنية';
                                      if (matchedUnit) {
                                        if (matchedUnit.activityType === 'commercial') unitTypeLabel = 'محل تجاري';
                                        else if (matchedUnit.activityType === 'administrative') unitTypeLabel = 'مكتب إداري';
                                        else if (matchedUnit.activityType === 'residential') unitTypeLabel = 'شقة سكنية';
                                      }

                                      const unitNum = matchedUnit?.unitNumber || d.unitNumber || '';
                                      const unitDetails = unitNum ? `${unitTypeLabel} - رقم ${unitNum}` : unitTypeLabel;

                                      let statusLabel = 'نشط / ساري';
                                      let statusBadgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

                                      if (matchedTenant?.status === 'expired') {
                                        statusLabel = 'منتهي';
                                        statusBadgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                                      } else if (matchedTenant?.status === 'evicted') {
                                        statusLabel = 'مفسوخ / مخلى';
                                        statusBadgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                                      }

                                      uniquePropertyTenantsMap.set(tenantKey, {
                                        id: d.tenantId || d.id,
                                        fullName: matchedTenant?.fullName || d.tenantName,
                                        unitDetails,
                                        unitNumber: unitNum || '—',
                                        contractStartDate: matchedTenant?.contractStartDate || '—',
                                        contractEndDate: matchedTenant?.contractEndDate || '—',
                                        statusLabel,
                                        statusBadgeColor,
                                        rentAmount: d.rentAmount || matchedTenant?.rentAmount || matchedUnit?.rentValue || 0,
                                        phone: matchedTenant?.phone || 'غير متاح',
                                      });
                                    }
                                  });

                                  const uniqueTenantsList = Array.from(uniquePropertyTenantsMap.values());

                                  return (
                                    <tr className="bg-[#08111F]/90">
                                      <td colSpan={11} className="p-3">
                                        <div className="p-4 bg-[#132238]/80 rounded-xl border border-[#D4A84F]/20 space-y-4">
                                           {/* Section 1: Monthly Aggregated Rent for this Property */}
                                           <div className="space-y-2">
                                             <div className="flex items-center justify-between pb-2 border-b border-[#D4A84F]/15">
                                               <span className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                                                 <Calendar className="w-4 h-4 text-[#D4A84F]" />
                                                 <span>إجمالي القيمة الإيجارية شهرياً لعقار: <strong className="text-[#F8F9FB]">{group.propertyName}</strong></span>
                                                 <span className="px-2 py-0.5 rounded-full bg-[#D4A84F]/15 text-[#D4A84F] border border-[#D4A84F]/30 text-[10px] font-mono">
                                                   {group.dues.length} استحقاق
                                                 </span>
                                               </span>
                                               <span className="text-[10px] text-emerald-300 font-bold bg-[#08111F] px-2.5 py-1 rounded-lg border border-[#D4A84F]/10">
                                                 مجموع إيجار العقار لكل شهر بترتيب زمني
                                               </span>
                                             </div>

                                             <div className="overflow-x-auto rounded-lg border border-[#D4A84F]/10">
                                               <table className="w-full text-right text-xs">
                                                 <thead>
                                                   <tr className="bg-[#08111F] text-[#9EA7B8] font-bold border-b border-[#D4A84F]/15 text-[11px]">
                                                     <th className="p-2.5 text-center w-10">#</th>
                                                     <th className="p-2.5">الشهر المالي</th>
                                                     <th className="p-2.5 text-center">عدد المستأجرين</th>
                                                     <th className="p-2.5">إجمالي إيجار العقار</th>
                                                     <th className="p-2.5">الإيجار المحصل</th>
                                                     <th className="p-2.5">عمولة المكتب</th>
                                                     <th className="p-2.5">صافي مستحق المالك</th>
                                                     <th className="p-2.5 text-rose-400 font-extrabold">السلف والمصروفات</th>
                                                     <th className="p-2.5">المصروف للمالك</th>
                                                     <th className="p-2.5">الرصيد المتبقي</th>
                                                     <th className="p-2.5 text-center">حالة الصرف</th>
                                                   </tr>
                                                 </thead>
                                                 <tbody className="divide-y divide-white/5 font-bold">
                                                   {group.months.map((m, mIdx) => {
                                                     const remBal = m.remainingBalance;
                                                     let statusBadge = 'لم يُصرف';
                                                     let statusBadgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                                                     if (m.paidOutCount === m.tenantCount && m.tenantCount > 0) {
                                                       statusBadge = 'صُرف بالكامل';
                                                       statusBadgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                                                     } else if (m.disbursedSum > 0 || m.paidOutCount > 0) {
                                                       statusBadge = 'صُرف جزئياً';
                                                       statusBadgeColor = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                                                     }

                                                     return (
                                                       <tr key={m.forMonthYear} className="hover:bg-white/5 transition-colors">
                                                         <td className="p-2.5 text-center font-mono text-[#9EA7B8] text-[11px]">{mIdx + 1}</td>
                                                         <td className="p-2.5 font-bold text-[#F8F9FB] font-mono">{m.monthNameAr || m.forMonthYear}</td>
                                                         <td className="p-2.5 text-center font-mono text-[#D4A84F]">{m.tenantCount} مستأجر</td>
                                                         <td className="p-2.5 font-mono text-[#F8F9FB] font-black">{m.rentSum.toLocaleString('ar-EG')} ج.م</td>
                                                         <td className="p-2.5 font-mono text-emerald-400 font-bold">{m.collectedSum.toLocaleString('ar-EG')} ج.م</td>
                                                         <td className="p-2.5 font-mono text-amber-400">{m.commissionSum.toLocaleString('ar-EG')} ج.م</td>
                                                         <td className="p-2.5 font-mono text-[#D4A84F] font-black">{m.netOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                                                         <td className="p-2.5 font-mono text-rose-400 font-extrabold">{m.totalDeductionsSum > 0 ? `-${m.totalDeductionsSum.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                                                         <td className="p-2.5 font-mono text-teal-300">{m.disbursedSum.toLocaleString('ar-EG')} ج.م</td>
                                                         <td className="p-2.5 font-mono text-rose-300">{remBal.toLocaleString('ar-EG')} ج.م</td>
                                                         <td className="p-2.5 text-center">
                                                           <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadgeColor}`}>
                                                             {statusBadge}
                                                           </span>
                                                         </td>
                                                       </tr>
                                                     );
                                                   })}
                                                 </tbody>
                                               </table>
                                             </div>
                                           </div>
                                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#D4A84F]/15">
                                            <span className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                                              <Users className="w-4 h-4 text-[#D4A84F]" />
                                              <span>قائمة مستأجري عقار: <strong className="text-[#F8F9FB]">{group.propertyName}</strong></span>
                                              <span className="px-2 py-0.5 rounded-full bg-[#D4A84F]/15 text-[#D4A84F] border border-[#D4A84F]/30 text-[10px] font-mono">
                                                {uniqueTenantsList.length} مستأجر
                                              </span>
                                            </span>
                                            <span className="text-[10px] text-[#9EA7B8] font-bold bg-[#08111F] px-2.5 py-1 rounded-lg border border-[#D4A84F]/10">
                                              📋 بيانات المستأجرين والعقود من سجلات العقارات والعقود الحالية
                                            </span>
                                          </div>

                                          <div className="overflow-x-auto rounded-lg border border-[#D4A84F]/10">
                                            <table className="w-full text-right text-xs">
                                              <thead>
                                                <tr className="bg-[#08111F] text-[#9EA7B8] font-bold border-b border-[#D4A84F]/15 text-[11px]">
                                                  <th className="p-2.5 text-center w-10">#</th>
                                                  <th className="p-2.5">اسم المستأجر</th>
                                                  <th className="p-2.5">بيانات الوحدة</th>
                                                  <th className="p-2.5 text-center">بداية العقد</th>
                                                  <th className="p-2.5 text-center">نهاية العقد</th>
                                                  <th className="p-2.5 text-center">حالة العقد</th>
                                                  <th className="p-2.5 text-center">قيمة الإيجار</th>
                                                  <th className="p-2.5 text-center">رقم الهاتف</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-white/5 font-bold">
                                                {uniqueTenantsList.length === 0 ? (
                                                  <tr>
                                                    <td colSpan={8} className="p-6 text-center text-[#9EA7B8]">
                                                      <Users className="w-8 h-8 text-[#D4A84F]/30 mx-auto mb-2" />
                                                      <p className="text-xs font-bold text-[#F8F9FB]">لا يوجد مستأجرون مسجلون لهذا العقار حالياً.</p>
                                                    </td>
                                                  </tr>
                                                ) : (
                                                  uniqueTenantsList.map((t, tIdx) => (
                                                    <tr key={t.id || tIdx} className="hover:bg-white/5 transition-colors">
                                                      <td className="p-2.5 text-center font-mono text-[#9EA7B8] text-[11px]">{tIdx + 1}</td>
                                                      <td className="p-2.5 font-bold text-[#F8F9FB]">{t.fullName}</td>
                                                      <td className="p-2.5 text-[#D4A84F] font-bold">{t.unitDetails}</td>
                                                      <td className="p-2.5 text-center font-mono text-[#9EA7B8] text-[11px]">{t.contractStartDate}</td>
                                                      <td className="p-2.5 text-center font-mono text-[#9EA7B8] text-[11px]">{t.contractEndDate}</td>
                                                      <td className="p-2.5 text-center">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${t.statusBadgeColor}`}>
                                                          {t.statusLabel}
                                                        </span>
                                                      </td>
                                                      <td className="p-2.5 text-center font-mono text-emerald-400 font-black">
                                                        {t.rentAmount.toLocaleString('ar-EG')} ج.م
                                                      </td>
                                                      <td className="p-2.5 text-center font-mono text-[#F8F9FB] text-[11px]">
                                                        {t.phone || 'غير متاح'}
                                                      </td>
                                                    </tr>
                                                  ))
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </React.Fragment>
                            );
                          })
                        )}

                        {/* Totals Summary Row */}
                        {statementDues.length > 0 && (
                          <tr className="bg-[#08111F] text-[#F8F9FB] font-black border-t-2 border-[#D4A84F]/30 text-xs">
                            <td colSpan={3} className="p-3 text-left text-[#D4A84F]">إجمالي كشف حساب العقارات:</td>
                            <td className="p-3 font-mono text-[#F8F9FB]">{ownerTotalRentSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-amber-400">{ownerTotalCommissionSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-[#D4A84F] text-sm">{ownerTotalNetOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-rose-400 font-extrabold">{totalOwnerDeductions > 0 ? `${totalOwnerDeductions.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                            <td className="p-3 font-mono text-emerald-400">{ownerTotalDisbursedSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-emerald-300">{ownerTotalCollectedSum.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 font-mono text-amber-400 text-sm font-black">{finalRemainingBalance.toLocaleString('ar-EG')} ج.م</td>
                            <td className="p-3 text-center text-[#D4A84F] font-mono">{ownerPropertyGroups.length} عقارات</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Deductions Table (Solf & Expenses) */}
                {(ownerAdvancesDeducted.length > 0 || ownerExpensesDeducted.length > 0) && (
                  <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-rose-500/20 overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-rose-500/5">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-rose-400" />
                        <h3 className="text-xs font-black text-rose-300">
                          الخصومات والتسويات المعتمدة للمالك (السُلف والمصروفات)
                        </h3>
                      </div>
                      <span className="text-[10px] text-rose-300 font-mono font-bold bg-[#08111F] px-2.5 py-1 rounded-lg border border-rose-500/20">
                        إجمالي المخصوم فعلياً من المستحق: {totalOwnerDeductions.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-[#08111F]/80 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/10">
                            <th className="p-3 text-center w-10">#</th>
                            <th className="p-3">نوع المعاملة</th>
                            <th className="p-3 text-center">طريقة الخصم / السداد</th>
                            <th className="p-3">العقار</th>
                            <th className="p-3">البيان / السبب</th>
                            <th className="p-3 text-center">تاريخ المعاملة</th>
                            <th className="p-3 text-center">المبلغ</th>
                            <th className="p-3 text-center">الأثر المالي</th>
                            <th className="p-3 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D4A84F]/10 text-[#F8F9FB]">
                          {ownerAdvancesDeducted.map((adv, idx) => {
                            const isEntitlement = isAdvanceDeductedFromEntitlement(adv);
                            const dedAmt = getAdvanceDeductedAmount(adv) || adv.amount || 0;
                            const methodLabel = adv.deductionMethod || (isEntitlement ? 'خصم من المستحق' : 'سداد نقدي');
                            return (
                              <tr key={`adv-${adv.id}`} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{idx + 1}</td>
                                <td className="p-3 font-bold text-amber-400">سلفة مالك عاجلة</td>
                                <td className="p-3 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                    isEntitlement 
                                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' 
                                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  }`}>
                                    {methodLabel}
                                  </span>
                                </td>
                                <td className="p-3 font-bold">{adv.propertyName || 'عقار مرتبط'}</td>
                                <td className="p-3 text-[#9EA7B8] text-[11px]">{adv.notes || 'سلفة مالك'}</td>
                                <td className="p-3 text-center font-mono text-[11px]">{adv.deductedAt || adv.advanceDate}</td>
                                <td className="p-3 text-center font-mono font-black text-[#F8F9FB]">
                                  {dedAmt.toLocaleString('ar-EG')} ج.م
                                </td>
                                <td className="p-3 text-center font-mono font-black">
                                  {isEntitlement ? (
                                    <span className="text-rose-400">-{dedAmt.toLocaleString('ar-EG')} ج.م (خصم من المستحق)</span>
                                  ) : (
                                    <span className="text-emerald-400">سداد نقدي (لا يخصم من المستحق)</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleRevertAdvanceDeduction(adv)}
                                    className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                  >
                                    الرجوع عن الخصم
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {ownerExpensesDeducted.map((exp, idx) => (
                            <tr key={`exp-${exp.id}`} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{ownerAdvancesDeducted.length + idx + 1}</td>
                              <td className="p-3 font-bold text-sky-400">مصروف عقار ({exp.category})</td>
                              <td className="p-3 text-center">
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-rose-500/15 text-rose-300 border-rose-500/30">
                                  خصم من المستحق
                                </span>
                              </td>
                              <td className="p-3 font-bold">{exp.propertyName || 'عقار مرتبط'}</td>
                              <td className="p-3 text-[#9EA7B8] text-[11px]">{exp.description || 'صيانة ومصروفات'}</td>
                              <td className="p-3 text-center font-mono text-[11px]">{exp.deductedAt || exp.expenseDate}</td>
                              <td className="p-3 text-center font-mono font-black text-[#F8F9FB]">
                                {(exp.amount || 0).toLocaleString('ar-EG')} ج.م
                              </td>
                              <td className="p-3 text-center font-mono font-black text-rose-400">
                                -{(exp.amount || 0).toLocaleString('ar-EG')} ج.م (خصم من المستحق)
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleRevertExpenseDeduction(exp)}
                                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                >
                                  الرجوع عن الخصم
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Section 4: Approved Payout Vouchers Table (سندات الصرف المعتمدة للمالك) */}
                {allOwnerPayouts && allOwnerPayouts.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#D4A84F]/20">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-emerald-400" />
                        <h4 className="text-xs sm:text-sm font-black text-[#F8F9FB]">
                          سندات الصرف المعتمدة والمنفذة للمالك ({allOwnerPayouts.filter(p => p.status !== 'reverted' && !p.isCancelled).length} سند)
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-black text-emerald-300 bg-[#08111F] px-3 py-1 rounded-xl border border-emerald-500/30">
                          إجمالي المنصرف الفعلي: {allOwnerPayouts.filter(p => p.status !== 'reverted' && !p.isCancelled).reduce((sum, p) => sum + (p.netAmountPaid || 0), 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-emerald-500/20 bg-[#08111F]/70">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-[#08111F] text-[#9EA7B8] font-bold border-b border-emerald-500/20 text-[11px]">
                            <th className="p-3 text-center w-10">#</th>
                            <th className="p-3">رقم السند</th>
                            <th className="p-3">العقار</th>
                            <th className="p-3 text-center">تاريخ الصرف</th>
                            <th className="p-3 text-center font-black text-emerald-300">مبلغ الصرف المنصرف</th>
                            <th className="p-3 text-center">طريقة الصرف</th>
                            <th className="p-3">رقم المعاملة / المحفظة</th>
                            <th className="p-3">بيان الصرف</th>
                            <th className="p-3 text-center">المسؤول</th>
                            <th className="p-3 text-center">الحالة</th>
                            <th className="p-3 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-bold">
                          {allOwnerPayouts.map((p, pIdx) => {
                            const isReverted = p.status === 'reverted' || p.isCancelled;
                            const matchedProp = properties.find(prop => prop.id === p.propertyId);

                            let methodBadge = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
                            if (p.paymentMethod === 'نقدي') {
                              methodBadge = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                            } else if (p.paymentMethod === 'اتصالات كاش') {
                              methodBadge = 'bg-lime-500/15 text-lime-300 border-lime-500/30';
                            } else if (p.paymentMethod === 'فودافون كاش') {
                              methodBadge = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                            }

                            return (
                              <tr key={p.id || pIdx} className={`hover:bg-white/[0.02] transition-colors ${isReverted ? 'opacity-50 line-through' : ''}`}>
                                <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{pIdx + 1}</td>
                                <td className="p-3 font-mono font-bold text-[#D4A84F]">
                                  {p.receiptNumber || `PAY-${p.id.slice(-6)}`}
                                </td>
                                <td className="p-3 font-bold text-[#F8F9FB]">
                                  {matchedProp?.name || p.propertyId || 'عقار مرتبط'}
                                </td>
                                <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">
                                  {p.payoutDate || '—'}
                                </td>
                                <td className="p-3 text-center font-mono font-black text-emerald-400 text-sm">
                                  {(p.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border ${methodBadge}`}>
                                    {p.paymentMethod || 'تحويل بنكي'}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-[11px] text-[#9EA7B8]">
                                  {p.bankTransactionRef || '—'}
                                </td>
                                <td className="p-3 text-[#9EA7B8] text-[11px] max-w-[200px] truncate" title={p.notes}>
                                  {p.notes || 'صرف مستحقات إيجار للمالك'}
                                </td>
                                <td className="p-3 text-center text-[11px] text-[#9EA7B8]">
                                  {p.createdBy || 'النظام'}
                                </td>
                                <td className="p-3 text-center">
                                  {isReverted ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                      ملغى / متراجع عنه
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      معتمد ونافذ
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {!isReverted && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevertSinglePayout(p)}
                                      disabled={isSavingOwnerPropertyPayout}
                                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 mx-auto disabled:opacity-50 shadow-sm"
                                      title="إلغاء هذا السند وإعادة المبلغ فوراً لمستحقات المالك"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>الرجوع عن السند</span>
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
                )}

              </div>
            );
          })()}

        </div>
      )}

      {/* VIEW 6: كشف حساب المستأجرين (TENANT STATEMENTS) */}
      {currentTab === 'tenant_statements' && (
        <div className="space-y-5">
          
          {/* Top Section View Selector: Overall Tenants Statement vs Individual Per-Tenant Statement */}
          <div className="bg-gradient-to-r from-[#132238] via-[#1A2E4A] to-[#132238] border border-[#D4A84F]/30 p-2.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-2 p-1 bg-[#08111F]/90 rounded-xl border border-[#D4A84F]/20 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setSelectedTenantId('all')}
                className={`flex-1 md:flex-initial px-5 py-2.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedTenantId === 'all'
                    ? 'bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 shadow-lg shadow-[#D4A84F]/25 scale-[1.01]'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>📊 كشف حساب المستأجرين إجمالاً (الكشف المجمع)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedTenantId === 'all') {
                    const availableTenants = tenants.filter(t => {
                      if (selectedPropertyId === 'all') return true;
                      if (t.propertyId && t.propertyId === selectedPropertyId) return true;
                      const u = units.find(unit => unit.id === t.unitId);
                      return u?.propertyId === selectedPropertyId;
                    });
                    if (availableTenants.length > 0) {
                      setSelectedTenantId(availableTenants[0].id);
                    }
                  }
                }}
                className={`flex-1 md:flex-initial px-5 py-2.5 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  selectedTenantId !== 'all'
                    ? 'bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 shadow-lg shadow-[#D4A84F]/25 scale-[1.01]'
                    : 'text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-white/5'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>👤 كشف حساب لكل مستأجر على حدة (الكشف التفصيلي)</span>
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 text-xs font-bold text-[#9EA7B8]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>الوضع الحالي:</span>
              <span className="text-[#D4A84F] font-black bg-[#08111F]/90 px-3 py-1 rounded-xl border border-[#D4A84F]/20">
                {selectedTenantId === 'all' ? 'الكشف الإجمالي المجمع لجميع المستأجرين' : 'كشف حساب تفصيلي لمستأجر محدد'}
              </span>
            </div>
          </div>

          {/* Top Filter Bar with Date Range Selector & Controls */}
          <div className="bg-[#132238]/80 backdrop-blur-md p-4 rounded-2xl border border-[#D4A84F]/20 space-y-4 shadow-xl relative z-30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Property Selector (اختر العقار) */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر العقار:</label>
                <select
                  value={selectedPropertyId}
                  onChange={e => {
                    const newPropId = e.target.value;
                    setSelectedPropertyId(newPropId);
                    if (newPropId !== 'all') {
                      const matchingTenants = tenants.filter(t => {
                        if (t.propertyId && t.propertyId === newPropId) return true;
                        const u = units.find(unit => unit.id === t.unitId);
                        return u?.propertyId === newPropId;
                      });
                      if (!matchingTenants.some(t => t.id === selectedTenantId)) {
                        setSelectedTenantId('all');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                >
                  <option value="all">جميع العقارات ({properties.length})</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Tenant Selector (اختر المستأجر) */}
              <SearchableTenantDropdown
                tenants={tenants}
                properties={properties}
                units={units}
                selectedTenantId={selectedTenantId}
                onSelectTenant={setSelectedTenantId}
                selectedPropertyId={selectedPropertyId}
                label="اختر المستأجر:"
                placeholder="بحث باسم المستأجر، الوحدة، الهاتف..."
              />

              {/* 3. Date Range Selector: From Month (من شهر/سنة) */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">من شهر/سنة:</label>
                <input
                  type="month"
                  value={tenantFromMonth}
                  onChange={e => setTenantFromMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                />
              </div>

              {/* 4. Date Range Selector: To Month (إلى شهر/سنة) */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">إلى شهر/سنة:</label>
                <input
                  type="month"
                  value={tenantToMonth}
                  onChange={e => setTenantToMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                />
              </div>

              {/* 5. Payment Status Filter (حالة السداد) */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">حالة السداد:</label>
                <select
                  value={collectionFilter}
                  onChange={e => setCollectionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="paid">تم التحصيل ✅</option>
                  <option value="unpaid">لم يتم التحصيل ⏳</option>
                  <option value="overdue">متأخر عن السداد ⚠️</option>
                </select>
              </div>
            </div>

            {/* Actions, Sorting & Filter Reset Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D4A84F]/15">
              <div className="flex flex-wrap items-center gap-2">
                {selectedTenantId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedTenantId('all')}
                    className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-[1.02]"
                    title="الرجوع إلى كشف حساب كافة المستأجرين"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>الرجوع لكافة المستأجرين</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTenantFromMonth('');
                    setTenantToMonth('');
                    setSelectedMonthYear('all');
                    setCollectionFilter('all');
                    setTenantSortOrder('asc');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#9EA7B8] hover:text-[#F8F9FB] text-xs font-bold transition-all cursor-pointer border border-white/5"
                >
                  إعادة ضبط الفلاتر
                </button>

                {/* Sort Order Toggle */}
                <button
                  type="button"
                  onClick={() => setTenantSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1.5 rounded-xl bg-[#08111F]/90 hover:bg-[#08111F] text-[#D4A84F] border border-[#D4A84F]/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  title="تغيير ترتيب السجلات الزمني"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>الترتيب: {tenantSortOrder === 'asc' ? 'من الأقدم للأحدث' : 'من الأحدث للأقدم'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenReportPreview('tenant_statement')}
                  className="px-4 py-2 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-2 cursor-pointer"
                  title="اطلاع ومعاينة تقرير كشف حساب المستأجر"
                >
                  <Eye className="w-4 h-4 text-[#D4A84F]" />
                  <span>اطلاع على كشف الحساب</span>
                </button>
                <button
                  onClick={() => handlePrintReportDirectly('tenant_statement')}
                  className="px-4 py-2 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
                  title="طباعة تقرير كشف حساب المستأجر"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>طباعة كشف الحساب</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tenant Financial Statement Main Content */}
          {(() => {
            const currentMonthISO = new Date().toISOString().slice(0, 7);

            // Filter dues according to selection and matching rules
            const filteredTenantDues = validDues.filter(d => {
              const matchesProperty = selectedPropertyId === 'all' || d.propertyId === selectedPropertyId;
              const matchesTenant = selectedTenantId === 'all' 
                ? matchesProperty 
                : d.tenantId === selectedTenantId;

              const tenantObj = selectedTenantId !== 'all' ? tenants.find(t => t.id === selectedTenantId) : null;
              const tenantRegMonthISO = tenantObj?.createdAt 
                ? tenantObj.createdAt.slice(0, 7) 
                : (tenantObj?.contractStartDate ? tenantObj.contractStartDate.slice(0, 7) : '');

              const matchesMonth = selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear;
              const matchesFromMonth = tenantFromMonth 
                ? (d.forMonthYear && d.forMonthYear >= tenantFromMonth)
                : (!tenantRegMonthISO || (d.forMonthYear && d.forMonthYear >= tenantRegMonthISO));
              const matchesToMonth = !tenantToMonth || (d.forMonthYear && d.forMonthYear <= tenantToMonth);

              const activeCollections = collections.filter(c => c.status !== 'reverted' && !c.isCancelled);

              // Import matching collection receipt from re_collections (collections array) or due object
              const matchingCollection = activeCollections.find(c => 
                c.tenantId === d.tenantId &&
                (c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
              );

              const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
              const isCollected = (cStatus === 'collected' || cStatus === 'prepaid') && ((d.collectedAmount || 0) > 0 || (matchingCollection?.amountPaid || 0) > 0);

              // Rule: Include all past/current months (up to current month) AND ONLY paid reserve/future months
              const isCurrentOrPast = !d.forMonthYear || d.forMonthYear <= currentMonthISO;
              const isPaidReserveFuture = d.forMonthYear && d.forMonthYear > currentMonthISO && isCollected;

              const matchesTimeFrame = tenantToMonth 
                ? (matchesFromMonth && matchesToMonth) 
                : (matchesFromMonth && (isCurrentOrPast || isPaidReserveFuture));

              let matchesStatus = true;
              if (collectionFilter === 'paid') matchesStatus = isCollected;
              if (collectionFilter === 'unpaid') matchesStatus = !isCollected;
              if (collectionFilter === 'overdue') matchesStatus = cStatus === 'overdue' && !isCollected;

              return matchesProperty && matchesTenant && matchesMonth && matchesTimeFrame && matchesStatus;
            });

            // Sort chronologically (asc) first to compute exact running balance
            const sortedAscDues = [...filteredTenantDues].sort((a, b) => (a.forMonthYear || '').localeCompare(b.forMonthYear || ''));

            let sumRequired = 0;
            let sumCollected = 0;
            let sumRemaining = 0;
            let countPaidMonths = 0;
            let countUnpaidMonths = 0;

            let cumulativeBalance = 0;
            const duesWithCalculatedBalances = sortedAscDues.map(d => {
              const activeCollections = collections.filter(c => c.status !== 'reverted' && !c.isCancelled);
              // Import matching collection receipt from re_collections (collections array) or due object
              const matchingCollection = activeCollections.find(c => 
                c.tenantId === d.tenantId &&
                (c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
              );
              const revertedCollection = collections.find(c => 
                (c.status === 'reverted' || c.isCancelled) &&
                c.tenantId === d.tenantId &&
                (c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
              );

              const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
              const isCollected = (cStatus === 'collected' || cStatus === 'prepaid') && ((d.collectedAmount || 0) > 0 || (matchingCollection?.amountPaid || 0) > 0);
              const paidAmt = isCollected ? (matchingCollection?.amountPaid ?? (d.collectedAmount || d.rentAmount)) : 0;
              const remainingAmt = Math.max(0, d.rentAmount - paidAmt);
              const paidDateVal = isCollected ? (matchingCollection?.paymentDate || d.paidDate || '') : '';
              const receiptNoVal = isCollected ? (matchingCollection?.receiptNumber || d.receiptNumber || '') : '';
              const paymentMethodVal = isCollected ? (matchingCollection?.paymentMethod || d.paymentMethod || '') : '';

              sumRequired += d.rentAmount;
              sumCollected += paidAmt;
              sumRemaining += remainingAmt;

              if (isCollected || paidAmt >= d.rentAmount) {
                countPaidMonths++;
              } else {
                countUnpaidMonths++;
              }

              let computedStatus: 'collected' | 'partial' | 'unpaid' = 'unpaid';
              if (isCollected || remainingAmt === 0) {
                computedStatus = 'collected';
              } else if (paidAmt > 0 && remainingAmt > 0) {
                computedStatus = 'partial';
              } else {
                computedStatus = 'unpaid';
              }

              cumulativeBalance += remainingAmt;

              return {
                ...d,
                cStatus,
                isCollected,
                revertedCollection,
                paidAmt,
                paidDate: paidDateVal,
                receiptNumber: receiptNoVal,
                paymentMethod: paymentMethodVal,
                remainingAmt,
                computedStatus,
                runningBalance: cumulativeBalance
              };
            });

            // Apply selected display sort order (asc / desc)
            const finalDisplayDues = tenantSortOrder === 'desc' 
              ? [...duesWithCalculatedBalances].reverse() 
              : duesWithCalculatedBalances;

            const currentTenantObj = tenants.find(t => t.id === selectedTenantId);
            const currentTenantUnit = units.find(u => u.id === currentTenantObj?.unitId);
            const currentTenantProp = properties.find(p => p.id === (currentTenantObj?.propertyId || currentTenantUnit?.propertyId));
            const currentTenantOwner = owners.find(o => o.id === (currentTenantProp?.ownerId || (currentTenantUnit as any)?.ownerId));
            const ownerNameStr = currentTenantOwner?.name || 'غير محدد';

            const tenantUncollectedDues = filteredTenantDues.filter(d => getDueCollectionStatus(d, todayISO, currentMonthISO, collections) !== 'collected');
            const overdueMonthsCount = tenantUncollectedDues.length;

            let tenantStatusText = 'منتظم بالسداد';
            let tenantStatusClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
            if (overdueMonthsCount >= 3) {
              tenantStatusText = 'متعثر عن السداد 🚨';
              tenantStatusClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
            } else if (overdueMonthsCount >= 1) {
              tenantStatusText = 'توجد متأخرات ⚠️';
              tenantStatusClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            }

            const monthlyRentVal = currentTenantObj?.rentAmount || currentTenantUnit?.rentValue || (filteredTenantDues[0]?.rentAmount || 0);
            const tenantRegMonthISO = currentTenantObj?.createdAt 
              ? currentTenantObj.createdAt.slice(0, 7) 
              : (currentTenantObj?.contractStartDate ? currentTenantObj.contractStartDate.slice(0, 7) : '—');
            const accountingPeriodStr = currentTenantObj 
              ? `من ${tenantRegMonthISO} (تاريخ القيد بالنظام) إلى ${currentMonthISO} (مستحق السداد)`
              : '—';

            return (
              <div className="space-y-5">
                
                {/* 1. TOP PROFILE INFORMATION CARD (بطاقة معلومات المستأجر والعقار) */}
                {currentTenantObj ? (
                  <div className="bg-gradient-to-b from-[#132238] to-[#0D1828] border border-[#D4A84F]/30 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
                    {/* Background Subtle Accent */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-[#D4A84F]/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D4A84F]/15 pb-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedTenantId('all')}
                          className="px-3 py-2 rounded-xl bg-[#08111F] hover:bg-[#132238] text-[#D4A84F] border border-[#D4A84F]/30 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md hover:border-[#D4A84F] shrink-0"
                          title="الرجوع إلى كشف حساب كافة المستأجرين"
                        >
                          <ArrowRight className="w-4 h-4" />
                          <span>رجوع</span>
                        </button>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4A84F]/25 to-[#D4A84F]/5 border border-[#D4A84F]/40 flex items-center justify-center text-[#D4A84F] shadow-lg shrink-0">
                          <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-xl font-black text-[#F8F9FB] tracking-tight">{currentTenantObj.fullName}</h2>
                            <span className={`px-3 py-0.5 rounded-full text-[11px] font-black border ${tenantStatusClass}`}>
                              {tenantStatusText}
                            </span>
                          </div>
                          <p className="text-xs text-[#9EA7B8] font-bold mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#D4A84F]" /> <span className="font-mono text-[#F8F9FB]">{currentTenantObj.phone || '—'}</span></span>
                            <span>•</span>
                            <span>العقد: <span className="font-mono text-[#D4A84F]">{currentTenantObj.contractNumber || 'ساري'}</span></span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-[#08111F]/90 px-4 py-2 rounded-2xl border border-[#D4A84F]/25 text-left shrink-0">
                          <span className="text-[10px] text-[#9EA7B8] block font-bold mb-0.5">القيمة الإيجارية الشهرية</span>
                          <span className="text-base sm:text-lg font-black font-mono text-[#D4A84F]">
                            {monthlyRentVal.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenReportPreview('tenant_statement')}
                            className="px-3.5 py-2 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-1.5 cursor-pointer"
                            title="اطلاع ومعاينة تقرير كشف حساب المستأجر"
                          >
                            <Eye className="w-4 h-4 text-[#D4A84F]" />
                            <span>اطلاع</span>
                          </button>
                          <button
                            onClick={() => handlePrintReportDirectly('tenant_statement')}
                            className="px-3.5 py-2 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-1.5 cursor-pointer"
                            title="طباعة تقرير كشف حساب المستأجر"
                          >
                            <Printer className="w-4 h-4 text-slate-950" />
                            <span>طباعة</span>
                          </button>

                        </div>
                      </div>
                    </div>

                    {/* 7 Required Profile Detail Items Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">اسم المستأجر</span>
                        <span className="text-[#F8F9FB] font-black block truncate" title={currentTenantObj.fullName}>{currentTenantObj.fullName}</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">رقم الهاتف</span>
                        <span className="text-[#F8F9FB] font-mono font-bold block">{currentTenantObj.phone || '—'}</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">اسم العقار</span>
                        <span className="text-[#D4A84F] font-black block truncate" title={currentTenantProp?.name}>{currentTenantProp?.name || '—'}</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">رقم الوحدة</span>
                        <span className="text-[#F8F9FB] font-mono font-black block">وحدة {currentTenantUnit?.unitNumber || '—'}</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">اسم المالك</span>
                        <span className="text-[#F8F9FB] font-black block truncate" title={ownerNameStr}>{ownerNameStr}</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">مدة المحاسبة</span>
                        <span className="font-mono text-[#F8F9FB] text-[11px] font-bold block truncate" title={accountingPeriodStr}>{accountingPeriodStr}</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">الإيجار الشهري</span>
                        <span className="font-mono text-emerald-400 font-black block">{monthlyRentVal.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-b from-[#132238] to-[#0D1828] border border-[#D4A84F]/30 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
                    {/* Background Subtle Accent */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-[#D4A84F]/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D4A84F]/15 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4A84F]/25 to-[#D4A84F]/5 border border-[#D4A84F]/40 flex items-center justify-center text-[#D4A84F] shadow-lg shrink-0">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-xl font-black text-[#F8F9FB] tracking-tight">
                              📊 كشف حساب المستأجرين إجمالاً (الكشف المجمع)
                            </h2>
                            <span className="px-3 py-0.5 rounded-full text-[11px] font-black border bg-amber-500/15 text-[#D4A84F] border-[#D4A84F]/30">
                              تقرير إجمالي مجمع ({tenants.length} مستأجر)
                            </span>
                          </div>
                          <p className="text-xs text-[#9EA7B8] font-bold mt-1">
                            {selectedPropertyId === 'all' 
                              ? `ملخص وإجمالي القيود المالية لجميع مستأجري العقارات (${tenants.length} مستأجر)`
                              : `ملخص وإجمالي المستأجرين لعقار: ${properties.find(p => p.id === selectedPropertyId)?.name}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenReportPreview('tenant_statement')}
                          className="px-3.5 py-2 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-1.5 cursor-pointer"
                          title="معاينة تقرير كشف حساب المستأجرين إجمالاً"
                        >
                          <Eye className="w-4 h-4 text-[#D4A84F]" />
                          <span>معاينة الكشف الإجمالي</span>
                        </button>
                        <button
                          onClick={() => handlePrintReportDirectly('tenant_statement')}
                          className="px-3.5 py-2 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-1.5 cursor-pointer"
                          title="طباعة تقرير كشف حساب المستأجرين إجمالاً"
                        >
                          <Printer className="w-4 h-4 text-slate-950" />
                          <span>طباعة الكشف الإجمالي</span>
                        </button>
                      </div>
                    </div>

                    {/* Overall Quick Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">إجمالي المستأجرين النشطين</span>
                        <span className="text-[#F8F9FB] font-mono font-black text-sm block">{tenants.length} مستأجر</span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">العقارات المغطاة</span>
                        <span className="text-[#D4A84F] font-bold block truncate">
                          {selectedPropertyId === 'all' ? `جميع العقارات (${properties.length})` : properties.find(p => p.id === selectedPropertyId)?.name}
                        </span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">إجمالي الإيجارات الشهرية</span>
                        <span className="text-[#F8F9FB] font-mono font-black text-sm block">
                          {tenants.reduce((acc, t) => {
                            const tDues = validDues.filter(d => d.tenantId === t.id);
                            const latest = tDues.length > 0 ? tDues[tDues.length - 1] : null;
                            return acc + (latest?.rentAmount || t.rentAmount || 0);
                          }, 0).toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>

                      <div className="bg-[#08111F]/70 p-3 rounded-xl border border-[#D4A84F]/15 space-y-1">
                        <span className="text-[10px] text-[#9EA7B8] font-bold block">نسبة التحصيل العامة</span>
                        <span className="text-emerald-400 font-mono font-black text-sm block">
                          {sumRequired > 0 ? Math.round((sumCollected / sumRequired) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. FOUR SUMMARY METRIC CARDS (بطاقات الملخص الأربعة) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Metric Card 1: إجمالي المستحق */}
                  <div className="bg-[#132238]/80 border border-[#D4A84F]/25 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between text-[#9EA7B8]">
                      <span className="text-xs font-black">إجمالي المستحق</span>
                      <div className="w-8 h-8 rounded-xl bg-[#D4A84F]/10 border border-[#D4A84F]/20 flex items-center justify-center text-[#D4A84F]">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-[#F8F9FB]">
                      {sumRequired.toLocaleString('ar-EG')} <span className="text-xs text-[#D4A84F]">ج.م</span>
                    </div>
                    <p className="text-[10px] text-[#9EA7B8] font-bold">إجمالي المطالبات عن الفترات المحددة</p>
                  </div>

                  {/* Metric Card 2: إجمالي المسدد */}
                  <div className="bg-[#132238]/80 border border-emerald-500/25 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between text-[#9EA7B8]">
                      <span className="text-xs font-black text-emerald-300">إجمالي المسدد</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-400">
                      {sumCollected.toLocaleString('ar-EG')} <span className="text-xs text-emerald-300">ج.م</span>
                    </div>
                    <p className="text-[10px] text-emerald-400/80 font-bold">{countPaidMonths} شهور تم تحصيلها بالكامل</p>
                  </div>

                  {/* Metric Card 3: إجمالي المتأخرات */}
                  <div className="bg-[#132238]/80 border border-rose-500/25 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between text-[#9EA7B8]">
                      <span className="text-xs font-black text-rose-300">إجمالي المتأخرات</span>
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-rose-400">
                      {sumRemaining.toLocaleString('ar-EG')} <span className="text-xs text-rose-300">ج.م</span>
                    </div>
                    <p className="text-[10px] text-rose-400/80 font-bold">الرصيد المتبقي المستحق للتحصيل</p>
                  </div>

                  {/* Metric Card 4: عدد الأشهر غير المحصلة */}
                  <div className="bg-[#132238]/80 border border-amber-500/25 rounded-2xl p-4 space-y-2 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between text-[#9EA7B8]">
                      <span className="text-xs font-black text-amber-300">عدد الأشهر غير المحصلة</span>
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-amber-400">
                      {countUnpaidMonths} <span className="text-xs text-amber-300">شهر</span>
                    </div>
                    <p className="text-[10px] text-amber-400/80 font-bold">فترات إيجارية معلقة أو غير مسددة</p>
                  </div>
                </div>

                {/* 3. CONDITIONAL TABLE: ALL TENANTS CONSOLIDATED SUMMARY OR SINGLE TENANT MONTHLY BREAKDOWN */}
                {selectedTenantId === 'all' ? (
                  <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 p-5 space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4A84F]/15 pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#D4A84F]" />
                        <h3 className="text-sm font-black text-[#F8F9FB]">
                          تقرير كشف حساب جميع المستأجرين (كشف مجمع إجمالي)
                        </h3>
                      </div>
                      <span className="text-xs text-[#9EA7B8] font-bold">
                        اضغط على زر <strong className="text-[#D4A84F]">عرض التفاصيل</strong> لأي مستأجر لفتح كشف حسابه التفصيلي
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-[#D4A84F]/10">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-[#08111F]/90 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/15 text-[11px]">
                            <th className="p-3 text-center w-10">#</th>
                            <th className="p-3">اسم المستأجر</th>
                            <th className="p-3">العقار</th>
                            <th className="p-3 text-center">الوحدة</th>
                            <th className="p-3">اسم المالك</th>
                            <th className="p-3 text-center">الإيجار الحالي</th>
                            <th className="p-3 text-center">الأشهر المستحقة</th>
                            <th className="p-3 text-center">إجمالي المستحقات</th>
                            <th className="p-3 text-center">إجمالي المحصل</th>
                            <th className="p-3 text-center">الرصيد المتبقي</th>
                            <th className="p-3 text-center">آخر تاريخ تحصيل</th>
                            <th className="p-3 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                          {(() => {
                            const displayTenants = tenants.filter(t => {
                              if (selectedPropertyId === 'all') return true;
                              if (t.propertyId && t.propertyId === selectedPropertyId) return true;
                              const u = units.find(unit => unit.id === t.unitId);
                              return u?.propertyId === selectedPropertyId;
                            });

                            if (displayTenants.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={12} className="p-10 text-center text-[#9EA7B8]">
                                    لا يوجد مستأجرون مطابقون للعقار أو البحث المختار.
                                  </td>
                                </tr>
                              );
                            }

                            return displayTenants.map((t, index) => {
                              const tUnit = units.find(u => u.id === t.unitId);
                              const tProp = properties.find(p => p.id === (t.propertyId || tUnit?.propertyId));
                              const tOwner = owners.find(o => o.id === (tProp?.ownerId || (tUnit as any)?.ownerId));
                              const tenantDuesAll = validDues.filter(d => {
                                if (d.tenantId !== t.id) return false;
                                if (tenantFromMonth && d.forMonthYear && d.forMonthYear < tenantFromMonth) return false;
                                if (tenantToMonth && d.forMonthYear && d.forMonthYear > tenantToMonth) return false;
                                return true;
                              });

                              const unpaidDues = tenantDuesAll.filter(d => {
                                const matchingColl = collections.find(c => 
                                  c.tenantId === d.tenantId &&
                                  (c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
                                );
                                const isCollected = getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'collected';
                                return !isCollected && (!d.forMonthYear || d.forMonthYear <= currentMonthISO);
                              });
                              const overdueMonthsCount = unpaidDues.length;

                              const latestTenantDue = tenantDuesAll.length > 0 ? tenantDuesAll[tenantDuesAll.length - 1] : null;
                              const tRentCurrent = latestTenantDue?.rentAmount || t.rentAmount || tUnit?.rentValue || 0;
                              const tTotalReq = tenantDuesAll.reduce((s, d) => s + (d.rentAmount || 0), 0);
                              const tTotalColl = tenantDuesAll.reduce((s, d) => {
                                const matchingColl = collections.find(c => 
                                  c.tenantId === d.tenantId &&
                                  (c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
                                );
                                const isCollected = getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'collected';
                                const collectedVal = matchingColl?.amountPaid ?? (isCollected ? (d.collectedAmount || d.rentAmount) : 0);
                                return s + collectedVal;
                              }, 0);
                              const tArrears = Math.max(0, tTotalReq - tTotalColl);

                              const tCollections = collections.filter(c => c.tenantId === t.id);
                              const collDates = [
                                ...tCollections.map(c => c.paymentDate).filter(Boolean),
                                ...tenantDuesAll.map(d => d.paidDate).filter(Boolean)
                              ].sort((a, b) => (b || '').localeCompare(a || ''));
                              const lastPaymentDate = collDates.length > 0 ? collDates[0] : '—';

                              return (
                                <tr key={t.id} className="hover:bg-[#08111F]/50 transition-colors">
                                  <td className="p-3 text-center font-mono text-[#9EA7B8] text-[11px]">{index + 1}</td>
                                  <td className="p-3">
                                    <div className="font-extrabold text-[#F8F9FB]">{t.fullName}</div>
                                    <span className="text-[10px] text-[#9EA7B8] font-mono">{t.phone}</span>
                                  </td>
                                  <td className="p-3 font-extrabold text-[#D4A84F]">{tProp?.name || '—'}</td>
                                  <td className="p-3 text-center font-mono text-[#F8F9FB]">وحدة {tUnit?.unitNumber || '—'}</td>
                                  <td className="p-3 font-extrabold text-[#F8F9FB]">{tOwner?.name || (tOwner as any)?.fullName || '—'}</td>
                                  <td className="p-3 text-center font-mono text-[#F8F9FB] font-black">{tRentCurrent.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 text-center font-mono font-black">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${overdueMonthsCount > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                                      {overdueMonthsCount} شهر
                                    </span>
                                  </td>
                                  <td className="p-3 text-center font-mono text-[#F8F9FB] font-black">{tTotalReq.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 text-center font-mono text-emerald-400 font-extrabold">{tTotalColl.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 text-center font-mono text-rose-400 font-black">{tArrears.toLocaleString('ar-EG')} ج.م</td>
                                  <td className="p-3 text-center font-mono text-[#9EA7B8] text-[11px]">{lastPaymentDate}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => setSelectedTenantId(t.id)}
                                        className="px-3 py-1.5 rounded-xl bg-[#D4A84F]/15 text-[#D4A84F] hover:bg-[#D4A84F]/30 border border-[#D4A84F]/30 text-[11px] font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                                        title="عرض كشف الحساب التفصيلي المستقل لهذا المستأجر"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>عرض التفاصيل</span>
                                      </button>

                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* SINGLE TENANT DETAILED BREAKDOWN WITH 3 DISTINCT SECTIONS */
                  (() => {
                    const todayISO = new Date().toISOString().slice(0, 10);
                    const currentMonthISO = new Date().toISOString().slice(0, 7);

                    const currentTenantObj = tenants.find(t => t.id === selectedTenantId);
                    const currentUnitObj = units.find(u => u.id === currentTenantObj?.unitId);
                    const currentPropObj = properties.find(p => p.id === (currentTenantObj?.propertyId || currentUnitObj?.propertyId));
                    const currentOwnerObj = owners.find(o => o.id === (currentPropObj?.ownerId || (currentUnitObj as any)?.ownerId));

                    // Source of truth: Read strictly from re_dues dataset (validDues array)
                    const tenantDuesAll = validDues
                      .filter(d => d.tenantId === selectedTenantId)
                      .sort((a, b) => (a.forMonthYear || '').localeCompare(b.forMonthYear || ''));

                    // Section 1: الشهور المحصلة
                    const collectedMonths = tenantDuesAll.filter(d => {
                      const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                      return (d.forMonthYear || '') <= currentMonthISO && (cStat === 'collected' || cStat === 'prepaid');
                    });

                    // Section 2: الشهور المتأخرة
                    const overdueMonths = tenantDuesAll.filter(d => {
                      const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                      return (d.forMonthYear || '') <= currentMonthISO && cStat !== 'collected' && cStat !== 'prepaid';
                    });

                    // Section 3: الشهور المسددة مسبقًا (الدفع المسبق / السداد الاحتياطي)
                    const prepaidMonths = tenantDuesAll.filter(d => {
                      const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                      return (d.forMonthYear || '') > currentMonthISO && (cStat === 'collected' || cStat === 'prepaid');
                    });

                    const calculateDelayDays = (due: ReRentDue) => {
                      const targetDateStr = due.dueDate || (due.forMonthYear ? `${due.forMonthYear}-01` : todayISO);
                      if (targetDateStr >= todayISO) return 0;
                      const dueMs = new Date(targetDateStr).getTime();
                      const todayMs = new Date(todayISO).getTime();
                      const diff = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
                      return diff > 0 ? diff : 0;
                    };

                    const formatPaymentMethod = (method?: string) => {
                      if (!method) return 'نقداً (كاش)';
                      if (method === 'cash') return 'نقداً (كاش)';
                      if (method === 'bank_transfer') return 'تحويل بنكي';
                      if (method === 'check') return 'شيك';
                      if (method === 'online') return 'سداد إلكتروني';
                      return method;
                    };

                    return (
                      <div className="space-y-6">
                        {/* Read-Only Mode Banner */}
                        <div className="bg-[#08111F]/90 p-4 rounded-2xl border border-[#D4A84F]/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#D4A84F]/10 border border-[#D4A84F]/25 flex items-center justify-center text-[#D4A84F]">
                              <Lock className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-xs sm:text-sm font-black text-[#F8F9FB]">
                                كشف حساب تفصيلي للمستأجر ({currentTenantObj?.fullName || 'غير محدد'})
                              </h4>
                              <p className="text-[11px] text-[#9EA7B8] font-bold mt-0.5">
                                نافذة التفاصيل للقراءة فقط والمشتقة مباشرة وحصرياً من قسم الإيجارات والتحصيل (مصدر البيانات الموحد).
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedTenantId('all')}
                            className="px-3.5 py-2 rounded-xl bg-[#D4A84F]/15 hover:bg-[#D4A84F]/25 text-[#D4A84F] border border-[#D4A84F]/30 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                          >
                            <ArrowRight className="w-4 h-4" />
                            <span>الرجوع إلى الكشف المجمع</span>
                          </button>
                        </div>

                        {/* ------------------------------------------------------------- */}
                        {/* SECTION 1: الشهور المحصلة */}
                        {/* ------------------------------------------------------------- */}
                        <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-emerald-500/30 p-5 space-y-4 shadow-xl">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <CheckCircle className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-[#F8F9FB]">1. الشهور المحصلة</h3>
                                <p className="text-[10px] text-[#9EA7B8] font-bold">جميع الشهور التي تم تحصيل إيجارها فعلياً حتى الشهر الحالي ({currentMonthISO})</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {collectedMonths.length} شهر محصل
                              </span>
                              {collectedMonths.length > 0 && (
                                <button
                                  onClick={() => handleOpenRevertModal(currentTenantObj, currentUnitObj, currentPropObj, currentOwnerObj)}
                                  className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                                  title="الرجوع عن تحصيل الأشهر المحصلة"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>الرجوع عن التحصيل</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-emerald-500/15">
                            <table className="w-full text-right text-xs">
                              <thead>
                                <tr className="bg-[#08111F]/90 text-[#9EA7B8] font-bold border-b border-emerald-500/20 text-[11px]">
                                  <th className="p-3 text-center w-10">#</th>
                                  <th className="p-3">الشهر والسنة</th>
                                  <th className="p-3 text-center">قيمة الإيجار</th>
                                  <th className="p-3 text-center">تاريخ التحصيل</th>
                                  <th className="p-3 text-center">رقم سند التحصيل</th>
                                  <th className="p-3 text-center">طريقة السداد</th>
                                  <th className="p-3 text-center">حالة الشهر</th>
                                  <th className="p-3 text-center">الإجراءات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-500/10 font-bold">
                                {collectedMonths.length === 0 ? (
                                  <tr>
                                    <td colSpan={8} className="p-8 text-center text-[#9EA7B8]">
                                      <Clock className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
                                      <p className="text-xs font-bold text-[#F8F9FB]">لا توجد شهور محصلة مسجلة لهذا المستأجر.</p>
                                    </td>
                                  </tr>
                                ) : (
                                  collectedMonths.map((d, idx) => (
                                    <tr key={d.id} className="hover:bg-[#08111F]/40 transition-colors">
                                      <td className="p-3 text-center font-mono text-[#9EA7B8] text-[11px]">{idx + 1}</td>
                                      <td className="p-3 font-mono text-[#F8F9FB] font-extrabold">{d.monthNameAr || d.forMonthYear}</td>
                                      <td className="p-3 text-center font-mono text-emerald-400 font-black">
                                        {(d.collectedAmount || d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                                      </td>
                                      <td className="p-3 text-center font-mono text-[#F8F9FB] text-[11px]">{d.paidDate || '—'}</td>
                                      <td className="p-3 text-center font-mono text-[#D4A84F] font-bold">{d.receiptNumber || '—'}</td>
                                      <td className="p-3 text-center font-bold text-[#9EA7B8]">{formatPaymentMethod(d.paymentMethod)}</td>
                                      <td className="p-3 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                          <span>تم التحصيل</span>
                                        </span>
                                      </td>
                                      <td className="p-3 text-center">
                                        <button
                                          onClick={() => handleOpenRevertModal(currentTenantObj, currentUnitObj, currentPropObj, currentOwnerObj, d.id)}
                                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-black transition-all cursor-pointer inline-flex items-center gap-1"
                                          title="الرجوع عن تحصيل هذا الشهر وإعادته للمتأخرات"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" />
                                          <span>الرجوع عن التحصيل</span>
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* ------------------------------------------------------------- */}
                        {/* SECTION 2: الشهور المتأخرة */}
                        {/* ------------------------------------------------------------- */}
                        <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-rose-500/30 p-5 space-y-4 shadow-xl">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-[#F8F9FB]">2. الشهور المتأخرة</h3>
                                <p className="text-[10px] text-[#9EA7B8] font-bold">جميع الشهور غير المسددة حتى تاريخ الشهر المالي الحالي ({currentMonthISO})</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-black ${overdueMonths.length > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}>
                              {overdueMonths.length > 0 ? `${overdueMonths.length} شهر متأخر` : 'لا توجد متأخرات 🎉'}
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-rose-500/15">
                            <table className="w-full text-right text-xs">
                              <thead>
                                <tr className="bg-[#08111F]/90 text-[#9EA7B8] font-bold border-b border-rose-500/20 text-[11px]">
                                  <th className="p-3 text-center w-10">#</th>
                                  <th className="p-3">الشهر والسنة</th>
                                  <th className="p-3 text-center">قيمة الإيجار</th>
                                  <th className="p-3 text-center">تاريخ الاستحقاق</th>
                                  <th className="p-3 text-center">عدد أيام التأخير</th>
                                  <th className="p-3 text-center">حالة الشهر</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-rose-500/10 font-bold">
                                {overdueMonths.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-[#9EA7B8]">
                                      <CheckCircle className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                                      <p className="text-xs font-bold text-emerald-400">🎉 لا توجد شهور متأخرة! المستأجر منتظم تماماً بالسداد.</p>
                                    </td>
                                  </tr>
                                ) : (
                                  overdueMonths.map((d, idx) => {
                                    const delayDays = calculateDelayDays(d);
                                    const revertedColl = collections.find(c => 
                                      (c.status === 'reverted' || c.isCancelled) &&
                                      c.tenantId === d.tenantId &&
                                      (c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
                                    );
                                    const isReverted = !!revertedColl || !!d.lastRevertDate || (d.collectionNotes && d.collectionNotes.includes('رجوع'));

                                    return (
                                      <tr key={d.id} className={`${isReverted ? 'bg-amber-500/[0.06]' : 'bg-rose-500/[0.03]'} hover:bg-rose-500/[0.07] transition-colors`}>
                                        <td className="p-3 text-center font-mono text-[#9EA7B8] text-[11px]">{idx + 1}</td>
                                        <td className="p-3 font-mono text-[#F8F9FB] font-extrabold">{d.monthNameAr || d.forMonthYear}</td>
                                        <td className="p-3 text-center font-mono text-rose-400 font-black">
                                          {(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                                        </td>
                                        <td className="p-3 text-center font-mono text-[#F8F9FB] text-[11px]">{d.dueDate || '—'}</td>
                                        <td className="p-3 text-center font-mono text-rose-300 font-black">
                                          {delayDays > 0 ? `${delayDays} يوماً` : 'مستحق اليوم'}
                                        </td>
                                        <td className="p-3 text-center">
                                          {isReverted ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40" title={`تم الرجوع عن التحصيل بتاريخ: ${revertedColl?.updatedAt?.slice(0, 10) || d.lastRevertDate || '—'}`}>
                                              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                                              <span>⚠️ مرجوع عن التحصيل</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                              <span>متأخر</span>
                                            </span>
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

                        {/* ------------------------------------------------------------- */}
                        {/* SECTION 3: الشهور المسددة مسبقًا (الدفع المسبق) */}
                        {/* ------------------------------------------------------------- */}
                        <div className="bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-amber-500/30 p-5 space-y-4 shadow-xl">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-[#F8F9FB]">3. الشهور المسددة مسبقًا (الدفع المسبق / السداد الاحتياطي)</h3>
                                <p className="text-[10px] text-[#9EA7B8] font-bold">جميع الأشهر الموجودة بقائمة السداد الاحتياطي للفترات القادمة ({`>`} {currentMonthISO}) والتي تم تحصيلها</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {prepaidMonths.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRevertPrepaymentModal(currentTenantObj, currentUnitObj, currentPropObj, currentOwnerObj)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                                  title="الرجوع عن تحصيل الأشهر المسددة مسبقاً"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                                  <span>الرجوع عن التحصيل</span>
                                </button>
                              )}
                              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                {prepaidMonths.length} شهر مدفوع مسبقًا
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-amber-500/15">
                            <table className="w-full text-right text-xs">
                              <thead>
                                <tr className="bg-[#08111F]/90 text-[#9EA7B8] font-bold border-b border-amber-500/20 text-[11px]">
                                  <th className="p-3 text-center w-10">#</th>
                                  <th className="p-3">الشهر والسنة</th>
                                  <th className="p-3 text-center">قيمة الإيجار</th>
                                  <th className="p-3 text-center">تاريخ إضافة السداد المسبق</th>
                                  <th className="p-3 text-center">حالة الشهر</th>
                                  <th className="p-3 text-center">الإجراءات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-500/10 font-bold">
                                {prepaidMonths.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-[#9EA7B8]">
                                      <Clock className="w-8 h-8 text-amber-500/30 mx-auto mb-2" />
                                      <p className="text-xs font-bold text-[#F8F9FB]">لا توجد شهور مسددة مسبقاً لهذا المستأجر.</p>
                                    </td>
                                  </tr>
                                ) : (
                                  prepaidMonths.map((d, idx) => (
                                    <tr key={d.id} className="bg-amber-500/[0.04] hover:bg-amber-500/[0.08] transition-colors">
                                      <td className="p-3 text-center font-mono text-[#9EA7B8] text-[11px]">{idx + 1}</td>
                                      <td className="p-3 font-mono text-[#F8F9FB] font-extrabold flex items-center gap-2">
                                        <span>{d.monthNameAr || d.forMonthYear}</span>
                                        <span className="text-[9px] font-sans px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black">
                                          احتياطي مدفوع
                                        </span>
                                      </td>
                                      <td className="p-3 text-center font-mono text-amber-300 font-black">
                                        {(d.collectedAmount || d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                                      </td>
                                      <td className="p-3 text-center font-mono text-[#F8F9FB] text-[11px]">{d.paidDate || '—'}</td>
                                      <td className="p-3 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">
                                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                          <span>مدفوع مسبقًا</span>
                                        </span>
                                      </td>
                                      <td className="p-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRevertPrepaymentModal(currentTenantObj, currentUnitObj, currentPropObj, currentOwnerObj, d.id)}
                                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-black transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                          title="الرجوع عن الدفع المسبق لهذا الشهر"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                                          <span>الرجوع عن التحصيل</span>
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* VIEW: العمولات (COMMISSIONS) */}
      {currentTab === 'commissions' && (
        <div className="space-y-5">

          {/* Header Bar */}
          <div className="p-5 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#D4A84F]/30 to-[#D4A84F]/10 border border-[#D4A84F]/40 text-[#D4A84F] shadow-lg">
                <DollarSign className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#F8F9FB] flex items-center gap-2">
                  نظام إدارة ومتابعة عمولات المكتب عن الإدارة العقارية
                  <span className="px-2 py-0.5 text-[10px] rounded-md bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30 font-bold">مجمع لكل عقار</span>
                </h3>
                <p className="text-xs text-[#9EA7B8] font-bold mt-0.5">
                  كشف عمولات مجمع لكل عقار مبيناً العمولة المستحقة، المحصلة، وحالة المطالبة من المالك.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                onClick={() => {
                  setModalReportType('office_commissions');
                  setIsReportModalOpen(true);
                }}
                className="px-4 py-2.5 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                معاينة التقرير
              </button>

              <button
                onClick={() => {
                  setModalReportType('office_commissions');
                  setIsReportModalOpen(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة التقرير
              </button>
            </div>
          </div>

          {/* Top Search & Filter Bar - Unified Design */}
          <div className="bg-[#132238]/80 backdrop-blur-md p-4 rounded-2xl border border-[#D4A84F]/20 space-y-4 shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              
              {/* 1. اختر العقار */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر العقار:</label>
                <select
                  value={commSelectedPropertyId}
                  onChange={e => setCommSelectedPropertyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                >
                  <option value="all">جميع العقارات ({properties.length})</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. اختر المالك */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر المالك:</label>
                <select
                  value={commSelectedOwnerId}
                  onChange={e => setCommSelectedOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                >
                  <option value="all">جميع الملاك ({owners.length})</option>
                  {owners.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. نوع الحساب */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">نوع الحساب:</label>
                <select
                  value={commAccountType}
                  onChange={e => setCommAccountType(e.target.value as 'monthly' | 'total')}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#D4A84F] font-black focus:border-[#D4A84F] outline-none transition-all"
                >
                  <option value="monthly">حسابات شهرية</option>
                  <option value="total">حسابات إجمالية</option>
                </select>
              </div>

              {/* 4. اختيار الشهر والسنة المالية (عند اختيار الحسابات الشهرية فقط) */}
              {commAccountType === 'monthly' && (
                <>
                  {/* اختيار الشهر */}
                  <div>
                    <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر الشهر المالي:</label>
                    <select
                      value={commSelectedMonth}
                      onChange={e => setCommSelectedMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all font-mono"
                    >
                      {AR_MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* اختيار السنة */}
                  <div>
                    <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">اختر السنة المالية:</label>
                    <select
                      value={commSelectedYear}
                      onChange={e => setCommSelectedYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all font-mono"
                    >
                      <option value="all">جميع السنوات</option>
                      {allAvailableCommYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* 5. حالات العرض */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">حالات العرض:</label>
                <select
                  value={commissionsFilter}
                  onChange={e => setCommissionsFilter(e.target.value as 'all' | 'uncollected' | 'collected')}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                >
                  <option value="all">الكل</option>
                  <option value="collected">تم التحصيل ✅</option>
                  <option value="uncollected">لم يتم التحصيل ⏳</option>
                </select>
              </div>

              {/* 6. بحث نصي */}
              <div>
                <label className="text-[10px] text-[#9EA7B8] block mb-1 font-bold">بحث نصي:</label>
                <input
                  type="text"
                  placeholder="ابحث باسم العقار، المالك..."
                  value={commSearchTerm}
                  onChange={e => setCommSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/20 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none transition-all"
                />
              </div>

            </div>

            {/* Reset Filters Bar */}
            {(commSelectedPropertyId !== 'all' || commSelectedOwnerId !== 'all' || commSelectedMonth !== 'all' || commSelectedYear !== 'all' || commissionsFilter !== 'all' || commSearchTerm) && (
              <div className="flex items-center justify-between pt-3 border-t border-[#D4A84F]/15">
                <button
                  type="button"
                  onClick={() => {
                    setCommSelectedPropertyId('all');
                    setCommSelectedOwnerId('all');
                    setCommSelectedMonth('all');
                    setCommSelectedYear('all');
                    setCommissionsFilter('all');
                    setCommAccountType('monthly');
                    setCommSearchTerm('');
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-[1.02]"
                  title="إعادة ضبط جميع الفلاتر"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة ضبط جميع الفلاتر</span>
                </button>
              </div>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 space-y-1 shadow-lg">
              <div className="flex items-center justify-between text-[#9EA7B8]">
                <span className="text-[11px] font-bold">إجمالي الإيجارات المستحقة</span>
                <Building className="w-4 h-4 text-[#D4A84F]" />
              </div>
              <p className="text-lg font-black text-[#F8F9FB] font-mono">
                {commTotals.sumDueRent.toLocaleString('ar-EG')} <span className="text-xs text-[#9EA7B8]">ج.م</span>
              </p>
              <div className="text-[10px] text-[#9EA7B8] pt-1 border-t border-white/5 flex justify-between font-mono">
                <span>المحصل من المستأجرين:</span>
                <span className="text-emerald-400 font-bold">{commTotals.sumCollectedRent.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>

            <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 space-y-1 shadow-lg">
              <div className="flex items-center justify-between text-[#9EA7B8]">
                <span className="text-[11px] font-bold">إجمالي العمولة المستحقة</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-lg font-black text-amber-400 font-mono">
                {commTotals.sumEarnedComm.toLocaleString('ar-EG')} <span className="text-xs text-amber-300">ج.م</span>
              </p>
              <div className="text-[10px] text-[#9EA7B8] pt-1 border-t border-white/5 flex justify-between font-mono">
                <span>العمولة الناتجة من تحصيل الإيجارات:</span>
                <span className="text-teal-300 font-bold">{commTotals.sumCollectedRentComm.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>

            <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-emerald-500/20 space-y-1 shadow-lg">
              <div className="flex items-center justify-between text-[#9EA7B8]">
                <span className="text-[11px] font-bold">العمولات المحصلة من الملاك</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-lg font-black text-emerald-400 font-mono">
                {commTotals.sumCollectedFromOwner.toLocaleString('ar-EG')} <span className="text-xs text-emerald-300">ج.م</span>
              </p>
              <div className="text-[10px] text-[#9EA7B8] pt-1 border-t border-white/5 flex justify-between font-mono">
                <span>نسبة المحصل من الملاك:</span>
                <span className="text-emerald-300 font-bold">
                  {commTotals.sumEarnedComm > 0 ? Math.round((commTotals.sumCollectedFromOwner / commTotals.sumEarnedComm) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="p-4 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-rose-500/20 space-y-1 shadow-lg">
              <div className="flex items-center justify-between text-[#9EA7B8]">
                <span className="text-[11px] font-bold">العمولات المتبقية والمتأخرة</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-lg font-black text-rose-400 font-mono">
                {commTotals.sumRemainingComm.toLocaleString('ar-EG')} <span className="text-xs text-rose-300">ج.م</span>
              </p>
              <div className="text-[10px] text-[#9EA7B8] pt-1 border-t border-white/5 flex justify-between font-mono">
                <span>سجلات بانتظار التحصيل:</span>
                <span className="text-rose-300 font-bold">
                  {filteredCommStatements.filter(s => s.remainingCommission > 0).length} عقار/شهر
                </span>
              </div>
            </div>

          </div>

          {/* Property-by-Property Commissions Section (عرض العمولات مقسم حسب كل عقار) */}
          <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-4 sm:p-5 space-y-4 shadow-2xl">
            <div className="border-b border-[#D4A84F]/15 pb-3 flex flex-wrap items-center justify-between gap-2 bg-[#08111F]/40 p-3 rounded-xl">
              <h3 className="text-xs sm:text-sm font-black text-[#D4A84F] flex items-center gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A84F]" />
                <span>عرض عمولات العقارات (مقسمة حسب كل عقار)</span>
              </h3>
              <span className="text-xs text-[#9EA7B8] font-mono font-bold bg-[#08111F] px-3 py-1 rounded-lg border border-[#D4A84F]/20">
                إجمالي العقارات: {propertyCommGroups.length} عقار
              </span>
            </div>

            {propertyCommGroups.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#9EA7B8] font-bold bg-[#08111F]/40 rounded-xl border border-white/5">
                لا توجد سجلات عمولات مطابقة للفلاتر المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#08111F]/90 text-[#9EA7B8] text-[11px] font-bold border-b border-[#D4A84F]/15">
                      <th className="p-3 text-center">#</th>
                      <th className="p-3">العقار والمالك</th>
                      <th className="p-3 text-center">آلية الاتفاق</th>
                      <th className="p-3 text-center">الشهور المالية</th>
                      <th className="p-3 text-center">إجمالي الإيجار</th>
                      <th className="p-3 text-center text-amber-400">العمولة المستحقة</th>
                      <th className="p-3 text-center text-emerald-400">المحصل من المالك</th>
                      <th className="p-3 text-center text-rose-400">العمولة المتبقية</th>
                      <th className="p-3 text-center">حالة التحصيل</th>
                      <th className="p-3 text-center">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 text-[#F8F9FB] font-bold">
                    {propertyCommGroups.map((group, idx) => {
                      const isFullyCollected = group.remainingCommission === 0 && group.earnedCommission > 0;
                      const isPartiallyCollected = group.amountCollectedFromOwner > 0 && group.remainingCommission > 0;

                      return (
                        <tr 
                          key={group.propertyId}
                          className="hover:bg-white/[0.03] transition-colors bg-[#08111F]/60"
                        >
                          <td className="p-3 text-center font-mono text-[11px] text-[#9EA7B8]">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-extrabold text-[#F8F9FB] flex items-center gap-1.5 text-sm">
                              <Building2 className="w-4 h-4 text-[#D4A84F]" />
                              <span>{group.propertyName}</span>
                            </div>
                            <span className="text-[11px] text-[#D4A84F] block mt-0.5">المالك: {group.ownerName}</span>
                          </td>
                          <td className="p-3 text-center text-[11px]">
                            <span className="bg-[#132238] text-amber-300 px-2 py-0.5 rounded border border-[#D4A84F]/20 font-sans">
                              {group.commissionRateText}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-slate-300">
                            <span className="px-2 py-0.5 rounded-lg bg-[#132238] border border-white/10 text-xs">
                              {group.monthsCount} شهر
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{group.totalDueRent.toLocaleString('ar-EG')} ج.م</td>
                          <td className="p-3 text-center font-mono text-amber-400 font-black text-sm">{group.earnedCommission.toLocaleString('ar-EG')} ج.م</td>
                          <td className="p-3 text-center font-mono text-emerald-400 font-black text-sm">{group.amountCollectedFromOwner.toLocaleString('ar-EG')} ج.م</td>
                          <td className={`p-3 text-center font-mono font-black text-sm ${group.remainingCommission > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {group.remainingCommission.toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="p-3 text-center">
                            {isFullyCollected ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-400" /> تم التحصيل بالكامل
                              </span>
                            ) : isPartiallyCollected ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400" /> تحصيل جزئي
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-400" /> بانتظار التحصيل
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {group.remainingCommission > 0 ? (
                                <>
                                  {group.statements.length === 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditCommStatusModal(group.statements[0])}
                                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md border border-emerald-400/40 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95"
                                      title="تسجيل تحصيل عمولة هذا العقار"
                                    >
                                      <Coins className="w-3.5 h-3.5 text-amber-300" />
                                      <span>تحصيل العمولة</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPropertyCommPropertyId(group.propertyId)}
                                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md border border-emerald-400/40 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95"
                                      title="عرض الشهور وتحصيل العمولة"
                                    >
                                      <Coins className="w-3.5 h-3.5 text-amber-300" />
                                      <span>تحصيل العمولة</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPropertyCommPropertyId(group.propertyId)}
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black transition-all cursor-pointer inline-flex items-center justify-center gap-1 shadow-sm hover:scale-[1.02] active:scale-95"
                                    title="عرض الشهور وتفاصيل السجلات"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                                    <span>التفاصيل</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPropertyCommPropertyId(group.propertyId)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-95"
                                  title="عرض الشهور وتفاصيل تحصيل العمولة"
                                >
                                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                                  <span>عرض التفاصيل</span>
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
          </div>

        </div>
      )}

      {/* VIEW 7: المطابقة والإغلاق المالي (REMOVED) */}
      {false && (() => {
        return null;
        const activeClosingMonth = selectedMonthYear === 'all' ? currentMonthISO : selectedMonthYear;
        const closingDuesList = validDues.filter(d => selectedMonthYear === 'all' || d.forMonthYear === selectedMonthYear);

        // 1. Tenant Rent Summary
        let totalTenantRent = 0;
        let collectedTenantRent = 0;
        let uncollectedTenantRent = 0;

        // 2. Owner Net Due Summary (سواء تم الصرف أو لم يتم الصرف)
        let totalOwnerRentDue = 0;
        let totalOwnerPaidOut = 0;
        let totalOwnerPendingPayout = 0;

        // 3. Office Commission Summary
        let totalCommissionDue = 0;
        let totalCommissionCollected = 0;

        closingDuesList.forEach(d => {
          const rent = d.rentAmount || 0;
          totalTenantRent += rent;

          const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
          const isCollected = cStatus === 'collected' || (d.collectedAmount || 0) > 0 || !!d.paidDate;
          const collAmt = isCollected ? (d.collectedAmount || rent) : (d.collectedAmount || 0);
          collectedTenantRent += collAmt;

          // Property & Owner details
          const prop = properties.find(p => p.id === d.propertyId);
          const owner = owners.find(o => o.id === (d.ownerId || prop?.ownerId));

          let comm = getDueCommissionAmount(d, owners, properties);
          totalCommissionDue += comm;
          if (isCollected) {
            totalCommissionCollected += comm;
          }

          const ownerDueForD = Math.max(0, rent - comm);
          totalOwnerRentDue += ownerDueForD;

          const pStatus = getDuePayoutStatus(d);
          if (pStatus === 'paid_out') {
            totalOwnerPaidOut += (d.payoutAmount || ownerDueForD);
          } else {
            totalOwnerPendingPayout += ownerDueForD;
          }
        });

        uncollectedTenantRent = Math.max(0, totalTenantRent - collectedTenantRent);
        const totalCommissionRemaining = Math.max(0, totalCommissionDue - totalCommissionCollected);

        // Per-Property Financial Closing Grouping
        const propertyClosingMap = new Map<string, {
          property: ReProperty;
          ownerName: string;
          dues: typeof closingDuesList;
          tenantRentTotal: number;
          tenantRentCollected: number;
          tenantRentUncollected: number;
          ownerDueTotal: number;
          ownerPaidOut: number;
          ownerPendingPayout: number;
          commissionDueTotal: number;
          commissionCollected: number;
          closedCount: number;
        }>();

        closingDuesList.forEach(d => {
          const propId = d.propertyId || 'other';
          const prop = properties.find(p => p.id === propId) || {
            id: propId,
            name: d.propertyName || 'عقار غير محدد',
            ownerId: d.ownerId || '',
          } as ReProperty;

          const owner = owners.find(o => o.id === (d.ownerId || prop.ownerId));
          const ownerName = owner?.name || 'مالك غير محدد';

          let comm = getDueCommissionAmount(d, owners, properties);

          const rent = d.rentAmount || 0;
          const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
          const isCollected = cStatus === 'collected' || (d.collectedAmount || 0) > 0 || !!d.paidDate;
          const collAmt = isCollected ? (d.collectedAmount || rent) : (d.collectedAmount || 0);

          const ownerDueForD = Math.max(0, rent - comm);
          const pStatus = getDuePayoutStatus(d);
          const paidOutForD = pStatus === 'paid_out' ? (d.payoutAmount || ownerDueForD) : 0;
          const pendingPayoutForD = pStatus === 'paid_out' ? 0 : ownerDueForD;

          if (!propertyClosingMap.has(propId)) {
            propertyClosingMap.set(propId, {
              property: prop,
              ownerName,
              dues: [],
              tenantRentTotal: 0,
              tenantRentCollected: 0,
              tenantRentUncollected: 0,
              ownerDueTotal: 0,
              ownerPaidOut: 0,
              ownerPendingPayout: 0,
              commissionDueTotal: 0,
              commissionCollected: 0,
              closedCount: 0,
            });
          }

          const entry = propertyClosingMap.get(propId)!;
          entry.dues.push(d);
          entry.tenantRentTotal += rent;
          entry.tenantRentCollected += collAmt;
          entry.tenantRentUncollected += Math.max(0, rent - collAmt);
          entry.ownerDueTotal += ownerDueForD;
          entry.ownerPaidOut += paidOutForD;
          entry.ownerPendingPayout += pendingPayoutForD;
          entry.commissionDueTotal += comm;
          if (isCollected) entry.commissionCollected += comm;
          if (d.monthClosingStatus === 'closed') entry.closedCount += 1;
        });

        const propertyClosingList = Array.from(propertyClosingMap.values());

        return (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-5 bg-[#132238]/80 backdrop-blur-md rounded-2xl border border-[#D4A84F]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#D4A84F]/30 to-[#D4A84F]/10 border border-[#D4A84F]/40 text-[#D4A84F] shadow-lg">
                  <Lock className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F8F9FB] flex items-center gap-2">
                    شاشة المطابقة والإغلاق المالي الشامل للشهور
                    <span className="px-2.5 py-0.5 text-[10px] rounded-md bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30 font-bold">
                      {selectedMonthYear === 'all' ? 'جميع الشهور' : `شهر ${selectedMonthYear}`}
                    </span>
                  </h3>
                  <p className="text-xs text-[#9EA7B8] font-bold mt-0.5">
                    حسابات محصل وغير محصل إيجارات المستأجرين، ومستحقات المالك المتبقية والمصروفة، والعمولة المستحقة عن كل عقار.
                  </p>
                </div>
              </div>

              {/* Month Picker */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <label className="text-xs text-[#9EA7B8] font-bold whitespace-nowrap">شهر الإغلاق المالي:</label>
                <input
                  type="month"
                  value={selectedMonthYear === 'all' ? '' : selectedMonthYear}
                  onChange={e => setSelectedMonthYear(e.target.value || 'all')}
                  className="px-3 py-2 rounded-xl bg-[#08111F]/90 border border-[#D4A84F]/30 text-xs text-[#F8F9FB] font-bold focus:border-[#D4A84F] outline-none shadow-inner"
                />
                {selectedMonthYear !== 'all' && (
                  <button
                    onClick={() => setSelectedMonthYear('all')}
                    className="px-2.5 py-2 text-xs font-bold text-[#D4A84F] bg-[#132238] border border-[#D4A84F]/20 rounded-xl hover:bg-[#1C2D42]"
                  >
                    عرض الكل
                  </button>
                )}
              </div>
            </div>

            {/* 3 Main KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Tenant Rents */}
              <div className="bg-gradient-to-br from-[#132238]/90 to-[#08111F]/90 p-5 rounded-2xl border border-sky-500/20 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sky-400 font-black flex items-center gap-1.5">
                    <Receipt className="w-4 h-4" /> 1. إيجارات المستأجرين (المحصل / غير المحصل)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 font-bold border border-sky-500/20">
                    {closingDuesList.length} استحقاق
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-[#F8F9FB]">
                  {totalTenantRent.toLocaleString('ar-EG')} <span className="text-xs font-sans text-sky-400">ج.م (إجمالي)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10 font-bold">
                  <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-300 block">المحصل من المستأجرين</span>
                    <span className="font-mono text-emerald-400 text-sm">{collectedTenantRent.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                    <span className="text-[10px] text-rose-300 block">غير المحصل (متأخرات)</span>
                    <span className="font-mono text-rose-400 text-sm">{uncollectedTenantRent.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Owner Rent Due */}
              <div className="bg-gradient-to-br from-[#132238]/90 to-[#08111F]/90 p-5 rounded-2xl border border-amber-500/20 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-400 font-black flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" /> 2. صافي إيجارات الملاك المستحقة
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                    خصم عمولة المكتب
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-amber-300">
                  {totalOwnerRentDue.toLocaleString('ar-EG')} <span className="text-xs font-sans text-amber-400">ج.م (المستحق الكلي)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10 font-bold">
                  <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-300 block">تم الصرف للملاك</span>
                    <span className="font-mono text-emerald-400 text-sm">{totalOwnerPaidOut.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] text-amber-300 block">بانتظار الصرف للملاك</span>
                    <span className="font-mono text-amber-400 text-sm">{totalOwnerPendingPayout.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Office Commission */}
              <div className="bg-gradient-to-br from-[#132238]/90 to-[#08111F]/90 p-5 rounded-2xl border border-[#D4A84F]/30 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#D4A84F] font-black flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" /> 3. عمولة المكتب المستحقة
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A84F]/10 text-[#D4A84F] font-bold border border-[#D4A84F]/20">
                    إدارة العقارات
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-[#F8F9FB]">
                  {totalCommissionDue.toLocaleString('ar-EG')} <span className="text-xs font-sans text-[#D4A84F]">ج.م (العمولة الكلية)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10 font-bold">
                  <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-300 block">العمولة المحصلة فعلياً</span>
                    <span className="font-mono text-emerald-400 text-sm">{totalCommissionCollected.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] text-amber-300 block">المتبقي غير المحصل</span>
                    <span className="font-mono text-amber-400 text-sm">{totalCommissionRemaining.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Property-by-Property Breakdown Table (كشف الإغلاق المالي تفصيلياً عن كل عقار) */}
            <div className="bg-[#132238]/70 backdrop-blur-md rounded-2xl border border-[#D4A84F]/20 p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#D4A84F]/15 pb-3">
                <h4 className="text-sm font-black text-[#F8F9FB] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#D4A84F]" />
                  كشف حساب الإغلاق المالي مفصلاً عن كل عقار لشهر ({selectedMonthYear === 'all' ? 'جميع الشهور' : selectedMonthYear})
                </h4>
                <span className="text-xs font-bold text-[#9EA7B8]">
                  عدد العقارات المسجلة بالأرشيف: {propertyClosingList.length} عقار
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#08111F]/90 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/15">
                      <th className="p-3">#</th>
                      <th className="p-3">العقار والمالك</th>
                      <th className="p-3 text-center">إجمالي إيجارات المستأجرين</th>
                      <th className="p-3 text-center">المحصل من المستأجرين</th>
                      <th className="p-3 text-center">غير المحصل (متأخرات)</th>
                      <th className="p-3 text-center">المستحق للمالك (صافي)</th>
                      <th className="p-3 text-center">حالة صرف المالك</th>
                      <th className="p-3 text-center">عمولة المكتب المستحقة</th>
                      <th className="p-3 text-center">حالة إغلاق العقار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 font-bold text-[#F8F9FB]">
                    {propertyClosingList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-[#9EA7B8] font-bold">
                          لا توجد استحقاقات مالية مسجلة لهذا الشهر
                        </td>
                      </tr>
                    ) : (
                      propertyClosingList.map((item, idx) => {
                        const isFullyClosed = item.closedCount === item.dues.length && item.dues.length > 0;
                        const isFullyMatched = item.tenantRentUncollected === 0 && item.ownerPendingPayout === 0;

                        return (
                          <tr key={item.property.id} className="hover:bg-[#08111F]/50 transition-all">
                            <td className="p-3 text-center font-mono text-[#9EA7B8]">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-extrabold text-[#F8F9FB]">{item.property.name}</div>
                              <div className="text-[10px] text-amber-400 font-bold">المالك: {item.ownerName}</div>
                            </td>
                            <td className="p-3 text-center font-mono font-extrabold text-sky-300">
                              {item.tenantRentTotal.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 text-center font-mono font-extrabold text-emerald-400">
                              {item.tenantRentCollected.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 text-center font-mono font-extrabold">
                              {item.tenantRentUncollected > 0 ? (
                                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                  {item.tenantRentUncollected.toLocaleString('ar-EG')} ج.م
                                </span>
                              ) : (
                                <span className="text-emerald-400">0 ج.م</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-extrabold text-amber-300">
                              {item.ownerDueTotal.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 text-center font-mono text-[11px]">
                              {item.ownerPendingPayout === 0 && item.ownerDueTotal > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                                  تم الصرف بالكامل ({item.ownerPaidOut.toLocaleString('ar-EG')} ج.م)
                                </span>
                              ) : item.ownerPaidOut > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                  صرف جزئي ({item.ownerPaidOut.toLocaleString('ar-EG')} / باقي {item.ownerPendingPayout.toLocaleString('ar-EG')} ج.م)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                                  بانتظار الصرف ({item.ownerPendingPayout.toLocaleString('ar-EG')} ج.م)
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-extrabold text-[#D4A84F]">
                              {item.commissionDueTotal.toLocaleString('ar-EG')} ج.م
                            </td>
                            <td className="p-3 text-center">
                              {isFullyClosed ? (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black inline-flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> مغلق رسمياً
                                </span>
                              ) : isFullyMatched ? (
                                <span className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[10px] font-black inline-flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-teal-400" /> مكتمل الجاهزية
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> بانتظار التسوية
                                </span>
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

            {/* Detailed Rent Dues Table & Individual / Bulk Month Closing Actions */}
            <div className="bg-[#132238]/60 backdrop-blur-md rounded-2xl border border-[#D4A84F]/15 p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#D4A84F]/10 pb-3">
                <div>
                  <h4 className="text-sm font-black text-[#F8F9FB] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#D4A84F]" />
                    جدول مطابقة واعتماد إغلاق العقود والوحدات الفردية لشهر ({selectedMonthYear === 'all' ? 'جميع الشهور' : selectedMonthYear})
                  </h4>
                  <p className="text-xs text-[#9EA7B8] font-bold mt-0.5">
                    يمكنك اعتماد الإغلاق المالي لكل عقد على حدة أو إغلاق كافة العقود المكتملة دفعة واحدة.
                  </p>
                </div>

                {closingDuesList.length > 0 && (
                  <button
                    onClick={() => {
                      const openDues = closingDuesList.filter(d => d.monthClosingStatus !== 'closed');
                      if (openDues.length === 0) {
                        alert('جميع الاستحقاقات لهذا الشهر مغلقة رسمياً بالفعل!');
                        return;
                      }
                      if (confirm(`هل أنت متأكد من اعتماد الإغلاق المالي لكافة عقود شهر (${selectedMonthYear}) البالغ عددها (${openDues.length}) استحقاق؟`)) {
                        openDues.forEach(d => {
                          if (onCloseMonthDue) onCloseMonthDue(d.id);
                        });
                        alert('✅ تم اعتماد الإغلاق المالي لجميع العقود المحددة بنجاح!');
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    <Lock className="w-4 h-4" />
                    اعتماد إغلاق شهر ({selectedMonthYear === 'all' ? 'الكل' : selectedMonthYear}) بالكامل
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#08111F]/80 text-[#9EA7B8] font-bold border-b border-[#D4A84F]/10">
                      <th className="p-3">العقار والوحدة</th>
                      <th className="p-3">المستأجر</th>
                      <th className="p-3">إجمالي الإيجار</th>
                      <th className="p-3">عمولة المكتب</th>
                      <th className="p-3">صافي المالك</th>
                      <th className="p-3">حالة صرف المالك</th>
                      <th className="p-3">حالة تحصيل المستأجر</th>
                      <th className="p-3">حالة المطابقة</th>
                      <th className="p-3 text-center">إغلاق الشهر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4A84F]/10 font-bold">
                    {closingDuesList.map(d => {
                      const pStatus = getDuePayoutStatus(d);
                      const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                      const isFullyMatched = pStatus === 'paid_out' && cStatus === 'collected';

                      const prop = properties.find(p => p.id === d.propertyId);
                      const owner = owners.find(o => o.id === (d.ownerId || prop?.ownerId));

                      let comm = getDueCommissionAmount(d, owners, properties);
                      const ownerNet = Math.max(0, (d.rentAmount || 0) - comm);

                      return (
                        <tr key={d.id} className="hover:bg-[#08111F]/40 transition-all">
                          <td className="p-3 font-extrabold text-[#F8F9FB]">
                            {d.propertyName} - وحدة {d.unitNumber}
                          </td>
                          <td className="p-3 text-[#9EA7B8]">{d.tenantName}</td>
                          <td className="p-3 font-mono text-[#F8F9FB]">{d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                          <td className="p-3 font-mono text-[#D4A84F]">{comm.toLocaleString('ar-EG')} ج.م</td>
                          <td className="p-3 font-mono text-amber-300">{ownerNet.toLocaleString('ar-EG')} ج.م</td>
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
                            <div className="flex items-center justify-center gap-1.5">
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

                              </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

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

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenReportPreview(reportType)}
                className="px-4 py-2.5 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md hover:shadow-[#D4A84F]/10 flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة التقرير</span>
              </button>
              <button
                onClick={() => handlePrintReportDirectly(reportType)}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير</span>
              </button>
            </div>
          </div>
          {/* Report Information Card */}
          {/* Report Information Card */}
          <div className="bg-[#132238]/60 p-6 rounded-2xl border border-[#D4A84F]/15 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D4A84F]/10 border border-[#D4A84F]/20 flex items-center justify-center text-[#D4A84F]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#F8F9FB]">
                  {reportType === "property_monthly" && "1. تقرير شهري لكل عقار"}
                  {reportType === "owner_statement" && "2. تقرير كشف حساب مالك"}
                  {reportType === "tenant_statement" && "3. تقرير كشف حساب مستأجر"}
                  {reportType === "owner_payouts" && "4. تقرير المصروف للملاك"}
                  {reportType === "tenant_collections" && "5. تقرير المحصل من المستأجرين"}
                  {reportType === "arrears" && "6. تقرير المتأخرات والديون"}
                  {reportType === "office_commissions" && "7. تقرير عمولات المكتب"}
                  {reportType === "office_advances" && "8. تقرير سُلف المكتب والفرق"}
                </h3>
                <p className="text-xs text-[#9EA7B8] mt-0.5">
                  {reportType === "property_monthly" && "تقرير شامل ومفصل لحركة الإيجارات، التحصيلات، المصروفات، وعمولات العقار عن شهر محدد أو كلي."}
                  {reportType === "owner_statement" && "كشف حساب رسمي للمالك يوضح المستحق، المحصل، عمولة المكتب، سُلف المالك، والمتبقي للصرف."}
                  {reportType === "tenant_statement" && "كشف حساب مفصل للمستأجر مع توضيح الإيجارات الشهرية وسندات السداد وتواريخ الدفع."}
                  {reportType === "owner_payouts" && "سجل كافة سندات الصرف والتحويلات المالية المسددة للملاك مع أرقام السندات."}
                  {reportType === "tenant_collections" && "سجل كافة سندات التحصيل والمبالغ المحصلة من المستأجرين مع أرقام الإيصالات."}
                  {reportType === "arrears" && "حصر الديون والمتأخرات الإيجارية غير المحصلة مع مدد التأخير لكل مستأجر."}
                  {reportType === "office_commissions" && "بيان شامل لعمولات المكتب المستحقة والمحصلة عن كل عقار ومالك."}
                  {reportType === "office_advances" && "حصر سُلف المكتب الممنوحة للملاك ومطابقة الخصومات والاستردادات."}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#D4A84F]/10 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#9EA7B8] flex items-center gap-2 font-bold">
                <Sparkles className="w-4 h-4 text-[#D4A84F]" />
                <span>التقارير مصممة للطباعة الرسمية A4 بتنسيق معتمد وختم المؤسسة.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenReportPreview(reportType)}
                  className="px-4 py-2 bg-[#132238] hover:bg-[#1C2D42] text-[#D4A84F] border border-[#D4A84F]/40 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>معاينة وتصدير</span>
                </button>
                <button
                  onClick={() => handlePrintReportDirectly(reportType)}
                  className="px-4 py-2 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة فورية</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advance Deduction Modal */}
      {advanceDeductionModalData && (
        <AdvanceDeductionModal
          isOpen={!!advanceDeductionModalData}
          onClose={() => setAdvanceDeductionModalData(null)}
          advance={advanceDeductionModalData.advance}
          availableNetEntitlement={advanceDeductionModalData.availableNetEntitlement}
          onConfirmDeduct={handleConfirmAdvanceDeduction}
          onRevertDeduction={handleRevertAdvanceDeduction}
          isSubmitting={isSubmittingAdvanceDeduction}
          currentUser={currentUser}
        />
      )}

      {/* Advance Deduction Receipts Modal */}
      {isAdvanceReceiptsModalOpen && (
        <AdvanceDeductionReceiptsModal
          isOpen={isAdvanceReceiptsModalOpen}
          onClose={() => {
            setIsAdvanceReceiptsModalOpen(false);
            setSelectedAdvanceForReceipts(null);
          }}
          advances={advances || []}
          owners={owners}
          properties={properties}
          selectedAdvance={selectedAdvanceForReceipts}
          currentUser={currentUser}
        />
      )}

      {/* Tenant Collection Receipts Modal */}
      {tenantReceiptsModalTenant && (
        <TenantCollectionReceiptsModal
          isOpen={!!tenantReceiptsModalTenant}
          onClose={() => {
            setTenantReceiptsModalTenant(null);
            setSelectedReceiptForPreview(null);
          }}
          tenant={tenantReceiptsModalTenant}
          collections={collections}
          properties={properties}
          units={units}
          owners={owners}
          currentUser={currentUser}
        />
      )}

      {/* Official Report Modal */}
      {isReportModalOpen && (
        <RealEstateReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          reportType={modalReportType}
          dues={validDues}
          collections={collections}
          owners={owners}
          properties={properties}
          units={units}
          tenants={tenants}
          advances={advances}
          expenses={expenses}
          payouts={payouts}
          commissionStatuses={commissionStatuses}
          rentAdjustments={rentAdjustments}
          selectedPropertyId={modalReportType === "office_commissions" ? commSelectedPropertyId : selectedPropertyId}
          selectedOwnerId={modalReportType === "office_commissions" ? commSelectedOwnerId : selectedOwnerId}
          selectedTenantId={modalReportType === "office_commissions" ? commSelectedTenantId : selectedTenantId}
          selectedMonthYear={modalReportType === "office_commissions" ? commSelectedMonthYear : selectedMonthYear}
          tenantFromMonth={tenantFromMonth}
          tenantToMonth={tenantToMonth}
          ownerStatementsFilter={ownerStatementsFilter}
          ownerAccountType={ownerAccountType}
          commissionsFilter={commSelectedStatus as any}
          commSearchTerm={commSearchTerm}
          commStatements={filteredCommStatements}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
