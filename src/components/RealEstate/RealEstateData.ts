import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReRealEstateLog, ReRentDue, ReCommissionStatus, ReOwnerAdvance, ReRentAdjustment 
} from '../../types';

/**
 * Check if an advance is deducted specifically from the owner's rental entitlement
 * (as opposed to direct cash repayment).
 */
export function isAdvanceDeductedFromEntitlement(advance?: ReOwnerAdvance | null): boolean {
  if (!advance) return false;
  if (advance.deductions && advance.deductions.length > 0) {
    return advance.deductions.some(d => 
      !d.deductionMethod || 
      d.deductionMethod === 'خصم من المستحق' || 
      d.deductionMethod === 'من المستحق للمالك' || 
      d.deductionMethod === 'from_entitlement'
    );
  }
  if (!advance.isDeducted && (!advance.deductedAmount || advance.deductedAmount <= 0)) return false;
  if (!advance.deductionMethod) return true; // Default fallback for backward compatibility
  return (
    advance.deductionMethod === 'خصم من المستحق' ||
    advance.deductionMethod === 'من المستحق للمالك' ||
    advance.deductionMethod === 'from_entitlement'
  );
}

/**
 * Get the actual deducted amount from an advance record (taking custom settlement amount into account).
 */
export function getAdvanceDeductedAmount(advance?: ReOwnerAdvance | null): number {
  if (!advance) return 0;
  if (advance.deductions && advance.deductions.length > 0) {
    return advance.deductions.reduce((sum, d) => sum + (d.amount || 0), 0);
  }
  if (advance.deductedAmount !== undefined && advance.deductedAmount !== null && Number(advance.deductedAmount) >= 0) {
    return Number(advance.deductedAmount);
  }
  if (advance.isDeducted) {
    return advance.amount || 0;
  }
  return 0;
}

/**
 * Get the deducted amount specifically deducted from rental entitlements.
 */
export function getAdvanceDeductedFromEntitlementAmount(advance?: ReOwnerAdvance | null): number {
  if (!advance) return 0;
  if (advance.deductions && advance.deductions.length > 0) {
    return advance.deductions
      .filter(d => !d.deductionMethod || d.deductionMethod === 'خصم من المستحق' || d.deductionMethod === 'من المستحق للمالك' || d.deductionMethod === 'from_entitlement')
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }
  if (isAdvanceDeductedFromEntitlement(advance)) {
    return getAdvanceDeductedAmount(advance);
  }
  return 0;
}

/**
 * Helper to retrieve all active, non-reverted, non-cancelled collection receipts matching a given rent due.
 * Matches strictly on tenantId + (unitId or propertyId) + forMonthYear (month & year) + receiptId / dueId.
 */
export function getMatchingCollectionReceipts(
  due: ReRentDue,
  collections?: ReCollectionReceipt[]
): ReCollectionReceipt[] {
  if (!due || !collections || collections.length === 0) return [];

  return collections.filter(c => {
    if (!c || c.status === 'reverted' || c.isCancelled || !(c.amountPaid && c.amountPaid > 0)) {
      return false;
    }

    // 1. Direct match by receipt ID or due ID
    if (c.dueId && c.dueId === due.id) return true;
    if (due.collectionReceiptId && c.id === due.collectionReceiptId) return true;
    if (due.receiptNumber && c.receiptNumber === due.receiptNumber) return true;

    // 2. Strict matching by Tenant
    const tenantMatches = !!(c.tenantId && due.tenantId && c.tenantId === due.tenantId);
    if (!tenantMatches) return false;

    // Strict Month/Year matching (e.g., '2026-08')
    const dueMonthYear = due.forMonthYear || (due.dueDate ? due.dueDate.slice(0, 7) : '');
    const receiptMonthYear = c.forMonthYear || (c.paymentDate ? c.paymentDate.slice(0, 7) : '');
    if (!dueMonthYear || !receiptMonthYear || dueMonthYear !== receiptMonthYear) return false;

    // Unit & Property consistency validation if present on both
    if (c.unitId && due.unitId && c.unitId !== due.unitId) return false;
    if (c.propertyId && due.propertyId && c.propertyId !== due.propertyId) return false;

    return true;
  });
}

/**
 * CENTRAL SINGLE SOURCE OF TRUTH FOR MONTH COLLECTION STATUS
 * Strictly evaluates month status from saved collection receipts (re_collections).
 * Does not rely on stale document fields or temporary cache.
 */
export function getDueCollectionStatus(
  due: ReRentDue, 
  todayISO: string = new Date().toISOString().slice(0, 10), 
  currentMonthISO: string = new Date().toISOString().slice(0, 7),
  collections?: ReCollectionReceipt[]
): 'collected' | 'overdue' | 'pending_collection' | 'prepaid' {
  if (!due) return 'overdue';

  const dueMonthYear = due.forMonthYear || (due.dueDate ? due.dueDate.slice(0, 7) : '');

  // 1. Strict check: Only consider collected or prepaid if a REAL matching collection receipt is saved
  if (collections && collections.length > 0) {
    const matchingReceipts = getMatchingCollectionReceipts(due, collections);
    const totalPaid = matchingReceipts.reduce((sum, r) => sum + (r.amountPaid || 0), 0);

    if (totalPaid > 0) {
      // Receipt exists and is verified
      if (dueMonthYear && dueMonthYear > currentMonthISO) {
        return 'prepaid';
      }
      return 'collected';
    }
  }

  // 2. If NO active saved collection receipt exists for this tenant, unit, and month:
  // It is NEVER collected or prepaid regardless of any stale state or cached field.
  if ((due.dueDate && due.dueDate <= todayISO) || (dueMonthYear && dueMonthYear <= currentMonthISO)) {
    return 'overdue';
  }

  return 'pending_collection';
}

export function isDueCollected(
  due: ReRentDue, 
  todayISO?: string, 
  currentMonthISO?: string, 
  collections?: ReCollectionReceipt[]
): boolean {
  const status = getDueCollectionStatus(due, todayISO, currentMonthISO, collections);
  return status === 'collected' || status === 'prepaid';
}

export function getDuePayoutStatus(due: ReRentDue): 'paid_out' | 'pending_payout' {
  if (!due) return 'pending_payout';
  if (due.payoutStatus === 'paid_out' || due.status === 'paid_out' || due.payoutDate) {
    return 'paid_out';
  }
  return 'pending_payout';
}

/**
 * Helper to resolve commission settings prioritizing property settings then owner settings.
 */
export function getPropertyCommissionSettings(
  prop?: { id?: string; commissionType?: string; commissionValue?: number; ownerId?: string } | null,
  owner?: { commissionType?: string; commissionValue?: number; id?: string } | null,
  dues?: Array<{ propertyId?: string; ownerId?: string; commissionType?: string; commissionValue?: number }>
): { commissionType: 'percentage' | 'fixed_per_thousand' | 'fixed_flat'; commissionValue: number } {
  if (prop && prop.commissionValue !== undefined && prop.commissionValue !== null && prop.commissionValue > 0) {
    return {
      commissionType: (prop.commissionType as any) || 'percentage',
      commissionValue: prop.commissionValue,
    };
  }
  if (owner && owner.commissionValue !== undefined && owner.commissionValue !== null && owner.commissionValue > 0) {
    return {
      commissionType: (owner.commissionType as any) || 'percentage',
      commissionValue: owner.commissionValue,
    };
  }
  if (dues && prop?.id) {
    const matchedDue = dues.find(d => d.propertyId === prop.id && d.commissionValue !== undefined && d.commissionValue !== null && d.commissionValue > 0);
    if (matchedDue) {
      return {
        commissionType: (matchedDue.commissionType as any) || 'percentage',
        commissionValue: matchedDue.commissionValue!,
      };
    }
  }
  if (dues && owner?.id) {
    const matchedDue = dues.find(d => d.ownerId === owner.id && d.commissionValue !== undefined && d.commissionValue !== null && d.commissionValue > 0);
    if (matchedDue) {
      return {
        commissionType: (matchedDue.commissionType as any) || 'percentage',
        commissionValue: matchedDue.commissionValue!,
      };
    }
  }
  return {
    commissionType: 'percentage',
    commissionValue: 0,
  };
}

/**
 * Calculates commission amount based on rent amount and owner/property commission settings.
 */
export function calculateCommissionFromSettings(
  rentAmount: number,
  ownerOrProp?: { commissionType?: string; commissionValue?: number } | null
): number {
  if (!ownerOrProp || rentAmount <= 0) return 0;
  const type = ownerOrProp.commissionType || 'percentage';
  const val = ownerOrProp.commissionValue ?? 0;
  if (val <= 0) return 0;

  if (type === 'percentage') {
    return Math.round((rentAmount * val) / 100);
  } else if (type === 'fixed_per_thousand') {
    return Math.floor(rentAmount / 1000) * val;
  } else if (type === 'fixed_flat') {
    return val;
  }
  return 0;
}

/**
 * Canonical helper that retrieves/computes the EXACT commission for a property and month
 * as defined and calculated by the Commissions section ("قسم العمولات").
 * This serves as the single source of truth across all statements, reports, and PDFs.
 */
export function getSectionCommissionForPropertyMonth(
  propertyId: string,
  forMonthYear: string,
  dues: Array<{ rentAmount?: number; propertyId?: string; ownerId?: string; forMonthYear?: string; commissionType?: string; commissionValue?: number }>,
  properties: ReProperty[],
  owners: ReOwner[],
  commissionStatuses?: ReCommissionStatus[]
): {
  earnedCommission: number;
  collectedCommission: number;
  isCollectedFromOwner: boolean;
  status: string;
} {
  const propObj = properties.find(p => p.id === propertyId);
  const ownerObj = owners.find(o => o.id === (propObj?.ownerId));
  const commSettings = getPropertyCommissionSettings(propObj, ownerObj, dues);

  // Filter all dues for this property and month
  const rawMonthDues = dues.filter(d => 
    (d.propertyId === propertyId || (!d.propertyId && propObj?.id === propertyId)) &&
    (!forMonthYear || forMonthYear === 'all' || d.forMonthYear === forMonthYear)
  );

  // Deduplicate monthDues to prevent summing duplicates
  const monthDuesMap = new Map<string, typeof rawMonthDues[0]>();
  rawMonthDues.forEach(d => {
    const k = `${d.propertyId || ''}_${(d as any).tenantId || (d as any).tenantName || ''}_${(d as any).unitId || (d as any).unitNumber || ''}_${d.forMonthYear || ''}`;
    if (!monthDuesMap.has(k)) {
      monthDuesMap.set(k, d);
    } else {
      const existing = monthDuesMap.get(k)!;
      const dUpdated = (d as any).updatedAt || (d as any).createdAt || '';
      const existUpdated = (existing as any).updatedAt || (existing as any).createdAt || '';
      if (dUpdated > existUpdated) {
        monthDuesMap.set(k, d);
      }
    }
  });
  const monthDues = Array.from(monthDuesMap.values());

  const totalDueRent = monthDues.reduce((s, d) => s + (d.rentAmount || 0), 0);

  // Calculate base commission from settings (same as Commissions section)
  const earnedCommission = calculateCommissionFromSettings(totalDueRent, commSettings);

  // Find status record in commissionStatuses if exists
  const statusObj = (commissionStatuses || []).find(
    cs => cs.propertyId === propertyId && (cs.forMonthYear === forMonthYear || cs.forMonthYear === 'all')
  );

  let statusVal = 'not_claimed';
  if (statusObj?.status) {
    statusVal = statusObj.status;
  } else if (statusObj?.isCollectedFromOwner) {
    statusVal = 'collected';
  }

  let collectedCommission = 0;
  if (statusVal === 'collected' || statusObj?.isCollectedFromOwner) {
    collectedCommission = statusObj?.amountCollectedFromOwner ?? earnedCommission;
  } else if (statusObj?.amountCollectedFromOwner && statusObj.amountCollectedFromOwner > 0) {
    collectedCommission = statusObj.amountCollectedFromOwner;
  }

  return {
    earnedCommission,
    collectedCommission,
    isCollectedFromOwner: statusVal === 'collected' || !!statusObj?.isCollectedFromOwner,
    status: statusVal,
  };
}

/**
 * Gets the commission amount for a due, applying property/owner commission settings accurately without duplication.
 */
export function getDueCommissionAmount(
  d: { rentAmount?: number; commissionAmount?: number; propertyId?: string; ownerId?: string; commissionType?: string; commissionValue?: number; forMonthYear?: string },
  owners: ReOwner[] = [],
  properties: ReProperty[] = [],
  allDues?: Array<{ rentAmount?: number; propertyId?: string; ownerId?: string; forMonthYear?: string; commissionType?: string; commissionValue?: number }>,
  commissionStatuses?: ReCommissionStatus[]
): number {
  const rent = d.rentAmount || 0;
  if (rent <= 0) return 0;

  if (d.propertyId && d.forMonthYear && allDues && allDues.length > 0) {
    const rawMonthDues = allDues.filter(item => 
      item.propertyId === d.propertyId && 
      item.forMonthYear === d.forMonthYear
    );
    const monthDuesMap = new Map<string, typeof rawMonthDues[0]>();
    rawMonthDues.forEach(item => {
      const k = `${item.propertyId || ''}_${(item as any).tenantId || (item as any).tenantName || ''}_${(item as any).unitId || (item as any).unitNumber || ''}_${item.forMonthYear || ''}`;
      if (!monthDuesMap.has(k)) {
        monthDuesMap.set(k, item);
      } else {
        const existing = monthDuesMap.get(k)!;
        const itemUpdated = (item as any).updatedAt || (item as any).createdAt || '';
        const existUpdated = (existing as any).updatedAt || (existing as any).createdAt || '';
        if (itemUpdated > existUpdated) {
          monthDuesMap.set(k, item);
        }
      }
    });
    const monthDues = Array.from(monthDuesMap.values());
    const totalMonthRent = monthDues.reduce((s, item) => s + (item.rentAmount || 0), 0);
    if (totalMonthRent > 0) {
      const secComm = getSectionCommissionForPropertyMonth(d.propertyId, d.forMonthYear, allDues, properties, owners, commissionStatuses);
      return Math.round((rent / totalMonthRent) * secComm.earnedCommission);
    }
  }

  const propObj = properties.find(p => p.id === d.propertyId);
  const ownerObj = owners.find(o => o.id === (d.ownerId || propObj?.ownerId));

  const settings = getPropertyCommissionSettings(propObj, ownerObj, allDues);

  if (settings.commissionValue <= 0) {
    if (d.commissionValue && d.commissionValue > 0) {
      const inlineSettings = { commissionType: d.commissionType, commissionValue: d.commissionValue };
      return calculateCommissionFromSettings(rent, inlineSettings);
    }
    return d.commissionAmount || 0;
  }

  if (settings.commissionType === 'percentage') {
    return Math.round((rent * settings.commissionValue) / 100);
  }
  if (settings.commissionType === 'fixed_per_thousand') {
    return Math.floor(rent / 1000) * settings.commissionValue;
  } else if (settings.commissionType === 'fixed_flat') {
    return settings.commissionValue;
  }
  return 0;
}

export interface PropertyStatementMonthEntry {
  forMonthYear: string;
  monthNameAr: string;
  rentSum: number;
  collectedSum: number;
  arrearsSum: number;
  commissionSum: number;
  commissionStatus?: string;
  isCommissionCollected?: boolean;
  collectedCommission?: number;
  expensesSum: number;
  advancesSum: number;
  totalDeductionsSum: number;
  allExpenses?: RePropertyExpense[];
  allAdvances?: ReOwnerAdvance[];
  expensesDeducted?: RePropertyExpense[];
  advancesDeducted?: ReOwnerAdvance[];
  netOwnerSum: number;
  disbursedSum: number;
  balanceSum: number;
  tenantCount: number;
  paidOutCount: number;
  dues: ReRentDue[];
}

export interface PropertyStatementGroup {
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  dues: ReRentDue[];
  months: PropertyStatementMonthEntry[];
  totalRentSum: number;
  totalCollectedSum: number;
  totalArrearsSum: number;
  totalCommissionSum: number;
  totalExpensesSum: number;
  totalAdvancesSum: number;
  totalDeductionsSum: number;
  allExpenses?: RePropertyExpense[];
  allAdvances?: ReOwnerAdvance[];
  expensesDeducted?: RePropertyExpense[];
  advancesDeducted?: ReOwnerAdvance[];
  totalNetOwnerSum: number;
  totalDisbursedSum: number;
  totalBalanceSum: number;
}

export interface PropertyStatementsCalculatedData {
  filteredDues: ReRentDue[];
  propertyGroups: PropertyStatementGroup[];
  grandTotalRent: number;
  grandTotalCollected: number;
  grandTotalArrears: number;
  grandTotalCommission: number;
  grandTotalExpenses: number;
  grandTotalAdvances: number;
  grandTotalDeductions: number;
  grandTotalNetOwner: number;
  grandTotalDisbursed: number;
  grandTotalBalance: number;
  leasedUnitsCount: number;
  vacantUnitsCount: number;
  totalUnitsCount: number;
  occupancyRate: number;
  collectionRate: number;
}

/**
 * Single Unified Source of Truth for Property Account Statements ("كشف حسابات العقارات").
 * Ensures 100% data parity between the UI screen and PDF reports.
 */
export function calculatePropertyStatementsData(params: {
  dues: ReRentDue[];
  collections: ReCollectionReceipt[];
  properties: ReProperty[];
  owners: ReOwner[];
  units: ReUnit[];
  expenses: RePropertyExpense[];
  advances: ReOwnerAdvance[];
  commissionStatuses: ReCommissionStatus[];
  rentAdjustments?: ReRentAdjustment[];
  filters: {
    selectedPropertyId?: string;
    selectedOwnerId?: string;
    selectedTenantId?: string;
    selectedMonthYear?: string;
    tenantFromMonth?: string;
    tenantToMonth?: string;
    propertyStatementsFilter?: string; // 'all' | 'collected' | 'uncollected'
    propertyAccountType?: string; // 'monthly' | 'total'
    todayISO?: string;
    currentMonthISO?: string;
  };
}): PropertyStatementsCalculatedData {
  const {
    dues = [],
    collections = [],
    properties = [],
    owners = [],
    units = [],
    expenses = [],
    advances = [],
    commissionStatuses = [],
    rentAdjustments = [],
    filters = {}
  } = params;

  const todayISO = filters.todayISO || new Date().toISOString().slice(0, 10);
  const currentMonthISO = filters.currentMonthISO || new Date().toISOString().slice(0, 7);
  const selectedPropertyId = filters.selectedPropertyId || 'all';
  const selectedOwnerId = filters.selectedOwnerId || 'all';
  const selectedTenantId = filters.selectedTenantId || 'all';
  const activeMonth = filters.propertyAccountType === 'total' ? 'all' : (filters.selectedMonthYear || 'all');
  const tenantFromMonth = filters.tenantFromMonth || '';
  const tenantToMonth = filters.tenantToMonth || '';
  const propertyStatementsFilter = filters.propertyStatementsFilter || 'all';

  // Set of registered property IDs in the Properties section
  const registeredPropIds = new Set((properties || []).map(p => p.id).filter(Boolean));

  // 1. Filter raw dues (excluding orphaned property records)
  const rawFilteredDues = dues.filter(d => {
    if (!d) return false;
    // Exclude dues belonging to properties that are not currently registered in the Properties section
    if (!d.propertyId || !registeredPropIds.has(d.propertyId)) return false;

    if (selectedPropertyId !== 'all' && d.propertyId !== selectedPropertyId) return false;
    if (selectedOwnerId !== 'all' && d.ownerId !== selectedOwnerId) return false;
    if (selectedTenantId !== 'all' && d.tenantId !== selectedTenantId) return false;

    if (activeMonth !== 'all') {
      if (activeMonth.length === 7 && d.forMonthYear !== activeMonth) return false;
      if (activeMonth.length === 4 && !d.forMonthYear?.startsWith(activeMonth)) return false;
    }

    if (tenantFromMonth && d.forMonthYear && d.forMonthYear < tenantFromMonth) return false;
    if (tenantToMonth && d.forMonthYear && d.forMonthYear > tenantToMonth) return false;

    const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
    const isCollected = cStatus === 'collected' || cStatus === 'prepaid';

    // Exclude uncollected future reserve months
    const isFutureMonth = d.forMonthYear && d.forMonthYear > currentMonthISO;
    if (activeMonth === 'all' && isFutureMonth && !isCollected) return false;

    if (propertyStatementsFilter === 'uncollected' && isCollected) return false;
    if (propertyStatementsFilter === 'collected' && !isCollected) return false;

    return true;
  });

  // 2. Deduplicate
  const uniqueMap = new Map<string, ReRentDue>();
  rawFilteredDues.forEach(d => {
    const key = `${d.tenantId || d.tenantName}_${d.unitId || d.unitNumber}_${d.forMonthYear}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, d);
    } else {
      const existing = uniqueMap.get(key)!;
      const isDCollected = isDueCollected(d, todayISO, currentMonthISO, collections);
      const isExistCollected = isDueCollected(existing, todayISO, currentMonthISO, collections);
      const isDPaidOut = d.payoutStatus === 'paid_out' || !!d.payoutDate;
      const isExistPaidOut = existing.payoutStatus === 'paid_out' || !!existing.payoutDate;

      const dUpdated = d.updatedAt || d.createdAt || '';
      const existUpdated = existing.updatedAt || existing.createdAt || '';

      if (d.isAdjusted && !existing.isAdjusted) {
        uniqueMap.set(key, d);
      } else if (!d.isAdjusted && existing.isAdjusted) {
        // preserve existing adjusted due
      } else if ((isDCollected && !isExistCollected) || (isDPaidOut && !isExistPaidOut) || (dUpdated > existUpdated)) {
        uniqueMap.set(key, d);
      }
    }
  });

  const filteredDues = Array.from(uniqueMap.values()).map(d => {
    const matchedAdj = (rentAdjustments || []).find(a => 
      (a.tenantId === d.tenantId || a.tenantName === d.tenantName) && 
      a.forMonthYear === d.forMonthYear
    );
    if (matchedAdj) {
      return {
        ...d,
        rentAmount: matchedAdj.adjustedRentAmount,
        isAdjusted: true,
        adjustedRentAmount: matchedAdj.adjustedRentAmount,
        commissionAmount: matchedAdj.commissionAmount ?? d.commissionAmount,
        netOwnerAmount: matchedAdj.netOwnerAmount ?? Math.max(0, matchedAdj.adjustedRentAmount - ((matchedAdj.commissionAmount ?? d.commissionAmount) || 0))
      };
    }
    return d;
  }).sort((a, b) => (a.forMonthYear || '').localeCompare(b.forMonthYear || ''));

  // 3. Group by Property
  const propertyGroupsMap = new Map<string, PropertyStatementGroup>();

  filteredDues.forEach(d => {
    const propObj = properties.find(p => p.id === d.propertyId);
    if (!propObj) return; // Skip if property is not found in registered properties list
    const propId = propObj.id;
    const propName = propObj.name || d.propertyName || 'عقار غير محدد';
    const ownerObj = owners.find(o => o.id === (d.ownerId || propObj.ownerId));
    const ownerName = d.ownerName || ownerObj?.name || (ownerObj as any)?.fullName || 'مالك غير محدد';

    if (!propertyGroupsMap.has(propId)) {
      propertyGroupsMap.set(propId, {
        propertyId: propId,
        propertyName: propName,
        ownerId: d.ownerId || propObj?.ownerId || '',
        ownerName: ownerName,
        dues: [],
        months: [],
        totalRentSum: 0,
        totalCollectedSum: 0,
        totalArrearsSum: 0,
        totalCommissionSum: 0,
        totalExpensesSum: 0,
        totalAdvancesSum: 0,
        totalDeductionsSum: 0,
        totalNetOwnerSum: 0,
        totalDisbursedSum: 0,
        totalBalanceSum: 0,
      });
    }

    const group = propertyGroupsMap.get(propId)!;
    group.dues.push(d);
  });

  let grandTotalRent = 0;
  let grandTotalCollected = 0;
  let grandTotalArrears = 0;
  let grandTotalCommission = 0;
  let grandTotalExpenses = 0;
  let grandTotalAdvances = 0;
  let grandTotalNetOwner = 0;
  let grandTotalDisbursed = 0;
  let grandTotalBalance = 0;

  propertyGroupsMap.forEach(group => {
    // Group this property's dues by month
    const monthMap = new Map<string, PropertyStatementMonthEntry>();

    group.dues.forEach(d => {
      const mKey = d.forMonthYear || '0000-00';
      if (!monthMap.has(mKey)) {
        monthMap.set(mKey, {
          forMonthYear: mKey,
          monthNameAr: d.monthNameAr || mKey,
          rentSum: 0,
          collectedSum: 0,
          arrearsSum: 0,
          commissionSum: 0,
          expensesSum: 0,
          advancesSum: 0,
          totalDeductionsSum: 0,
          netOwnerSum: 0,
          disbursedSum: 0,
          balanceSum: 0,
          tenantCount: 0,
          paidOutCount: 0,
          dues: [],
        });
      }

      const mEntry = monthMap.get(mKey)!;
      mEntry.dues.push(d);

      const rent = d.rentAmount || 0;
      const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
      const isCollected = cStat === 'collected' || cStat === 'prepaid';
      const collected = isCollected ? (d.collectedAmount || d.rentAmount || 0) : 0;

      mEntry.rentSum += rent;
      mEntry.collectedSum += collected;
      mEntry.tenantCount += 1;

      if (getDuePayoutStatus(d) === 'paid_out') {
        mEntry.paidOutCount += 1;
      }
    });

    monthMap.forEach((mEntry, mKey) => {
      mEntry.arrearsSum = Math.max(0, mEntry.rentSum - mEntry.collectedSum);

      const secComm = getSectionCommissionForPropertyMonth(group.propertyId, mKey, dues, properties, owners, commissionStatuses);
      mEntry.commissionSum = secComm.earnedCommission;
      mEntry.commissionStatus = secComm.status;
      mEntry.isCommissionCollected = secComm.isCollectedFromOwner || secComm.status === 'collected';
      mEntry.collectedCommission = secComm.collectedCommission;

      // Month-specific Deductions for this property and month
      const allMonthExp = (expenses || []).filter(e => {
        const isTarget = e.propertyId === group.propertyId;
        const expM = e.forMonthYear || (e.expenseDate ? e.expenseDate.slice(0, 7) : '');
        return isTarget && expM === mKey;
      });

      const allMonthAdv = (advances || []).filter(a => {
        const isTarget = a.propertyId === group.propertyId || (!a.propertyId && a.ownerId === group.ownerId);
        const advM = a.forMonthYear || (a.advanceDate ? a.advanceDate.slice(0, 7) : '');
        return isTarget && advM === mKey;
      });

      const monthExp = allMonthExp.filter(e => e.isDeducted);
      const monthAdv = allMonthAdv.filter(a => a.isDeducted);

      mEntry.allExpenses = allMonthExp;
      mEntry.allAdvances = allMonthAdv;
      mEntry.expensesDeducted = monthExp;
      mEntry.advancesDeducted = monthAdv;
      mEntry.expensesSum = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
      mEntry.advancesSum = monthAdv.reduce((s, a) => s + getAdvanceDeductedFromEntitlementAmount(a), 0);
      mEntry.totalDeductionsSum = mEntry.expensesSum + mEntry.advancesSum;

      // Net Owner Entitlement for this month = Rent - Office Commission - Approved Deductions (Expenses & Advances)
      mEntry.netOwnerSum = Math.max(0, mEntry.rentSum - mEntry.commissionSum - mEntry.totalDeductionsSum);

      // Amount Disbursed to Owner for this month
      mEntry.disbursedSum = mEntry.dues.reduce((sum, d) => {
        if (getDuePayoutStatus(d) !== 'paid_out') return sum;
        const dueComm = mEntry.rentSum > 0 ? Math.round(((d.rentAmount || 0) / mEntry.rentSum) * secComm.earnedCommission) : 0;
        const dueNet = Math.max(0, (d.rentAmount || 0) - dueComm);
        return sum + (d.payoutAmount || dueNet);
      }, 0);

      // Remaining Balance to be paid out
      mEntry.balanceSum = Math.max(0, mEntry.netOwnerSum - mEntry.disbursedSum);
    });

    const sortedMonths = Array.from(monthMap.values()).sort((a, b) => a.forMonthYear.localeCompare(b.forMonthYear));
    group.months = sortedMonths;

    group.totalRentSum = sortedMonths.reduce((s, m) => s + m.rentSum, 0);
    group.totalCollectedSum = sortedMonths.reduce((s, m) => s + m.collectedSum, 0);
    group.totalArrearsSum = sortedMonths.reduce((s, m) => s + m.arrearsSum, 0);
    group.totalCommissionSum = sortedMonths.reduce((s, m) => s + m.commissionSum, 0);
    group.totalExpensesSum = sortedMonths.reduce((s, m) => s + m.expensesSum, 0);
    group.totalAdvancesSum = sortedMonths.reduce((s, m) => s + m.advancesSum, 0);
    group.totalDeductionsSum = group.totalExpensesSum + group.totalAdvancesSum;
    group.allExpenses = (expenses || []).filter(e => e.propertyId === group.propertyId);
    group.allAdvances = (advances || []).filter(a => a.propertyId === group.propertyId || (!a.propertyId && a.ownerId === group.ownerId));
    group.expensesDeducted = group.allExpenses.filter(e => e.isDeducted);
    group.advancesDeducted = group.allAdvances.filter(a => a.isDeducted);
    group.totalNetOwnerSum = sortedMonths.reduce((s, m) => s + m.netOwnerSum, 0);
    group.totalDisbursedSum = sortedMonths.reduce((s, m) => s + m.disbursedSum, 0);
    group.totalBalanceSum = Math.max(0, group.totalNetOwnerSum - group.totalDisbursedSum);

    grandTotalRent += group.totalRentSum;
    grandTotalCollected += group.totalCollectedSum;
    grandTotalArrears += group.totalArrearsSum;
    grandTotalCommission += group.totalCommissionSum;
    grandTotalExpenses += group.totalExpensesSum;
    grandTotalAdvances += group.totalAdvancesSum;
    grandTotalNetOwner += group.totalNetOwnerSum;
    grandTotalDisbursed += group.totalDisbursedSum;
    grandTotalBalance += group.totalBalanceSum;
  });

  const propertyGroups = Array.from(propertyGroupsMap.values());

  const activeFilteredUnits = units.filter(u => selectedPropertyId === 'all' || u.propertyId === selectedPropertyId);
  const totalUnitsCount = activeFilteredUnits.length;
  const leasedUnitsCount = new Set(filteredDues.map(d => d.unitId)).size || activeFilteredUnits.filter(u => u.status === 'rented').length;
  const vacantUnitsCount = Math.max(0, totalUnitsCount - leasedUnitsCount);
  const occupancyRate = totalUnitsCount > 0 ? Math.round((leasedUnitsCount / totalUnitsCount) * 100) : 0;
  const collectionRate = grandTotalRent > 0 ? Math.round((grandTotalCollected / grandTotalRent) * 100) : 0;

  return {
    filteredDues,
    propertyGroups,
    grandTotalRent,
    grandTotalCollected,
    grandTotalArrears,
    grandTotalCommission,
    grandTotalExpenses,
    grandTotalAdvances,
    grandTotalDeductions: grandTotalExpenses + grandTotalAdvances,
    grandTotalNetOwner,
    grandTotalDisbursed,
    grandTotalBalance,
    leasedUnitsCount,
    vacantUnitsCount,
    totalUnitsCount,
    occupancyRate,
    collectionRate,
  };
}

export interface OwnerStatementMonthEntry {
  forMonthYear: string;
  monthNameAr: string;
  rentSum: number;
  collectedSum: number;
  commissionSum: number;
  netOwnerSum: number;
  disbursedSum: number;
  tenantCount: number;
  paidOutCount: number;
  dues: ReRentDue[];
  allAdvances?: ReOwnerAdvance[];
  allExpenses?: RePropertyExpense[];
  advancesDeducted: ReOwnerAdvance[];
  expensesDeducted: RePropertyExpense[];
  sumAdvancesDeducted: number;
  sumExpensesDeducted: number;
  totalDeductionsSum: number;
  netOwnerAfterDeductions: number;
  remainingBalance: number;
}

export interface OwnerStatementPropertyGroup {
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  dues: ReRentDue[];
  months: OwnerStatementMonthEntry[];
  totalRentSum: number;
  totalCommissionSum: number;
  totalNetOwnerSum: number;
  totalDisbursedSum: number;
  totalCollectedSum: number;
  totalBalanceSum: number;
  allAdvances?: ReOwnerAdvance[];
  allExpenses?: RePropertyExpense[];
  advancesDeducted: ReOwnerAdvance[];
  expensesDeducted: RePropertyExpense[];
  sumAdvancesDeducted: number;
  sumExpensesDeducted: number;
  totalDeductionsSum: number;
  netOwnerAfterDeductions: number;
  netBalanceAfterDeductions: number;
}

export interface OwnerStatementsCalculatedData {
  statementDues: ReRentDue[];
  ownerPropertyGroups: OwnerStatementPropertyGroup[];
  ownerTotalRentSum: number;
  ownerTotalCommissionSum: number;
  ownerTotalNetOwnerSum: number;
  ownerTotalDisbursedSum: number;
  ownerTotalCollectedSum: number;
  ownerTotalBalanceSum: number;
  allOwnerAdvances: ReOwnerAdvance[];
  allOwnerExpenses: RePropertyExpense[];
  allOwnerPayouts?: RePayout[];
  ownerAdvancesDeducted: ReOwnerAdvance[];
  ownerExpensesDeducted: RePropertyExpense[];
  sumDeductedAdvances: number;
  sumDeductedExpenses: number;
  totalOwnerDeductions: number;
  finalNetSettlement: number;
  finalRemainingBalance: number;
}

/**
 * Single Unified Source of Truth for Owner Account Statements ("كشف حساب الملاك").
 * Ensures 100% data and calculation parity between the UI screen and PDF reports.
 */
export function calculateOwnerStatementsData(params: {
  dues: ReRentDue[];
  collections: ReCollectionReceipt[];
  properties: ReProperty[];
  owners: ReOwner[];
  units?: ReUnit[];
  expenses: RePropertyExpense[];
  advances: ReOwnerAdvance[];
  payouts?: RePayout[];
  commissionStatuses: ReCommissionStatus[];
  rentAdjustments?: ReRentAdjustment[];
  filters: {
    selectedPropertyId?: string;
    selectedOwnerId?: string;
    selectedMonthYear?: string;
    ownerStatementsFilter?: string; // 'all' | 'collected' | 'uncollected'
    ownerAccountType?: string; // 'monthly' | 'total'
    todayISO?: string;
    currentMonthISO?: string;
  };
}): OwnerStatementsCalculatedData {
  const {
    dues = [],
    collections = [],
    properties = [],
    owners = [],
    expenses = [],
    advances = [],
    payouts = [],
    commissionStatuses = [],
    rentAdjustments = [],
    filters = {}
  } = params;

  const todayISO = filters.todayISO || new Date().toISOString().slice(0, 10);
  const currentMonthISO = filters.currentMonthISO || new Date().toISOString().slice(0, 7);
  const selectedPropertyId = filters.selectedPropertyId || 'all';
  const selectedOwnerId = filters.selectedOwnerId || 'all';
  const activeMonth = filters.ownerAccountType === 'total' ? 'all' : (filters.selectedMonthYear || 'all');
  const ownerStatementsFilter = filters.ownerStatementsFilter || 'all';

  const registeredPropIds = new Set((properties || []).map(p => p.id).filter(Boolean));

  // 1. Filter raw dues
  const rawOwnerDues = dues.filter(d => {
    if (!d) return false;
    // Exclude orphaned property records not registered in the Properties section
    if (!d.propertyId || !registeredPropIds.has(d.propertyId)) return false;
    if (!d.propertyName || d.propertyName.includes('عقار غير محدد')) return false;

    const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
    const isCollected = cStatus === 'collected' || cStatus === 'prepaid';
    const isFutureMonth = d.forMonthYear && d.forMonthYear > currentMonthISO;
    if (activeMonth === 'all' && isFutureMonth && !isCollected) return false;

    if (ownerStatementsFilter === 'uncollected' && isCollected) return false;
    if (ownerStatementsFilter === 'collected' && !isCollected) return false;

    const pOwnerId = properties.find(p => p.id === d.propertyId)?.ownerId;
    const resolvedOwnerId = d.ownerId || pOwnerId || '';

    const matchOwner = selectedOwnerId === 'all' || resolvedOwnerId === selectedOwnerId || d.ownerId === selectedOwnerId;
    const matchMonth = activeMonth === 'all' || d.forMonthYear === activeMonth;
    const matchProp = selectedPropertyId === 'all' || d.propertyId === selectedPropertyId;
    return matchOwner && matchMonth && matchProp;
  });

  // 2. Deduplicate by tenant/unit/month key
  const ownerUniqueDuesMap = new Map<string, ReRentDue>();
  rawOwnerDues.forEach(d => {
    const key = `${d.tenantId || d.tenantName}_${d.unitId || d.unitNumber}_${d.forMonthYear}`;
    if (!ownerUniqueDuesMap.has(key)) {
      ownerUniqueDuesMap.set(key, d);
    } else {
      const existing = ownerUniqueDuesMap.get(key)!;
      const isDCollected = isDueCollected(d, todayISO, currentMonthISO, collections);
      const isExistCollected = isDueCollected(existing, todayISO, currentMonthISO, collections);
      const isDPaidOut = d.payoutStatus === 'paid_out' || !!d.payoutDate;
      const isExistPaidOut = existing.payoutStatus === 'paid_out' || !!existing.payoutDate;

      const dUpdated = d.updatedAt || d.createdAt || '';
      const existUpdated = existing.updatedAt || existing.createdAt || '';

      if (d.isAdjusted && !existing.isAdjusted) {
        ownerUniqueDuesMap.set(key, d);
      } else if (!d.isAdjusted && existing.isAdjusted) {
        // preserve existing adjusted due
      } else if ((isDCollected && !isExistCollected) || (isDPaidOut && !isExistPaidOut) || (dUpdated > existUpdated)) {
        ownerUniqueDuesMap.set(key, d);
      }
    }
  });
  const statementDues = Array.from(ownerUniqueDuesMap.values()).map(d => {
    const matchedAdj = (rentAdjustments || []).find(a => 
      (a.tenantId === d.tenantId || a.tenantName === d.tenantName) && 
      a.forMonthYear === d.forMonthYear
    );
    if (matchedAdj) {
      return {
        ...d,
        rentAmount: matchedAdj.adjustedRentAmount,
        isAdjusted: true,
        adjustedRentAmount: matchedAdj.adjustedRentAmount,
        commissionAmount: matchedAdj.commissionAmount ?? d.commissionAmount,
        netOwnerAmount: matchedAdj.netOwnerAmount ?? Math.max(0, matchedAdj.adjustedRentAmount - ((matchedAdj.commissionAmount ?? d.commissionAmount) || 0))
      };
    }
    return d;
  });

  // 3. Deductions (Advances and Expenses) directly synchronized from advances & expenses records
  const allOwnerAdvances = (advances || []).filter(a => {
    const prop = properties.find(p => p.id === a.propertyId);
    const resolvedOwnerId = a.ownerId || prop?.ownerId || '';
    const matchOwner = selectedOwnerId === 'all' || resolvedOwnerId === selectedOwnerId || a.ownerId === selectedOwnerId;
    const matchProp = selectedPropertyId === 'all' || a.propertyId === selectedPropertyId;
    const advMonth = a.forMonthYear || (a.advanceDate ? a.advanceDate.slice(0, 7) : '');
    const matchMonth = activeMonth === 'all' || !advMonth || advMonth === activeMonth;
    return matchOwner && matchProp && matchMonth;
  });

  const allOwnerExpenses = (expenses || []).filter(e => {
    const prop = properties.find(p => p.id === e.propertyId);
    const resolvedOwnerId = e.ownerId || prop?.ownerId || '';
    const matchOwner = selectedOwnerId === 'all' || resolvedOwnerId === selectedOwnerId || e.ownerId === selectedOwnerId;
    const matchProp = selectedPropertyId === 'all' || e.propertyId === selectedPropertyId;
    const expMonth = e.forMonthYear || (e.expenseDate ? e.expenseDate.slice(0, 7) : '');
    const matchMonth = activeMonth === 'all' || !expMonth || expMonth === activeMonth;
    return matchOwner && matchProp && matchMonth;
  });

  const allOwnerPayouts = (payouts || []).filter(p => {
    if (!p) return false;
    const prop = properties.find(propObj => propObj.id === p.propertyId);
    const resolvedOwnerId = p.ownerId || prop?.ownerId || '';
    const matchOwner = selectedOwnerId === 'all' || resolvedOwnerId === selectedOwnerId || p.ownerId === selectedOwnerId;
    const matchProp = selectedPropertyId === 'all' || p.propertyId === selectedPropertyId;
    const payMonth = p.forMonthYear || (p.payoutDate ? p.payoutDate.slice(0, 7) : '');
    const matchMonth = activeMonth === 'all' || !payMonth || payMonth === activeMonth;
    return matchOwner && matchProp && matchMonth;
  });

  const ownerAdvancesDeducted = allOwnerAdvances.filter(a => a.isDeducted);
  const ownerExpensesDeducted = allOwnerExpenses.filter(e => e.isDeducted);

  const sumDeductedAdvances = ownerAdvancesDeducted.reduce((acc, a) => acc + getAdvanceDeductedFromEntitlementAmount(a), 0);
  const sumDeductedExpenses = ownerExpensesDeducted.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalOwnerDeductions = sumDeductedAdvances + sumDeductedExpenses;

  // 4. Group dues by Property
  const ownerPropertyGroupsMap = new Map<string, OwnerStatementPropertyGroup>();

  statementDues.forEach(d => {
    const propId = d.propertyId;
    if (!propId || !registeredPropIds.has(propId)) return;
    const propObj = properties.find(p => p.id === propId);
    if (!propObj) return;
    const ownerObj = owners.find(o => o.id === (d.ownerId || propObj.ownerId));
    const propName = propObj.name || d.propertyName || 'عقار غير محدد';
    const ownerName = ownerObj?.name || d.ownerName || 'مالك غير محدد';

    if (!ownerPropertyGroupsMap.has(propId)) {
      ownerPropertyGroupsMap.set(propId, {
        propertyId: propId,
        propertyName: propName,
        ownerId: d.ownerId || propObj?.ownerId || '',
        ownerName: ownerName,
        dues: [],
        months: [],
        totalRentSum: 0,
        totalCommissionSum: 0,
        totalNetOwnerSum: 0,
        totalDisbursedSum: 0,
        totalCollectedSum: 0,
        totalBalanceSum: 0,
        advancesDeducted: [],
        expensesDeducted: [],
        sumAdvancesDeducted: 0,
        sumExpensesDeducted: 0,
        totalDeductionsSum: 0,
        netOwnerAfterDeductions: 0,
        netBalanceAfterDeductions: 0,
      });
    }

    const group = ownerPropertyGroupsMap.get(propId)!;
    group.dues.push(d);
  });

  let ownerTotalRentSum = 0;
  let ownerTotalCommissionSum = 0;
  let ownerTotalNetOwnerSum = 0;
  let ownerTotalDisbursedSum = 0;
  let ownerTotalCollectedSum = 0;
  let ownerTotalBalanceSum = 0;

  ownerPropertyGroupsMap.forEach(group => {
    // Property level deductions
    group.allAdvances = allOwnerAdvances.filter(a => a.propertyId === group.propertyId || (!a.propertyId && a.ownerId === group.ownerId));
    group.allExpenses = allOwnerExpenses.filter(e => e.propertyId === group.propertyId);
    group.advancesDeducted = ownerAdvancesDeducted.filter(a => a.propertyId === group.propertyId || (!a.propertyId && a.ownerId === group.ownerId));
    group.expensesDeducted = ownerExpensesDeducted.filter(e => e.propertyId === group.propertyId);
    group.sumAdvancesDeducted = group.advancesDeducted.reduce((sum, a) => sum + getAdvanceDeductedFromEntitlementAmount(a), 0);
    group.sumExpensesDeducted = group.expensesDeducted.reduce((sum, e) => sum + (e.amount || 0), 0);
    group.totalDeductionsSum = group.sumAdvancesDeducted + group.sumExpensesDeducted;

    const propMonthsMap = new Map<string, OwnerStatementMonthEntry>();

    group.dues.forEach(d => {
      const mKey = d.forMonthYear || '0000-00';
      if (!propMonthsMap.has(mKey)) {
        propMonthsMap.set(mKey, {
          forMonthYear: mKey,
          monthNameAr: d.monthNameAr || mKey,
          rentSum: 0,
          collectedSum: 0,
          commissionSum: 0,
          netOwnerSum: 0,
          disbursedSum: 0,
          tenantCount: 0,
          paidOutCount: 0,
          dues: [],
          allAdvances: [],
          allExpenses: [],
          advancesDeducted: [],
          expensesDeducted: [],
          sumAdvancesDeducted: 0,
          sumExpensesDeducted: 0,
          totalDeductionsSum: 0,
          netOwnerAfterDeductions: 0,
          remainingBalance: 0,
        });
      }
      const mEntry = propMonthsMap.get(mKey)!;
      mEntry.dues.push(d);
      mEntry.tenantCount += 1;
      if (getDuePayoutStatus(d) === 'paid_out') {
        mEntry.paidOutCount += 1;
      }
    });

    propMonthsMap.forEach((mEntry, mKey) => {
      const mDues = mEntry.dues;
      const mRent = mDues.reduce((s, d) => s + (d.rentAmount || 0), 0);
      const secComm = getSectionCommissionForPropertyMonth(group.propertyId, mKey, dues, properties, owners, commissionStatuses);

      mEntry.rentSum = mRent;
      mEntry.commissionSum = secComm.earnedCommission;

      // Monthly deductions (all transactions & deducted only)
      const allMonthAdv = (allOwnerAdvances || []).filter(a => {
        const isTarget = a.propertyId === group.propertyId || (!a.propertyId && a.ownerId === group.ownerId);
        const advM = a.forMonthYear || (a.advanceDate ? a.advanceDate.slice(0, 7) : '');
        return isTarget && advM === mKey;
      });
      const allMonthExp = (allOwnerExpenses || []).filter(e => {
        const isTarget = e.propertyId === group.propertyId;
        const expM = e.forMonthYear || (e.expenseDate ? e.expenseDate.slice(0, 7) : '');
        return isTarget && expM === mKey;
      });

      const monthAdv = allMonthAdv.filter(a => a.isDeducted);
      const monthExp = allMonthExp.filter(e => e.isDeducted);

      mEntry.allAdvances = allMonthAdv;
      mEntry.allExpenses = allMonthExp;
      mEntry.advancesDeducted = monthAdv;
      mEntry.expensesDeducted = monthExp;
      mEntry.sumAdvancesDeducted = monthAdv.reduce((s, a) => s + getAdvanceDeductedFromEntitlementAmount(a), 0);
      mEntry.sumExpensesDeducted = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
      mEntry.totalDeductionsSum = mEntry.sumAdvancesDeducted + mEntry.sumExpensesDeducted;
      mEntry.netOwnerSum = Math.max(0, mRent - secComm.earnedCommission - mEntry.totalDeductionsSum);
      mEntry.netOwnerAfterDeductions = mEntry.netOwnerSum;

      let mColl = 0;
      let mDisb = 0;
      mDues.forEach(d => {
        const cStat = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
        const pStat = getDuePayoutStatus(d);
        const dueComm = mRent > 0 ? Math.round(((d.rentAmount || 0) / mRent) * secComm.earnedCommission) : 0;
        const dueNet = Math.max(0, (d.rentAmount || 0) - dueComm);

        if (cStat === 'collected' || cStat === 'prepaid') mColl += (d.collectedAmount || d.rentAmount || 0);
        if (pStat === 'paid_out') mDisb += dueNet;
      });

      mEntry.collectedSum = mColl;
      mEntry.disbursedSum = mDisb;
      mEntry.remainingBalance = Math.max(0, mEntry.netOwnerSum - mDisb);
    });

    const sortedPropMonths = Array.from(propMonthsMap.values()).sort((a, b) => a.forMonthYear.localeCompare(b.forMonthYear));
    group.months = sortedPropMonths;

    group.totalRentSum = sortedPropMonths.reduce((s, m) => s + m.rentSum, 0);
    group.totalCommissionSum = sortedPropMonths.reduce((s, m) => s + m.commissionSum, 0);
    group.totalNetOwnerSum = Math.max(0, group.totalRentSum - group.totalCommissionSum);
    group.totalDisbursedSum = sortedPropMonths.reduce((s, m) => s + m.disbursedSum, 0);
    group.totalCollectedSum = sortedPropMonths.reduce((s, m) => s + m.collectedSum, 0);
    group.totalBalanceSum = group.totalNetOwnerSum - group.totalDisbursedSum;
    group.netOwnerAfterDeductions = Math.max(0, group.totalNetOwnerSum - group.totalDeductionsSum);
    group.netBalanceAfterDeductions = Math.max(0, group.totalBalanceSum - group.totalDeductionsSum);

    ownerTotalRentSum += group.totalRentSum;
    ownerTotalCommissionSum += group.totalCommissionSum;
    ownerTotalNetOwnerSum += group.totalNetOwnerSum;
    ownerTotalDisbursedSum += group.totalDisbursedSum;
    ownerTotalCollectedSum += group.totalCollectedSum;
    ownerTotalBalanceSum += group.totalBalanceSum;
  });

  const ownerPropertyGroups = Array.from(ownerPropertyGroupsMap.values());
  const finalNetSettlement = Math.max(0, ownerTotalNetOwnerSum - totalOwnerDeductions);
  const finalRemainingBalance = Math.max(0, ownerTotalBalanceSum - totalOwnerDeductions);

  return {
    statementDues,
    ownerPropertyGroups,
    ownerTotalRentSum,
    ownerTotalCommissionSum,
    ownerTotalNetOwnerSum,
    ownerTotalDisbursedSum,
    ownerTotalCollectedSum,
    ownerTotalBalanceSum,
    allOwnerAdvances,
    allOwnerExpenses,
    allOwnerPayouts,
    ownerAdvancesDeducted,
    ownerExpensesDeducted,
    sumDeductedAdvances,
    sumDeductedExpenses,
    totalOwnerDeductions,
    finalNetSettlement,
    finalRemainingBalance,
  };
}

// Default initial data for testing/seeding (empty by default to prevent re-seeding orphaned demo records)
export const initialOwners: ReOwner[] = [];

export const initialProperties: ReProperty[] = [];

export const initialUnits: ReUnit[] = [];

export const initialTenants: ReTenant[] = [];

export const initialCollections: ReCollectionReceipt[] = [];

export const initialPayouts: RePayout[] = [];

export const initialExpenses: RePropertyExpense[] = [];

export const initialAdvances: ReOwnerAdvance[] = [];

export const initialLogs: ReRealEstateLog[] = [];

export const initialDues: ReRentDue[] = [];

export const initialCommissionStatuses: ReCommissionStatus[] = [];

export function formatMonthYearAr(myStr: string): string {
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
}

/**
 * Helper to check if a given month (YYYY-MM) falls within a suspension period for a tenant.
 */
export function isTenantMonthSuspended(forMonthYear: string, tenant: ReTenant): boolean {
  if (!forMonthYear || !tenant) return false;

  // 1. If currently suspended
  if (tenant.status === 'suspended') {
    const suspMonth = tenant.suspensionDate ? tenant.suspensionDate.slice(0, 7) : '';
    if (!suspMonth) return true;
    if (forMonthYear > suspMonth) return true;
    if (forMonthYear === suspMonth && tenant.suspensionDate.endsWith('-01')) return true;
  }

  // 2. Check historical suspension periods
  if (tenant.suspensionHistory && tenant.suspensionHistory.length > 0) {
    for (const entry of tenant.suspensionHistory) {
      const suspM = entry.suspendedAt ? entry.suspendedAt.slice(0, 7) : '';
      const reactM = entry.reactivatedAt ? entry.reactivatedAt.slice(0, 7) : '';
      if (suspM) {
        if (reactM) {
          // Suspended strictly between suspension month and reactivation month
          if (forMonthYear > suspM && forMonthYear < reactM) {
            return true;
          }
        } else {
          // Still active suspension
          if (forMonthYear > suspM) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
