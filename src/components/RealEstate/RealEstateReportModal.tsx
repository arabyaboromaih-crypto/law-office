import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, Download, X, ZoomIn, ZoomOut, Landmark, FileText, Check, AlertCircle, Eye
} from 'lucide-react';
import { 
  ReRentDue, ReOwner, ReProperty, ReUnit, ReTenant, User, ReCollectionReceipt, ReCommissionStatus, ReOwnerAdvance, RePropertyExpense, ReRentAdjustment, RePayout
} from '../../types';
import { 
  getDueCollectionStatus, 
  getDuePayoutStatus, 
  calculateCommissionFromSettings, 
  getDueCommissionAmount, 
  getPropertyCommissionSettings, 
  getSectionCommissionForPropertyMonth, 
  calculatePropertyStatementsData, 
  calculateOwnerStatementsData, 
  formatMonthYearAr,
  isAdvanceDeductedFromEntitlement,
  getAdvanceDeductedAmount,
  getAdvanceDeductedFromEntitlementAmount
} from './RealEstateData';

export type ReportType = 
  | 'property_monthly' 
  | 'owner_statement' 
  | 'tenant_statement' 
  | 'owner_payouts' 
  | 'tenant_collections' 
  | 'arrears' 
  | 'office_commissions' 
  | 'office_advances';

interface RealEstateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  dues: ReRentDue[];
  collections?: ReCollectionReceipt[];
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  advances?: ReOwnerAdvance[];
  expenses?: RePropertyExpense[];
  payouts?: RePayout[];
  commissionStatuses?: ReCommissionStatus[];
  rentAdjustments?: ReRentAdjustment[];
  selectedPropertyId: string;
  selectedOwnerId: string;
  selectedTenantId: string;
  selectedMonthYear: string;
  tenantFromMonth?: string;
  tenantToMonth?: string;
  ownerStatementsFilter?: 'all' | 'collected' | 'uncollected';
  ownerAccountType?: 'monthly' | 'total';
  accountType?: 'monthly' | 'total';
  commissionsFilter?: 'all' | 'uncollected' | 'collected';
  commSearchTerm?: string;
  commStatements?: Array<{
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
    tenantCount?: number;
    tenantNamesList?: string;
    dues?: ReRentDue[];
  }>;
  currentUser: User;
  autoPrint?: boolean;
  ownerPayoutType?: 'immediate' | 'deferred' | 'all';
}

export function getReportTitle(reportType: ReportType): string {
  switch (reportType) {
    case 'property_monthly':
      return 'التقرير الشهري المالي والإشغالي للعقار';
    case 'owner_statement':
      return 'تقرير كشف حساب وتسوية مستحقات المالك';
    case 'tenant_statement':
      return 'تقرير كشف حساب ومدفوعات وتأخيرات المستأجر';
    case 'owner_payouts':
      return 'تقرير المبالغ المصروفة للملاك';
    case 'tenant_collections':
      return 'تقرير المبالغ المحصلة من المستأجرين';
    case 'arrears':
      return 'تقرير المتأخرات والديون المستحقة عن العقود';
    case 'office_commissions':
      return 'تقرير أرباح وعمولات المكتب عن الإدارة العقارية';
    case 'office_advances':
      return 'تقرير سُلف المكتب والفرق بين المصروف والمحصل';
    default:
      return 'التقرير المالي الرسمي للإدارة العقارية';
  }
}

export function getReportPeriodDescription(params: {
  selectedMonthYear?: string;
  tenantFromMonth?: string;
  tenantToMonth?: string;
  reportType?: ReportType;
}): {
  filterType: string;
  filterPeriod: string;
  badgeText: string;
  displayHeadline: string;
} {
  const { selectedMonthYear, tenantFromMonth, tenantToMonth } = params;

  const monthsMap: Record<string, string> = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
  };

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const formatToDayMonthYear = (val: string, isEnd = false): string => {
    if (!val) return '';
    if (val.length === 7 && val.includes('-')) {
      const [y, m] = val.split('-');
      const yNum = parseInt(y, 10);
      const mNum = parseInt(m, 10);
      if (isEnd) {
        const lastDay = getDaysInMonth(yNum, mNum);
        return `${String(lastDay).padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      } else {
        return `01/${m.padStart(2, '0')}/${y}`;
      }
    }
    if (val.length === 10 && val.includes('-')) {
      const [y, m, d] = val.split('-');
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return val;
  };

  const formatToMonthNameYear = (val: string): string => {
    if (!val) return '';
    if (val.length === 4) return `سنة ${val}`;
    if (val.includes('-')) {
      const [y, m] = val.split('-');
      const mName = monthsMap[m] || m;
      return `${mName} ${y}`;
    }
    return val;
  };

  // Case 1: Both From and To Month are specified
  if (tenantFromMonth && tenantToMonth) {
    if (tenantFromMonth === tenantToMonth) {
      const mText = formatToMonthNameYear(tenantFromMonth);
      return {
        filterType: 'تصفية شهرية',
        filterPeriod: mText,
        badgeText: `الشهر: ${mText}`,
        displayHeadline: `عن شهر ${mText}`
      };
    }

    const fromYear = tenantFromMonth.slice(0, 4);
    const toYear = tenantToMonth.slice(0, 4);
    const isFullYear = fromYear === toYear && tenantFromMonth.endsWith('-01') && tenantToMonth.endsWith('-12');
    if (isFullYear) {
      return {
        filterType: 'تصفية سنوية',
        filterPeriod: fromYear,
        badgeText: `السنة: ${fromYear}`,
        displayHeadline: `عن السنة المالية ${fromYear}`
      };
    }

    const fromDateStr = formatToDayMonthYear(tenantFromMonth, false);
    const toDateStr = formatToDayMonthYear(tenantToMonth, true);
    const fromMonthStr = formatToMonthNameYear(tenantFromMonth);
    const toMonthStr = formatToMonthNameYear(tenantToMonth);

    return {
      filterType: 'تصفية حسب فترة زمنية',
      filterPeriod: `من ${fromMonthStr} إلى ${toMonthStr}`,
      badgeText: `الفترة من ${fromDateStr} إلى ${toDateStr}`,
      displayHeadline: `عن الفترة من ${fromDateStr} إلى ${toDateStr}`
    };
  }

  // Case 2: Only From Month specified
  if (tenantFromMonth && !tenantToMonth) {
    const fromDateStr = formatToDayMonthYear(tenantFromMonth, false);
    const fromMonthStr = formatToMonthNameYear(tenantFromMonth);
    return {
      filterType: 'تصفية من تاريخ محدد',
      filterPeriod: `من ${fromMonthStr} حتى تاريخه`,
      badgeText: `الفترة من ${fromDateStr} حتى تاريخه`,
      displayHeadline: `عن الفترة من ${fromDateStr} حتى تاريخه`
    };
  }

  // Case 3: Only To Month specified
  if (!tenantFromMonth && tenantToMonth) {
    const toDateStr = formatToDayMonthYear(tenantToMonth, true);
    const toMonthStr = formatToMonthNameYear(tenantToMonth);
    return {
      filterType: 'تصفية حتى تاريخ محدد',
      filterPeriod: `حتى ${toMonthStr}`,
      badgeText: `الفترة حتى ${toDateStr}`,
      displayHeadline: `عن الفترة حتى ${toDateStr}`
    };
  }

  // Case 4: selectedMonthYear is active
  if (selectedMonthYear && selectedMonthYear !== 'all') {
    if (selectedMonthYear.length === 4) {
      return {
        filterType: 'تصفية سنوية',
        filterPeriod: selectedMonthYear,
        badgeText: `السنة: ${selectedMonthYear}`,
        displayHeadline: `عن السنة المالية ${selectedMonthYear}`
      };
    }
    const mText = formatToMonthNameYear(selectedMonthYear);
    return {
      filterType: 'تصفية شهرية',
      filterPeriod: mText,
      badgeText: `الشهر: ${mText}`,
      displayHeadline: `عن شهر ${mText}`
    };
  }

  // Case 5: Default / All Periods
  return {
    filterType: 'كافة الفترات',
    filterPeriod: 'جميع الشهور والفترات المسجلة',
    badgeText: 'كافة الفترات المسجلة',
    displayHeadline: 'كافة الفترات الإيجارية المسجلة'
  };
}

export function generateRealEstateReportHTML(params: {
  reportType: ReportType;
  dues: ReRentDue[];
  collections?: ReCollectionReceipt[];
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  advances?: ReOwnerAdvance[];
  expenses?: RePropertyExpense[];
  payouts?: RePayout[];
  commissionStatuses?: ReCommissionStatus[];
  rentAdjustments?: ReRentAdjustment[];
  selectedPropertyId: string;
  selectedOwnerId: string;
  selectedTenantId: string;
  selectedMonthYear: string;
  tenantFromMonth?: string;
  tenantToMonth?: string;
  ownerStatementsFilter?: 'all' | 'collected' | 'uncollected';
  ownerAccountType?: 'monthly' | 'total';
  accountType?: 'monthly' | 'total';
  commissionsFilter?: 'all' | 'uncollected' | 'collected';
  commSearchTerm?: string;
  commStatements?: Array<any>;
  currentUser: User;
  serialNumber?: string;
  issuedAt?: string;
  ownerPayoutType?: 'immediate' | 'deferred' | 'all';
}): string {
  const {
    reportType,
    dues,
    collections = [],
    owners,
    properties,
    units,
    tenants,
    advances = [],
    expenses = [],
    payouts = [],
    commissionStatuses = [],
    rentAdjustments = [],
    selectedPropertyId,
    selectedOwnerId,
    selectedTenantId,
    selectedMonthYear,
    tenantFromMonth,
    tenantToMonth,
    ownerStatementsFilter = 'all',
    ownerAccountType = 'monthly',
    accountType = 'monthly',
    commissionsFilter = 'all',
    commSearchTerm = '',
    commStatements,
    currentUser,
    serialNumber = `RUM-RE-${Math.floor(100000 + Math.random() * 900000)}`,
    issuedAt = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }),
    ownerPayoutType = 'all'
  } = params;

  const todayISO = new Date().toISOString().slice(0, 10);
  const currentMonthISO = new Date().toISOString().slice(0, 7);
  const registeredPropIds = new Set((properties || []).map(p => p.id).filter(Boolean));

  // Status computation helpers
  const getDuePayoutStatus = (due: ReRentDue): 'paid_out' | 'pending_payout' => {
    if (due.payoutStatus === 'paid_out' || due.status === 'paid_out' || due.payoutDate) {
      return 'paid_out';
    }
    return 'pending_payout';
  };

  // --- Owner Statement Dedicated Logic (Identical 100% to Screen via calculateOwnerStatementsData) ---
  const {
    ownerPropertyGroups,
    ownerTotalRentSum,
    ownerTotalCommissionSum,
    ownerTotalNetOwnerSum,
    ownerTotalDisbursedSum,
    ownerTotalCollectedSum,
    ownerTotalBalanceSum,
    allOwnerAdvances,
    allOwnerExpenses,
    allOwnerPayouts = [],
    ownerAdvancesDeducted,
    ownerExpensesDeducted,
    sumDeductedAdvances,
    sumDeductedExpenses,
    totalOwnerDeductions,
    finalNetSettlement,
    finalRemainingBalance,
  } = calculateOwnerStatementsData({
    dues: dues || [],
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

  // Period calculation & description
  const periodInfo = getReportPeriodDescription({
    selectedMonthYear,
    tenantFromMonth,
    tenantToMonth,
    reportType
  });

  // Filter dues based on report configuration
  const rawFilteredDues = dues.filter(d => {
    // Automatically exclude orphaned property records not registered in the Properties section
    if (!d.propertyId || !registeredPropIds.has(d.propertyId)) return false;

    // Property filter
    if (selectedPropertyId !== 'all' && d.propertyId !== selectedPropertyId) return false;

    // Owner filter
    if (selectedOwnerId !== 'all' && d.ownerId !== selectedOwnerId) return false;

    // Tenant filter
    if (selectedTenantId !== 'all' && d.tenantId !== selectedTenantId) return false;

    // Year / Month filter via selectedMonthYear
    if (selectedMonthYear && selectedMonthYear !== 'all') {
      if (selectedMonthYear.length === 4) {
        if (!d.forMonthYear || !d.forMonthYear.startsWith(selectedMonthYear)) return false;
      } else {
        if (d.forMonthYear !== selectedMonthYear) return false;
      }
    }

    // Range filter: tenantFromMonth
    if (tenantFromMonth) {
      const fromMonthKey = tenantFromMonth.slice(0, 7);
      if (d.forMonthYear && d.forMonthYear < fromMonthKey) return false;
    }

    // Range filter: tenantToMonth
    if (tenantToMonth) {
      const toMonthKey = tenantToMonth.slice(0, 7);
      if (d.forMonthYear && d.forMonthYear > toMonthKey) return false;
    }

    // Check matching collection from imported collections (الايجارات والتحصيل)
    const activeCollections = collections.filter(c => c.status !== 'reverted' && !c.isCancelled);
    const matchingColl = activeCollections.find(c => 
      c.tenantId === d.tenantId &&
      ((c.dueId && c.dueId === d.id) || c.forMonthYear === d.forMonthYear || (c.paymentDate && c.paymentDate.slice(0, 7) === d.forMonthYear))
    );
    const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
    const isCollected = (cStat === 'collected' || cStat === 'prepaid') && ((d.collectedAmount || 0) > 0 || (matchingColl?.amountPaid || 0) > 0);

    if (reportType === 'tenant_statement') {
      // If user has specific filter bounds (tenantFromMonth, tenantToMonth, or selectedMonthYear),
      // we strictly follow that window.
      // If no toMonth or selectedMonthYear filter is active, only include past/current + paid future reserves.
      const hasSpecificTimeWindow = !!tenantToMonth || (selectedMonthYear && selectedMonthYear !== 'all');
      if (!hasSpecificTimeWindow) {
        const isCurrentOrPast = !d.forMonthYear || d.forMonthYear <= currentMonthISO;
        const isPaidReserveFuture = d.forMonthYear && d.forMonthYear > currentMonthISO && isCollected;
        if (!(isCurrentOrPast || isPaidReserveFuture)) {
          return false;
        }
      }
    } else if (reportType === 'owner_statement' || reportType === 'office_commissions') {
      // Rule: Owner & Commission statements cutoff is up to end of current month (forMonthYear <= currentMonthISO)
      const isCurrentOrPast = !d.forMonthYear || d.forMonthYear <= currentMonthISO;
      if (!selectedMonthYear || selectedMonthYear === 'all') {
        if (!isCurrentOrPast) return false;
      }
    } else {
      // Rule: Exclude uncollected future reserve months from all other report types
      const isFutureReserve = d.forMonthYear && d.forMonthYear > currentMonthISO;
      if (isFutureReserve && !isCollected) {
        return false;
      }
    }

    if (reportType === 'arrears') {
      if (isCollected) return false;
      if (d.forMonthYear && d.forMonthYear > currentMonthISO && cStat !== 'overdue') return false;
    }
    if (reportType === 'owner_payouts' && getDuePayoutStatus(d) !== 'paid_out') return false;
    if (reportType === 'tenant_collections' && !isCollected) return false;
    if (reportType === 'office_advances' && (getDuePayoutStatus(d) !== 'paid_out' || isCollected)) return false;

    return true;
  });

  // Deduplicate by tenant/unit/month key
  const uniqueMap = new Map<string, typeof rawFilteredDues[0]>();
  rawFilteredDues.forEach(d => {
    const key = `${d.tenantId || d.tenantName}_${d.unitId || d.unitNumber}_${d.forMonthYear}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, d);
    } else {
      const existing = uniqueMap.get(key)!;
      if ((d.status === 'collected' || d.payoutStatus === 'paid_out') && existing.status !== 'collected') {
        uniqueMap.set(key, d);
      }
    }
  });
  const filteredDues = Array.from(uniqueMap.values()).sort((a, b) => (a.forMonthYear || '').localeCompare(b.forMonthYear || ''));

  // Unified Property Statements Data calculation
  const propertyStatementsData = calculatePropertyStatementsData({
    dues: dues || [],
    collections: collections || [],
    properties: properties || [],
    owners: owners || [],
    units: units || [],
    expenses: expenses || [],
    advances: advances || [],
    commissionStatuses: commissionStatuses || [],
    rentAdjustments: rentAdjustments || [],
    filters: {
      selectedPropertyId,
      selectedOwnerId,
      selectedTenantId,
      selectedMonthYear,
      tenantFromMonth,
      tenantToMonth,
      propertyStatementsFilter: commissionsFilter || 'all',
      todayISO,
      currentMonthISO,
    }
  });

  // Financial Summaries for the report
  let sumRent = 0;
  let sumCommission = 0;
  let sumNetOwner = 0;
  let sumCollected = 0;
  let sumDisbursed = 0;
  let sumAdvances = 0;
  let sumExpenses = 0;

  if (reportType === 'property_monthly') {
    sumRent = propertyStatementsData.grandTotalRent;
    sumCollected = propertyStatementsData.grandTotalCollected;
    sumCommission = propertyStatementsData.grandTotalCommission;
    sumExpenses = propertyStatementsData.grandTotalExpenses;
    sumAdvances = propertyStatementsData.grandTotalAdvances;
    sumNetOwner = propertyStatementsData.grandTotalNetOwner;
    sumDisbursed = propertyStatementsData.grandTotalDisbursed;
  } else if (reportType === 'owner_statement') {
    sumRent = ownerTotalRentSum;
    sumCollected = ownerTotalCollectedSum;
    sumCommission = ownerTotalCommissionSum;
    sumExpenses = sumDeductedExpenses;
    sumAdvances = sumDeductedAdvances;
    sumNetOwner = finalNetSettlement;
    sumDisbursed = ownerTotalDisbursedSum;
  } else {
    filteredDues.forEach(d => {
      const commAmt = getDueCommissionAmount(d, owners, properties, filteredDues, commissionStatuses);
      const netAmt = Math.max(0, (d.rentAmount || 0) - commAmt);
      sumRent += d.rentAmount || 0;
      sumCommission += commAmt;
      sumNetOwner += netAmt;

      const pStat = getDuePayoutStatus(d);
      const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);

      if (cStat === 'collected' || cStat === 'prepaid') {
        sumCollected += d.collectedAmount || d.rentAmount || 0;
      }
      if (pStat === 'paid_out') {
        sumDisbursed += d.netOwnerAmount || 0;
        if (cStat !== 'collected') {
          sumAdvances += d.netOwnerAmount || 0;
        }
      }
    });
  }

  // Context Descriptions
  const propertyName = selectedPropertyId === 'all' ? 'جميع العقارات' : (properties.find(p => p.id === selectedPropertyId)?.name || 'عقار محدد');
  const ownerName = selectedOwnerId === 'all' ? 'جميع الملاك' : (owners.find(o => o.id === selectedOwnerId)?.name || 'مالك محدد');
  const tenantName = selectedTenantId === 'all' ? 'جميع المستأجرين' : (tenants.find(t => t.id === selectedTenantId)?.fullName || (tenants.find(t => t.id === selectedTenantId) as any)?.name || 'مستأجر محدد');
  const monthName = selectedMonthYear === 'all' ? 'كافة الشهور' : selectedMonthYear;

  // Unit & Occupancy calculations for property monthly report
  const selectedPropertyUnits = units.filter(u => selectedPropertyId === 'all' || u.propertyId === selectedPropertyId);
  let totalUnitsCount = selectedPropertyUnits.length || 1;
  let leasedUnitsCount = new Set(filteredDues.map(d => d.unitId)).size || selectedPropertyUnits.filter(u => u.status === 'rented').length;
  let vacantUnitsCount = Math.max(0, totalUnitsCount - leasedUnitsCount);
  let totalArrears = Math.max(0, sumRent - sumCollected);
  let collectionPercentage = sumRent > 0 ? Math.round((sumCollected / sumRent) * 100) : 0;

  if (reportType === 'property_monthly') {
    totalUnitsCount = propertyStatementsData.totalUnitsCount || totalUnitsCount;
    leasedUnitsCount = propertyStatementsData.leasedUnitsCount;
    vacantUnitsCount = propertyStatementsData.vacantUnitsCount;
    totalArrears = propertyStatementsData.grandTotalArrears;
    collectionPercentage = propertyStatementsData.collectionRate;
  }

  // Tenant Specific Calculations for Tenant Statement Report
  const selectedTenantObj = tenants.find(t => t.id === selectedTenantId);
  const tenantUnit = units.find(u => u.id === selectedTenantObj?.unitId);
  const tenantProperty = properties.find(p => p.id === (selectedTenantObj?.propertyId || tenantUnit?.propertyId));

  const tenantOverdueDues = filteredDues.filter(d => getDueCollectionStatus(d, todayISO, currentMonthISO, collections) === 'overdue' || (getDueCollectionStatus(d, todayISO, currentMonthISO, collections) !== 'collected' && d.dueDate < todayISO));
  const tenantOverdueMonthsCount = tenantOverdueDues.length;
  const tenantOverdueMonthsNames = tenantOverdueDues.map(d => d.monthNameAr || d.forMonthYear);
  const tenantOverdueStatement = tenantOverdueMonthsNames.length > 0 ? tenantOverdueMonthsNames.join(' – ') : 'لا توجد متأخرات (منتظم بالسداد)';

  let tenantFinancialStatus = 'منتظم';
  let tenantFinancialBadgeClass = 'badge-collected';
  if (tenantOverdueMonthsCount >= 3) {
    tenantFinancialStatus = 'متعثر';
    tenantFinancialBadgeClass = 'badge-overdue';
  } else if (tenantOverdueMonthsCount >= 1) {
    tenantFinancialStatus = 'متأخر';
    tenantFinancialBadgeClass = 'badge-pending';
  }

  const tenantMonthlyRentAmount = (filteredDues.length > 0 ? (filteredDues[filteredDues.length - 1]?.rentAmount || filteredDues[0]?.rentAmount) : 0) || selectedTenantObj?.rentAmount || tenantUnit?.rentValue || 0;

  // Commissions calculations for office_commissions report
  const commItems: Array<{
    propertyId: string;
    propertyName: string;
    ownerId: string;
    ownerName: string;
    forMonthYear: string;
    totalDueRent: number;
    totalCollectedRent: number;
    commissionRateText: string;
    earnedCommission: number;
    amountCollectedFromOwner: number;
    remainingCommission: number;
    status: 'not_claimed' | 'claimed' | 'collected' | 'overdue';
    tenantCount?: number;
    tenantNamesList?: string;
  }> = [];

  if (reportType === 'office_commissions') {
    if (commStatements) {
      commStatements.forEach(stmt => {
        commItems.push({
          propertyId: stmt.propertyId,
          propertyName: stmt.propertyName,
          ownerId: stmt.ownerId,
          ownerName: stmt.ownerName,
          forMonthYear: stmt.forMonthYear,
          totalDueRent: stmt.totalDueRent || 0,
          totalCollectedRent: stmt.totalCollectedRent || 0,
          commissionRateText: stmt.commissionRateText || 'حسب العقد',
          earnedCommission: stmt.earnedCommission || 0,
          amountCollectedFromOwner: stmt.amountCollectedFromOwner || 0,
          remainingCommission: stmt.remainingCommission || 0,
          status: stmt.status || 'not_claimed',
          tenantCount: stmt.tenantCount || (stmt.dues ? stmt.dues.length : 0),
          tenantNamesList: stmt.tenantNamesList || '',
        });
      });
    } else {
      properties.forEach(prop => {
        if (selectedPropertyId !== 'all' && prop.id !== selectedPropertyId) return;
        const owner = owners.find(o => o.id === prop.ownerId);
        if (selectedOwnerId !== 'all' && owner?.id !== selectedOwnerId && prop.ownerId !== selectedOwnerId) return;

        const ownerName = owner?.name || 'مالك غير محدد';
        const commSettings = getPropertyCommissionSettings(prop, owner);
        let rateText = 'حسب العقد';
        if (commSettings.commissionType === 'percentage') {
          rateText = `نسبة (${commSettings.commissionValue}%)`;
        } else if (commSettings.commissionType === 'fixed_per_thousand') {
          rateText = `لكل 1000 (${commSettings.commissionValue} ج.م)`;
        } else if (commSettings.commissionType === 'fixed_flat') {
          rateText = `مبلغ ثابت (${commSettings.commissionValue} ج.م)`;
        }

        const propDues = dues.filter(d => {
          if (d.propertyId !== prop.id) return false;
          if (selectedTenantId !== 'all' && d.tenantId !== selectedTenantId) {
            const selT = tenants.find(t => t.id === selectedTenantId);
            if (!selT || (selT.fullName || '').trim().toLowerCase() !== (d.tenantName || '').trim().toLowerCase()) {
              return false;
            }
          }
          const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
          const isCollected = cStatus === 'collected';
          if (commissionsFilter === 'uncollected' && isCollected) return false;
          if (commissionsFilter === 'collected' && !isCollected) return false;
          return true;
        });

        if (accountType === 'total') {
          const filteredDues = propDues.filter(d => {
            if (selectedMonthYear !== 'all' && selectedMonthYear.length === 7 && d.forMonthYear !== selectedMonthYear) return false;
            if (selectedMonthYear !== 'all' && selectedMonthYear.length === 4 && !d.forMonthYear.startsWith(selectedMonthYear)) return false;
            return true;
          });

          const propStatuses = (commissionStatuses || []).filter(cs => {
            if (cs.propertyId !== prop.id) return false;
            if (selectedMonthYear !== 'all' && selectedMonthYear.length === 7 && cs.forMonthYear !== selectedMonthYear) return false;
            if (selectedMonthYear !== 'all' && selectedMonthYear.length === 4 && !cs.forMonthYear.startsWith(selectedMonthYear)) return false;
            return true;
          });

          if (filteredDues.length === 0 && propStatuses.length === 0) return;

          const totalDueRent = filteredDues.reduce((s, d) => s + (d.rentAmount || 0), 0);
          const totalCollectedRent = filteredDues.reduce((s, d) => {
            const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
            return s + (cStat === 'collected' ? (d.collectedAmount || d.rentAmount || 0) : 0);
          }, 0);

          const earnedComm = calculateCommissionFromSettings(totalDueRent, commSettings);

          let amountCollectedFromOwner = propStatuses.reduce((s, cs) => s + (cs.amountCollectedFromOwner || 0), 0);
          if (amountCollectedFromOwner === 0) {
            const collectedCount = propStatuses.filter(cs => cs.status === 'collected' || cs.isCollectedFromOwner).length;
            if (collectedCount > 0) amountCollectedFromOwner = earnedComm;
          }

          const remainingComm = Math.max(0, earnedComm - amountCollectedFromOwner);

          let statusVal: 'not_claimed' | 'claimed' | 'collected' | 'overdue' = 'not_claimed';
          if (remainingComm === 0 && earnedComm > 0) statusVal = 'collected';
          else if (amountCollectedFromOwner > 0) statusVal = 'claimed';

          if (commSearchTerm.trim()) {
            const q = commSearchTerm.trim().toLowerCase();
            const match = prop.name.toLowerCase().includes(q) || ownerName.toLowerCase().includes(q);
            if (!match) return;
          }

          const tenantNames = Array.from(new Set(filteredDues.map(d => d.tenantName).filter(Boolean)));

          commItems.push({
            propertyId: prop.id,
            propertyName: prop.name,
            ownerId: prop.ownerId || owner?.id || '',
            ownerName,
            forMonthYear: 'حساب إجمالي شامل',
            totalDueRent,
            totalCollectedRent,
            commissionRateText: rateText,
            earnedCommission: earnedComm,
            amountCollectedFromOwner,
            remainingCommission: remainingComm,
            status: statusVal,
            tenantCount: tenantNames.length,
            tenantNamesList: tenantNames.join(' ، ')
          });
        } else {
          const monthYearsSet = new Set<string>();
          propDues.forEach(d => { if (d.forMonthYear) monthYearsSet.add(d.forMonthYear); });
          (commissionStatuses || []).filter(cs => cs.propertyId === prop.id).forEach(cs => { if (cs.forMonthYear) monthYearsSet.add(cs.forMonthYear); });

          const monthYearsList = Array.from(monthYearsSet).sort();
          monthYearsList.forEach(my => {
            if (selectedMonthYear !== 'all' && selectedMonthYear.length === 7 && my !== selectedMonthYear) return;
            if (selectedMonthYear !== 'all' && selectedMonthYear.length === 4 && !my.startsWith(selectedMonthYear)) return;

            const myDues = propDues.filter(d => d.forMonthYear === my);
            const statusObj = (commissionStatuses || []).find(cs => cs.propertyId === prop.id && cs.forMonthYear === my);

            if (myDues.length === 0 && !statusObj) return;

            const totalDueRent = myDues.reduce((s, d) => s + (d.rentAmount || 0), 0);
            const totalCollectedRent = myDues.reduce((s, d) => {
              const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
              return s + (cStat === 'collected' ? (d.collectedAmount || d.rentAmount || 0) : 0);
            }, 0);

            const earnedComm = calculateCommissionFromSettings(totalDueRent, commSettings);

            let statusVal: 'not_claimed' | 'claimed' | 'collected' | 'overdue' = 'not_claimed';
            if (statusObj?.status) {
              statusVal = statusObj.status as any;
            } else if (statusObj?.isCollectedFromOwner) {
              statusVal = 'collected';
            }

            const amountCollectedFromOwner = statusVal === 'collected'
              ? (statusObj?.amountCollectedFromOwner ?? earnedComm)
              : (statusObj?.amountCollectedFromOwner || 0);

            const remainingComm = Math.max(0, earnedComm - amountCollectedFromOwner);

            if (commSearchTerm.trim()) {
              const q = commSearchTerm.trim().toLowerCase();
              const match = prop.name.toLowerCase().includes(q) || ownerName.toLowerCase().includes(q) || my.toLowerCase().includes(q);
              if (!match) return;
            }

            const tenantNames = Array.from(new Set(myDues.map(d => d.tenantName).filter(Boolean)));

            commItems.push({
              propertyId: prop.id,
              propertyName: prop.name,
              ownerId: prop.ownerId || owner?.id || '',
              ownerName,
              forMonthYear: my,
              totalDueRent,
              totalCollectedRent,
              commissionRateText: rateText,
              earnedCommission: earnedComm,
              amountCollectedFromOwner,
              remainingCommission: remainingComm,
              status: statusVal,
              tenantCount: tenantNames.length,
              tenantNamesList: tenantNames.join(' ، ')
            });
          });
        }
      });
    }

    const parseMonthSortKey = (my: string): string => {
      if (!my) return '9999-99';
      const ymMatch = my.match(/(\d{4})[-/](\d{1,2})/);
      if (ymMatch) {
        return `${ymMatch[1]}-${ymMatch[2].padStart(2, '0')}`;
      }
      const yearMatch = my.match(/(\d{4})/);
      if (yearMatch) {
        return `${yearMatch[1]}-00`;
      }
      return '9999-99';
    };

    commItems.sort((a, b) => {
      const keyA = parseMonthSortKey(a.forMonthYear);
      const keyB = parseMonthSortKey(b.forMonthYear);
      if (keyA !== keyB) {
        return keyA.localeCompare(keyB);
      }
      const propComp = a.propertyName.localeCompare(b.propertyName, 'ar');
      if (propComp !== 0) return propComp;
      return a.ownerName.localeCompare(b.ownerName, 'ar');
    });
  }

  const commTotalDueRentSum = commItems.reduce((s, i) => s + i.totalDueRent, 0);
  const commTotalCollectedRentSum = commItems.reduce((s, i) => s + i.totalCollectedRent, 0);
  const commEarnedCommSum = commItems.reduce((s, i) => s + i.earnedCommission, 0);
  const commCollectedFromOwnerSum = commItems.reduce((s, i) => s + i.amountCollectedFromOwner, 0);
  const commRemainingCommSum = commItems.reduce((s, i) => s + i.remainingCommission, 0);

  const reportTitle = getReportTitle(reportType);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle} - مؤسسة رميح للمحاماة</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 12mm 15mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'IBM Plex Sans Arabic', 'Cairo', sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      direction: rtl;
      text-align: right;
      font-size: 11pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .page-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 5mm;
      background: #ffffff;
    }

    /* Official Branding Header */
    .header-branding {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px double #b45309;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }

    .brand-logo-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border: 2px solid #d97706;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #f59e0b;
      font-size: 24px;
      font-weight: bold;
    }

    .firm-name {
      font-size: 15pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
    }

    .firm-sub {
      font-size: 9.5pt;
      color: #b45309;
      font-weight: 700;
      margin-top: 2px;
    }

    .meta-box {
      text-align: left;
      font-size: 8.5pt;
      color: #475569;
    }

    .meta-box strong {
      color: #0f172a;
    }

    .serial-badge {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: bold;
      font-size: 9pt;
      margin-top: 4px;
    }

    /* Report Banner */
    .report-title-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fbbf24;
      text-align: center;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #d97706;
      margin-bottom: 12px;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
    }

    .report-title-banner h1 {
      font-size: 13pt;
      font-weight: 800;
      margin: 0;
      color: #f59e0b;
    }

    .period-headline-badge {
      margin-top: 5px;
      display: inline-block;
      padding: 3px 12px;
      background: rgba(212, 168, 79, 0.15);
      border: 1px solid rgba(212, 168, 79, 0.4);
      border-radius: 6px;
      color: #f1f5f9;
      font-size: 8.5pt;
      font-weight: 700;
    }

    /* Filters Summary Grid */
    .filters-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 8.5pt;
    }

    .filter-item {
      display: flex;
      flex-direction: column;
    }

    .filter-item .label {
      color: #64748b;
      font-weight: 700;
      font-size: 7.5pt;
      margin-bottom: 1px;
    }

    .filter-item .val {
      color: #0f172a;
      font-weight: 700;
    }

    .filter-item.period-filter-item {
      background: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 6px;
      padding: 3px 6px;
    }

    .period-filter-val {
      color: #b45309 !important;
      font-weight: 800 !important;
    }

    /* KPI Cards Row */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 15px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }

    .kpi-card.gold {
      border-color: #f59e0b;
      background: #fffbeb;
    }

    .kpi-card.emerald {
      border-color: #10b981;
      background: #ecfdf5;
    }

    .kpi-card .kpi-lbl {
      font-size: 7.5pt;
      color: #475569;
      font-weight: 700;
      display: block;
    }

    .kpi-card .kpi-val {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
      font-family: 'Cairo', sans-serif;
    }

    /* Report Data Table */
    .data-table-container {
      width: 100%;
      margin-bottom: 20px;
    }

    table.report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }

    table.report-table th {
      background-color: #0f172a;
      color: #f59e0b;
      font-weight: 800;
      padding: 7px 6px;
      border: 1px solid #1e293b;
      text-align: center;
      font-size: 8.5pt;
    }

    table.report-table td {
      padding: 6px 6px;
      border: 1px solid #cbd5e1;
      text-align: center;
      vertical-align: middle;
    }

    table.report-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .num-font {
      font-family: 'Cairo', monospace, sans-serif;
      font-weight: 700;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
    }

    .badge-collected {
      background-color: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }

    .badge-overdue {
      background-color: #ffe4e6;
      color: #9f1239;
      border: 1px solid #fecdd3;
    }

    .badge-pending {
      background-color: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    .badge-payout {
      background-color: #e0e7ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
    }

    tr.total-row td {
      background-color: #1e293b !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 9pt;
      border-top: 2px solid #d97706;
    }

    tr.total-row td.gold-text {
      color: #f59e0b !important;
    }

    /* Signatures Section */
    .signatures-block {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 1px solid #cbd5e1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      text-align: center;
      font-size: 8.5pt;
    }

    .sig-col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 70px;
    }

    .sig-title {
      font-weight: 700;
      color: #334155;
    }

    .sig-dots {
      color: #94a3b8;
      font-weight: bold;
    }

    /* Footer */
    .report-footer {
      margin-top: 20px;
      text-align: center;
      font-size: 7.5pt;
      color: #64748b;
      border-top: 1px border #e2e8f0;
      padding-top: 6px;
    }

    @media print {
      body {
        background: white !important;
        color: black !important;
      }
      .page-container {
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">

    <!-- Header Branding -->
    <div class="header-branding">
      <div class="brand-logo-title">
        <div class="brand-icon">⚖️</div>
        <div>
          <div class="firm-name">مؤسسة رميح للمحاماة والاستشارات القانونية</div>
          <div class="firm-sub">قطاع الإدارة العقارية والتحصيل والخدمات المالية والتوثيق</div>
        </div>
      </div>

      <div class="meta-box">
        <div><strong>تاريخ الإصدار:</strong> ${issuedAt}</div>
        <div><strong>مُعد التقرير:</strong> ${currentUser?.fullName || (currentUser as any)?.name || 'عربي أبو رميح'}</div>
        <div class="serial-badge">${serialNumber}</div>
      </div>
    </div>

    <!-- Title Banner -->
    <div class="report-title-banner">
      <h1>${reportTitle}</h1>
      <div class="period-headline-badge">${periodInfo.displayHeadline} • (${periodInfo.filterType})</div>
    </div>

    <!-- Filters Summary -->
    <div class="filters-summary">
      <div class="filter-item">
        <span class="label">العقار المختار:</span>
        <span class="val">${propertyName}</span>
      </div>
      <div class="filter-item">
        <span class="label">المالك:</span>
        <span class="val">${ownerName}</span>
      </div>
      ${reportType !== 'office_commissions' ? `
      <div class="filter-item">
        <span class="label">المستأجر:</span>
        <span class="val">${tenantName}</span>
      </div>
      ` : ''}
      <div class="filter-item period-filter-item">
        <span class="label">الفترة والتصفية:</span>
        <span class="val period-filter-val">${periodInfo.badgeText}</span>
      </div>
    </div>

    <!-- KPI Summary Row -->
    ${reportType === 'office_commissions' ? `
      <div class="kpi-row">
        <div class="kpi-card gold">
          <span class="kpi-lbl">إجمالي الإيجارات المستحقة</span>
          <span class="kpi-val">${commTotalDueRentSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">إجمالي الإيجارات المحصلة</span>
          <span class="kpi-val">${commTotalCollectedRentSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card gold">
          <span class="kpi-lbl">إجمالي عمولات المكتب</span>
          <span class="kpi-val">${commEarnedCommSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">العمولات المحصلة من الملاك</span>
          <span class="kpi-val">${commCollectedFromOwnerSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">المتبقي قيد المطالبة</span>
          <span class="kpi-val">${commRemainingCommSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
      </div>
    ` : reportType === 'property_monthly' ? `
      <div class="kpi-row">
        <div class="kpi-card gold">
          <span class="kpi-lbl">إجمالي الإيراد الشهري (قبل الخصم)</span>
          <span class="kpi-val">${sumRent.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">إجمالي الإيجارات المحصلة</span>
          <span class="kpi-val">${sumCollected.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">إجمالي المتأخرات</span>
          <span class="kpi-val">${totalArrears.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">نسبة التحصيل</span>
          <span class="kpi-val">${collectionPercentage}%</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">حالة إشغال الوحدات</span>
          <span class="kpi-val">${leasedUnitsCount} مؤجرة / ${vacantUnitsCount} شاغرة</span>
        </div>
      </div>
    ` : reportType === 'tenant_statement' ? `
      <div class="kpi-row">
        <div class="kpi-card gold">
          <span class="kpi-lbl">إجمالي الإيجارات المطلوبة</span>
          <span class="kpi-val">${sumRent.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">إجمالي المبالغ المحصلة</span>
          <span class="kpi-val">${sumCollected.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">إجمالي المتأخرات والرصيد</span>
          <span class="kpi-val">${totalArrears.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">${selectedTenantId === 'all' ? 'نسبة التحصيل' : 'الشهور المتأخرة'}</span>
          <span class="kpi-val">${selectedTenantId === 'all' ? `${collectionPercentage}%` : `${tenantOverdueMonthsCount} شهر`}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">${selectedTenantId === 'all' ? 'نوع التصفية' : 'حالة المستأجر المالية'}</span>
          <span class="kpi-val">${selectedTenantId === 'all' ? `<span class="badge badge-payout">${periodInfo.filterType}</span>` : `<span class="badge ${tenantFinancialBadgeClass}">${tenantFinancialStatus}</span>`}</span>
        </div>
      </div>

      ${selectedTenantObj ? `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 15px; font-size: 8.5pt;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 6px;">
            <div><strong>اسم المستأجر:</strong> ${selectedTenantObj.fullName}</div>
            <div><strong>العقار / الوحدة:</strong> ${tenantProperty?.name || '—'} (وحدة ${tenantUnit?.unitNumber || '—'})</div>
            <div><strong>قيمة الإيجار الشهري:</strong> ${tenantMonthlyRentAmount.toLocaleString('ar-EG')} ج.م</div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div><strong>فترة التقرير:</strong> ${periodInfo.badgeText}</div>
            <div><strong>رقم العقد:</strong> ${selectedTenantObj.contractNumber || 'ساري'}</div>
            <div><strong>حالة المديونية:</strong> ${totalArrears > 0 ? `${totalArrears.toLocaleString('ar-EG')} ج.م متأخرة` : 'لا توجد مديونية'}</div>
          </div>
        </div>
      ` : ''}
    ` : reportType === 'owner_statement' ? `
      <div class="kpi-row">
        <div class="kpi-card gold">
          <span class="kpi-lbl">إجمالي الإيجارات المستحقة</span>
          <span class="kpi-val">${ownerTotalRentSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">إجمالي الإيجارات المحصلة</span>
          <span class="kpi-val">${ownerTotalCollectedSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card gold">
          <span class="kpi-lbl">عمولات المكتب المستحقة</span>
          <span class="kpi-val">${ownerTotalCommissionSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">صافي استحقاق المالك</span>
          <span class="kpi-val" style="color: #b45309; font-weight: 800;">${ownerTotalNetOwnerSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card" style="border-color: #f87171; background: #fff5f5;">
          <span class="kpi-lbl" style="color: #991b1b;">الخصومات (سلف ومصروفات)</span>
          <span class="kpi-val" style="color: #dc2626; font-weight: 900;">${totalOwnerDeductions > 0 ? `-${totalOwnerDeductions.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">المصروف الفعلي للمالك</span>
          <span class="kpi-val" style="color: #0284c7; font-weight: 800;">${ownerTotalDisbursedSum.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">صافي الرصيد المتبقي للمالك</span>
          <span class="kpi-val" style="color: #059669; font-weight: 900;">${finalRemainingBalance.toLocaleString('ar-EG')} ج.م</span>
        </div>
      </div>
    ` : `
      <div class="kpi-row">
        <div class="kpi-card gold">
          <span class="kpi-lbl">إجمالي المستحق</span>
          <span class="kpi-val">${sumRent.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card emerald">
          <span class="kpi-lbl">المبالغ المحصلة</span>
          <span class="kpi-val">${sumCollected.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">المصروف للملاك</span>
          <span class="kpi-val">${sumDisbursed.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">عمولات المكتب</span>
          <span class="kpi-val">${sumCommission.toLocaleString('ar-EG')} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-lbl">سُلف الفرق</span>
          <span class="kpi-val">${sumAdvances.toLocaleString('ar-EG')} ج.م</span>
        </div>
      </div>
    `}

    <!-- Data Table -->
    <div class="data-table-container">
      <table class="report-table">
        ${reportType === 'office_commissions' ? `
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 22%;">اسم العقار والمالك</th>
              <th style="width: 10%;">الشهر المالي</th>
              <th style="width: 11%;">الإيجار المستحق</th>
              <th style="width: 11%;">الإيجار المحصل</th>
              <th style="width: 10%;">نسبة / نوع العمولة</th>
              <th style="width: 10%;">العمولة المستحقة</th>
              <th style="width: 10%;">المحصل من المالك</th>
              <th style="width: 11%;">المتبقي للمكتب</th>
              <th style="width: 11%;">حالة المطالبة والسداد</th>
            </tr>
          </thead>
          <tbody>
            ${commItems.length === 0 ? `
              <tr>
                <td colspan="10" style="padding: 20px; color: #64748b; font-weight: bold; text-align: center;">
                  لا توجد عمولات مطابقة للفلاتر المحددة.
                </td>
              </tr>
            ` : commItems.map((item, idx) => `
              <tr>
                <td class="num-font" style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 700; text-align: right;">
                  <div style="font-size: 8.5pt; color: #0f172a; font-weight: 800;">${item.propertyName}</div>
                  <div style="font-size: 7.5pt; color: #b45309; font-weight: 700;">المالك: ${item.ownerName}</div>
                </td>
                <td class="num-font" style="text-align: center; font-weight: 700;">${item.forMonthYear}</td>
                <td class="num-font">${item.totalDueRent.toLocaleString('ar-EG')} ج.م</td>
                <td class="num-font" style="color: #059669;">${item.totalCollectedRent.toLocaleString('ar-EG')} ج.م</td>
                <td style="font-size: 8pt; font-weight: 700; text-align: center;">${item.commissionRateText}</td>
                <td class="num-font" style="font-weight: 800; color: #b45309;">${item.earnedCommission.toLocaleString('ar-EG')} ج.م</td>
                <td class="num-font" style="color: #059669; font-weight: 700;">${item.amountCollectedFromOwner.toLocaleString('ar-EG')} ج.م</td>
                <td class="num-font" style="color: ${item.remainingCommission > 0 ? '#dc2626' : '#059669'}; font-weight: 800;">${item.remainingCommission.toLocaleString('ar-EG')} ج.م</td>
                <td style="text-align: center;">
                  ${item.status === 'collected' ? '<span class="badge badge-collected">تم التحصيل</span>' :
                    item.status === 'claimed' ? '<span class="badge badge-payout">تمت المطالبة</span>' :
                    item.status === 'overdue' ? '<span class="badge badge-overdue">متأخرة</span>' :
                    '<span class="badge badge-pending">لم تتم المطالبة</span>'}
                </td>
              </tr>
            `).join('')}
            
            <tr class="total-row">
              <td colspan="3" style="text-align: right; padding-right: 15px;">
                الإجمالي الكلي لتقرير عمولات المكتب (${commItems.length} سجل)
              </td>
              <td class="num-font gold-text">${commTotalDueRentSum.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${commTotalCollectedRentSum.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text" style="text-align: center;">—</td>
              <td class="num-font gold-text">${commEarnedCommSum.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${commCollectedFromOwnerSum.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${commRemainingCommSum.toLocaleString('ar-EG')} ج.م</td>
              <td style="font-size: 8pt; text-align: center;">تقرير معتمد رسمياً</td>
            </tr>
          </tbody>
        ` : reportType === 'tenant_statement' && selectedTenantId === 'all' ? `
          <thead>
            <tr>
              <th style="width: 3%;">#</th>
              <th style="width: 15%;">اسم المستأجر</th>
              <th style="width: 12%;">العقار</th>
              <th style="width: 6%;">الوحدة</th>
              <th style="width: 12%;">اسم المالك</th>
              <th style="width: 9%;">الإيجار الشهري</th>
              <th style="width: 7%;">الأشهر المستحقة</th>
              <th style="width: 11%;">إجمالي المستحقات</th>
              <th style="width: 11%;">إجمالي المحصل</th>
              <th style="width: 12%;">الرصيد المتبقي</th>
              <th style="width: 10%;">آخر تاريخ تحصيل</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const displayTenants = tenants.filter(t => {
                if (selectedPropertyId === 'all') return true;
                if (t.propertyId && t.propertyId === selectedPropertyId) return true;
                const u = units.find(unit => unit.id === t.unitId);
                return u?.propertyId === selectedPropertyId;
              });

              if (displayTenants.length === 0) {
                return `
                  <tr>
                    <td colspan="11" style="padding: 20px; color: #64748b; font-weight: bold;">
                      لا يوجد مستأجرون مطابقون للعقار أو الفلاتر المختارة.
                    </td>
                  </tr>
                `;
              }

              const activeCollections = collections.filter(c => c && c.status !== 'reverted' && !c.isCancelled && (c.amountPaid || 0) > 0);

              let tableSumReq = 0;
              let tableSumColl = 0;
              let tableSumArrears = 0;

              const rowsHtml = displayTenants.map((t, idx) => {
                const tUnit = units.find(u => u.id === t.unitId);
                const tProp = properties.find(p => p.id === (t.propertyId || tUnit?.propertyId));
                const tOwner = owners.find(o => o.id === (tProp?.ownerId || (tUnit as any)?.ownerId));

                // STRICTLY filter dues for this tenant from filteredDues (which already applies all date, year, month & property filters)
                const tenantDuesInPeriod = filteredDues.filter(d => d.tenantId === t.id);

                const unpaidDues = tenantDuesInPeriod.filter(d => {
                  const matchingColl = activeCollections.find(c => 
                    c.tenantId === d.tenantId &&
                    ((c.dueId && c.dueId === d.id) || c.forMonthYear === d.forMonthYear)
                  );
                  const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                  const isCollected = (cStat === 'collected' || cStat === 'prepaid') && !!matchingColl;
                  return !isCollected && (!d.forMonthYear || d.forMonthYear <= currentMonthISO);
                });
                const overdueMonthsCount = unpaidDues.length;

                const latestTenantDue = tenantDuesInPeriod.length > 0 ? tenantDuesInPeriod[tenantDuesInPeriod.length - 1] : null;
                const tRentCurrent = latestTenantDue?.rentAmount || t.rentAmount || tUnit?.rentValue || 0;
                const tTotalReq = tenantDuesInPeriod.reduce((s, d) => s + (d.rentAmount || 0), 0);
                const tTotalColl = tenantDuesInPeriod.reduce((s, d) => {
                  const matchingColl = activeCollections.find(c => 
                    c.tenantId === d.tenantId &&
                    ((c.dueId && c.dueId === d.id) || c.forMonthYear === d.forMonthYear)
                  );
                  const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                  const isCollected = (cStat === 'collected' || cStat === 'prepaid') && !!matchingColl;
                  const collectedVal = matchingColl?.amountPaid ?? (isCollected ? (d.collectedAmount || d.rentAmount || 0) : 0);
                  return s + collectedVal;
                }, 0);
                const tArrears = Math.max(0, tTotalReq - tTotalColl);

                tableSumReq += tTotalReq;
                tableSumColl += tTotalColl;
                tableSumArrears += tArrears;

                const tCollections = activeCollections.filter(c => c.tenantId === t.id);
                const collDates = [
                  ...tCollections.map(c => c.paymentDate).filter(Boolean),
                  ...tenantDuesInPeriod.map(d => d.paidDate).filter(Boolean)
                ].sort((a, b) => (b || '').localeCompare(a || ''));
                const lastPaymentDate = collDates.length > 0 ? collDates[0] : '—';

                return `
                  <tr>
                    <td class="num-font">${idx + 1}</td>
                    <td style="font-weight: 700;">${t.fullName}<br><span style="font-size: 7.5pt; color: #64748b;">${t.phone || ''}</span></td>
                    <td style="font-weight: 700; color: #b45309;">${tProp?.name || '—'}</td>
                    <td class="num-font">وحدة ${tUnit?.unitNumber || '—'}</td>
                    <td style="font-weight: 700;">${tOwner?.name || (tOwner as any)?.fullName || '—'}</td>
                    <td class="num-font" style="font-weight: 800;">${tRentCurrent.toLocaleString('ar-EG')} ج.م</td>
                    <td class="num-font" style="font-weight: 800; color: ${overdueMonthsCount > 0 ? '#dc2626' : '#059669'};">${overdueMonthsCount} شهر</td>
                    <td class="num-font" style="font-weight: 800; color: #1e293b;">${tTotalReq.toLocaleString('ar-EG')} ج.م</td>
                    <td class="num-font" style="color: #059669; font-weight: 700;">${tTotalColl.toLocaleString('ar-EG')} ج.م</td>
                    <td class="num-font" style="color: #dc2626; font-weight: 700;">${tArrears.toLocaleString('ar-EG')} ج.م</td>
                    <td class="num-font" style="font-size: 8pt; color: #334155;">${lastPaymentDate}</td>
                  </tr>
                `;
              }).join('');

              return rowsHtml + `
                <tr class="total-row">
                  <td colspan="5" style="text-align: right; padding-right: 15px;">
                    إجمالي التقرير المجمع لجميع المستأجرين (${displayTenants.length} مستأجر)
                  </td>
                  <td class="num-font gold-text">${displayTenants.reduce((s, t) => {
                    const tDues = filteredDues.filter(d => d.tenantId === t.id);
                    const latest = tDues.length > 0 ? tDues[tDues.length - 1] : null;
                    return s + (latest?.rentAmount || t.rentAmount || 0);
                  }, 0).toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text">—</td>
                  <td class="num-font gold-text">${tableSumReq.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text">${tableSumColl.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text">${tableSumArrears.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font">—</td>
                </tr>
              `;
            })()}
          </tbody>
        ` : reportType === 'tenant_statement' ? `
          <thead>
            <tr>
              <th style="width: 4%;">#</th>
              <th style="width: 16%;">اسم المستأجر والعقار</th>
              <th style="width: 10%;">الشهر المالي</th>
              <th style="width: 10%;">تاريخ الاستحقاق</th>
              <th style="width: 12%;">الإيجار المطلوب</th>
              <th style="width: 12%;">المبلغ المحصل</th>
              <th style="width: 12%;">المتأخرات والرصيد</th>
              <th style="width: 14%;">الإيصال والتاريخ</th>
              <th style="width: 10%;">حالة السداد</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDues.length === 0 ? `
              <tr>
                <td colspan="9" style="padding: 20px; color: #64748b; font-weight: bold;">
                  لا توجد سجلاّت ماليّة أو إيجاريّة مطابقة للمستأجر المحدد.
                </td>
              </tr>
            ` : filteredDues.map((d, idx) => {
              const activeCollections = collections.filter(c => c && c.status !== 'reverted' && !c.isCancelled && (c.amountPaid || 0) > 0);
              const matchingColl = activeCollections.find(c => 
                c.tenantId === d.tenantId &&
                ((c.dueId && c.dueId === d.id) || c.forMonthYear === d.forMonthYear)
              );
              const revertedColl = collections.find(c => 
                (c.status === 'reverted' || c.isCancelled) &&
                c.tenantId === d.tenantId &&
                ((c.dueId && c.dueId === d.id) || c.forMonthYear === d.forMonthYear)
              );

              const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
              const isCollected = (cStat === 'collected' || cStat === 'prepaid') && !!matchingColl;
              const rentDue = d.rentAmount || 0;
              const collected = isCollected ? (matchingColl?.amountPaid ?? (d.collectedAmount || rentDue)) : 0;
              const arrears = Math.max(0, rentDue - collected);
              const paidDateVal = matchingColl?.paymentDate || d.paidDate || '';
              const receiptNoVal = matchingColl?.receiptNumber || d.receiptNumber || '';

              const isPrepaidReserve = isCollected && d.forMonthYear && d.forMonthYear > currentMonthISO;
              let badgeClass = 'badge-pending';
              let badgeText = 'مستحق';
              let badgeCustomStyle = '';

              if (isCollected) {
                badgeClass = 'badge-collected';
                badgeText = isPrepaidReserve ? 'مقدم رصيد' : 'مسدد بالكامل';
              } else if (revertedColl || d.lastRevertDate) {
                badgeClass = 'badge-overdue';
                badgeText = 'مرتجع / ملغى';
              } else if (cStat === 'overdue') {
                badgeClass = 'badge-overdue';
                badgeText = 'متأخر';
              }

              return `
                <tr>
                  <td class="num-font">${idx + 1}</td>
                  <td style="font-weight: 700;">${d.tenantName || '—'}<br><span style="font-size: 7.5pt; color: #64748b;">${d.propertyName || ''} - وحدة ${d.unitNumber || ''}</span></td>
                  <td class="num-font" style="font-weight: 700;">${d.forMonthYear || ''}</td>
                  <td class="num-font" style="color: #475569;">${d.dueDate || ''}</td>
                  <td class="num-font" style="font-weight: 800; color: #1e293b;">${rentDue.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font" style="color: #059669; font-weight: 700;">${collected.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font" style="color: #dc2626; font-weight: 700;">${arrears.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font" style="font-size: 8pt; color: #334155;">
                    ${isCollected 
                      ? `إيصال #${receiptNoVal || 'محصل'}<br><span style="color: #64748b;">${paidDateVal || ''}</span>` 
                      : (revertedColl || d.lastRevertDate
                          ? `<span style="color: #dc2626; font-weight: 800; font-size: 7.5pt;">⚠️ تم إلغاء التحصيل والرجوع عنه</span><br><span style="color: #991b1b; font-size: 7pt;">تاريخ الرجوع: ${revertedColl?.updatedAt?.slice(0, 10) || revertedColl?.revertedAt || d.lastRevertDate || paidDateVal || '—'}</span>`
                          : '—'
                        )
                    }
                  </td>
                  <td><span class="badge ${badgeClass}" ${badgeCustomStyle ? `style="${badgeCustomStyle}"` : ''}>${badgeText}</span></td>
                </tr>
              `;
            }).join('')}
            
            <tr class="total-row">
              <td colspan="4" style="text-align: right; padding-right: 15px;">
                إجمالي كشف حساب المستأجر (${filteredDues.length} شهر/استحقاق)
              </td>
              <td class="num-font gold-text">${sumRent.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${sumCollected.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${(sumRent - sumCollected).toLocaleString('ar-EG')} ج.م</td>
              <td colspan="2" style="font-size: 8pt; text-align: center;">الرصيد المتبقي: ${(sumRent - sumCollected).toLocaleString('ar-EG')} ج.م</td>
            </tr>
          </tbody>
        ` : reportType === 'property_monthly' ? (() => {
          const pGroupsList = propertyStatementsData.propertyGroups;

          if (pGroupsList.length === 0) {
            return `
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم العقار والمالك</th>
                  <th>الشهر المالي</th>
                  <th>إجمالي الإيجار</th>
                  <th>الإيجار المحصل</th>
                  <th>عمولة المكتب</th>
                  <th>السلف والمصروفات</th>
                  <th>صافي مستحق المالك</th>
                  <th>المصروف للمالك</th>
                  <th>حالة التسوية</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="10" style="padding: 20px; color: #64748b; font-weight: bold;">
                    لا توجد بيانات مطابقة للفلاتر المحددة لهذا التقرير.
                  </td>
                </tr>
              </tbody>
            `;
          }

          const renderDeductionsCell = (advancesList: ReOwnerAdvance[] = [], expensesList: RePropertyExpense[] = []) => {
            const items: string[] = [];

            advancesList.forEach(a => {
              const isDed = !!a.isDeducted;
              const isReverted = !isDed && (!!a.unDeductedAt || !!(a as any).unDeductedBy);
              const isEntitlement = isAdvanceDeductedFromEntitlement(a);
              const dedAmt = getAdvanceDeductedAmount(a) || a.amount || 0;
              let statusText = 'لم يتم الخصم';
              let statusColor = '#b45309';
              let statusBg = '#fef3c7';

              if (isDed) {
                if (isEntitlement) {
                  statusText = 'خصم من المستحق';
                  statusColor = '#dc2626';
                  statusBg = '#ffe4e6';
                } else {
                  statusText = 'سداد نقدي (لا يخصم)';
                  statusColor = '#059669';
                  statusBg = '#d1fae5';
                }
              } else if (isReverted) {
                statusText = 'تم إلغاء الخصم';
                statusColor = '#dc2626';
                statusBg = '#ffe4e6';
              }

              const noteText = a.notes ? (a.notes.length > 25 ? a.notes.slice(0, 25) + '...' : a.notes) : 'سلفة مالك';
              const refText = a.deductionRef ? ` (مرجع #${a.deductionRef})` : '';

              items.push(`
                <div style="margin-bottom: 3px; padding: 3px 5px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 7pt; text-align: right; line-height: 1.25;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: ${isDed && !isEntitlement ? '#059669' : '#b45309'};">
                      سلفة: ${isDed && isEntitlement ? '-' : ''}${dedAmt.toLocaleString('ar-EG')} ج.م
                    </span>
                    <span style="font-size: 6pt; font-weight: bold; color: ${statusColor}; background: ${statusBg}; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">${statusText}</span>
                  </div>
                  <div style="color: #64748b; font-size: 6.5pt; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.notes || ''}${refText}">${noteText}${refText}</div>
                </div>
              `);
            });

            expensesList.forEach(e => {
              const isDed = !!e.isDeducted;
              const isReverted = !isDed && (!!e.unDeductedAt || !!(e as any).unDeductedBy);
              let statusText = 'لم يتم الخصم';
              let statusColor = '#b45309';
              let statusBg = '#fef3c7';

              if (isDed) {
                statusText = 'خصم من المستحق';
                statusColor = '#dc2626';
                statusBg = '#ffe4e6';
              } else if (isReverted) {
                statusText = 'تم إلغاء الخصم';
                statusColor = '#dc2626';
                statusBg = '#ffe4e6';
              }

              const descText = e.description || (e as any).notes || 'مصروف عقار';
              const shortDesc = descText.length > 25 ? descText.slice(0, 25) + '...' : descText;

              items.push(`
                <div style="margin-bottom: 3px; padding: 3px 5px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 7pt; text-align: right; line-height: 1.25;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                    <span style="font-weight: 800; color: #0284c7;">مصروف: ${isDed ? '-' : ''}${(e.amount || 0).toLocaleString('ar-EG')} ج.م</span>
                    <span style="font-size: 6pt; font-weight: bold; color: ${statusColor}; background: ${statusBg}; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">${statusText}</span>
                  </div>
                  <div style="color: #64748b; font-size: 6.5pt; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descText}">[${e.category || 'صيانة'}] ${shortDesc}</div>
                </div>
              `);
            });

            if (items.length === 0) {
              return `<span style="color: #94a3b8; font-size: 7.5pt; font-family: monospace;">—</span>`;
            }

            return items.join('');
          };

          return `
            </table>
            ${pGroupsList.map(pGroup => {
              const sortedMonths = pGroup.months;

              const pTotalRent = pGroup.totalRentSum;
              const pTotalCollected = pGroup.totalCollectedSum;
              const pTotalArrears = pGroup.totalArrearsSum;
              const pTotalCommission = pGroup.totalCommissionSum;
              const pTotalDeductions = pGroup.totalDeductionsSum || 0;
              const pTotalNetOwner = pGroup.totalNetOwnerSum;
              const pTotalDisbursed = pGroup.totalDisbursedSum;
              const pTotalBalance = pGroup.totalBalanceSum;

              return `
                <table class="report-table" style="margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #0f172a; color: #f59e0b;">
                      <th colspan="12" style="text-align: right; padding: 10px 14px; font-size: 11pt; font-weight: 900; border-bottom: 2px solid #d4a84f;">
                        🏢 عقار: ${pGroup.propertyName} — المالك: ${pGroup.ownerName} <span style="font-size: 9pt; color: #94a3b8; font-weight: normal; margin-right: 10px;">(${sortedMonths.length} شهر مالي)</span>
                      </th>
                    </tr>
                    <tr>
                      <th style="width: 3%;">#</th>
                      <th style="width: 11%;">الشهر المالي</th>
                      <th style="width: 7%;">عدد المستأجرين</th>
                      <th style="width: 10%;">إجمالي إيجار العقار</th>
                      <th style="width: 10%;">الإيجار المحصل</th>
                      <th style="width: 8%;">المتأخرات</th>
                      <th style="width: 8%;">عمولة المكتب</th>
                      <th style="width: 8%;">حالة تحصيل العمولة</th>
                      <th style="width: 17%;">السلف والمصروفات</th>
                      <th style="width: 10%;">صافي مستحق المالك</th>
                      <th style="width: 8%;">المصروف للمالك</th>
                      <th style="width: 8%;">حالة الصرف والتسوية</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sortedMonths.map((m, idx) => {
                      let statusBadge = 'لم يُصرف';
                      let badgeClass = 'badge-overdue';

                      if (m.paidOutCount === m.tenantCount && m.tenantCount > 0) {
                        statusBadge = 'صُرف بالكامل';
                        badgeClass = 'badge-collected';
                      } else if (m.disbursedSum > 0 || m.paidOutCount > 0) {
                        statusBadge = 'صُرف جزئياً';
                        badgeClass = 'badge-pending';
                      }

                      const arrearsVal = m.arrearsSum;

                      let commBadgeText = 'لم يتم التحصيل';
                      let commBadgeClass = 'badge-overdue';

                      if (m.isCommissionCollected || m.commissionStatus === 'collected') {
                        commBadgeText = 'تم التحصيل';
                        commBadgeClass = 'badge-collected';
                      } else if ((m.collectedCommission || 0) > 0) {
                        commBadgeText = 'تحصيل جزئي';
                        commBadgeClass = 'badge-pending';
                      }

                      const deductionsCellHtml = renderDeductionsCell(m.allAdvances || m.advancesDeducted, m.allExpenses || m.expensesDeducted);

                      return `
                        <tr>
                          <td class="num-font" style="text-align: center;">${idx + 1}</td>
                          <td class="num-font" style="font-weight: 800; color: #1e293b;">${m.monthNameAr || m.forMonthYear}</td>
                          <td class="num-font" style="text-align: center;">${m.tenantCount} وحدة/مستأجر</td>
                          <td class="num-font" style="font-weight: 700;">${m.rentSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font" style="color: #059669; font-weight: 700;">${m.collectedSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font" style="color: #dc2626; font-weight: 700;">${arrearsVal > 0 ? `${arrearsVal.toLocaleString('ar-EG')} ج.م` : '—'}</td>
                          <td class="num-font" style="color: #d97706;">${m.commissionSum.toLocaleString('ar-EG')} ج.م</td>
                          <td style="text-align: center;">
                            <span class="badge ${commBadgeClass}">${commBadgeText}</span>
                          </td>
                          <td style="text-align: right; vertical-align: top; padding: 4px;">${deductionsCellHtml}</td>
                          <td class="num-font" style="font-weight: 800; color: #b45309;">${m.netOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font" style="color: #0284c7; font-weight: 700;">${m.disbursedSum.toLocaleString('ar-EG')} ج.م</td>
                          <td style="text-align: center;">
                            <span class="badge ${badgeClass}">${statusBadge}</span>
                          </td>
                        </tr>
                      `;
                    }).join('')}

                    <tr class="total-row" style="background-color: #f8fafc; font-weight: bold;">
                      <td colspan="3" style="text-align: right; padding-right: 15px; color: #1e293b;">
                        إجمالي عقار (${pGroup.propertyName}) للفترة:
                      </td>
                      <td class="num-font gold-text">${pTotalRent.toLocaleString('ar-EG')} ج.م</td>
                      <td class="num-font gold-text" style="color: #059669;">${pTotalCollected.toLocaleString('ar-EG')} ج.م</td>
                      <td class="num-font gold-text" style="color: #dc2626;">${pTotalArrears > 0 ? `${pTotalArrears.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                      <td class="num-font gold-text" style="color: #d97706;">${pTotalCommission.toLocaleString('ar-EG')} ج.م</td>
                      <td style="font-size: 8pt; text-align: center;">
                        <span class="badge ${pTotalArrears === 0 ? 'badge-collected' : 'badge-pending'}">${pTotalArrears === 0 ? 'محصلة' : 'جزئي/متبقي'}</span>
                      </td>
                      <td class="num-font gold-text" style="color: #dc2626;">${pTotalDeductions > 0 ? `-${pTotalDeductions.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                      <td class="num-font gold-text" style="color: #b45309;">${pTotalNetOwner.toLocaleString('ar-EG')} ج.م</td>
                      <td class="num-font gold-text" style="color: #0284c7;">${pTotalDisbursed.toLocaleString('ar-EG')} ج.م</td>
                      <td style="font-size: 8pt; text-align: center; color: ${pTotalBalance > 0 ? '#d97706' : '#059669'};">
                        ${pTotalBalance > 0 ? `متبقي: ${pTotalBalance.toLocaleString('ar-EG')} ج.م` : 'خالص'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              `;
            }).join('')}
            <table class="report-table">
              <tfoot>
                <tr class="total-row" style="background-color: #0f172a; color: #ffffff;">
                  <td colspan="3" style="text-align: right; padding-right: 15px; font-weight: 900; color: #d4a84f;">
                    الإجمالي الكلي لجميع العقارات المدرجة بالتقرير:
                  </td>
                  <td class="num-font gold-text">${sumRent.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #10b981;">${sumCollected.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #ef4444;">${(sumRent - sumCollected).toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #f59e0b;">${sumCommission.toLocaleString('ar-EG')} ج.م</td>
                  <td style="font-size: 8pt; text-align: center; color: #d4a84f; font-weight: bold;">
                    كشف معتمد
                  </td>
                  <td class="num-font gold-text" style="color: #ef4444;">${(propertyStatementsData.grandTotalDeductions || 0) > 0 ? `-${(propertyStatementsData.grandTotalDeductions || 0).toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                  <td class="num-font gold-text" style="color: #d4a84f;">${sumNetOwner.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #38bdf8;">${sumDisbursed.toLocaleString('ar-EG')} ج.م</td>
                  <td style="font-size: 8pt; text-align: center; color: #d4a84f; font-weight: bold;">
                    كشف معتمد رسمياً
                  </td>
                </tr>
              </tfoot>
          `;
        })() : reportType === 'owner_statement' ? (() => {
          if (ownerPropertyGroups.length === 0) {
            return `
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 20%;">الشهر المالي</th>
                  <th style="width: 12%;">عدد المستأجرين</th>
                  <th style="width: 15%;">إجمالي الإيجار المستحق</th>
                  <th style="width: 15%;">الإيجار المحصل</th>
                  <th style="width: 12%;">عمولة المكتب</th>
                  <th style="width: 15%;">صافي مستحق المالك</th>
                  <th style="width: 10%;">حالة التسوية</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="8" style="padding: 25px; text-align: center; color: #64748b; font-weight: bold;">
                    لا توجد بيانات مطابقة للشروط المختارة لكشف حساب المالك.
                  </td>
                </tr>
              </tbody>
            `;
          }

          return `
            </table>
            ${ownerPropertyGroups.map((pGroup) => {
              // Group dues for this property by month
              const sortedPropMonths = pGroup.months || [];

              // Tenants for this property
              const propertyUnits = units.filter(u => u.propertyId === pGroup.propertyId);
              const propertyUnitIds = new Set(propertyUnits.map(u => u.id));

              const pGroupTenantsMap = new Map<string, {
                fullName: string;
                unitDetails: string;
                contractStartDate: string;
                contractEndDate: string;
                statusLabel: string;
                rentAmount: number;
                phone: string;
              }>();

              tenants.forEach(t => {
                const isMatchUnit = t.unitId && propertyUnitIds.has(t.unitId);
                const isMatchProperty = (t as any).propertyId === pGroup.propertyId;
                const isMatchDues = pGroup.dues.some(d => d.tenantId === t.id || d.tenantName === t.fullName);

                if (isMatchUnit || isMatchProperty || isMatchDues) {
                  const matchedUnit = units.find(u => u.id === t.unitId) || 
                    units.find(u => u.propertyId === pGroup.propertyId && u.unitNumber === (t as any).unitNumber);

                  let unitTypeLabel = 'شقة / وحدة سكنية';
                  if (matchedUnit) {
                    if (matchedUnit.activityType === 'commercial') unitTypeLabel = 'محل تجاري';
                    else if (matchedUnit.activityType === 'administrative') unitTypeLabel = 'مكتب إداري';
                    else if (matchedUnit.activityType === 'residential') unitTypeLabel = 'شقة سكنية';
                  }

                  const unitNum = matchedUnit?.unitNumber || (t as any).unitNumber || '';
                  const unitDetails = unitNum ? `${unitTypeLabel} - رقم ${unitNum}` : unitTypeLabel;

                  let statusLabel = 'نشط / ساري';
                  if (t.status === 'expired') statusLabel = 'منتهي';
                  else if (t.status === 'evicted') statusLabel = 'مفسوخ / مخلى';

                  const tenantKey = t.id || `${t.fullName}_${unitNum}`;

                  const matchedDue = pGroup.dues.find(d => d.tenantId === t.id);
                  if (!pGroupTenantsMap.has(tenantKey)) {
                    pGroupTenantsMap.set(tenantKey, {
                      fullName: t.fullName,
                      unitDetails,
                      contractStartDate: t.contractStartDate || '—',
                      contractEndDate: t.contractEndDate || '—',
                      statusLabel,
                      rentAmount: matchedDue?.rentAmount || t.rentAmount || matchedUnit?.rentValue || 0,
                      phone: t.phone || 'غير متاح',
                    });
                  }
                }
              });

              pGroup.dues.forEach(d => {
                const tenantKey = d.tenantId || `${d.tenantName}_${d.unitNumber}`;

                if (!pGroupTenantsMap.has(tenantKey) && d.tenantName) {
                  const matchedTenant = tenants.find(t => t.id === d.tenantId || t.fullName === d.tenantName);
                  const matchedUnit = units.find(u => u.id === d.unitId || (u.propertyId === pGroup.propertyId && u.unitNumber === d.unitNumber));

                  let unitTypeLabel = 'شقة / وحدة سكنية';
                  if (matchedUnit) {
                    if (matchedUnit.activityType === 'commercial') unitTypeLabel = 'محل تجاري';
                    else if (matchedUnit.activityType === 'administrative') unitTypeLabel = 'مكتب إداري';
                    else if (matchedUnit.activityType === 'residential') unitTypeLabel = 'شقة سكنية';
                  }

                  const unitNum = matchedUnit?.unitNumber || d.unitNumber || '';
                  const unitDetails = unitNum ? `${unitTypeLabel} - رقم ${unitNum}` : unitTypeLabel;

                  let statusLabel = 'نشط / ساري';
                  if (matchedTenant?.status === 'expired') statusLabel = 'منتهي';
                  else if (matchedTenant?.status === 'evicted') statusLabel = 'مفسوخ / مخلى';

                  pGroupTenantsMap.set(tenantKey, {
                    fullName: matchedTenant?.fullName || d.tenantName,
                    unitDetails,
                    contractStartDate: matchedTenant?.contractStartDate || '—',
                    contractEndDate: matchedTenant?.contractEndDate || '—',
                    statusLabel,
                    rentAmount: d.rentAmount || matchedTenant?.rentAmount || matchedUnit?.rentValue || 0,
                    phone: matchedTenant?.phone || 'غير متاح',
                  });
                }
              });

              const pGroupTenantsList = Array.from(pGroupTenantsMap.values());

              const renderDeductionsCell = (advancesList: ReOwnerAdvance[] = [], expensesList: RePropertyExpense[] = []) => {
                const items: string[] = [];

                advancesList.forEach(a => {
                  const isDed = !!a.isDeducted;
                  const isReverted = !isDed && (!!a.unDeductedAt || !!(a as any).unDeductedBy);
                  const isEntitlement = isAdvanceDeductedFromEntitlement(a);
                  const dedAmt = getAdvanceDeductedAmount(a) || a.amount || 0;
                  let statusText = 'لم يتم الخصم';
                  let statusColor = '#b45309';
                  let statusBg = '#fef3c7';

                  if (isDed) {
                    if (isEntitlement) {
                      statusText = 'خصم من المستحق';
                      statusColor = '#dc2626';
                      statusBg = '#ffe4e6';
                    } else {
                      statusText = 'سداد نقدي (لا يخصم)';
                      statusColor = '#059669';
                      statusBg = '#d1fae5';
                    }
                  } else if (isReverted) {
                    statusText = 'تم إلغاء الخصم';
                    statusColor = '#dc2626';
                    statusBg = '#ffe4e6';
                  }

                  const noteText = a.notes ? (a.notes.length > 25 ? a.notes.slice(0, 25) + '...' : a.notes) : 'سلفة مالك';
                  const refText = a.deductionRef ? ` (مرجع #${a.deductionRef})` : '';

                  items.push(`
                    <div style="margin-bottom: 3px; padding: 3px 5px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 7pt; text-align: right; line-height: 1.25;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                        <span style="font-weight: 800; color: ${isDed && !isEntitlement ? '#059669' : '#b45309'};">
                          سلفة: ${isDed && isEntitlement ? '-' : ''}${dedAmt.toLocaleString('ar-EG')} ج.م
                        </span>
                        <span style="font-size: 6pt; font-weight: bold; color: ${statusColor}; background: ${statusBg}; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">${statusText}</span>
                      </div>
                      <div style="color: #64748b; font-size: 6.5pt; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${a.notes || ''}${refText}">${noteText}${refText}</div>
                    </div>
                  `);
                });

                expensesList.forEach(e => {
                  const isDed = !!e.isDeducted;
                  const isReverted = !isDed && (!!e.unDeductedAt || !!(e as any).unDeductedBy);
                  let statusText = 'لم يتم الخصم';
                  let statusColor = '#b45309';
                  let statusBg = '#fef3c7';

                  if (isDed) {
                    statusText = 'خصم من المستحق';
                    statusColor = '#dc2626';
                    statusBg = '#ffe4e6';
                  } else if (isReverted) {
                    statusText = 'تم إلغاء الخصم';
                    statusColor = '#dc2626';
                    statusBg = '#ffe4e6';
                  }

                  const descText = e.description || (e as any).notes || 'مصروف عقار';
                  const shortDesc = descText.length > 25 ? descText.slice(0, 25) + '...' : descText;

                  items.push(`
                    <div style="margin-bottom: 3px; padding: 3px 5px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 7pt; text-align: right; line-height: 1.25;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                        <span style="font-weight: 800; color: #0284c7;">مصروف: ${isDed ? '-' : ''}${(e.amount || 0).toLocaleString('ar-EG')} ج.م</span>
                        <span style="font-size: 6pt; font-weight: bold; color: ${statusColor}; background: ${statusBg}; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">${statusText}</span>
                      </div>
                      <div style="color: #64748b; font-size: 6.5pt; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descText}">[${e.category || 'صيانة'}] ${shortDesc}</div>
                    </div>
                  `);
                });

                if (items.length === 0) {
                  return `<span style="color: #94a3b8; font-size: 7.5pt; font-family: monospace;">—</span>`;
                }

                return items.join('');
              };

              return `
                <table class="report-table" style="margin-bottom: 20px;">
                  <thead>
                    <tr style="background-color: #0f172a; color: #d4a84f;">
                      <th colspan="10" style="text-align: right; padding: 10px 14px; font-size: 11pt; font-weight: 900; border-bottom: 2px solid #d4a84f;">
                        🏢 عقار: ${pGroup.propertyName} — المالك: ${pGroup.ownerName} <span style="font-size: 9pt; color: #94a3b8; font-weight: normal; margin-right: 10px;">(${pGroup.dues.length} استحقاق إيجاري)</span>
                      </th>
                    </tr>
                    <tr>
                      <th style="width: 3%;">#</th>
                      <th style="width: 12%;">الشهر المالي</th>
                      <th style="width: 8%;">عدد المستأجرين</th>
                      <th style="width: 11%;">إجمالي إيجار العقار</th>
                      <th style="width: 11%;">الإيجار المحصل</th>
                      <th style="width: 9%;">عمولة المكتب</th>
                      <th style="width: 18%;">السلف والمصروفات</th>
                      <th style="width: 10%;">صافي مستحق المالك</th>
                      <th style="width: 9%;">المصروف للمالك</th>
                      <th style="width: 9%;">حالة الصرف والتسوية</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sortedPropMonths.map((m, idx) => {
                      let statusBadge = 'لم يُصرف';
                      let badgeClass = 'badge-overdue';

                      if (m.paidOutCount === m.tenantCount && m.tenantCount > 0) {
                        statusBadge = 'صُرف بالكامل';
                        badgeClass = 'badge-collected';
                      } else if (m.disbursedSum > 0 || m.paidOutCount > 0) {
                        statusBadge = 'صُرف جزئياً';
                        badgeClass = 'badge-pending';
                      }

                      const deductionsCellHtml = renderDeductionsCell(m.allAdvances || m.advancesDeducted, m.allExpenses || m.expensesDeducted);

                      return `
                        <tr>
                          <td class="num-font" style="text-align: center;">${idx + 1}</td>
                          <td class="num-font" style="font-weight: 800; color: #1e293b;">${m.monthNameAr || m.forMonthYear}</td>
                          <td class="num-font" style="text-align: center;">${m.tenantCount} مستأجر</td>
                          <td class="num-font" style="font-weight: 700;">${m.rentSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font" style="color: #059669; font-weight: 700;">${m.collectedSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font" style="color: #d97706;">${m.commissionSum.toLocaleString('ar-EG')} ج.م</td>
                          <td style="text-align: right; vertical-align: top; padding: 4px;">${deductionsCellHtml}</td>
                          <td class="num-font" style="font-weight: 800; color: #b45309;">${m.netOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font" style="color: #0284c7; font-weight: 700;">${m.disbursedSum.toLocaleString('ar-EG')} ج.م</td>
                          <td style="text-align: center;">
                            <span class="badge ${badgeClass}">${statusBadge}</span>
                          </td>
                        </tr>
                      `;
                    }).join('')}

                    ${(() => {
                      const propDeductionsSum = pGroup.totalDeductionsSum || 0;
                      const remainingBal = pGroup.netBalanceAfterDeductions;

                      return `
                        <tr class="total-row" style="background-color: #f8fafc; font-weight: bold;">
                          <td colspan="3" style="text-align: right; padding-right: 15px; color: #1e293b;">
                            إجمالي إيجار عقار (${pGroup.propertyName}):
                          </td>
                          <td class="num-font gold-text">${pGroup.totalRentSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font gold-text" style="color: #059669;">${pGroup.totalCollectedSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font gold-text" style="color: #d97706;">${pGroup.totalCommissionSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font gold-text" style="color: #dc2626;">${propDeductionsSum > 0 ? `-${propDeductionsSum.toLocaleString('ar-EG')} ج.م` : '0 ج.م'}</td>
                          <td class="num-font gold-text" style="color: #b45309;">${pGroup.totalNetOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                          <td class="num-font gold-text" style="color: #0284c7;">${pGroup.totalDisbursedSum.toLocaleString('ar-EG')} ج.م</td>
                          <td style="font-size: 8pt; text-align: center; color: ${remainingBal > 0 ? '#d97706' : '#059669'};">
                            ${remainingBal > 0 ? `متبقي: ${remainingBal.toLocaleString('ar-EG')} ج.م` : 'خالص'}
                          </td>
                        </tr>
                      `;
                    })()}
                  </tbody>
                </table>

                <!-- Tenant Information Table for this property -->
                <table class="report-table" style="margin-bottom: 25px; border: 1px solid #cbd5e1;">
                  <thead>
                    <tr style="background-color: #f1f5f9; color: #334155;">
                      <th colspan="8" style="text-align: right; padding: 6px 12px; font-size: 9.5pt; font-weight: 800;">
                        📋 قائمة مستأجري عقار: ${pGroup.propertyName} (${pGroupTenantsList.length} مستأجر)
                      </th>
                    </tr>
                    <tr style="background-color: #f8fafc; font-size: 8.5pt;">
                      <th style="width: 4%;">#</th>
                      <th style="width: 20%;">اسم المستأجر</th>
                      <th style="width: 20%;">بيانات الوحدة</th>
                      <th style="width: 12%;">بداية العقد</th>
                      <th style="width: 12%;">نهاية العقد</th>
                      <th style="width: 10%;">حالة العقد</th>
                      <th style="width: 11%;">قيمة الإيجار</th>
                      <th style="width: 11%;">رقم الهاتف</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pGroupTenantsList.length === 0 ? `
                      <tr>
                        <td colspan="8" style="padding: 12px; text-align: center; color: #64748b;">لا يوجد مستأجرون مسجلون لهذا العقار.</td>
                      </tr>
                    ` : pGroupTenantsList.map((t, tIdx) => `
                      <tr style="font-size: 8.5pt;">
                        <td class="num-font" style="text-align: center;">${tIdx + 1}</td>
                        <td style="font-weight: 700; color: #0f172a;">${t.fullName}</td>
                        <td style="color: #b45309; font-weight: 700;">${t.unitDetails}</td>
                        <td class="num-font" style="text-align: center; color: #475569;">${t.contractStartDate}</td>
                        <td class="num-font" style="text-align: center; color: #475569;">${t.contractEndDate}</td>
                        <td style="text-align: center; font-weight: 700;">${t.statusLabel}</td>
                        <td class="num-font" style="color: #059669; font-weight: 800;">${t.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                        <td class="num-font" style="text-align: center; color: #1e293b;">${t.phone}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `;
            }).join('')}

            <!-- Solf & Expenses Table Linked to Owner & Property (Same as Advances & Expenses Section) -->
            ${(allOwnerAdvances.length > 0 || allOwnerExpenses.length > 0 || ownerAdvancesDeducted.length > 0 || ownerExpensesDeducted.length > 0) ? (() => {
              const displayAdvances = allOwnerAdvances.length > 0 ? allOwnerAdvances : ownerAdvancesDeducted;
              const displayExpenses = allOwnerExpenses.length > 0 ? allOwnerExpenses : ownerExpensesDeducted;

              return `
                <table class="report-table" style="margin-bottom: 25px; border: 1px solid #cbd5e1;">
                  <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a;">
                      <th colspan="7" style="text-align: right; padding: 8px 12px; font-size: 10pt; font-weight: 900; border-bottom: 2px solid #cbd5e1;">
                        💸 بيان السُلف ومصروفات العقار المرتبطة بالمالك والعقار (من قسم السلف والمصروفات)
                      </th>
                    </tr>
                    <tr style="background-color: #f8fafc; font-size: 8.5pt;">
                      <th style="width: 4%;">#</th>
                      <th style="width: 16%;">نوع المعاملة</th>
                      <th style="width: 18%;">العقار</th>
                      <th style="width: 28%;">البيان والتفاصيل</th>
                      <th style="width: 11%;">تاريخ المعاملة</th>
                      <th style="width: 11%;">المبلغ</th>
                      <th style="width: 12%;">حالة الخصم والأثر</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${displayAdvances.map((a, idx) => {
                      const isDeducted = !!a.isDeducted;
                      const isReverted = !isDeducted && (!!a.unDeductedAt || !!(a as any).unDeductedBy);
                      const isEntitlement = isAdvanceDeductedFromEntitlement(a);
                      const dedAmt = getAdvanceDeductedAmount(a) || a.amount || 0;
                      return `
                        <tr style="font-size: 8.5pt; ${isDeducted ? 'background-color: #fffbfa;' : isReverted ? 'background-color: #fff1f2;' : ''}">
                          <td class="num-font" style="text-align: center;">${idx + 1}</td>
                          <td style="font-weight: 700; color: #b45309;">سُلفة مالك عاجلة</td>
                          <td style="font-weight: 600;">${a.propertyName || 'عقار المالك'}</td>
                          <td>${a.notes || 'سلفة مالك مسجلة'}</td>
                          <td class="num-font" style="text-align: center; color: #475569;">${a.advanceDate || (a.createdAt ? a.createdAt.slice(0, 10) : '—')}</td>
                          <td class="num-font" style="font-weight: 800; color: #0f172a;">${dedAmt.toLocaleString('ar-EG')} ج.م</td>
                          <td style="text-align: center;">
                            ${isDeducted ? (
                              isEntitlement ? `
                                <span class="badge badge-overdue" style="display: inline-block; margin-bottom: 2px;">تم الخصم (مخصوم من المستحق)</span>
                                <div class="num-font" style="color: #dc2626; font-size: 7.5pt; font-weight: 800;">-${dedAmt.toLocaleString('ar-EG')} ج.م</div>
                              ` : `
                                <span class="badge badge-collected" style="display: inline-block; margin-bottom: 2px;">سداد نقدي (لا يخصم من المستحق)</span>
                                <div class="num-font" style="color: #059669; font-size: 7.5pt; font-weight: 800;">${dedAmt.toLocaleString('ar-EG')} ج.م (مسدد)</div>
                              `
                            ) : isReverted ? `
                              <span class="badge badge-overdue" style="background-color: #ffe4e6; color: #dc2626; border-color: #fecdd3; display: inline-block; margin-bottom: 2px;">تم إلغاء الخصم (مسترجع للمستحق)</span>
                              <div class="num-font" style="color: #059669; font-size: 7.5pt; font-weight: 800;">+${dedAmt.toLocaleString('ar-EG')} ج.م</div>
                            ` : `
                              <span class="badge badge-pending">لم يتم الخصم (قيد المعالجة)</span>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                    ${displayExpenses.map((e, idx) => {
                      const isDeducted = !!e.isDeducted;
                      const isReverted = !isDeducted && (!!e.unDeductedAt || !!(e as any).unDeductedBy);
                      return `
                        <tr style="font-size: 8.5pt; ${isDeducted ? 'background-color: #fffbfa;' : isReverted ? 'background-color: #fff1f2;' : ''}">
                          <td class="num-font" style="text-align: center;">${displayAdvances.length + idx + 1}</td>
                          <td style="font-weight: 700; color: #0284c7;">مصروف عقار (${e.category || 'صيانة'})</td>
                          <td style="font-weight: 600;">${e.propertyName || 'عقار المالك'}</td>
                          <td>${e.description || (e as any).notes || e.category || 'صيانة ومصروفات دورية'}</td>
                          <td class="num-font" style="text-align: center; color: #475569;">${e.expenseDate || (e.createdAt ? e.createdAt.slice(0, 10) : '—')}</td>
                          <td class="num-font" style="font-weight: 800; color: #0f172a;">${(e.amount || 0).toLocaleString('ar-EG')} ج.م</td>
                          <td style="text-align: center;">
                            ${isDeducted ? `
                              <span class="badge badge-overdue" style="display: inline-block; margin-bottom: 2px;">تم الخصم (مخصوم من المستحق)</span>
                              <div class="num-font" style="color: #dc2626; font-size: 7.5pt; font-weight: 800;">-${(e.amount || 0).toLocaleString('ar-EG')} ج.م</div>
                            ` : isReverted ? `
                              <span class="badge badge-overdue" style="background-color: #ffe4e6; color: #dc2626; border-color: #fecdd3; display: inline-block; margin-bottom: 2px;">تم إلغاء الخصم (مسترجع للمستحق)</span>
                              <div class="num-font" style="color: #059669; font-size: 7.5pt; font-weight: 800;">+${(e.amount || 0).toLocaleString('ar-EG')} ج.م</div>
                            ` : `
                              <span class="badge badge-pending">لم يتم الخصم (قيد المعالجة)</span>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                    <tr class="total-row" style="background-color: #fff1f2; font-weight: bold;">
                      <td colspan="5" style="text-align: right; padding-right: 15px; color: #991b1b;">إجمالي الخصومات المعتمدة والمخصومة فعلياً من المستحقات:</td>
                      <td colspan="2" class="num-font" style="color: #dc2626; font-weight: 900; font-size: 10pt; text-align: left; padding-left: 15px;">-${totalOwnerDeductions.toLocaleString('ar-EG')} ج.م</td>
                    </tr>
                  </tbody>
                </table>
              `;
            })() : ''}

            <!-- Owner Payout Vouchers (سندات الصرف المعتمدة للمالك) -->
            ${(allOwnerPayouts && allOwnerPayouts.length > 0) ? (() => {
              const activePayouts = allOwnerPayouts.filter(p => p.status !== 'reverted' && !p.isCancelled);
              const sumActivePayouts = activePayouts.reduce((s, p) => s + (p.netAmountPaid || 0), 0);

              return `
                <table class="report-table" style="margin-bottom: 25px; border: 1px solid #cbd5e1;">
                  <thead>
                    <tr style="background-color: #f1f5f9; color: #0f172a;">
                      <th colspan="8" style="text-align: right; padding: 8px 12px; font-size: 10pt; font-weight: 900; border-bottom: 2px solid #cbd5e1;">
                        💵 بيان سندات الصرف المنصرفة للمالك (سندات الصرف المعتمدة)
                      </th>
                    </tr>
                    <tr style="background-color: #f8fafc; font-size: 8.5pt;">
                      <th style="width: 4%;">#</th>
                      <th style="width: 14%;">رقم السند</th>
                      <th style="width: 12%;">تاريخ الصرف</th>
                      <th style="width: 16%;">العقار</th>
                      <th style="width: 22%;">البيان والتفاصيل</th>
                      <th style="width: 12%;">طريقة الصرف</th>
                      <th style="width: 10%;">المبلغ المصروف</th>
                      <th style="width: 10%;">حالة السند</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allOwnerPayouts.map((p, idx) => {
                      const isCancelled = p.status === 'reverted' || p.isCancelled;
                      const prop = properties.find(propObj => propObj.id === p.propertyId);
                      return `
                        <tr style="font-size: 8.5pt; ${isCancelled ? 'background-color: #fff1f2;' : 'background-color: #f0fdf4;'}">
                          <td class="num-font" style="text-align: center;">${idx + 1}</td>
                          <td class="num-font" style="font-weight: 700; color: #0284c7;">${p.receiptNumber || `PAY-${p.id.slice(-6)}`}</td>
                          <td class="num-font" style="text-align: center; color: #475569;">${p.payoutDate || (p.createdAt ? p.createdAt.slice(0, 10) : '—')}</td>
                          <td style="font-weight: 600;">${prop?.name || 'عقار المالك'}</td>
                          <td>${p.notes || 'صرف مستحقات إيجار للمالك'}</td>
                          <td style="text-align: center; font-weight: 700; color: #b45309;">
                            ${p.paymentMethod || 'نقدي'}
                            ${p.bankTransactionRef ? `<div class="num-font" style="font-size: 7.5pt; color: #64748b;">مرجع: ${p.bankTransactionRef}</div>` : ''}
                          </td>
                          <td class="num-font" style="font-weight: 900; color: ${isCancelled ? '#94a3b8' : '#059669'};">
                            ${(p.netAmountPaid || 0).toLocaleString('ar-EG')} ج.م
                          </td>
                          <td style="text-align: center;">
                            ${isCancelled ? `
                              <span class="badge badge-overdue" style="background-color: #ffe4e6; color: #dc2626; border-color: #fecdd3;">ملغي / مسترجع</span>
                            ` : `
                              <span class="badge badge-collected">معتمد ومخصوم</span>
                            `}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                    <tr class="total-row" style="background-color: #ecfdf5; font-weight: bold;">
                      <td colspan="6" style="text-align: right; padding-right: 15px; color: #065f46;">إجمالي مبالغ سندات الصرف المعتمدة للمالك:</td>
                      <td colspan="2" class="num-font" style="color: #059669; font-weight: 900; font-size: 10pt; text-align: left; padding-left: 15px;">
                        ${sumActivePayouts.toLocaleString('ar-EG')} ج.م
                      </td>
                    </tr>
                  </tbody>
                </table>
              `;
            })() : ''}

            <table class="report-table">
              <tfoot>
                <tr class="total-row" style="background-color: #0f172a; color: #ffffff;">
                  <td colspan="3" style="text-align: right; padding-right: 15px; font-weight: 900; color: #d4a84f;">
                    الإجمالي والتسوية المالية لكشف حساب المالك:
                  </td>
                  <td class="num-font gold-text">${ownerTotalRentSum.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #10b981;">${ownerTotalCollectedSum.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #f59e0b;">${ownerTotalCommissionSum.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #d4a84f;">${ownerTotalNetOwnerSum.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font gold-text" style="color: #38bdf8;">${ownerTotalDisbursedSum.toLocaleString('ar-EG')} ج.م</td>
                  <td style="font-size: 8.5pt; text-align: center; color: #10b981; font-weight: bold;">
                    صافي المتبقي للمالك: ${finalRemainingBalance.toLocaleString('ar-EG')} ج.م
                  </td>
                </tr>
              </tfoot>
          `;
        })() : `
          <thead>
            <tr>
              <th style="width: 8%;">الشهر</th>
              <th style="width: 14%;">اسم المالك</th>
              <th style="width: 14%;">اسم العقار</th>
              <th style="width: 8%;">الوحدة</th>
              <th style="width: 14%;">اسم المستأجر</th>
              <th style="width: 10%;">الإيجار</th>
              <th style="width: 8%;">العمولة</th>
              <th style="width: 10%;">صافي المالك</th>
              <th style="width: 7%;">التحصيل</th>
              <th style="width: 7%;">الصرف</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDues.length === 0 ? `
              <tr>
                <td colspan="10" style="padding: 20px; color: #64748b; font-weight: bold;">
                  لا توجد بيانات مطابقة للفلاتر المحددة في هذا التقرير.
                </td>
              </tr>
            ` : filteredDues.map(d => {
              const comm = getDueCommissionAmount(d, owners, properties);
              const net = Math.max(0, (d.rentAmount || 0) - comm);
              const pStat = getDuePayoutStatus(d);
              const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);

              return `
                <tr>
                  <td class="num-font">${d.monthNameAr || d.forMonthYear}</td>
                  <td style="font-weight: 700;">${d.ownerName}</td>
                  <td>${d.propertyName}</td>
                  <td class="num-font">وحدة ${d.unitNumber}</td>
                  <td style="font-weight: 700;">${d.tenantName}</td>
                  <td class="num-font">${d.rentAmount.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font" style="color: #d97706;">${comm.toLocaleString('ar-EG')} ج.م</td>
                  <td class="num-font" style="font-weight: 800;">${net.toLocaleString('ar-EG')} ج.م</td>
                  <td>
                    ${cStat === 'collected' ? '<span class="badge badge-collected">محصل</span>' :
                      cStat === 'overdue' ? '<span class="badge badge-overdue">متأخر</span>' :
                      '<span class="badge badge-pending">معلق</span>'}
                  </td>
                  <td>
                    ${pStat === 'paid_out' ? '<span class="badge badge-payout">تم الصرف</span>' :
                      '<span class="badge badge-pending">بانتظار الصرف</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
            
            <tr class="total-row">
              <td colspan="5" style="text-align: right; padding-right: 15px;">الإجمالي الكلي للتقرير (${filteredDues.length} سجل)</td>
              <td class="num-font gold-text">${sumRent.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${sumCommission.toLocaleString('ar-EG')} ج.م</td>
              <td class="num-font gold-text">${sumNetOwner.toLocaleString('ar-EG')} ج.م</td>
              <td colspan="2" style="font-size: 8pt; text-align: center;">إجمالي التقرير المالي المعتمد</td>
            </tr>
          </tbody>
        `}
      </table>
    </div>

    <!-- Signatures -->
    <div class="signatures-block">
      <div class="sig-col">
        <span class="sig-title">إعداد المحاسب المسؤول</span>
        <span class="sig-dots">التوقيع: .....................</span>
      </div>
      <div class="sig-col">
        <span class="sig-title">مراجعة مدير قطاع العقارات</span>
        <span class="sig-dots">التوقيع: .....................</span>
      </div>
      <div class="sig-col">
        <span class="sig-title">اعتماد رئيس المؤسسة والختم الرسمي</span>
        <span class="sig-dots">الختم والتوقيع الرسمي</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="report-footer">
      وثيقة إلكترونية موثقة صادرة عن منظومة مؤسسة رميح للمحاماة - جميع الحقوق محفوظة © ${new Date().getFullYear()}
    </div>

  </div>
</body>
</html>`;

  return html;
}

/**
 * Direct print helper: Creates a temporary iframe and triggers browser print
 * strictly for the generated report content.
 */
export function printReportDirectly(htmlContent: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Direct print error:', err);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 2000);
      }
    }, 500);
  }
}

export default function RealEstateReportModal({
  isOpen,
  onClose,
  reportType,
  dues,
  collections = [],
  owners,
  properties,
  units,
  tenants,
  advances = [],
  expenses = [],
  payouts = [],
  commissionStatuses = [],
  rentAdjustments = [],
  selectedPropertyId,
  selectedOwnerId,
  selectedTenantId,
  selectedMonthYear,
  tenantFromMonth,
  tenantToMonth,
  ownerStatementsFilter = 'all',
  ownerAccountType = 'monthly',
  accountType = 'monthly',
  commissionsFilter = 'all',
  commSearchTerm = '',
  commStatements,
  currentUser,
  autoPrint = false,
  ownerPayoutType = 'all'
}: RealEstateReportModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [iframeHeight, setIframeHeight] = useState<number>(1100);

  // Memoize stable metadata per modal session to prevent random html re-generation and iframe flicker
  const reportMetadata = React.useMemo(() => {
    return {
      serialNumber: `RUM-RE-${Math.floor(100000 + Math.random() * 900000)}`,
      issuedAt: new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })
    };
  }, [isOpen, reportType, selectedTenantId, selectedPropertyId, selectedOwnerId, selectedMonthYear]);

  // Memoize HTML content so iframe srcDoc stays strictly identical across re-renders
  const htmlContent = React.useMemo(() => {
    if (!isOpen) return '';
    return generateRealEstateReportHTML({
      reportType,
      dues,
      collections,
      owners,
      properties,
      units,
      tenants,
      advances,
      expenses,
      payouts,
      commissionStatuses,
      rentAdjustments,
      selectedPropertyId,
      selectedOwnerId,
      selectedTenantId,
      selectedMonthYear,
      tenantFromMonth,
      tenantToMonth,
      ownerStatementsFilter,
      ownerAccountType,
      accountType,
      commissionsFilter,
      commSearchTerm,
      commStatements,
      currentUser,
      serialNumber: reportMetadata.serialNumber,
      issuedAt: reportMetadata.issuedAt,
      ownerPayoutType
    });
  }, [
    isOpen, reportType, dues, collections, owners, properties, units, tenants, advances, expenses, payouts,
    commissionStatuses, rentAdjustments, selectedPropertyId, selectedOwnerId, selectedTenantId, selectedMonthYear,
    tenantFromMonth, tenantToMonth, ownerStatementsFilter, ownerAccountType, accountType, commissionsFilter, commSearchTerm, commStatements, currentUser, reportMetadata, ownerPayoutType
  ]);

  // Auto-fit iframe height to content document height without double-scrollbar jitter
  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const doc = iframeRef.current.contentWindow.document;
        const scrollH = Math.max(
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          doc.body?.offsetHeight || 0,
          doc.documentElement?.offsetHeight || 0
        );
        if (scrollH > 300) {
          setIframeHeight(scrollH + 30);
        }
      } catch (e) {
        // Ignore cross-origin issues if any
      }
    }
  };

  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isOpen) return null;

  const reportTitle = getReportTitle(reportType);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (err) {
        printReportDirectly(htmlContent);
      }
    } else {
      printReportDirectly(htmlContent);
    }
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4" dir="rtl">
      <div className="bg-[#0f172a] border border-[#D4A84F]/30 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-[#F8F9FB]">
        
        {/* Modal Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between p-3.5 sm:p-4 bg-[#132238] border-b border-[#D4A84F]/20 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#D4A84F]/15 text-[#D4A84F]">
              <Landmark className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#F8F9FB] flex items-center gap-2">
                <span>معاينة التقرير الرسمي</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30 font-bold">A4 PDF</span>
              </h3>
              <p className="text-xs text-[#9EA7B8] font-bold">{reportTitle}</p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            
            {/* Zoom controls */}
            <div className="hidden sm:flex items-center bg-[#08111F] border border-[#D4A84F]/15 rounded-xl px-2 py-1 gap-1">
              <button
                onClick={() => setZoomLevel(prev => Math.max(75, prev - 15))}
                className="p-1 hover:bg-white/10 rounded-lg text-[#9EA7B8] hover:text-white transition-all cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-[#D4A84F] px-1">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
                className="p-1 hover:bg-white/10 rounded-lg text-[#9EA7B8] hover:text-white transition-all cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownloadHTML}
              className="px-3 py-1.5 rounded-xl bg-[#08111F] border border-[#D4A84F]/25 text-[#D4A84F] hover:bg-[#D4A84F]/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="تنزيل نسختك المطبوعة"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">تنزيل التقرير</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-[#D4A84F] to-[#C3973E] text-slate-950 font-black text-xs rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#D4A84F]/20 flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>طباعة التقرير</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer mr-1"
              title="إغلاق المعاينة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Canvas Stage - Responsive & Flicker-free */}
        <div className="flex-1 bg-slate-950/80 p-4 sm:p-6 overflow-y-auto overflow-x-auto flex justify-center items-start">
          <div 
            className="bg-white rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-slate-300 overflow-hidden"
            style={{
              width: `${(210 * (zoomLevel / 100))}mm`,
              maxWidth: '100%',
              minHeight: `${(297 * (zoomLevel / 100))}mm`,
              height: `${iframeHeight}px`,
              transformOrigin: 'top center'
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              onLoad={handleIframeLoad}
              className="w-full h-full border-none block"
              title="A4 Report Paper Frame"
            />
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="p-2.5 px-4 bg-[#132238] border-t border-[#D4A84F]/20 flex items-center justify-between text-[11px] text-[#9EA7B8] font-bold shrink-0">
          <span>مؤسسة رميح للمحاماة والاستشارات القانونية • قطاع العقارات والتحصيل</span>
          <span className="text-[#D4A84F] font-mono">جاهز للطباعة والتصدير الفعلي</span>
        </div>

      </div>
    </div>
  );
}
