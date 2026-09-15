import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, User, Building, Calendar, Coins, CheckCircle2, 
  CreditCard, DollarSign, X, Save, Loader2, Sparkles, 
  AlertCircle, ShieldCheck, Check, Clock, RefreshCw, FileText,
  Plus, Trash2, CalendarPlus, CalendarCheck2, ArrowRight,
  Edit3, Info, RotateCcw, Pencil, History, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { 
  ReRentDue, ReTenant, ReUnit, ReProperty, ReOwner, 
  ReCollectionReceipt, User as AuthUser, ReRentAdjustment
} from '../../types';
import { 
  getDueCollectionStatus, 
  getMatchingCollectionReceipts,
  getPropertyCommissionSettings,
  calculateCommissionFromSettings,
  getApplicableRentAdjustment
} from './RealEstateData';
import { generateCollectionReceiptVoucherHTML, printReceiptDirectly } from './TenantCollectionReceiptsModal';
import { saveRentAdjustmentDoc, deleteFirestoreDoc, updateFirestoreDoc } from '../../services/dbSync';
import { ArrearsPaymentSection } from './ArrearsPaymentSection';
import { PrepaymentSection } from './PrepaymentSection';

export function formatMonthYearAr(monthKey?: string): string {
  if (!monthKey || typeof monthKey !== 'string') return '';
  const [year, month] = monthKey.split('-');
  const monthMap: Record<string, string> = {
    '01': 'يناير',
    '02': 'فبراير',
    '03': 'مارس',
    '04': 'أبريل',
    '05': 'مايو',
    '06': 'يونيو',
    '07': 'يوليو',
    '08': 'أغسطس',
    '09': 'سبتمبر',
    '10': 'أكتوبر',
    '11': 'نوفمبر',
    '12': 'ديسمبر'
  };
  return month && monthMap[month] ? `${monthMap[month]} ${year}` : monthKey;
}

interface AddCollectionReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDues: ReRentDue[];
  allDues: ReRentDue[];
  tenants: ReTenant[];
  units: ReUnit[];
  properties: ReProperty[];
  owners?: ReOwner[];
  collections: ReCollectionReceipt[];
  currentUser?: AuthUser;
  rentAdjustments?: ReRentAdjustment[];
  initialPaymentTab?: 'arrears' | 'prepayment';
  onSaveReceipt: (params: {
    duesToProcess: ReRentDue[];
    collectForm: {
      paidDate: string;
      collectedAmount: number;
      paymentMethod: string;
      receiptNumber: string;
      notes: string;
    };
  }) => Promise<void>;
  onSaveRentAdjustment?: (adjustment: ReRentAdjustment, updatedDue: ReRentDue) => Promise<void>;
  onDeleteRentAdjustment?: (adjustmentId: string, resetDue: ReRentDue) => Promise<void>;
}

export default function AddCollectionReceiptModal({
  isOpen,
  onClose,
  initialDues,
  allDues,
  tenants,
  units,
  properties,
  owners,
  collections,
  currentUser,
  rentAdjustments = [],
  initialPaymentTab,
  onSaveReceipt,
  onSaveRentAdjustment,
  onDeleteRentAdjustment
}: AddCollectionReceiptModalProps) {
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthISO = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Primary initial due to derive tenant / unit / property
  const primaryInitialDue = initialDues[0] || null;

  // Active Payment Section Tab: 'arrears' vs 'prepayment'
  const [paymentTypeTab, setPaymentTypeTab] = useState<'arrears' | 'prepayment'>('arrears');
  const [arrearsSelectedIds, setArrearsSelectedIds] = useState<string[]>([]);
  const [prepaidSelectedIds, setPrepaidSelectedIds] = useState<string[]>([]);

  // Selected Dues State derived dynamically based on the active tab
  const selectedDueIds = useMemo(() => {
    return paymentTypeTab === 'arrears' ? arrearsSelectedIds : prepaidSelectedIds;
  }, [paymentTypeTab, arrearsSelectedIds, prepaidSelectedIds]);

  // Unified setter for selected IDs targeting the active tab
  const setSelectedDueIds = useCallback((action: string[] | ((prev: string[]) => string[])) => {
    if (paymentTypeTab === 'arrears') {
      setArrearsSelectedIds(action);
    } else {
      setPrepaidSelectedIds(action);
    }
  }, [paymentTypeTab]);

  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single');

  // Form State
  const [paidDate, setPaidDate] = useState<string>(todayISO);
  const [paymentMethod, setPaymentMethod] = useState<string>('نقداً');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [collectedAmount, setCollectedAmount] = useState<number | string>(0);
  const [notes, setNotes] = useState<string>('');

  // UI Feedback State
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [submittingAction, setSubmittingAction] = useState<'collect' | 'save_receipt' | null>(null);
  const isSubmittingRef = React.useRef(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PREPAYMENT SECTION STATE
  const [addedPrepaidDues, setAddedPrepaidDues] = useState<ReRentDue[]>([]);
  const [prepaySelectedMonth, setPrepaySelectedMonth] = useState<string>('');
  const [prepayRentAmount, setPrepayRentAmount] = useState<number | string>('');
  const [prepayInlineError, setPrepayInlineError] = useState<string | null>(null);
  const [prepayInlineSuccess, setPrepayInlineSuccess] = useState<string | null>(null);

  // INDEPENDENT MONTHLY RENT EDITING STATE
  const [editingMonthDue, setEditingMonthDue] = useState<ReRentDue | null>(null);
  const [editRentAmountInput, setEditRentAmountInput] = useState<number | string>('');
  const [editRentNotesInput, setEditRentNotesInput] = useState<string>('');
  const [isSavingEditRent, setIsSavingEditRent] = useState<boolean>(false);

  // Local adjustments map for current modal lifecycle
  const [localAdjustments, setLocalAdjustments] = useState<Record<string, { amount: number; notes?: string; originalAmount?: number }>>({});

  // Reset local adjustments on modal open
  useEffect(() => {
    if (isOpen) {
      setLocalAdjustments({});
      setEditingMonthDue(null);
    }
  }, [isOpen]);

  // Find matching tenant, unit, property, and owner
  const currentTenant = useMemo(() => {
    if (!primaryInitialDue) return null;
    return tenants.find(t => 
      t.id === primaryInitialDue.tenantId || 
      (t.fullName && t.fullName.trim() === (primaryInitialDue.tenantName || '').trim())
    ) || null;
  }, [primaryInitialDue, tenants]);

  const currentUnit = useMemo(() => {
    if (!primaryInitialDue) return null;
    return units.find(u => 
      u.id === primaryInitialDue.unitId || 
      (u.unitNumber && u.unitNumber === primaryInitialDue.unitNumber)
    ) || null;
  }, [primaryInitialDue, units]);

  const currentProperty = useMemo(() => {
    if (!primaryInitialDue) return null;
    return properties.find(p => 
      p.id === primaryInitialDue.propertyId || 
      (currentUnit && p.id === currentUnit.propertyId)
    ) || null;
  }, [primaryInitialDue, properties, currentUnit]);

  const currentOwner = useMemo(() => {
    if (!primaryInitialDue) return null;
    return (owners || []).find(o => 
      o.id === primaryInitialDue.ownerId || 
      (currentProperty && o.id === currentProperty.ownerId) || 
      (currentTenant && o.id === currentTenant.ownerId)
    ) || null;
  }, [primaryInitialDue, owners, currentProperty, currentTenant]);

  // Actual monthly rent based on contractual records
  const actualRentAmount = useMemo(() => {
    return currentTenant?.rentAmount || currentUnit?.rentValue || primaryInitialDue?.rentAmount || 0;
  }, [currentTenant, currentUnit, primaryInitialDue]);

  // Available dues for THIS tenant across all months, combined with added prepaid dues
  const availableTenantDues = useMemo(() => {
    if (!primaryInitialDue) return [];
    const tenantId = primaryInitialDue.tenantId;
    const tenantName = primaryInitialDue.tenantName;

    // Filter dues for this tenant
    const duesForTenant = allDues.filter(d => {
      const matchTId = tenantId && d.tenantId === tenantId;
      const matchTName = tenantName && d.tenantName && d.tenantName.trim() === tenantName.trim();
      return matchTId || matchTName;
    });

    // Merge with any dynamically added prepaid dues
    const allCombined = [...duesForTenant, ...addedPrepaidDues];

    // Deduplicate by forMonthYear
    const uniqueMap = new Map<string, ReRentDue>();
    allCombined.forEach(d => {
      const key = d.forMonthYear || d.id;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, d);
      }
    });

    // Map and apply rent adjustments strictly per tenant & month
    return Array.from(uniqueMap.values()).map(d => {
      const monthKey = d.forMonthYear || '';
      const localAdj = localAdjustments[monthKey];
      const matchedAdj = getApplicableRentAdjustment(rentAdjustments, d.tenantId, d.tenantName, d.forMonthYear);

      const originalRent = d.originalRentAmount ?? matchedAdj?.originalRentAmount ?? actualRentAmount ?? d.rentAmount;
      const effectiveRent = localAdj !== undefined
        ? localAdj.amount
        : (matchedAdj?.adjustedRentAmount ?? d.adjustedRentAmount ?? d.rentAmount);

      const isAdjusted = localAdj !== undefined || !!matchedAdj || !!d.isAdjusted;
      const commAmt = matchedAdj?.commissionAmount ?? d.commissionAmount;
      const netOwner = matchedAdj?.netOwnerAmount ?? (effectiveRent !== undefined && commAmt !== undefined ? Math.max(0, effectiveRent - commAmt) : d.netOwnerAmount);

      return {
        ...d,
        originalRentAmount: originalRent,
        rentAmount: effectiveRent,
        isAdjusted,
        adjustedRentAmount: effectiveRent,
        commissionAmount: commAmt,
        netOwnerAmount: netOwner
      };
    }).sort((a, b) => 
      (a.forMonthYear || '').localeCompare(b.forMonthYear || '')
    );
  }, [primaryInitialDue, allDues, addedPrepaidDues, localAdjustments, rentAdjustments, actualRentAmount]);

  // Active selected dues objects
  const selectedDues = useMemo(() => {
    return availableTenantDues.filter(d => selectedDueIds.includes(d.id));
  }, [availableTenantDues, selectedDueIds]);

  // Breakdown of selected dues into already paid (with existing receipt) vs payable
  const { alreadyPaidDues, payableDues } = useMemo(() => {
    const paid: Array<{ due: ReRentDue; receipt: ReCollectionReceipt }> = [];
    const payable: ReRentDue[] = [];

    selectedDues.forEach(due => {
      const matchingReceipts = getMatchingCollectionReceipts(due, collections);
      if (matchingReceipts.length > 0) {
        paid.push({ due, receipt: matchingReceipts[0] });
      } else {
        payable.push(due);
      }
    });

    return { alreadyPaidDues: paid, payableDues: payable };
  }, [selectedDues, collections]);

  const hasAlreadyPaidSelected = alreadyPaidDues.length > 0;

  // Dues filtered specifically for the Arrears tab (Past and current months)
  const arrearsDues = useMemo(() => {
    return availableTenantDues.filter(d => !d.forMonthYear || d.forMonthYear <= currentMonthISO);
  }, [availableTenantDues, currentMonthISO]);

  // Existing Future dues in system (for Prepayment tab, excluding dynamically added ones in this session)
  const futureTenantDues = useMemo(() => {
    return availableTenantDues.filter(d => 
      d.forMonthYear && 
      d.forMonthYear > currentMonthISO &&
      !addedPrepaidDues.some(ad => ad.id === d.id || ad.forMonthYear === d.forMonthYear)
    );
  }, [availableTenantDues, currentMonthISO, addedPrepaidDues]);

  // Uncollected arrears statistics for tab indicator badges
  const pastArrearsDues = useMemo(() => {
    return availableTenantDues.filter(d => (d.forMonthYear || '') < currentMonthISO);
  }, [availableTenantDues, currentMonthISO]);

  const uncollectedArrearsDues = useMemo(() => {
    return pastArrearsDues.filter(d => 
      getDueCollectionStatus(d, todayISO, currentMonthISO, collections) !== 'collected' && 
      getMatchingCollectionReceipts(d, collections).length === 0
    );
  }, [pastArrearsDues, todayISO, currentMonthISO, collections]);

  const uncollectedArrearsCount = uncollectedArrearsDues.length;
  const totalUncollectedArrearsAmount = useMemo(() => {
    return uncollectedArrearsDues.reduce((s, d) => s + (d.rentAmount || 0), 0);
  }, [uncollectedArrearsDues]);

  // Calculate Required Rent Sum only for payable dues
  const totalRequiredRent = useMemo(() => {
    return payableDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
  }, [payableDues]);

  // Remaining calculation
  const numericCollected = Number(collectedAmount) || 0;
  const remainingAmount = totalRequiredRent - numericCollected;

  // Tab switching handler
  const handleSwitchPaymentTab = (newTab: 'arrears' | 'prepayment') => {
    if (newTab === paymentTypeTab) return;
    setPaymentTypeTab(newTab);
    setErrorMessage(null);

    if (newTab === 'arrears') {
      let currentArrIds = arrearsSelectedIds;
      if (currentArrIds.length === 0) {
        const uncollectedPast = arrearsDues.filter(d => 
          getMatchingCollectionReceipts(d, collections).length === 0
        );
        if (uncollectedPast.length > 0) {
          currentArrIds = [uncollectedPast[0].id];
          setArrearsSelectedIds(currentArrIds);
        }
      }
      const payable = availableTenantDues.filter(d => 
        currentArrIds.includes(d.id) && 
        getMatchingCollectionReceipts(d, collections).length === 0
      );
      const sum = payable.reduce((s, d) => s + (d.rentAmount || 0), 0);
      setCollectedAmount(sum);
    } else {
      // Prepayment
      let currentPrepIds = prepaidSelectedIds;
      if (currentPrepIds.length === 0 && addedPrepaidDues.length > 0) {
        currentPrepIds = addedPrepaidDues.map(d => d.id);
        setPrepaidSelectedIds(currentPrepIds);
      }
      const payable = availableTenantDues.filter(d => 
        currentPrepIds.includes(d.id) && 
        getMatchingCollectionReceipts(d, collections).length === 0
      );
      const sum = payable.reduce((s, d) => s + (d.rentAmount || 0), 0);
      setCollectedAmount(sum);
    }
  };

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen && initialDues && initialDues.length > 0) {
      const arrearsInitial = initialDues.filter(d => !d.forMonthYear || d.forMonthYear <= currentMonthISO);
      const prepaidInitial = initialDues.filter(d => d.forMonthYear && d.forMonthYear > currentMonthISO);

      const arrIds = arrearsInitial.map(d => d.id);
      const prepIds = prepaidInitial.map(d => d.id);

      setArrearsSelectedIds(arrIds);
      setPrepaidSelectedIds(prepIds);

      // Determine initial tab: honor initialPaymentTab if specified, else detect from initial dues
      let activeTab: 'arrears' | 'prepayment' = 'arrears';
      if (initialPaymentTab) {
        activeTab = initialPaymentTab;
      } else if (prepaidInitial.length > 0 && arrearsInitial.length === 0) {
        activeTab = 'prepayment';
      }
      setPaymentTypeTab(activeTab);

      // If opening in arrears and no past dues pre-selected, auto-select first uncollected due if available
      let finalArrIds = arrIds;
      if (activeTab === 'arrears' && finalArrIds.length === 0) {
        const uncollectedPast = allDues.filter(d => {
          const matchTId = primaryInitialDue?.tenantId && d.tenantId === primaryInitialDue.tenantId;
          const matchTName = primaryInitialDue?.tenantName && d.tenantName && d.tenantName.trim() === primaryInitialDue.tenantName.trim();
          const isPastOrCurrent = !d.forMonthYear || d.forMonthYear <= currentMonthISO;
          const isUncollected = getMatchingCollectionReceipts(d, collections).length === 0;
          return (matchTId || matchTName) && isPastOrCurrent && isUncollected;
        });
        if (uncollectedPast.length > 0) {
          finalArrIds = [uncollectedPast[0].id];
          setArrearsSelectedIds(finalArrIds);
        }
      }

      const activeInitial = activeTab === 'prepayment'
        ? prepaidInitial
        : (finalArrIds.length > 0 
            ? availableTenantDues.filter(d => finalArrIds.includes(d.id))
            : initialDues);

      const activeIds = activeTab === 'prepayment' ? prepIds : finalArrIds;
      setSelectionMode(activeIds.length > 1 ? 'multi' : 'single');

      const autoReceiptNo = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setReceiptNumber(autoReceiptNo);
      setPaidDate(todayISO);
      setPaymentMethod('نقداً');
      setNotes('');
      setErrorMessage(null);
      setSuccessToast(null);
      setPrepayInlineError(null);
      setPrepayInlineSuccess(null);
      setAddedPrepaidDues([]);

      // Default amount with adjustments applied
      const totalDue = activeInitial.reduce((sum, d) => {
        const matchedAdj = getApplicableRentAdjustment(rentAdjustments, d.tenantId, d.tenantName, d.forMonthYear);
        const eff = matchedAdj?.adjustedRentAmount ?? d.adjustedRentAmount ?? d.rentAmount ?? 0;
        return sum + eff;
      }, 0);
      setCollectedAmount(totalDue);
    }
  }, [isOpen, initialDues, todayISO, currentMonthISO, rentAdjustments, initialPaymentTab]);

  // Initialize prepayment rent and default future month
  useEffect(() => {
    if (actualRentAmount > 0) {
      setPrepayRentAmount(actualRentAmount);
    }
  }, [actualRentAmount]);

  useEffect(() => {
    if (isOpen) {
      // Find the furthest month currently in available dues to suggest the immediate next month
      const existingMonths = availableTenantDues.map(d => d.forMonthYear).filter(Boolean);
      const latestMonth = existingMonths.length > 0 
        ? [...existingMonths].sort().pop()! 
        : currentMonthISO;

      const baseMonth = latestMonth && latestMonth > currentMonthISO ? latestMonth : currentMonthISO;
      const [y, m] = baseMonth.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      setPrepaySelectedMonth(nextMonthKey);
    }
  }, [isOpen, availableTenantDues, currentMonthISO]);

  // Update collectedAmount automatically when user toggles dues
  const handleToggleDue = (due: ReRentDue) => {
    if (paymentTypeTab === 'arrears') {
      if (selectionMode === 'single') {
        setArrearsSelectedIds([due.id]);
        const matching = getMatchingCollectionReceipts(due, collections);
        setCollectedAmount(matching.length > 0 ? 0 : (due.rentAmount || 0));
      } else {
        let nextIds: string[];
        if (arrearsSelectedIds.includes(due.id)) {
          nextIds = arrearsSelectedIds.filter(id => id !== due.id);
        } else {
          nextIds = [...arrearsSelectedIds, due.id];
        }
        setArrearsSelectedIds(nextIds);
        const nextTotal = availableTenantDues
          .filter(d => nextIds.includes(d.id) && getMatchingCollectionReceipts(d, collections).length === 0)
          .reduce((sum, d) => sum + (d.rentAmount || 0), 0);
        setCollectedAmount(nextTotal);
      }
    } else {
      // Prepayment
      if (selectionMode === 'single') {
        setPrepaidSelectedIds([due.id]);
        const matching = getMatchingCollectionReceipts(due, collections);
        setCollectedAmount(matching.length > 0 ? 0 : (due.rentAmount || 0));
      } else {
        let nextIds: string[];
        if (prepaidSelectedIds.includes(due.id)) {
          nextIds = prepaidSelectedIds.filter(id => id !== due.id);
        } else {
          nextIds = [...prepaidSelectedIds, due.id];
        }
        setPrepaidSelectedIds(nextIds);
        const nextTotal = availableTenantDues
          .filter(d => nextIds.includes(d.id) && getMatchingCollectionReceipts(d, collections).length === 0)
          .reduce((sum, d) => sum + (d.rentAmount || 0), 0);
        setCollectedAmount(nextTotal);
      }
    }
  };

  // Switch Mode handler
  const handleSwitchMode = (mode: 'single' | 'multi') => {
    setSelectionMode(mode);
    if (mode === 'single') {
      if (paymentTypeTab === 'arrears') {
        if (arrearsSelectedIds.length > 1) {
          const firstId = arrearsSelectedIds[0];
          setArrearsSelectedIds([firstId]);
          const d = availableTenantDues.find(item => item.id === firstId);
          if (d) {
            const matching = getMatchingCollectionReceipts(d, collections);
            setCollectedAmount(matching.length > 0 ? 0 : (d.rentAmount || 0));
          }
        }
      } else {
        if (prepaidSelectedIds.length > 1) {
          const firstId = prepaidSelectedIds[0];
          setPrepaidSelectedIds([firstId]);
          const d = availableTenantDues.find(item => item.id === firstId);
          if (d) {
            const matching = getMatchingCollectionReceipts(d, collections);
            setCollectedAmount(matching.length > 0 ? 0 : (d.rentAmount || 0));
          }
        }
      }
    }
  };

  // Handle Quick Fill full amount
  const handleFillFullAmount = () => {
    setCollectedAmount(totalRequiredRent);
  };

  // Open Month Rent Edit Dialog
  const handleOpenEditRent = (due: ReRentDue) => {
    setEditingMonthDue(due);
    setEditRentAmountInput(due.rentAmount !== undefined ? due.rentAmount : (actualRentAmount || 0));
    const matchedAdj = getApplicableRentAdjustment(rentAdjustments, due.tenantId, due.tenantName, due.forMonthYear);
    setEditRentNotesInput(matchedAdj?.notes || localAdjustments[due.forMonthYear || '']?.notes || '');
  };

  // Save Month Rent Adjustment permanently in Firestore and local state
  // Rule: New contractual rent applies starting from the selected month and forward (>= forMonthYear)
  // It NEVER modifies any past month (< forMonthYear) or any collected receipts!
  const handleSaveMonthRent = async () => {
    if (!editingMonthDue) return;
    const newAmount = Number(editRentAmountInput);
    if (isNaN(newAmount) || newAmount < 0) {
      alert('يرجى إدخال قيمة إيجار صحيحة أكبر من أو تساوي الصفر.');
      return;
    }

    setIsSavingEditRent(true);
    try {
      const targetTenantId = editingMonthDue.tenantId || currentTenant?.id || '';
      const targetMonthYear = editingMonthDue.forMonthYear;
      const nowISO = new Date().toISOString();

      // Commission calculations
      const commSettings = getPropertyCommissionSettings(currentProperty, currentOwner, allDues);
      let commAmt = 0;
      if (commSettings.commissionType === 'percentage') {
        commAmt = Math.round((newAmount * (commSettings.commissionValue || 0)) / 100);
      } else if (commSettings.commissionType === 'fixed_per_thousand') {
        commAmt = Math.floor(newAmount / 1000) * (commSettings.commissionValue || 0);
      } else if (commSettings.commissionType === 'fixed_flat') {
        commAmt = commSettings.commissionValue || 0;
      }
      const netOwner = Math.max(0, newAmount - commAmt);
      const origRent = editingMonthDue.originalRentAmount || actualRentAmount || editingMonthDue.rentAmount;

      // 1. Persistent adjustment record via saveRentAdjustmentDoc
      const adjDocId = `adj_${targetTenantId}_${targetMonthYear}`;
      const adjustmentRecord: ReRentAdjustment = {
        id: adjDocId,
        tenantId: targetTenantId,
        tenantName: editingMonthDue.tenantName || currentTenant?.fullName || '',
        unitId: editingMonthDue.unitId || currentUnit?.id || '',
        propertyId: editingMonthDue.propertyId || currentProperty?.id || '',
        forMonthYear: targetMonthYear,
        adjustedRentAmount: newAmount,
        originalRentAmount: origRent,
        commissionType: commSettings.commissionType,
        commissionValue: commSettings.commissionValue,
        commissionAmount: commAmt,
        netOwnerAmount: netOwner,
        notes: editRentNotesInput.trim() || `تعديل القيمة الإيجارية التعاقدية ابتداءً من شهر ${editingMonthDue.monthNameAr || formatMonthYearAr(targetMonthYear)} وما بعده`,
        updatedAt: nowISO
      };
      await saveRentAdjustmentDoc(adjustmentRecord);

      // 2. Persistent update in re_dues for the selected month
      const matchedExistingDue = allDues.find(d => 
        (editingMonthDue.id && d.id === editingMonthDue.id) || 
        (d.tenantId === targetTenantId && d.forMonthYear === targetMonthYear)
      );
      const dueDocId = editingMonthDue.id || matchedExistingDue?.id || `due-${targetTenantId}-${targetMonthYear}`;
      const dueDataToSave: ReRentDue = {
        ...editingMonthDue,
        id: dueDocId,
        rentAmount: newAmount,
        isAdjusted: true,
        adjustedRentAmount: newAmount,
        originalRentAmount: origRent,
        commissionType: commSettings.commissionType,
        commissionValue: commSettings.commissionValue,
        commissionAmount: commAmt,
        netOwnerAmount: netOwner,
        updatedAt: nowISO
      };
      await updateFirestoreDoc('re_dues', dueDocId, dueDataToSave);

      // 3. Persistent update for all forward uncollected dues (forMonthYear > targetMonthYear)
      // Never touches any prior month (< targetMonthYear) and never touches collected dues!
      const forwardUncollectedDues = allDues.filter(d => {
        const matchTId = targetTenantId && d.tenantId === targetTenantId;
        const matchTName = editingMonthDue.tenantName && d.tenantName && d.tenantName.trim().toLowerCase() === editingMonthDue.tenantName.trim().toLowerCase();
        const isMatch = matchTId || matchTName;
        return isMatch && d.forMonthYear && d.forMonthYear > targetMonthYear && d.status !== 'collected';
      });

      for (const fDue of forwardUncollectedDues) {
        if (fDue.id && fDue.id !== dueDocId) {
          await updateFirestoreDoc('re_dues', fDue.id, {
            rentAmount: newAmount,
            isAdjusted: true,
            adjustedRentAmount: newAmount,
            originalRentAmount: fDue.originalRentAmount || origRent,
            commissionType: commSettings.commissionType,
            commissionValue: commSettings.commissionValue,
            commissionAmount: commAmt,
            netOwnerAmount: netOwner,
            updatedAt: nowISO
          });
        }
      }

      // 4. Update tenant contractual rent amount in re_tenants
      if (targetTenantId) {
        await updateFirestoreDoc('re_tenants', targetTenantId, {
          rentAmount: newAmount,
          lastRentAdjustmentMonth: targetMonthYear,
          updatedAt: nowISO
        });
      }

      // 5. Update local session state for this month and forward months
      setLocalAdjustments(prev => {
        const next = { ...prev };
        next[targetMonthYear] = {
          amount: newAmount,
          notes: editRentNotesInput.trim(),
          originalAmount: origRent
        };
        availableTenantDues.forEach(d => {
          if (d.forMonthYear && d.forMonthYear > targetMonthYear && d.status !== 'collected') {
            next[d.forMonthYear] = {
              amount: newAmount,
              notes: editRentNotesInput.trim(),
              originalAmount: d.originalRentAmount || origRent
            };
          }
        });
        return next;
      });

      // 6. Update parent state
      if (onSaveRentAdjustment) {
        await onSaveRentAdjustment(adjustmentRecord, dueDataToSave);
      }

      // 7. Update collectedAmount automatically
      if (selectionMode === 'single') {
        setCollectedAmount(newAmount);
      } else {
        const oldRent = editingMonthDue.rentAmount || 0;
        const diff = newAmount - oldRent;
        if (Number(collectedAmount) === totalRequiredRent) {
          setCollectedAmount(totalRequiredRent + diff);
        }
      }

      setSuccessToast(`تم حفظ وتطبيق القيمة الإيجارية الجديدة بنجاح ابتداءً من شهر (${editingMonthDue.monthNameAr || formatMonthYearAr(targetMonthYear)}) وما بعده بمبلغ ${newAmount.toLocaleString('ar-EG')} ج.م`);
      setEditingMonthDue(null);
    } catch (err: any) {
      console.error('Error saving rent adjustment:', err);
      alert('حدث خطأ أثناء حفظ تعديل الإيجار في قاعدة البيانات.');
    } finally {
      setIsSavingEditRent(false);
    }
  };

  // Restore original rent amount
  const handleRestoreOriginalRent = async () => {
    if (!editingMonthDue) return;
    const targetTenantId = editingMonthDue.tenantId || currentTenant?.id || '';
    const targetMonthYear = editingMonthDue.forMonthYear;
    const origRent = editingMonthDue.originalRentAmount || actualRentAmount || editingMonthDue.rentAmount;

    setIsSavingEditRent(true);
    try {
      const nowISO = new Date().toISOString();
      const adjDocId = `adj_${targetTenantId}_${targetMonthYear}`;
      await deleteFirestoreDoc('re_rent_adjustments', adjDocId);

      const commSettings = getPropertyCommissionSettings(currentProperty, currentOwner, allDues);
      let commAmt = 0;
      if (commSettings.commissionType === 'percentage') {
        commAmt = Math.round((origRent * (commSettings.commissionValue || 0)) / 100);
      } else if (commSettings.commissionType === 'fixed_per_thousand') {
        commAmt = Math.floor(origRent / 1000) * (commSettings.commissionValue || 0);
      } else if (commSettings.commissionType === 'fixed_flat') {
        commAmt = commSettings.commissionValue || 0;
      }
      const netOwner = Math.max(0, origRent - commAmt);

      const matchedExistingDue = allDues.find(d => 
        (editingMonthDue.id && d.id === editingMonthDue.id) || 
        (d.tenantId === targetTenantId && d.forMonthYear === targetMonthYear)
      );
      const dueDocId = editingMonthDue.id || matchedExistingDue?.id || `due-${targetTenantId}-${targetMonthYear}`;
      const dueDataToSave: ReRentDue = {
        ...editingMonthDue,
        id: dueDocId,
        rentAmount: origRent,
        isAdjusted: false,
        adjustedRentAmount: undefined,
        commissionType: commSettings.commissionType,
        commissionValue: commSettings.commissionValue,
        commissionAmount: commAmt,
        netOwnerAmount: netOwner,
        updatedAt: nowISO
      };
      await updateFirestoreDoc('re_dues', dueDocId, dueDataToSave);

      // Restore forward uncollected dues
      const forwardUncollectedDues = allDues.filter(d => {
        const matchTId = targetTenantId && d.tenantId === targetTenantId;
        const matchTName = editingMonthDue.tenantName && d.tenantName && d.tenantName.trim().toLowerCase() === editingMonthDue.tenantName.trim().toLowerCase();
        const isMatch = matchTId || matchTName;
        return isMatch && d.forMonthYear && d.forMonthYear > targetMonthYear && d.status !== 'collected';
      });

      for (const fDue of forwardUncollectedDues) {
        if (fDue.id && fDue.id !== dueDocId) {
          const fallbackRent = fDue.originalRentAmount || origRent;
          await updateFirestoreDoc('re_dues', fDue.id, {
            rentAmount: fallbackRent,
            isAdjusted: false,
            adjustedRentAmount: undefined,
            updatedAt: nowISO
          });
        }
      }

      // Restore tenant contractual rent in re_tenants
      if (targetTenantId && origRent > 0) {
        await updateFirestoreDoc('re_tenants', targetTenantId, {
          rentAmount: origRent,
          updatedAt: nowISO
        });
      }

      setLocalAdjustments(prev => {
        const copy = { ...prev };
        delete copy[targetMonthYear];
        availableTenantDues.forEach(d => {
          if (d.forMonthYear && d.forMonthYear > targetMonthYear) {
            delete copy[d.forMonthYear];
          }
        });
        return copy;
      });

      if (onDeleteRentAdjustment) {
        await onDeleteRentAdjustment(adjDocId, dueDataToSave);
      } else if (onSaveRentAdjustment) {
        await onSaveRentAdjustment({
          id: adjDocId,
          tenantId: targetTenantId,
          forMonthYear: targetMonthYear,
          adjustedRentAmount: origRent,
          updatedAt: nowISO
        } as any, dueDataToSave);
      }

      if (selectionMode === 'single') {
        setCollectedAmount(origRent);
      }

      setSuccessToast(`تمت استعادة القيمة الأصلية (${origRent.toLocaleString('ar-EG')} ج.م) ابتداءً من شهر (${editingMonthDue.monthNameAr || formatMonthYearAr(targetMonthYear)}) وما بعده.`);
      setEditingMonthDue(null);
    } catch (err: any) {
      console.error('Error restoring original rent:', err);
      alert('حدث خطأ أثناء استعادة القيمة الأصلية.');
    } finally {
      setIsSavingEditRent(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PREPAYMENT LOGIC (الدفع المسبق)
  // ---------------------------------------------------------------------------
  const handleAddPrepaidMonth = (targetMonth?: string, customRent?: number) => {
    setPrepayInlineError(null);
    setPrepayInlineSuccess(null);

    const monthKey = targetMonth || prepaySelectedMonth;
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      setPrepayInlineError('يرجى اختيار شهر وسنة صالحين للدفع المسبق.');
      return;
    }

    const tenantId = currentTenant?.id || primaryInitialDue?.tenantId || '';
    const tenantName = currentTenant?.fullName || primaryInitialDue?.tenantName || 'المستأجر';

    // 1. Strict Duplicate Prevention: Check if already paid with a collection receipt in collections
    const alreadyCollectedReceipt = (collections || []).find(c => 
      c &&
      !c.isCancelled &&
      c.status !== 'reverted' &&
      (c.amountPaid || 0) > 0 &&
      (c.tenantId === tenantId || ((c as any).tenantName && (c as any).tenantName.trim() === tenantName.trim())) &&
      c.forMonthYear === monthKey
    );

    if (alreadyCollectedReceipt) {
      setPrepayInlineError(
        `⚠️ شهر (${formatMonthYearAr(monthKey)}) مسدد بالفعل ومسجل له سند تحصيل في المنظومة (رقم السند: ${alreadyCollectedReceipt.receiptNumber || '—'}). يمنع تكرار تسجيل نفس الشهر.`
      );
      return;
    }

    // 2. Check if already exists in available dues and is marked collected/prepaid
    const existingDue = availableTenantDues.find(d => d.forMonthYear === monthKey);
    if (existingDue) {
      const cStatus = getDueCollectionStatus(existingDue, todayISO, currentMonthISO, collections);
      if (cStatus === 'collected' || cStatus === 'prepaid') {
        setPrepayInlineError(`⚠️ شهر (${formatMonthYearAr(monthKey)}) مسدد بالفعل في المنظومة. يمنع تكرار تسجيل نفس الشهر.`);
        return;
      }

      // If already in selectedDueIds
      if (selectedDueIds.includes(existingDue.id)) {
        setPrepayInlineError(`ℹ️ شهر (${formatMonthYearAr(monthKey)}) مضاف ومحدد بالفعل في قائمة السداد الحالية.`);
        return;
      }

      // If existing due exists and is unpaid, select it immediately
      const newIds = [...selectedDueIds, existingDue.id];
      setSelectedDueIds(newIds);
      setSelectionMode('multi');
      const nextTotal = availableTenantDues
        .filter(d => newIds.includes(d.id) && getMatchingCollectionReceipts(d, collections).length === 0)
        .reduce((sum, d) => sum + (d.rentAmount || 0), 0);
      setCollectedAmount(nextTotal);
      setPrepayInlineSuccess(`✅ تم إضافة شهر ${formatMonthYearAr(monthKey)} بنجاح بقيمة الإيجار الفعلية (${(existingDue.rentAmount || 0).toLocaleString('ar-EG')} ج.م).`);

      // Advance selector to the next month
      const [y, m] = monthKey.split('-').map(Number);
      const nextD = new Date(y, m, 1);
      setPrepaySelectedMonth(`${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`);
      return;
    }

    // 3. New Future Due Creation for Prepayment with actual rent amount and full linkage
    const numericRent = customRent !== undefined 
      ? customRent 
      : (Number(prepayRentAmount) || actualRentAmount);

    if (numericRent <= 0) {
      setPrepayInlineError('يرجى تحديد قيمة إيجار صحيحة أكبر من الصفر للشهر المضاف.');
      return;
    }

    const [yStr, mStr] = monthKey.split('-');
    const monthNameAr = formatMonthYearAr(monthKey);
    const dueDay = currentUnit?.dueDay || 1;
    const dueDayStr = String(dueDay).padStart(2, '0');
    const dueDate = `${yStr}-${mStr}-${dueDayStr}`;

    // Calculate commission
    const commSettings = getPropertyCommissionSettings(currentProperty, currentOwner, allDues);
    const commType = commSettings.commissionType;
    const commVal = commSettings.commissionValue;
    const commAmount = calculateCommissionFromSettings(numericRent, commSettings);
    const netOwnerAmount = Math.max(0, numericRent - commAmount);

    const dueId = `due-prepaid-${tenantId}-${monthKey}`;
    const newDue: ReRentDue = {
      id: dueId,
      tenantId: tenantId,
      tenantName: tenantName,
      tenantPhone: currentTenant?.phone || primaryInitialDue?.tenantPhone || '',
      unitId: currentUnit?.id || primaryInitialDue?.unitId || '',
      unitNumber: currentUnit?.unitNumber || primaryInitialDue?.unitNumber || '',
      propertyId: currentProperty?.id || primaryInitialDue?.propertyId || '',
      propertyName: currentProperty?.name || primaryInitialDue?.propertyName || '',
      ownerId: currentOwner?.id || primaryInitialDue?.ownerId || '',
      ownerName: currentOwner?.name || primaryInitialDue?.ownerName || '',
      contractNumber: currentTenant?.contractNumber || primaryInitialDue?.contractNumber || '',
      forMonthYear: monthKey,
      monthNameAr: monthNameAr,
      dueDate: dueDate,
      rentAmount: numericRent,
      commissionType: commType,
      commissionValue: commVal,
      commissionAmount: commAmount,
      netOwnerAmount: netOwnerAmount,
      status: 'pending',
      isPrepaid: true,
      collectionStatus: 'prepaid',
      createdAt: new Date().toISOString()
    };

    setAddedPrepaidDues(prev => [...prev, newDue]);
    const newIds = [...selectedDueIds, dueId];
    setSelectedDueIds(newIds);
    setSelectionMode('multi');

    // Automatically update collectedAmount to cover the newly added month
    setCollectedAmount(prev => Number(prev) + numericRent);

    setPrepayInlineSuccess(`✅ تم إضافة شهر ${monthNameAr} للدفع المسبق بنجاح وربطه بالموكل والوحدة بقيمة ${numericRent.toLocaleString('ar-EG')} ج.م.`);

    // Advance selector to the next month
    const [y, m] = monthKey.split('-').map(Number);
    const nextD = new Date(y, m, 1);
    setPrepaySelectedMonth(`${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`);
  };

  // Add multiple consecutive future months (Quick buttons)
  const handleAddMultiplePrepaidMonths = (count: number) => {
    setPrepayInlineError(null);
    setPrepayInlineSuccess(null);

    let base = prepaySelectedMonth;
    if (!base || !/^\d{4}-\d{2}$/.test(base)) {
      const existingMonths = availableTenantDues.map(d => d.forMonthYear).filter(Boolean);
      const latestMonth = existingMonths.length > 0 
        ? [...existingMonths].sort().pop()! 
        : currentMonthISO;
      const baseMonth = latestMonth && latestMonth > currentMonthISO ? latestMonth : currentMonthISO;
      const [y, m] = baseMonth.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      base = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    }

    let addedCount = 0;
    let [curY, curM] = base.split('-').map(Number);

    for (let i = 0; i < count; i++) {
      const mKey = `${curY}-${String(curM).padStart(2, '0')}`;
      
      const isColl = (collections || []).some(c => 
        c && !c.isCancelled && c.status !== 'reverted' && 
        (c.amountPaid || 0) > 0 && 
        (c.tenantId === (currentTenant?.id || primaryInitialDue?.tenantId) || 
         ((c as any).tenantName && (c as any).tenantName === (currentTenant?.fullName || primaryInitialDue?.tenantName))) && 
        c.forMonthYear === mKey
      );
      const isAlreadyInDues = availableTenantDues.some(d => 
        d.forMonthYear === mKey && 
        (d.collectionStatus === 'collected' || d.collectionStatus === 'prepaid')
      );

      if (!isColl && !isAlreadyInDues) {
        handleAddPrepaidMonth(mKey);
        addedCount++;
      }

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    if (addedCount > 0) {
      setPrepayInlineSuccess(`✅ تم إضافة (${addedCount}) أشهر مستقبلية للدفع المسبق بنجاح.`);
    } else {
      setPrepayInlineError('لم تتم إضافة أي أشهر لأن جميع الأشهر المطلوبة مسددة أو مضافة مسبقاً.');
    }
  };

  // Remove an added prepaid due
  const handleRemovePrepaidDue = (dueId: string) => {
    setAddedPrepaidDues(prev => prev.filter(d => d.id !== dueId));
    setSelectedDueIds(prev => prev.filter(id => id !== dueId));
    const removedDue = addedPrepaidDues.find(d => d.id === dueId);
    if (removedDue) {
      const removedRent = removedDue.rentAmount || 0;
      setCollectedAmount(prev => Math.max(0, Number(prev) - removedRent));
    }
    setPrepayInlineSuccess(null);
    setPrepayInlineError(null);
  };

  // Handle Form Submit (handles both 'collect' and 'save_receipt')
  const handleSubmit = async (actionType: 'collect' | 'save_receipt' = 'collect', e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 0. Strict duplicate prevention: lock immediately against rapid multi-clicks
    if (isSaving || isSubmittingRef.current) return;

    // 1. Strict Validation: Check if single or all selected dues already have a collection receipt
    if (selectedDues.length === 1 && hasAlreadyPaidSelected) {
      const paidItem = alreadyPaidDues[0];
      const mName = paidItem.due.monthNameAr || formatMonthYearAr(paidItem.due.forMonthYear);
      const rNum = paidItem.receipt.receiptNumber ? ` (رقم السند: ${paidItem.receipt.receiptNumber})` : '';
      setErrorMessage(`هذا الشهر (${mName}) مسدد بالفعل وله سند تحصيل محفوظ${rNum}. لا يمكن تكرار التحصيل.`);
      return;
    }

    if (payableDues.length === 0) {
      setErrorMessage('جميع الأشهر المحددة مسددة بالفعل ولها سندات تحصيل محفوظة في قاعدة البيانات.');
      return;
    }

    if (numericCollected <= 0) {
      setErrorMessage('يرجى إدخال مبلغ محصل صحيح أكبر من الصفر للأشهر المستحقة.');
      return;
    }

    setErrorMessage(null);
    isSubmittingRef.current = true;
    setIsSaving(true);
    setSubmittingAction(actionType);

    const generatedReceiptNo = receiptNumber.trim() || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // Execute the actual collection and Firestore persistence
      await onSaveReceipt({
        duesToProcess: payableDues,
        collectForm: {
          paidDate,
          collectedAmount: numericCollected,
          paymentMethod,
          receiptNumber: generatedReceiptNo,
          notes
        }
      });

      // Show EXACT notification required by user
      if (actionType === 'save_receipt') {
        setSuccessToast('تم حفظ سند التحصيل بنجاح');
      } else {
        setSuccessToast('تم التحصيل بنجاح وحفظ السند');
      }

      // If user chose "حفظ السند", generate and print/preview the receipt directly
      if (actionType === 'save_receipt') {
        try {
          const tenantForReceipt = currentTenant || (primaryInitialDue ? {
            id: primaryInitialDue.tenantId,
            fullName: primaryInitialDue.tenantName,
            nationalId: '',
            phone: '',
            unitId: primaryInitialDue.unitId,
            propertyId: primaryInitialDue.propertyId,
            rentAmount: primaryInitialDue.rentAmount,
            contractStartDate: '',
            contractEndDate: '',
            status: 'active' as const,
            createdAt: ''
          } : null);

          if (tenantForReceipt) {
            const receiptHtml = generateCollectionReceiptVoucherHTML({
              receipt: {
                id: `coll_${Date.now()}`,
                receiptNumber: generatedReceiptNo,
                tenantId: tenantForReceipt.id,
                unitId: currentUnit?.id || primaryInitialDue.unitId,
                propertyId: currentProperty?.id || primaryInitialDue.propertyId,
                amountPaid: numericCollected,
                forMonthYear: payableDues.map(d => d.monthNameAr || formatMonthYearAr(d.forMonthYear)).join(' + '),
                paymentDate: paidDate,
                paymentMethod: paymentMethod as any,
                collectedBy: currentUser?.fullName || 'الإدارة المالية',
                notes: notes || (payableDues.length > 1 ? `تحصيل إيجار (${payableDues.length}) أشهر` : `تحصيل إيجار شهر ${payableDues[0]?.monthNameAr || ''}`),
                status: 'collected',
                createdAt: new Date().toISOString()
              },
              tenant: tenantForReceipt,
              property: currentProperty || undefined,
              unit: currentUnit || undefined,
              owner: currentOwner || undefined,
              currentUser
            });
            printReceiptDirectly(receiptHtml);
          }
        } catch (printErr) {
          console.warn('Direct print notice:', printErr);
        }
      }

      // Close modal smoothly after user sees the clear confirmation
      setTimeout(() => {
        setIsSaving(false);
        isSubmittingRef.current = false;
        setSubmittingAction(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setIsSaving(false);
      isSubmittingRef.current = false;
      setSubmittingAction(null);
      setErrorMessage(err?.message || 'حدث خطأ أثناء تنفيذ التحصيل وحفظ السند في السحابة. يرجى المحاولة مرة أخرى.');
    }
  };

  if (!isOpen || !primaryInitialDue) return null;

  // Display Period text
  const periodDisplayText = selectedDues.length === 1 
    ? (selectedDues[0].monthNameAr || formatMonthYearAr(selectedDues[0].forMonthYear))
    : `${selectedDues.length} أشهر (${selectedDues.map(d => d.monthNameAr || formatMonthYearAr(d.forMonthYear)).join('، ')})`;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
        dir="rtl"
        id="add-collection-receipt-overlay"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-[#0B1528] border-2 border-[#D4A84F]/40 rounded-2xl sm:rounded-3xl w-full max-w-5xl h-[92vh] max-h-[92vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-right text-[#F8F9FB] relative overflow-hidden my-auto"
          id="add-collection-receipt-modal"
        >
          {/* SUCCESS TOAST OVERLAY */}
          <AnimatePresence>
            {successToast && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute inset-x-0 top-4 z-50 flex justify-center px-4"
              >
                <div className="bg-emerald-600 border border-emerald-400 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm sm:text-base">
                  <CheckCircle2 className="w-6 h-6 text-white shrink-0 animate-bounce" />
                  <span>{successToast}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HEADER - FIXED TOP */}
          <div className="flex items-center justify-between border-b border-[#D4A84F]/20 p-4 sm:p-5 md:p-6 shrink-0 bg-[#0F1D30]/95 backdrop-blur-md">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-2.5 sm:p-3 rounded-2xl bg-[#D4A84F]/15 border border-[#D4A84F]/30 text-[#D4A84F] shrink-0 shadow-inner">
                <Receipt className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-[#F8F9FB] flex items-center gap-2">
                  <span>إضافة سند تحصيل</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#D4A84F]/20 text-[#D4A84F] border border-[#D4A84F]/30">
                    إيجارات وتحصيل
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-[#9EA7B8] font-medium mt-0.5 truncate">
                  تسجيل دفعة إيجار وتوليد سند مالي رسمي مع إمكانية الدفع المسبق
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#9EA7B8] hover:text-white transition-colors cursor-pointer shrink-0 border border-white/10"
              title="إغلاق النافذة"
              id="btn-close-collection-modal"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* FORM BODY - SCROLLABLE (Smooth on Laptop & Mobile) */}
          <form onSubmit={(e) => handleSubmit('collect', e)} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 sm:p-6 md:p-8 overflow-y-auto overscroll-contain touch-pan-y space-y-6 sm:space-y-7 flex-1 custom-scrollbar">

              {/* ERROR MESSAGE BANNER */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-3 shadow-md">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* TOP PAYMENT SECTIONS: قسمي «الإيجارات المتأخرة» و«الدفع المسبق» متجاورين كخيارين واضحين */}
              {/* ------------------------------------------------------------- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4.5" id="payment-options-selector">
                {/* الخيار 1: الإيجارات المتأخرة */}
                <button
                  type="button"
                  onClick={() => handleSwitchPaymentTab('arrears')}
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 text-right transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3.5 ${
                    paymentTypeTab === 'arrears'
                      ? 'bg-gradient-to-br from-[#1C1608] via-[#0F1D30] to-[#1F1706] border-amber-400 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400/50 text-white scale-[1.01]'
                      : 'bg-[#0A1424]/90 border-white/10 hover:border-amber-400/40 hover:bg-[#0F1D30] text-slate-300'
                  }`}
                  id="btn-tab-arrears"
                >
                  {/* Glow Accent */}
                  {paymentTypeTab === 'arrears' && (
                    <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
                  )}

                  {/* Top Row: Icon + Active Status */}
                  <div className="flex items-center justify-between gap-2 relative">
                    <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-sm transition-all ${
                      paymentTypeTab === 'arrears'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400/50 ring-1 ring-amber-400/30'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}>
                      <History className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                    </div>

                    {paymentTypeTab === 'arrears' ? (
                      <span className="text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>القسم المختار حالياً</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        انقر للاختيار
                      </span>
                    )}
                  </div>

                  {/* Middle Row: Title + Description */}
                  <div className="space-y-1 relative">
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2">
                      <span>الإيجارات المتأخرة</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        المتأخرات والمستحق
                      </span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      سداد وتحصيل المتأخرات والشهور السابقة والمستحقة على المستأجر
                    </p>
                  </div>

                  {/* Bottom Row: Dynamic Arrears Badge */}
                  <div className="relative pt-2 border-t border-white/10">
                    {uncollectedArrearsCount > 0 ? (
                      <div className="text-xs sm:text-sm font-bold bg-amber-950/60 border border-amber-500/40 px-3 py-1.5 rounded-xl text-amber-300 flex items-center justify-between gap-2">
                        <span>يوجد {uncollectedArrearsCount} أشهر متأخرة</span>
                        <span className="text-white font-mono font-black">{totalUncollectedArrearsAmount.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm font-bold bg-emerald-950/50 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>لا توجد متأخرات سابقة مسجلة</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* الخيار 2: الدفع المسبق */}
                <button
                  type="button"
                  onClick={() => handleSwitchPaymentTab('prepayment')}
                  className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 text-right transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3.5 ${
                    paymentTypeTab === 'prepayment'
                      ? 'bg-gradient-to-br from-[#180F2E] via-[#0F1D30] to-[#1B1133] border-purple-400 shadow-xl shadow-purple-500/20 ring-2 ring-purple-400/50 text-white scale-[1.01]'
                      : 'bg-[#0A1424]/90 border-white/10 hover:border-purple-400/40 hover:bg-[#0F1D30] text-slate-300'
                  }`}
                  id="btn-tab-prepayment"
                >
                  {/* Glow Accent */}
                  {paymentTypeTab === 'prepayment' && (
                    <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />
                  )}

                  {/* Top Row: Icon + Active Status */}
                  <div className="flex items-center justify-between gap-2 relative">
                    <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-sm transition-all ${
                      paymentTypeTab === 'prepayment'
                        ? 'bg-purple-500/25 text-purple-300 border-purple-400/50 ring-1 ring-purple-400/30'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}>
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                    </div>

                    {paymentTypeTab === 'prepayment' ? (
                      <span className="text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full bg-purple-400 text-slate-950 flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>القسم المختار حالياً</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        انقر للاختيار
                      </span>
                    )}
                  </div>

                  {/* Middle Row: Title + Description */}
                  <div className="space-y-1 relative">
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-white flex items-center gap-2">
                      <span>الدفع المسبق</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        أشهر مستقبلية
                      </span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium">
                      إضافة وسداد أشهر مستقبلية للوحدة مقدماً وربطها بالعقد
                    </p>
                  </div>

                  {/* Bottom Row: Dynamic Prepayment Badge */}
                  <div className="relative pt-2 border-t border-white/10">
                    {addedPrepaidDues.length > 0 ? (
                      <div className="text-xs sm:text-sm font-bold bg-purple-950/60 border border-purple-500/40 px-3 py-1.5 rounded-xl text-purple-200 flex items-center justify-between gap-2">
                        <span>تمت إضافة {addedPrepaidDues.length} أشهر مسبقة</span>
                        <span className="text-white font-mono font-black">{addedPrepaidDues.reduce((s, d) => s + (d.rentAmount || 0), 0).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm font-bold bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-xl text-purple-300 flex items-center gap-1.5">
                        <CalendarPlus className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>اختيار وسداد أشهر مستقبلية مقدماً</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* عرض بيانات القسم المختار فقط وإخفاء القسم الآخر بالكامل */}
              {/* ------------------------------------------------------------- */}
              {paymentTypeTab === 'arrears' && (
                <ArrearsPaymentSection
                  currentTenant={currentTenant}
                  primaryInitialDue={primaryInitialDue}
                  currentProperty={currentProperty}
                  currentUnit={currentUnit}
                  currentOwner={currentOwner}
                  actualRentAmount={actualRentAmount}
                  todayISO={todayISO}
                  currentMonthISO={currentMonthISO}
                  collections={collections}
                  arrearsDues={arrearsDues}
                  selectedDueIds={selectedDueIds}
                  selectedDues={selectedDues}
                  selectionMode={selectionMode}
                  handleSwitchMode={handleSwitchMode}
                  handleToggleDue={handleToggleDue}
                  handleOpenEditRent={handleOpenEditRent}
                  periodDisplayText={periodDisplayText}
                  alreadyPaidDues={alreadyPaidDues}
                  uncollectedArrearsCount={uncollectedArrearsCount}
                  totalUncollectedArrearsAmount={totalUncollectedArrearsAmount}
                  onSwitchToPrepayment={() => handleSwitchPaymentTab('prepayment')}
                  paidDate={paidDate}
                  setPaidDate={setPaidDate}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  receiptNumber={receiptNumber}
                  setReceiptNumber={setReceiptNumber}
                  collectedAmount={collectedAmount}
                  setCollectedAmount={setCollectedAmount}
                  notes={notes}
                  setNotes={setNotes}
                  totalRequiredRent={totalRequiredRent}
                  numericCollected={numericCollected}
                  remainingAmount={remainingAmount}
                  handleFillFullAmount={handleFillFullAmount}
                />
              )}

              {paymentTypeTab === 'prepayment' && (
                <PrepaymentSection
                  currentTenant={currentTenant}
                  primaryInitialDue={primaryInitialDue}
                  currentProperty={currentProperty}
                  currentUnit={currentUnit}
                  currentOwner={currentOwner}
                  actualRentAmount={actualRentAmount}
                  todayISO={todayISO}
                  currentMonthISO={currentMonthISO}
                  collections={collections}
                  addedPrepaidDues={addedPrepaidDues}
                  futureTenantDues={futureTenantDues}
                  selectedDueIds={selectedDueIds}
                  prepaySelectedMonth={prepaySelectedMonth}
                  setPrepaySelectedMonth={setPrepaySelectedMonth}
                  prepayRentAmount={prepayRentAmount}
                  setPrepayRentAmount={setPrepayRentAmount}
                  prepayInlineError={prepayInlineError}
                  setPrepayInlineError={setPrepayInlineError}
                  prepayInlineSuccess={prepayInlineSuccess}
                  setPrepayInlineSuccess={setPrepayInlineSuccess}
                  handleAddPrepaidMonth={handleAddPrepaidMonth}
                  handleAddMultiplePrepaidMonths={handleAddMultiplePrepaidMonths}
                  handleRemovePrepaidDue={handleRemovePrepaidDue}
                  handleToggleDue={handleToggleDue}
                  uncollectedArrearsCount={uncollectedArrearsCount}
                  totalUncollectedArrearsAmount={totalUncollectedArrearsAmount}
                  onSwitchToArrears={() => handleSwitchPaymentTab('arrears')}
                  paidDate={paidDate}
                  setPaidDate={setPaidDate}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  receiptNumber={receiptNumber}
                  setReceiptNumber={setReceiptNumber}
                  collectedAmount={collectedAmount}
                  setCollectedAmount={setCollectedAmount}
                  notes={notes}
                  setNotes={setNotes}
                  totalRequiredRent={totalRequiredRent}
                  numericCollected={numericCollected}
                  remainingAmount={remainingAmount}
                  handleFillFullAmount={handleFillFullAmount}
                />
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* STICKY FOOTER - FIXED BOTTOM BAR */}
            {/* ------------------------------------------------------------- */}
            <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-t border-[#D4A84F]/20 bg-[#0A1424] shrink-0 gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#9EA7B8] font-medium">
                <ShieldCheck className="w-4 h-4 text-[#D4A84F] shrink-0" />
                <span>سيتم حفظ سند التحصيل وتحديث السجلات والتقارير المالية فوراً</span>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3 mr-auto flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-white/15 text-[#CAD2DF] hover:text-white hover:bg-white/5 text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
                  id="btn-cancel-collection"
                >
                  إلغاء
                </button>

                {/* زر 1: التحصيل المباشر وتحديث الأرصدة والمتبقي في النظام */}
                <button
                  type="button"
                  onClick={() => handleSubmit('collect')}
                  disabled={isSaving || selectedDues.length === 0 || payableDues.length === 0 || Number(collectedAmount) <= 0}
                  className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-emerald-400/30"
                  id="btn-execute-collection"
                  title={
                    selectedDues.length === 1 && hasAlreadyPaidSelected
                      ? 'هذا الشهر مسدد بالفعل وله سند تحصيل محفوظ'
                      : payableDues.length === 0 && selectedDues.length > 0
                        ? 'جميع الأشهر المحددة مسددة بالفعل'
                        : 'تنفيذ التحصيل وتحديث رصيد المستأجر والمتبقي فوراً في النظام'
                  }
                >
                  {isSaving && submittingAction === 'collect' ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-white" />
                      <span>جاري التحصيل وتحديث الرصيد...</span>
                    </>
                  ) : selectedDues.length === 1 && hasAlreadyPaidSelected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <span>مسدد بالفعل</span>
                    </>
                  ) : payableDues.length === 0 && selectedDues.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <span>الأشهر مسددة بالفعل</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <span>التحصيل ({payableDues.length > 0 ? payableDues.length : 0} شهر)</span>
                    </>
                  )}
                </button>

                {/* زر 2: حفظ السند والتحصيل الفعلي في Firestore مع الطباعة الفورية */}
                <button
                  type="button"
                  onClick={() => handleSubmit('save_receipt')}
                  disabled={isSaving || selectedDues.length === 0 || payableDues.length === 0 || Number(collectedAmount) <= 0}
                  className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-[#D4A84F] to-[#C3973E] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-[#D4A84F]/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-[#D4A84F]/40"
                  id="btn-save-collection-receipt"
                  title={
                    selectedDues.length === 1 && hasAlreadyPaidSelected
                      ? 'هذا الشهر مسدد بالفعل وله سند تحصيل محفوظ'
                      : payableDues.length === 0 && selectedDues.length > 0
                        ? 'جميع الأشهر المحددة مسددة بالفعل'
                        : 'تسجيل عملية التحصيل وسند الدفع في Firestore وتحديث الرصيد وطباعة السند'
                  }
                >
                  {isSaving && submittingAction === 'save_receipt' ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-slate-950" />
                      <span>جاري حفظ السند والتحصيل...</span>
                    </>
                  ) : selectedDues.length === 1 && hasAlreadyPaidSelected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                      <span>مسدد وله سند</span>
                    </>
                  ) : payableDues.length === 0 && selectedDues.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                      <span>الأشهر مسددة</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                      <span>حفظ السند</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

        </motion.div>

        {/* MODAL: Independent Contractual Rent Edit Dialog - High Contrast & Responsive */}
        {editingMonthDue && (
          <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
            dir="rtl"
            onClick={() => {
              if (!isSavingEditRent) setEditingMonthDue(null);
            }}
          >
            <div 
              className="bg-[#0F1D30] border-2 border-[#D4A84F]/60 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0 text-right my-auto animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Accent Ribbon */}
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-[#D4A84F] to-amber-300" />

              {/* Header */}
              <div className="p-4 sm:p-5 bg-[#08111F] border-b border-white/10 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md shrink-0">
                    <Edit3 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-[#F8F9FB] tracking-tight">
                        تعديل القيمة الإيجارية التعاقدية
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/40">
                        مستقبلية وما بعدها
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-bold mt-1">
                      المستأجر: <strong className="text-white font-extrabold">{editingMonthDue.tenantName || currentTenant?.fullName || 'غير محدد'}</strong>
                      {editingMonthDue.unitNumber && <span className="mr-1.5 text-amber-300 font-mono font-bold">• وحدة {editingMonthDue.unitNumber}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMonthDue(null)}
                  disabled={isSavingEditRent}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 space-y-4 max-h-[calc(85vh-160px)] overflow-y-auto">
                {/* 2 Comparative Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Card 1: Effective Month */}
                  <div className="p-3.5 rounded-2xl bg-[#162740] border border-amber-500/30 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-amber-300/90 mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>شهر بداية سريان التعديل:</span>
                    </span>
                    <div className="font-mono font-black text-sm sm:text-base text-white flex items-center justify-between">
                      <span>{editingMonthDue.monthNameAr || formatMonthYearAr(editingMonthDue.forMonthYear)}</span>
                      <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                        وما بعده فقط
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Original/Previous Contract Rent */}
                  <div className="p-3.5 rounded-2xl bg-[#162740] border border-white/15 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-slate-400" />
                      <span>القيمة السابقة / الأصلية:</span>
                    </span>
                    <div className="font-mono font-black text-sm sm:text-base text-slate-100 flex items-center justify-between">
                      <span>{(editingMonthDue.originalRentAmount || actualRentAmount || editingMonthDue.rentAmount).toLocaleString('ar-EG')} ج.م</span>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        محفوظة للشهور السابقة
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Input: New Contractual Rent */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-white flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>القيمة الإيجارية التعاقدية الجديدة</span>
                      <span className="text-rose-400 font-bold">*</span>
                    </span>
                    <span className="text-[11px] text-amber-300 font-bold">تُطبّق ابتداءً من هذا الشهر وما بعده</span>
                  </label>
                  
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editRentAmountInput}
                      onChange={(e) => setEditRentAmountInput(e.target.value)}
                      placeholder="أدخل القيمة الإيجارية الجديدة"
                      className="w-full bg-[#08111F] border-2 border-[#D4A84F]/60 focus:border-[#D4A84F] focus:ring-2 focus:ring-[#D4A84F]/30 rounded-2xl px-4 py-3 text-[#F8F9FB] font-mono text-xl font-black focus:outline-none shadow-inner"
                      disabled={isSavingEditRent}
                      autoFocus
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-amber-400 font-mono">
                      ج.م
                    </span>
                  </div>

                  {/* Difference Tag */}
                  {(() => {
                    const origRent = editingMonthDue.originalRentAmount || actualRentAmount || editingMonthDue.rentAmount || 0;
                    const numVal = Number(editRentAmountInput);
                    if (!isNaN(numVal) && editRentAmountInput !== '') {
                      const diff = numVal - origRent;
                      if (diff > 0) {
                        return (
                          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 pt-0.5">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>زيادة في الإيجار بمقدار +{diff.toLocaleString('ar-EG')} ج.م شهرياً</span>
                          </div>
                        );
                      } else if (diff < 0) {
                        return (
                          <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1 pt-0.5">
                            <Info className="w-3.5 h-3.5" />
                            <span>تخفيض في الإيجار بمقدار {Math.abs(diff).toLocaleString('ar-EG')} ج.م شهرياً</span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1 pt-0.5">
                            <span>نفس القيمة السابقة دون تغيير</span>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>

                {/* Notes Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-200">
                    سبب أو بيان التعديل التعاقدي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={editRentNotesInput}
                    onChange={(e) => setEditRentNotesInput(e.target.value)}
                    placeholder="مثال: زيادة سنوية حسب العقد، تجديد تعاقد، تعديل متفق عليه..."
                    className="w-full bg-[#08111F] border border-white/15 focus:border-[#D4A84F] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 font-bold focus:outline-none"
                    disabled={isSavingEditRent}
                  />
                </div>

                {/* Explicit Rule & Scope Clarification Card */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-100 text-xs leading-relaxed space-y-1.5 shadow-sm">
                  <div className="font-black text-amber-300 flex items-center gap-2 text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>ضمان حماية واستقرار البيانات:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-200 font-bold pr-1">
                    <li>
                      القيمة الجديدة تُطبَّق <strong className="text-amber-300">ابتداءً من شهر ({editingMonthDue.monthNameAr || formatMonthYearAr(editingMonthDue.forMonthYear)}) وكافة الشهور اللاحقة</strong> فقط.
                    </li>
                    <li>
                      <strong className="text-emerald-300">الأشهر السابقة وسندات التحصيل المسجلة:</strong> تبقى بقيمتها وتاريخها كما هي تماماً ولا تتأثر بهذا التعديل.
                    </li>
                    <li>
                      يتم حفظ التعديل فوراً في قاعدة البيانات السحابية كمصدر وحيد ومستمر وينعكس في كافة التقارير وكشوف الحساب.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 sm:p-5 bg-[#08111F] border-t border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                {editingMonthDue.isAdjusted ? (
                  <button
                    type="button"
                    onClick={handleRestoreOriginalRent}
                    disabled={isSavingEditRent}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black text-rose-300 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    title="إلغاء التعديل والعودة للقيمة التعاقدية الأصلية"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة القيمة الأصلية</span>
                  </button>
                ) : (
                  <div className="hidden sm:block" />
                )}

                <div className="w-full sm:w-auto flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingMonthDue(null)}
                    disabled={isSavingEditRent}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMonthRent}
                    disabled={isSavingEditRent}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A84F] via-amber-400 to-[#B38734] hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-[#D4A84F]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95"
                  >
                    {isSavingEditRent ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>جاري الحفظ السحابي...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                        <span>حفظ وتطبيق التعديل</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
