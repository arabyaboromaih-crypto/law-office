import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReRealEstateLog, ReRentDue, ReCommissionStatus, ReOwnerAdvance 
} from '../../types';

/**
 * CENTRAL SINGLE SOURCE OF TRUTH FOR MONTH COLLECTION STATUS (جدول الإيجارات والتحصيل)
 * Strictly evaluates month status from the re_dues document alone.
 */
export function getDueCollectionStatus(
  due: ReRentDue, 
  todayISO: string = new Date().toISOString().slice(0, 10), 
  currentMonthISO: string = new Date().toISOString().slice(0, 7),
  collections?: ReCollectionReceipt[]
): 'collected' | 'overdue' | 'pending_collection' | 'prepaid' {
  if (!due) return 'pending_collection';

  // Check if there is a matching active collection receipt in re_collections
  if (collections && collections.length > 0) {
    const hasActiveReceipt = collections.some(c => 
      c && 
      c.status !== 'reverted' && 
      !c.isCancelled && 
      (c.amountPaid || 0) > 0 &&
      ((c.dueId && c.dueId === due.id) || 
       (c.tenantId && c.tenantId === due.tenantId && c.forMonthYear === due.forMonthYear))
    );
    if (hasActiveReceipt) {
      if (due.forMonthYear && due.forMonthYear > currentMonthISO) {
        return 'prepaid';
      }
      return 'collected';
    }
  }

  const isPrepaidFlag = due.collectionStatus === 'prepaid' || due.isPrepaid === true;
  if (isPrepaidFlag) {
    if (due.forMonthYear && due.forMonthYear <= currentMonthISO) {
      return 'collected';
    }
    return 'prepaid';
  }

  const isCollected = 
    due.collectionStatus === 'collected' || 
    due.status === 'collected' || 
    ((due.collectedAmount || 0) > 0 && (due.collectedAmount || 0) >= (due.rentAmount || 0)) ||
    !!due.receiptNumber ||
    !!due.paidDate;

  if (isCollected) {
    if (due.forMonthYear && due.forMonthYear > currentMonthISO) {
      return 'prepaid';
    }
    return 'collected';
  }

  if ((due.dueDate && due.dueDate < todayISO) || (due.forMonthYear && due.forMonthYear < currentMonthISO)) {
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

// Default initial data for testing/seeding
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
