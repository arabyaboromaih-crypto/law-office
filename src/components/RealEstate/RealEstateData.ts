import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReRealEstateLog, ReRentDue, ReCommissionStatus, ReOwnerAdvance, ReRentAdjustment 
} from '../../types';

// ----------------------------------------------------
// 0. Applicable Rent Adjustment Helper
// ----------------------------------------------------
/**
 * Resolves the applicable rent adjustment for a specific tenant and month.
 * Rule: When a contractual rent adjustment is made for a selected month, it applies strictly 
 * to that month and all subsequent months (>= forMonthYear), and NEVER alters any prior month (< forMonthYear).
 * If multiple adjustments exist across time, the latest one whose forMonthYear <= targetMonthYear is selected.
 */
export function getApplicableRentAdjustment(
  rentAdjustments: ReRentAdjustment[] = [],
  tenantId?: string,
  tenantName?: string,
  forMonthYear?: string
): ReRentAdjustment | null {
  if (!forMonthYear) return null;
  const tId = (tenantId || '').trim();
  const tName = (tenantName || '').trim().toLowerCase();

  const matchingTenantAdjs = (rentAdjustments || []).filter(a => {
    if (!a || !a.forMonthYear) return false;
    const matchId = !!(tId && a.tenantId && a.tenantId.trim() === tId);
    const matchName = !!(tName && a.tenantName && a.tenantName.trim().toLowerCase() === tName);
    return matchId || matchName;
  });

  if (matchingTenantAdjs.length === 0) return null;

  // 1. Exact match for this specific month has absolute priority
  const exactMatch = matchingTenantAdjs.find(a => a.forMonthYear === forMonthYear);
  if (exactMatch) return exactMatch;

  // 2. Filter adjustments whose effective starting month is <= forMonthYear
  const applicable = matchingTenantAdjs.filter(a => a.forMonthYear <= forMonthYear);
  if (applicable.length > 0) {
    // Sort descending by forMonthYear to get the latest active adjustment for this month
    applicable.sort((a, b) => b.forMonthYear.localeCompare(a.forMonthYear));
    return applicable[0];
  }

  // 3. If target month is prior to the earliest adjustment, check if the earliest adjustment recorded an originalRentAmount
  const sortedAsc = [...matchingTenantAdjs].sort((a, b) => a.forMonthYear.localeCompare(b.forMonthYear));
  const earliest = sortedAsc[0];
  if (earliest && earliest.originalRentAmount && earliest.originalRentAmount > 0) {
    return {
      ...earliest,
      id: `orig_${tId || 't'}_${forMonthYear}`,
      forMonthYear,
      adjustedRentAmount: earliest.originalRentAmount
    };
  }

  return null;
}

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
 * Matches strictly on tenantId/tenantName + unitId/unitNumber + forMonthYear (month & year) + receiptId / dueId.
 * SSoT: A receipt only matches a due if it belongs to the exact same tenant, unit, and month/year.
 */
export function getMatchingCollectionReceipts(
  due: ReRentDue,
  collections?: ReCollectionReceipt[]
): ReCollectionReceipt[] {
  if (!due || !collections || collections.length === 0) return [];

  const dueMonthYear = (due.forMonthYear || (due.dueDate ? due.dueDate.slice(0, 7) : '')).trim().replace('/', '-');

  return collections.filter(c => {
    if (!c || c.status === 'reverted' || c.isCancelled || !(c.amountPaid && c.amountPaid > 0)) {
      return false;
    }

    // 1. Strict Tenant Match: Must match tenantId (or tenantName if missing)
    const tenantMatches = !!(
      (c.tenantId && due.tenantId && c.tenantId === due.tenantId) ||
      (c.tenantName && due.tenantName && c.tenantName.trim().toLowerCase() === due.tenantName.trim().toLowerCase())
    );
    if (!tenantMatches) return false;

    // 2. Unit and Property consistency: if specified on both, they MUST match
    if (c.unitId && due.unitId && c.unitId !== due.unitId) return false;
    if (c.unitNumber && due.unitNumber && c.unitNumber.trim() !== due.unitNumber.trim()) return false;
    if (c.propertyId && due.propertyId && c.propertyId !== due.propertyId) return false;

    // 3. Direct ID link verification (if linked, tenant & unit already validated above)
    if (c.dueId && c.dueId === due.id) return true;
    if (due.collectionReceiptId && c.id === due.collectionReceiptId) return true;
    if (due.receiptNumber && c.receiptNumber && due.receiptNumber === c.receiptNumber) return true;

    // 4. Strict Month/Year Match (e.g., '2026-08')
    const receiptMonthYear = (c.forMonthYear || (c.paymentDate ? c.paymentDate.slice(0, 7) : '')).trim().replace('/', '-');
    if (!dueMonthYear || !receiptMonthYear) return false;

    return dueMonthYear === receiptMonthYear || receiptMonthYear.includes(dueMonthYear) || dueMonthYear.includes(receiptMonthYear);
  });
}

/**
 * DETAILS OF A DUE'S COLLECTION STATUS DERIVED STRICTLY FROM SAVED COLLECTION RECEIPTS
 */
export interface DueCollectionDetails {
  status: 'collected' | 'partial' | 'overdue' | 'pending_collection' | 'prepaid';
  isFullyPaid: boolean;
  isPartial: boolean;
  isUnpaid: boolean;
  totalPaid: number;
  remainingAmount: number;
  matchingReceipts: ReCollectionReceipt[];
  latestReceipt: ReCollectionReceipt | null;
  receiptNumber: string;
  paymentDate: string;
  paymentMethod: string;
}

/**
 * Returns comprehensive details for a rent due strictly from physically saved collection receipts.
 * SSoT Rules:
 * - Matching receipts for tenant + unit + month + year
 * - A month is ONLY fully paid ('collected' or 'prepaid') if matchingReceipts.length > 0 AND totalPaid >= rentAmount
 * - If matchingReceipts.length > 0 AND totalPaid > 0 AND totalPaid < rentAmount, it is partially paid ('partial') with remaining balance
 * - If matchingReceipts.length === 0, it is unpaid ('overdue' if due date passed, otherwise 'pending_collection')
 * - Never relies on UI-cached or temporary flags.
 */
export function getDueCollectionDetails(
  due: ReRentDue,
  todayISO: string = new Date().toISOString().slice(0, 10),
  currentMonthISO: string = new Date().toISOString().slice(0, 7),
  collections?: ReCollectionReceipt[]
): DueCollectionDetails {
  const matchingReceipts = getMatchingCollectionReceipts(due, collections);
  let totalPaid = matchingReceipts.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const rentAmount = due?.rentAmount || 0;

  // Rule 1: المبلغ المحصل الخاص بهذا الشهر المالي فقط (بحيث يساوي أو يقل عن الإيجار المطلوب للشهر)
  // ولا يجوز تكرار إجمالي قيمة الإيصال الكاملة (68,000 ج.م) في كل صف
  if (rentAmount > 0 && totalPaid > rentAmount) {
    totalPaid = (due.collectedAmount && due.collectedAmount > 0 && due.collectedAmount <= rentAmount)
      ? due.collectedAmount
      : rentAmount;
  }

  // Fallback: If matchingReceipts is empty but due has collected status or recorded collectedAmount
  if (totalPaid === 0 && (due.status === 'collected' || due.collectionStatus === 'collected' || due.collectionStatus === 'prepaid')) {
    totalPaid = (due.collectedAmount && due.collectedAmount > 0)
      ? Math.min(rentAmount, due.collectedAmount)
      : rentAmount;
  }

  // Rule 3: المتأخرات والرصيد: (الإيجار المطلوب - المبلغ المحصل للشهر)
  const remainingAmount = Math.max(0, rentAmount - totalPaid);
  const dueMonthYear = (due?.forMonthYear || (due?.dueDate ? due.dueDate.slice(0, 7) : '')).trim().replace('/', '-');
  const isFuture = !!(dueMonthYear && dueMonthYear > currentMonthISO);

  let status: 'collected' | 'partial' | 'overdue' | 'pending_collection' | 'prepaid';

  if (matchingReceipts.length > 0 && rentAmount > 0 && totalPaid >= rentAmount) {
    status = isFuture ? 'prepaid' : 'collected';
  } else if (matchingReceipts.length > 0 && totalPaid > 0 && totalPaid < rentAmount) {
    status = 'partial';
  } else if (matchingReceipts.length > 0 && totalPaid > 0) {
    status = isFuture ? 'prepaid' : 'collected';
  } else {
    if ((due?.dueDate && due.dueDate <= todayISO) || (dueMonthYear && dueMonthYear <= currentMonthISO)) {
      status = 'overdue';
    } else {
      status = 'pending_collection';
    }
  }

  // Sort matching receipts descending by paymentDate / createdAt
  const sortedReceipts = [...matchingReceipts].sort((a, b) => 
    (b.paymentDate || b.createdAt || '').localeCompare(a.paymentDate || a.createdAt || '')
  );
  const latestReceipt = sortedReceipts[0] || null;

  return {
    status,
    isFullyPaid: status === 'collected' || status === 'prepaid',
    isPartial: status === 'partial',
    isUnpaid: status === 'overdue' || status === 'pending_collection',
    totalPaid,
    remainingAmount,
    matchingReceipts,
    latestReceipt,
    receiptNumber: latestReceipt?.receiptNumber || '',
    paymentDate: latestReceipt?.paymentDate || '',
    paymentMethod: latestReceipt?.paymentMethod || '',
  };
}

export interface TenantDueAllocation {
  due: ReRentDue;
  forMonthYear: string;
  dueDate: string;
  monthNameAr: string;
  rentDue: number; // الإيجار المطلوب
  collectedAmount: number; // المبلغ المحصل الخاص بهذا الشهر المالي فقط (بحيث يساوي أو يقل عن الإيجار المطلوب للشهر)
  remainingArrears: number; // المتأخرات والرصيد: (الإيجار المطلوب - المبلغ المحصل للشهر)
  receiptNumber: string;
  paymentDate: string;
  paymentMethod: string;
  isFullyPaid: boolean;
  isPartial: boolean;
  isUnpaid: boolean;
  isPrepaidReserve: boolean;
  status: 'collected' | 'partial' | 'overdue' | 'pending_collection' | 'prepaid';
  badgeClass: string;
  badgeText: string;
  badgeCustomStyle?: string;
  isFromComprehensiveReceipt: boolean;
  comprehensiveReceiptNumber?: string;
  comprehensiveReceiptTotal?: number;
  revertedCollection?: ReCollectionReceipt;
  lastRevertDate?: string;
}

export interface TenantStatementAllocationResult {
  allocations: TenantDueAllocation[];
  totalRequired: number; // إجمالي المطلوب
  totalCollected: number; // إجمالي المحصل
  totalArrears: number; // إجمالي المتأخرات والرصيد
  comprehensiveReceipts: Array<{
    receiptNumber: string;
    totalAmount: number;
    paymentDate: string;
    paymentMethod: string;
    monthsCovered: string[];
  }>;
  comprehensiveReceiptNumberText: string; // e.g. "إيصال شامل رقم: #REC-2026-001 بمبلغ 68,000 ج.م"
  primaryReceiptNumber: string;
  hasComprehensiveReceipt: boolean;
}

/**
 * SEQUENTIAL MONTHLY ALLOCATION ENGINE
 * Divides lump-sum or multi-month collection receipts sequentially across dues in chronological order.
 * Ensures:
 * 1. collectedAmount for each row reflects ONLY this month's paid rent (<= rentDue).
 * 2. Never duplicates full receipt value (e.g. 68,000) across multiple rows.
 * 3. remainingArrears = Math.max(0, rentDue - collectedAmount).
 * 4. Yields totalRequired, totalCollected, and comprehensiveReceiptNumber details for reporting.
 */
export function calculateTenantMonthlyAllocations(
  dues: ReRentDue[],
  collections: ReCollectionReceipt[],
  todayISO: string = new Date().toISOString().slice(0, 10),
  currentMonthISO: string = new Date().toISOString().slice(0, 7)
): TenantStatementAllocationResult {
  if (!dues || dues.length === 0) {
    return {
      allocations: [],
      totalRequired: 0,
      totalCollected: 0,
      totalArrears: 0,
      comprehensiveReceipts: [],
      comprehensiveReceiptNumberText: 'لا توجد إيصالات',
      primaryReceiptNumber: '',
      hasComprehensiveReceipt: false
    };
  }

  // Sort dues chronologically ascending
  const sortedDues = [...dues].sort((a, b) => 
    (a.forMonthYear || a.dueDate || '').localeCompare(b.forMonthYear || b.dueDate || '')
  );

  const tenantIds = new Set(sortedDues.map(d => d.tenantId).filter(Boolean));
  const tenantNames = new Set(sortedDues.map(d => (d.tenantName || '').trim().toLowerCase()).filter(Boolean));

  // Active (non-reverted, non-cancelled) collections for this tenant/group
  const activeCollections = (collections || []).filter(c => {
    if (!c || c.status === 'reverted' || c.isCancelled || !(c.amountPaid && c.amountPaid > 0)) {
      return false;
    }
    const matchId = c.tenantId && tenantIds.has(c.tenantId);
    const matchName = c.tenantName && tenantNames.has(c.tenantName.trim().toLowerCase());
    const matchesDuesDirectly = sortedDues.some(d => 
      (c.dueId && c.dueId === d.id) ||
      (d.collectionReceiptId && d.collectionReceiptId === c.id) ||
      (d.receiptNumber && c.receiptNumber && d.receiptNumber === c.receiptNumber)
    );
    return matchId || matchName || matchesDuesDirectly;
  });

  // Sort collections chronologically: by paymentDate ascending, then createdAt ascending
  const sortedReceipts = [...activeCollections].sort((a, b) => 
    (a.paymentDate || a.createdAt || '').localeCompare(b.paymentDate || b.createdAt || '')
  );

  // Initialize tracking pools for each receipt
  interface ReceiptPool {
    receipt: ReCollectionReceipt;
    receiptNumber: string;
    totalAmount: number;
    remainingAmount: number;
    allocatedMonths: string[];
  }

  const receiptPools: ReceiptPool[] = sortedReceipts.map(r => ({
    receipt: r,
    receiptNumber: r.receiptNumber || 'بدون رقم',
    totalAmount: Number(r.amountPaid) || 0,
    remainingAmount: Number(r.amountPaid) || 0,
    allocatedMonths: []
  }));

  const dueAllocationsMap = new Map<string, {
    paid: number;
    receiptsUsed: ReceiptPool[];
  }>();

  sortedDues.forEach(d => {
    dueAllocationsMap.set(d.id, { paid: 0, receiptsUsed: [] });
  });

  // Pass 1: Direct 1-to-1 links (when receipt explicitly targets single due and isn't shared)
  receiptPools.forEach(pool => {
    const directDues = sortedDues.filter(d => 
      pool.receipt.dueId === d.id || d.collectionReceiptId === pool.receipt.id
    );
    if (directDues.length === 1 && pool.remainingAmount > 0) {
      const targetDue = directDues[0];
      const rec = dueAllocationsMap.get(targetDue.id)!;
      const needed = Math.max(0, (targetDue.rentAmount || 0) - rec.paid);
      const canTake = Math.min(needed, pool.remainingAmount);
      if (canTake > 0) {
        rec.paid += canTake;
        pool.remainingAmount -= canTake;
        pool.allocatedMonths.push(targetDue.forMonthYear || targetDue.dueDate || '');
        if (!rec.receiptsUsed.includes(pool)) rec.receiptsUsed.push(pool);
      }
    }
  });

  // Pass 2: Shared receipts matching by receiptNumber or collection links across multiple dues
  receiptPools.forEach(pool => {
    if (pool.remainingAmount <= 0) return;
    const matchingDuesByReceiptNo = sortedDues.filter(d => 
      (d.receiptNumber && pool.receiptNumber && d.receiptNumber === pool.receiptNumber) ||
      (d.collectionReceiptId && pool.receipt.id && d.collectionReceiptId === pool.receipt.id) ||
      (pool.receipt.dueId && pool.receipt.dueId === d.id)
    );
    if (matchingDuesByReceiptNo.length > 0) {
      for (const targetDue of matchingDuesByReceiptNo) {
        if (pool.remainingAmount <= 0) break;
        const rec = dueAllocationsMap.get(targetDue.id)!;
        const needed = Math.max(0, (targetDue.rentAmount || 0) - rec.paid);
        if (needed <= 0) continue;
        const canTake = Math.min(needed, pool.remainingAmount);
        if (canTake > 0) {
          rec.paid += canTake;
          pool.remainingAmount -= canTake;
          pool.allocatedMonths.push(targetDue.forMonthYear || targetDue.dueDate || '');
          if (!rec.receiptsUsed.includes(pool)) rec.receiptsUsed.push(pool);
        }
      }
    }
  });

  // Pass 3: Sequential allocation of remaining receipt balances to chronological dues
  receiptPools.forEach(pool => {
    if (pool.remainingAmount <= 0) return;

    // Check if receipt has forMonthYear matching a specific month
    const rMonth = (pool.receipt.forMonthYear || '').trim().slice(0, 7);
    if (rMonth) {
      const sameMonthDue = sortedDues.find(d => (d.forMonthYear || '').slice(0, 7) === rMonth);
      if (sameMonthDue) {
        const rec = dueAllocationsMap.get(sameMonthDue.id)!;
        const needed = Math.max(0, (sameMonthDue.rentAmount || 0) - rec.paid);
        if (needed > 0) {
          const canTake = Math.min(needed, pool.remainingAmount);
          if (canTake > 0) {
            rec.paid += canTake;
            pool.remainingAmount -= canTake;
            pool.allocatedMonths.push(sameMonthDue.forMonthYear || sameMonthDue.dueDate || '');
            if (!rec.receiptsUsed.includes(pool)) rec.receiptsUsed.push(pool);
          }
        }
      }
    }

    // Allocate any remaining receipt balance (e.g. 68,000 lump-sum) across remaining unpaid dues chronologically
    if (pool.remainingAmount > 0) {
      for (const targetDue of sortedDues) {
        if (pool.remainingAmount <= 0) break;
        const rec = dueAllocationsMap.get(targetDue.id)!;
        const needed = Math.max(0, (targetDue.rentAmount || 0) - rec.paid);
        if (needed <= 0) continue;
        const canTake = Math.min(needed, pool.remainingAmount);
        if (canTake > 0) {
          rec.paid += canTake;
          pool.remainingAmount -= canTake;
          pool.allocatedMonths.push(targetDue.forMonthYear || targetDue.dueDate || '');
          if (!rec.receiptsUsed.includes(pool)) rec.receiptsUsed.push(pool);
        }
      }
    }
  });

  // Pass 4: Fallback if due itself has collectedAmount recorded directly on document
  // If an individual due recorded a lump-sum collectedAmount (e.g. 68,000 for 17,000 rent),
  // cap this month to rentAmount and cascade remaining balance to subsequent consecutive dues sequentially.
  sortedDues.forEach((d, idx) => {
    const rec = dueAllocationsMap.get(d.id)!;
    const rent = d.rentAmount || 0;
    if (rec.paid === 0 && (d.status === 'collected' || (d.collectedAmount || 0) > 0)) {
      const docPaid = (d.collectedAmount && d.collectedAmount > 0) ? d.collectedAmount : rent;
      const thisMonthTake = Math.min(rent, docPaid);
      rec.paid = thisMonthTake;
      let excess = docPaid - thisMonthTake;
      if (excess > 0) {
        for (let j = idx + 1; j < sortedDues.length; j++) {
          if (excess <= 0) break;
          const nextDue = sortedDues[j];
          const nextRec = dueAllocationsMap.get(nextDue.id)!;
          const nextNeeded = Math.max(0, (nextDue.rentAmount || 0) - nextRec.paid);
          if (nextNeeded <= 0) continue;
          const take = Math.min(nextNeeded, excess);
          nextRec.paid += take;
          excess -= take;
        }
      }
    }
  });

  const allocations: TenantDueAllocation[] = [];
  let totalRequired = 0;
  let totalCollected = 0;

  sortedDues.forEach(d => {
    const rec = dueAllocationsMap.get(d.id)!;
    const rentDue = d.rentAmount || 0;
    // Rule 1: المبلغ المحصل الخاص بهذا الشهر المالي فقط (بحيث يساوي أو يقل عن الإيجار المطلوب للشهر)
    const collectedAmount = Math.min(rentDue, rec.paid);
    // Rule 3: المتأخرات والرصيد: (الإيجار المطلوب - المبلغ المحصل للشهر)
    const remainingArrears = Math.max(0, rentDue - collectedAmount);

    totalRequired += rentDue;
    totalCollected += collectedAmount;

    const isFullyPaid = rentDue > 0 && collectedAmount >= rentDue;
    const isPartial = collectedAmount > 0 && collectedAmount < rentDue;
    const isUnpaid = collectedAmount === 0;

    const isPrepaidReserve = isFullyPaid && !!(d.forMonthYear && d.forMonthYear > currentMonthISO);

    let status: 'collected' | 'partial' | 'overdue' | 'pending_collection' | 'prepaid';
    let badgeClass = 'badge-pending';
    let badgeText = 'مستحق';
    let badgeCustomStyle = '';

    const revertedCollection = (collections || []).find(c => 
      (c.status === 'reverted' || c.isCancelled) &&
      (c.tenantId === d.tenantId || (c.tenantName && d.tenantName && c.tenantName.trim().toLowerCase() === d.tenantName.trim().toLowerCase())) &&
      ((c.dueId && c.dueId === d.id) || c.forMonthYear === d.forMonthYear || d.lastRevertDate)
    );

    if (isFullyPaid) {
      status = isPrepaidReserve ? 'prepaid' : 'collected';
      badgeClass = 'badge-collected';
      badgeText = isPrepaidReserve ? 'مقدم رصيد' : 'مسدد بالكامل';
    } else if (isPartial) {
      status = 'partial';
      badgeClass = 'badge-pending';
      badgeText = 'مسدد جزئياً';
      badgeCustomStyle = 'background-color: #fef3c7; color: #b45309; border: 1px solid #f59e0b;';
    } else if (revertedCollection || d.lastRevertDate) {
      status = 'overdue';
      badgeClass = 'badge-overdue';
      badgeText = 'مرتجع / ملغى';
    } else {
      const isOverdue = (d.dueDate && d.dueDate <= todayISO) || (d.forMonthYear && d.forMonthYear <= currentMonthISO);
      status = isOverdue ? 'overdue' : 'pending_collection';
      badgeClass = isOverdue ? 'badge-overdue' : 'badge-pending';
      badgeText = isOverdue ? 'متأخر' : 'مستحق';
    }

    const primaryPool = rec.receiptsUsed[0] || null;
    const receiptNumber = primaryPool?.receiptNumber || d.receiptNumber || '';
    const paymentDate = primaryPool?.receipt.paymentDate || d.paidDate || '';
    const paymentMethod = primaryPool?.receipt.paymentMethod || d.paymentMethod || '';

    const isFromComprehensiveReceipt = !!(
      primaryPool && 
      (primaryPool.totalAmount > rentDue || primaryPool.allocatedMonths.length > 1)
    );

    allocations.push({
      due: d,
      forMonthYear: d.forMonthYear || '',
      dueDate: d.dueDate || '',
      monthNameAr: d.monthNameAr || d.forMonthYear || '',
      rentDue,
      collectedAmount,
      remainingArrears,
      receiptNumber,
      paymentDate,
      paymentMethod,
      isFullyPaid,
      isPartial,
      isUnpaid,
      isPrepaidReserve,
      status,
      badgeClass,
      badgeText,
      badgeCustomStyle,
      isFromComprehensiveReceipt,
      comprehensiveReceiptNumber: isFromComprehensiveReceipt ? primaryPool?.receiptNumber : undefined,
      comprehensiveReceiptTotal: isFromComprehensiveReceipt ? primaryPool?.totalAmount : undefined,
      revertedCollection,
      lastRevertDate: d.lastRevertDate
    });
  });

  const totalArrears = Math.max(0, totalRequired - totalCollected);

  const comprehensiveReceipts = receiptPools
    .filter(p => p.allocatedMonths.length > 0 || p.totalAmount > (dues[0]?.rentAmount || 0))
    .map(p => ({
      receiptNumber: p.receiptNumber,
      totalAmount: p.totalAmount,
      paymentDate: p.receipt.paymentDate || '',
      paymentMethod: p.receipt.paymentMethod || '',
      monthsCovered: p.allocatedMonths
    }));

  const hasComprehensiveReceipt = comprehensiveReceipts.some(r => r.monthsCovered.length > 1 || r.totalAmount > (dues[0]?.rentAmount || 0));

  let comprehensiveReceiptNumberText = '';
  if (comprehensiveReceipts.length === 1) {
    const cr = comprehensiveReceipts[0];
    comprehensiveReceiptNumberText = `إيصال شامل #${cr.receiptNumber} (إجمالي: ${cr.totalAmount.toLocaleString('ar-EG')} ج.م)`;
  } else if (comprehensiveReceipts.length > 1) {
    comprehensiveReceiptNumberText = comprehensiveReceipts.map(cr => `#${cr.receiptNumber} (${cr.totalAmount.toLocaleString('ar-EG')} ج.م)`).join(' ، ');
  } else if (allocations.some(a => a.receiptNumber)) {
    const uniqueReceipts = Array.from(new Set(allocations.map(a => a.receiptNumber).filter(Boolean)));
    comprehensiveReceiptNumberText = uniqueReceipts.map(r => `#${r}`).join(' ، ');
  } else {
    comprehensiveReceiptNumberText = 'لا يوجد إيصال مسجل';
  }

  const primaryReceiptNumber = comprehensiveReceipts[0]?.receiptNumber || allocations.find(a => a.receiptNumber)?.receiptNumber || '';

  return {
    allocations,
    totalRequired,
    totalCollected,
    totalArrears,
    comprehensiveReceipts,
    comprehensiveReceiptNumberText,
    primaryReceiptNumber,
    hasComprehensiveReceipt
  };
}

/**
 * CENTRAL SINGLE SOURCE OF TRUTH FOR MONTH COLLECTION STATUS
 * Strictly evaluates month status from saved collection receipts (re_collections).
 * Does not rely on stale document fields or temporary cache.
 * A month is ONLY 'collected' or 'prepaid' if a valid, non-reverted, non-cancelled
 * collection receipt is physically saved in the re_collections dataset with the full required rent.
 */
export function getDueCollectionStatus(
  due: ReRentDue, 
  todayISO: string = new Date().toISOString().slice(0, 10), 
  currentMonthISO: string = new Date().toISOString().slice(0, 7),
  collections?: ReCollectionReceipt[]
): 'collected' | 'overdue' | 'pending_collection' | 'prepaid' | 'partial' {
  if (!due) return 'pending_collection';

  const details = getDueCollectionDetails(due, todayISO, currentMonthISO, collections);
  return details.status;
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
    const matchedAdj = getApplicableRentAdjustment(rentAdjustments, d.tenantId, d.tenantName, d.forMonthYear);
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
    if (d.isAdjusted && d.adjustedRentAmount !== undefined) {
      return {
        ...d,
        rentAmount: d.adjustedRentAmount,
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
      const details = getDueCollectionDetails(d, todayISO, currentMonthISO, collections);
      const collected = details.totalPaid;

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
  monthlyEntitlements: MonthlyEntitlementRow[];
}

export interface MonthlyEntitlementRow {
  monthKey: string;           // e.g. '2025-05'
  monthNameAr: string;        // e.g. 'مايو 2025'
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  tenantCount: number;
  paidOutCount: number;
  rentSum: number;            // إجمالي إيجار الشهر
  collectedSum: number;       // المحصل من المستأجرين
  commissionSum: number;      // عمولة المكتب
  totalDeductionsSum: number; // السلف والمصروفات المخصومة
  netOwnerSum: number;        // قيمة الاستحقاق (صافي مستحق المالك)
  disbursedSum: number;       // المصروف للمالك
  remainingBalance: number;   // الرصيد المتبقي
  payoutStatus: 'paid_out' | 'partial' | 'pending';
  dues: ReRentDue[];
  allAdvances: ReOwnerAdvance[];
  allExpenses: RePropertyExpense[];
  advancesDeducted: ReOwnerAdvance[];
  expensesDeducted: RePropertyExpense[];
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
    const matchedAdj = getApplicableRentAdjustment(rentAdjustments, d.tenantId, d.tenantName, d.forMonthYear);
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
    if (d.isAdjusted && d.adjustedRentAmount !== undefined) {
      return {
        ...d,
        rentAmount: d.adjustedRentAmount,
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
        const details = getDueCollectionDetails(d, todayISO, currentMonthISO, collections);
        const pStat = getDuePayoutStatus(d);
        const dueComm = mRent > 0 ? Math.round(((d.rentAmount || 0) / mRent) * secComm.earnedCommission) : 0;
        const dueNet = Math.max(0, (d.rentAmount || 0) - dueComm);

        mColl += details.totalPaid;
        if (pStat === 'paid_out') mDisb += dueNet;
      });

      // Synchronize with direct payouts registered for this specific property & month
      const activeMonthPayouts = (allOwnerPayouts || []).filter(p => {
        if (!p || p.status === 'reverted' || p.isCancelled) return false;
        const matchProp = p.propertyId === group.propertyId;
        const pMonth = p.forMonthYear || (p.payoutDate ? p.payoutDate.slice(0, 7) : '');
        return matchProp && pMonth === mKey;
      });
      const sumDirectPayouts = activeMonthPayouts.reduce((sum, p) => sum + (p.netAmountPaid || 0), 0);
      if (sumDirectPayouts > mDisb) {
        mDisb = sumDirectPayouts;
      }

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

  // 5. Construct flat monthly entitlements list across properties & owners
  const monthlyEntitlements: MonthlyEntitlementRow[] = [];
  ownerPropertyGroups.forEach(group => {
    group.months.forEach(m => {
      let payoutStatus: 'paid_out' | 'partial' | 'pending' = 'pending';
      const allDuesPaidOut = m.dues.length > 0 && m.dues.every(d => getDuePayoutStatus(d) === 'paid_out');
      if (allDuesPaidOut || (m.remainingBalance <= 0 && m.disbursedSum > 0) || (m.paidOutCount === m.tenantCount && m.tenantCount > 0)) {
        payoutStatus = 'paid_out';
      } else if (m.disbursedSum > 0 && m.remainingBalance > 0) {
        payoutStatus = 'partial';
      }

      monthlyEntitlements.push({
        monthKey: m.forMonthYear,
        monthNameAr: m.monthNameAr || formatMonthYearAr(m.forMonthYear),
        propertyId: group.propertyId,
        propertyName: group.propertyName,
        ownerId: group.ownerId,
        ownerName: group.ownerName,
        tenantCount: m.tenantCount,
        paidOutCount: m.paidOutCount,
        rentSum: m.rentSum,
        collectedSum: m.collectedSum,
        commissionSum: m.commissionSum,
        totalDeductionsSum: m.totalDeductionsSum,
        netOwnerSum: m.netOwnerSum,
        disbursedSum: m.disbursedSum,
        remainingBalance: m.remainingBalance,
        payoutStatus,
        dues: m.dues,
        allAdvances: m.allAdvances || [],
        allExpenses: m.allExpenses || [],
        advancesDeducted: m.advancesDeducted || [],
        expensesDeducted: m.expensesDeducted || [],
      });
    });
  });

  // Sort monthly entitlements by month descending (most recent first), then property
  monthlyEntitlements.sort((a, b) => {
    const monthCmp = b.monthKey.localeCompare(a.monthKey);
    if (monthCmp !== 0) return monthCmp;
    return a.propertyName.localeCompare(b.propertyName);
  });

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
    monthlyEntitlements,
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
