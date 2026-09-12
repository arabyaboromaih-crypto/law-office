import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Receipt, User, Building, Calendar, Coins, CheckCircle2, 
  CreditCard, DollarSign, X, Save, Loader2, Sparkles, 
  AlertCircle, ShieldCheck, Check, Clock, RefreshCw, FileText,
  Plus, Trash2, CalendarPlus, CalendarCheck2, ArrowRight
} from 'lucide-react';
import { 
  ReRentDue, ReTenant, ReUnit, ReProperty, ReOwner, 
  ReCollectionReceipt, User as AuthUser 
} from '../../types';
import { 
  getDueCollectionStatus, 
  getMatchingCollectionReceipts,
  getPropertyCommissionSettings,
  calculateCommissionFromSettings
} from './RealEstateData';
import { generateCollectionReceiptVoucherHTML, printReceiptDirectly } from './TenantCollectionReceiptsModal';

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
  onSaveReceipt
}: AddCollectionReceiptModalProps) {
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthISO = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Primary initial due to derive tenant / unit / property
  const primaryInitialDue = initialDues[0] || null;

  // Selected Dues State
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
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

    // Sort by forMonthYear ascending (oldest to newest)
    return Array.from(uniqueMap.values()).sort((a, b) => 
      (a.forMonthYear || '').localeCompare(b.forMonthYear || '')
    );
  }, [primaryInitialDue, allDues, addedPrepaidDues]);

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

  // Calculate Required Rent Sum only for payable dues
  const totalRequiredRent = useMemo(() => {
    return payableDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
  }, [payableDues]);

  // Remaining calculation
  const numericCollected = Number(collectedAmount) || 0;
  const remainingAmount = totalRequiredRent - numericCollected;

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen && initialDues && initialDues.length > 0) {
      const ids = initialDues.map(d => d.id);
      setSelectedDueIds(ids);
      setSelectionMode(ids.length > 1 ? 'multi' : 'single');

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

      // Default amount
      const totalDue = initialDues.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
      setCollectedAmount(totalDue);
    }
  }, [isOpen, initialDues, todayISO]);

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
    if (selectionMode === 'single') {
      setSelectedDueIds([due.id]);
      const matching = getMatchingCollectionReceipts(due, collections);
      setCollectedAmount(matching.length > 0 ? 0 : (due.rentAmount || 0));
    } else {
      let nextIds: string[];
      if (selectedDueIds.includes(due.id)) {
        nextIds = selectedDueIds.filter(id => id !== due.id);
      } else {
        nextIds = [...selectedDueIds, due.id];
      }
      setSelectedDueIds(nextIds);
      const nextTotal = availableTenantDues
        .filter(d => nextIds.includes(d.id) && getMatchingCollectionReceipts(d, collections).length === 0)
        .reduce((sum, d) => sum + (d.rentAmount || 0), 0);
      setCollectedAmount(nextTotal);
    }
  };

  // Switch Mode handler
  const handleSwitchMode = (mode: 'single' | 'multi') => {
    setSelectionMode(mode);
    if (mode === 'single' && selectedDues.length > 1) {
      const firstId = selectedDues[0]?.id;
      if (firstId) {
        setSelectedDueIds([firstId]);
        const d = availableTenantDues.find(item => item.id === firstId);
        if (d) {
          const matching = getMatchingCollectionReceipts(d, collections);
          setCollectedAmount(matching.length > 0 ? 0 : (d.rentAmount || 0));
        }
      }
    }
  };

  // Handle Quick Fill full amount
  const handleFillFullAmount = () => {
    setCollectedAmount(totalRequiredRent);
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
          className="bg-[#0F1D30] border border-[#D4A84F]/30 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.8)] text-right text-[#F8F9FB] relative overflow-hidden my-auto"
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
              {/* SECTION 1: بيانات المستأجر والعقار التعاقدية */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-[#D4A84F]">
                    <User className="w-5 h-5 text-[#D4A84F]" />
                    <span>بيانات المستأجر والعقار التعاقدية</span>
                  </div>
                  <span className="text-xs font-bold text-[#9EA7B8] bg-white/5 px-3 py-1 rounded-lg">
                    البيانات الأساسية
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Tenant */}
                  <div className="p-3.5 rounded-xl bg-[#0F1D30]/90 border border-white/5 space-y-1.5">
                    <span className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#D4A84F]" />
                      المستأجر / الموكل
                    </span>
                    <p className="text-sm sm:text-base font-black text-[#F8F9FB] truncate" title={currentTenant?.fullName || primaryInitialDue.tenantName}>
                      {currentTenant?.fullName || primaryInitialDue.tenantName || '—'}
                    </p>
                    {currentTenant?.phone && (
                      <p className="text-xs text-[#9EA7B8] font-mono">{currentTenant.phone}</p>
                    )}
                  </div>

                  {/* Property & Unit */}
                  <div className="p-3.5 rounded-xl bg-[#0F1D30]/90 border border-white/5 space-y-1.5">
                    <span className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-[#D4A84F]" />
                      العقار / الوحدة
                    </span>
                    <p className="text-sm sm:text-base font-black text-[#F8F9FB] truncate">
                      {currentProperty?.name || primaryInitialDue.propertyName || 'عقار'}
                      {' - '}
                      <span className="text-[#D4A84F]">وحدة {currentUnit?.unitNumber || primaryInitialDue.unitNumber || '—'}</span>
                    </p>
                    {currentOwner?.name && (
                      <p className="text-xs text-[#9EA7B8] truncate">المالك: {currentOwner.name}</p>
                    )}
                  </div>

                  {/* Period */}
                  <div className="p-3.5 rounded-xl bg-[#0F1D30]/90 border border-white/5 space-y-1.5">
                    <span className="text-xs text-[#9EA7B8] font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-sky-400" />
                      فترة السداد
                    </span>
                    <p className="text-sm sm:text-base font-black text-sky-300 truncate" title={periodDisplayText}>
                      {periodDisplayText}
                    </p>
                    <p className="text-xs text-[#9EA7B8]">{selectedDues.length} شهر محدد</p>
                  </div>

                  {/* Actual Rent */}
                  <div className="p-3.5 rounded-xl bg-[#0F1D30]/90 border border-emerald-500/20 bg-emerald-950/10 space-y-1.5">
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      الإيجار الشهري الفعلي
                    </span>
                    <p className="text-sm sm:text-base font-black text-emerald-400 font-mono truncate">
                      {actualRentAmount.toLocaleString('ar-EG')} ج.م
                    </p>
                    <p className="text-[11px] text-emerald-300/80">القيمة التعاقدية للوحدة</p>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 2: قسم مستقل - «الدفع المسبق» */}
              {/* ------------------------------------------------------------- */}
              <div 
                className="bg-gradient-to-br from-[#121028]/90 via-[#0F1D30]/95 to-[#161233]/90 border-2 border-purple-500/35 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-5 shadow-lg relative overflow-hidden"
                id="section-prepayment"
              >
                {/* Accent glow background */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/20 pb-3.5 relative">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-300" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-purple-200 flex items-center gap-2">
                        <span>الدفع المسبق</span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/40">
                          أشهر مستقبلية
                        </span>
                      </h4>
                      <p className="text-xs sm:text-sm text-[#CAD2DF] font-medium mt-0.5">
                        إضافة شهر أو عدة أشهر مستقبلية وربطها بالموكل/المستأجر والوحدة وقيمة الإيجار الفعلية
                      </p>
                    </div>
                  </div>

                  {/* Summary badge */}
                  <div className="text-xs font-bold bg-purple-950/50 border border-purple-500/30 px-3 py-1.5 rounded-xl text-purple-300">
                    الإيجار الفعلي للوحدة: <span className="text-white font-mono font-black">{actualRentAmount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                </div>

                {/* Linking Context Banner */}
                <div className="p-3.5 rounded-xl bg-[#08111F]/80 border border-purple-500/25 text-xs sm:text-sm text-[#CAD2DF] flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>
                      الربط التلقائي: 
                      <strong className="text-white mx-1">{currentTenant?.fullName || primaryInitialDue.tenantName}</strong>
                      — وحدة: <strong className="text-[#D4A84F]">{currentUnit?.unitNumber || primaryInitialDue.unitNumber}</strong>
                      {' '}({currentProperty?.name || primaryInitialDue.propertyName})
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-purple-300">
                    يتم التحقق لمنع تكرار أي شهر مسجل
                  </span>
                </div>

                {/* Inline Alerts for Prepayment */}
                {prepayInlineError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>{prepayInlineError}</span>
                  </div>
                )}

                {prepayInlineSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{prepayInlineSuccess}</span>
                  </div>
                )}

                {/* Action Row: Month Picker + Rent Amount + ADD Button */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end bg-[#0A1424]/90 p-4 sm:p-5 rounded-2xl border border-purple-500/20">
                  {/* Select Month */}
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold flex items-center gap-1.5">
                      <CalendarPlus className="w-4 h-4 text-purple-400" />
                      <span>الشهر المستقبلي المراد سداده مقدماً</span>
                    </label>
                    <input
                      type="month"
                      value={prepaySelectedMonth}
                      onChange={(e) => {
                        setPrepaySelectedMonth(e.target.value);
                        setPrepayInlineError(null);
                        setPrepayInlineSuccess(null);
                      }}
                      className="w-full bg-[#0F1D30] border border-purple-500/30 rounded-xl px-4 py-2.5 text-sm sm:text-base text-white font-mono font-bold focus:outline-none focus:border-purple-400 transition-all"
                      id="input-prepay-month"
                    />
                  </div>

                  {/* Rent Amount */}
                  <div className="sm:col-span-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        <span>قيمة الإيجار الفعلية</span>
                      </label>
                      {Number(prepayRentAmount) !== actualRentAmount && (
                        <button
                          type="button"
                          onClick={() => setPrepayRentAmount(actualRentAmount)}
                          className="text-[11px] text-purple-300 hover:underline font-bold"
                          title="استعادة الإيجار التعاقدي الفعلي"
                        >
                          استعادة الفعلي ({actualRentAmount.toLocaleString('ar-EG')})
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={prepayRentAmount}
                        onChange={(e) => setPrepayRentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={String(actualRentAmount)}
                        className="w-full bg-[#0F1D30] border border-purple-500/30 rounded-xl px-4 py-2.5 pl-14 text-sm sm:text-base text-emerald-400 font-mono font-black focus:outline-none focus:border-emerald-400 transition-all text-left"
                        id="input-prepay-rent"
                      />
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#9EA7B8]">
                        ج.م
                      </span>
                    </div>
                  </div>

                  {/* Primary Add Button */}
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={() => handleAddPrepaidMonth()}
                      className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      id="btn-add-prepaid-month"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                      <span>إضافة شهر</span>
                    </button>
                  </div>
                </div>

                {/* Quick Addition Buttons for Multiple Future Months */}
                <div className="space-y-2">
                  <span className="text-xs text-[#CAD2DF] font-bold block">
                    إضافة سريعة لعدة أشهر مستقبلية بضغطة زر:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddMultiplePrepaidMonths(1)}
                      className="px-3.5 py-2 rounded-xl bg-[#08111F] hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-500 text-xs font-bold text-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      id="btn-prepay-next-month"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-400" />
                      <span>الشهر القادم مباشرة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddMultiplePrepaidMonths(3)}
                      className="px-3.5 py-2 rounded-xl bg-[#08111F] hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-500 text-xs font-bold text-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      id="btn-prepay-3-months"
                    >
                      <CalendarCheck2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>+ 3 أشهر (ربع سنوي)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddMultiplePrepaidMonths(6)}
                      className="px-3.5 py-2 rounded-xl bg-[#08111F] hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-500 text-xs font-bold text-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      id="btn-prepay-6-months"
                    >
                      <CalendarCheck2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>+ 6 أشهر (نصف سنوي)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddMultiplePrepaidMonths(12)}
                      className="px-3.5 py-2 rounded-xl bg-[#08111F] hover:bg-purple-950/40 border border-purple-500/30 hover:border-purple-500 text-xs font-bold text-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                      id="btn-prepay-12-months"
                    >
                      <CalendarCheck2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>+ سنة كاملة (12 شهر)</span>
                    </button>
                  </div>
                </div>

                {/* List of Added Prepaid Months in this section */}
                {addedPrepaidDues.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-purple-500/20">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-purple-200">
                        الأشهر المضافة حديثاً في الدفع المسبق ({addedPrepaidDues.length}):
                      </span>
                      <span className="text-emerald-400 font-mono">
                        إجمالي: {addedPrepaidDues.reduce((s, d) => s + (d.rentAmount || 0), 0).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {addedPrepaidDues.map((due) => (
                        <div
                          key={due.id}
                          className="p-3 rounded-xl bg-[#08111F] border border-purple-500/40 flex items-center justify-between gap-2 shadow-sm"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-white truncate">
                                {due.monthNameAr || formatMonthYearAr(due.forMonthYear)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 shrink-0">
                                مسبق
                              </span>
                            </div>
                            <p className="text-xs text-emerald-400 font-mono font-bold">
                              {(due.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePrepaidDue(due.id)}
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100 border border-rose-500/30 transition-all cursor-pointer shrink-0"
                            title="إلغاء هذا الشهر المسبق"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 3: فترة الاستحقاق واختيار الشهور (Months Selector) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-[#D4A84F]">
                    <Calendar className="w-5 h-5 text-[#D4A84F]" />
                    <span>فترة الاستحقاق واختيار الشهور</span>
                  </div>

                  {/* Mode Toggle: Single vs Multi */}
                  <div className="flex items-center bg-[#0F1D30] p-1 rounded-xl border border-white/10 gap-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('single')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectionMode === 'single'
                          ? 'bg-[#D4A84F] text-slate-950 shadow-sm font-black'
                          : 'text-[#9EA7B8] hover:text-white'
                      }`}
                      id="btn-mode-single-month"
                    >
                      شهر واحد
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('multi')}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectionMode === 'multi'
                          ? 'bg-[#D4A84F] text-slate-950 shadow-sm font-black'
                          : 'text-[#9EA7B8] hover:text-white'
                      }`}
                      id="btn-mode-multi-months"
                    >
                      عدة أشهر (سداد مسبق / متأخرات)
                    </button>
                  </div>
                </div>

                {/* Month Chips Selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm text-[#CAD2DF] font-bold">
                    <span>اختر الأشهر المراد سدادها في هذا السند:</span>
                    <span className="text-amber-300 font-mono">
                      ({selectedDues.length} شهر محدد — الإجمالي: {totalRequiredRent.toLocaleString('ar-EG')} ج.م)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2.5 max-h-48 overflow-y-auto p-2.5 custom-scrollbar bg-[#0F1D30]/70 rounded-xl border border-white/10">
                    {availableTenantDues.map((d) => {
                      const isSelected = selectedDueIds.includes(d.id);
                      const isPast = (d.forMonthYear || '') < currentMonthISO;
                      const isCurrent = d.forMonthYear === currentMonthISO;
                      const cStatus = getDueCollectionStatus(d, todayISO, currentMonthISO, collections);
                      const matchingReceipts = getMatchingCollectionReceipts(d, collections);
                      const isAlreadyCollected = matchingReceipts.length > 0 || cStatus === 'collected' || cStatus === 'prepaid';
                      const isDynamicallyAdded = addedPrepaidDues.some(ad => ad.id === d.id);

                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleToggleDue(d)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 border text-right ${
                            isSelected
                              ? isAlreadyCollected
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 ring-1 ring-emerald-500/40'
                                : isDynamicallyAdded || (d.forMonthYear || '') > currentMonthISO
                                  ? 'bg-purple-950/50 border-purple-500 text-purple-100 shadow-md ring-1 ring-purple-500/50'
                                  : 'bg-gradient-to-r from-[#D4A84F]/25 to-[#C3973E]/20 border-[#D4A84F] text-[#F8F9FB] shadow-md ring-1 ring-[#D4A84F]/40'
                              : isAlreadyCollected
                                ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/30'
                                : 'bg-[#08111F] border-white/10 text-[#9EA7B8] hover:text-white hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isSelected ? (
                              isAlreadyCollected ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : isDynamicallyAdded || (d.forMonthYear || '') > currentMonthISO ? (
                                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-[#D4A84F] shrink-0" />
                              )
                            ) : isAlreadyCollected ? (
                              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-white/25 shrink-0" />
                            )}
                            <span className="font-extrabold text-[#F8F9FB]">
                              {d.monthNameAr || formatMonthYearAr(d.forMonthYear)}
                            </span>
                          </div>

                          <span className="font-mono text-xs text-amber-300 font-bold border-r border-white/10 pr-2">
                            {(d.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                          </span>

                          {isAlreadyCollected ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              مسدد بسند
                            </span>
                          ) : isDynamicallyAdded ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              مضاف مسبقاً
                            </span>
                          ) : isPast ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              متأخر
                            </span>
                          ) : isCurrent ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              الحالي
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              مستقبلي
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Multi-month breakdown message when mixed months selected */}
                  {selectedDues.length > 1 && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#0F1D30] border border-white/10 space-y-2.5 text-xs sm:text-sm">
                      <div className="font-bold text-[#F8F9FB] flex items-center justify-between border-b border-white/5 pb-2">
                        <span>تفصيل الأشهر المحددة ({selectedDues.length} شهر):</span>
                        <span className="text-amber-300 font-mono font-bold">
                          المطلوب سداده فعلياً: {totalRequiredRent.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>

                      {hasAlreadyPaidSelected && (
                        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>أشهر مسددة مسبقاً بسند تحصيل محفوظ ({alreadyPaidDues.length}):</span>
                          </div>
                          <p className="text-xs text-emerald-200/90 mr-5 leading-relaxed">
                            {alreadyPaidDues.map(p => `${p.due.monthNameAr || formatMonthYearAr(p.due.forMonthYear)}${p.receipt.receiptNumber ? ` (سند: ${p.receipt.receiptNumber})` : ''}`).join('، ')}
                            {' — '}
                            <span className="text-emerald-400 font-bold">لن يتم تكرار تحصيلها أو مضاعفة سنداتها.</span>
                          </p>
                        </div>
                      )}

                      {payableDues.length > 0 ? (
                        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>الأشهر التي سيتم تحصيلها في هذا السند ({payableDues.length}):</span>
                          </div>
                          <p className="text-xs text-amber-200/90 mr-5 leading-relaxed font-mono">
                            {payableDues.map(p => `${p.monthNameAr || formatMonthYearAr(p.forMonthYear)} (${(p.rentAmount || 0).toLocaleString('ar-EG')} ج.م)`).join(' + ')}
                          </p>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>جميع الأشهر المحددة مسددة بالفعل ولا توجد أي أشهر متبقية للسداد.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 4: ملخص المبلغ والحساب (المستحق - المحصل = المتبقي) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-[#D4A84F]">
                    <DollarSign className="w-5 h-5 text-[#D4A84F]" />
                    <span>ملخص المبلغ والحساب</span>
                  </div>
                  <span className="text-xs font-bold text-[#9EA7B8]">
                    المعادلة المالية للسند
                  </span>
                </div>

                {/* Equation Box */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 items-center text-center">
                  {/* Required */}
                  <div className="p-3.5 sm:p-5 rounded-2xl bg-[#0F1D30] border border-white/10 space-y-1">
                    <span className="text-xs sm:text-sm text-[#CAD2DF] font-bold block">
                      الإيجار المستحق
                    </span>
                    <p className="text-base sm:text-xl md:text-2xl font-black text-amber-300 font-mono">
                      {totalRequiredRent.toLocaleString('ar-EG')} <span className="text-xs text-[#9EA7B8]">ج.م</span>
                    </p>
                  </div>

                  {/* Collected */}
                  <div className="p-3.5 sm:p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                    <span className="text-xs sm:text-sm text-emerald-400 font-bold block">
                      المبلغ المحصل
                    </span>
                    <p className="text-base sm:text-xl md:text-2xl font-black text-emerald-400 font-mono">
                      {numericCollected.toLocaleString('ar-EG')} <span className="text-xs text-emerald-400/80">ج.م</span>
                    </p>
                  </div>

                  {/* Remaining */}
                  <div className={`p-3.5 sm:p-5 rounded-2xl border space-y-1 ${
                    remainingAmount === 0
                      ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-300'
                      : remainingAmount > 0
                        ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                        : 'bg-sky-950/20 border-sky-500/30 text-sky-300'
                  }`}>
                    <span className="text-xs sm:text-sm font-bold block">
                      {remainingAmount < 0 ? 'سداد فائض (زيادة)' : 'المتبقي'}
                    </span>
                    <p className="text-base sm:text-xl md:text-2xl font-black font-mono">
                      {Math.abs(remainingAmount).toLocaleString('ar-EG')} <span className="text-xs opacity-80">ج.م</span>
                    </p>
                  </div>
                </div>

                {/* Status Message Pill */}
                <div className="pt-1">
                  {remainingAmount === 0 ? (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>تم إدخال المبلغ بالكامل ومطابقة قيمة السند بنسبة 100%</span>
                    </div>
                  ) : remainingAmount > 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>سداد جزئي: متبقي على المستأجر {remainingAmount.toLocaleString('ar-EG')} ج.م سيظهر كمتأخر في كشف الحساب</span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>سداد فائض: دفعة زيادة بقيمة {Math.abs(remainingAmount).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 5: بيانات التحصيل والدفع والسند */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-[#08111F]/80 border border-[#D4A84F]/20 rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-[#D4A84F]">
                    <CreditCard className="w-5 h-5 text-[#D4A84F]" />
                    <span>بيانات التحصيل والسند المالي</span>
                  </div>
                  <span className="text-xs font-bold text-[#9EA7B8]">
                    بيانات العملية المالية
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {/* Paid Date */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#D4A84F]" />
                      <span>تاريخ التحصيل <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      required
                      className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-4 py-3 text-sm sm:text-base text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] font-mono transition-all"
                      id="input-collection-date"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#D4A84F]" />
                      <span>طريقة السداد <span className="text-rose-400">*</span></span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                      className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-4 py-3 text-sm sm:text-base text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all cursor-pointer"
                      id="select-collection-payment-method"
                    >
                      <option value="نقداً">نقداً بالخزينة (كاش)</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="إنستاباي">إنستاباي رقمي (InstaPay)</option>
                      <option value="فودافون كاش">فودافون كاش / محفظة إلكترونية</option>
                      <option value="شيك بنكي">شيك بنكي</option>
                    </select>
                  </div>

                  {/* Receipt Number */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D4A84F]" />
                        <span>رقم سند التحصيل <span className="text-rose-400">*</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setReceiptNumber(`REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)}
                        className="text-xs text-[#D4A84F] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        title="توليد رقم سند جديد"
                      >
                        <RefreshCw className="w-3 h-3" />
                        توليد تلقائي
                      </button>
                    </div>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      required
                      placeholder="REC-2026-XXXX"
                      className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-4 py-3 text-sm sm:text-base text-[#F8F9FB] font-mono font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                      id="input-collection-receipt-no"
                    />
                  </div>

                  {/* Collected Amount */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        <span>المبلغ المحصل فعلياً <span className="text-rose-400">*</span></span>
                      </label>
                      <button
                        type="button"
                        onClick={handleFillFullAmount}
                        className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 font-bold transition-all cursor-pointer"
                        title="تعبئة المبلغ المطلوب كاملاً بضغطة واحدة"
                      >
                        تعبئة المبلغ بالكامل
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={collectedAmount}
                        onChange={(e) => setCollectedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        required
                        placeholder="0"
                        className="w-full bg-[#0F1D30] border border-emerald-500/40 rounded-xl px-4 py-3 pl-14 text-sm sm:text-base text-emerald-400 font-mono font-black focus:outline-none focus:border-emerald-400 transition-all text-left"
                        id="input-collection-amount"
                      />
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#9EA7B8]">
                        ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes & Bank Reference */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm text-[#CAD2DF] font-bold block">
                    ملاحظات أو الرقم المرجعي للتحويل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب أي ملاحظات إضافية أو رقم الحوالة أو الشيك..."
                    className="w-full bg-[#0F1D30] border border-[#D4A84F]/20 rounded-xl px-4 py-3 text-xs sm:text-sm text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    id="input-collection-notes"
                  />
                </div>
              </div>

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
      </div>
    </AnimatePresence>
  );
}
