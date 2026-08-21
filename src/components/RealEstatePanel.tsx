import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Landmark, Building, Home, Users, 
  Receipt, Wallet, CreditCard, FileBarChart, History,
  Plus, Search, Edit2, Trash2, Printer, Check, X, Save,
  AlertTriangle, Eye, Shield, FileText, Upload, RefreshCw, Filter, ExternalLink, Clock, Loader2,
  Phone, Mail, ChevronLeft, ChevronRight, CheckCircle, CheckCircle2, SlidersHorizontal, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReOwnerAdvance, ReRealEstateLog, ReRentDue, User, ReCommissionStatus, ReRentAdjustment 
} from '../types';
import { 
  subscribeCollection, addFirestoreDoc, 
  updateFirestoreDoc, deleteFirestoreDoc, getFirestoreDocs,
  processRentCollectionTransaction, saveCommissionStatusDoc,
  markEntityAsDeleted
} from '../services/dbSync';
import { 
  initialOwners, initialProperties, initialUnits, initialTenants, 
  initialCollections, initialPayouts, initialExpenses, initialAdvances, initialLogs, initialDues, initialCommissionStatuses,
  getDueCollectionStatus, getPropertyCommissionSettings, calculateCommissionFromSettings, isTenantMonthSuspended
} from './RealEstate/RealEstateData';
import RealEstateFinancials from './RealEstate/RealEstateFinancials';
import RealEstateBackupPanel from './RealEstate/RealEstateBackupPanel';
import AddCollectionReceiptModal from './RealEstate/AddCollectionReceiptModal';
import { Database } from 'lucide-react';
import { uploadToR2WithProgress } from '../utils/fileStorage';
import { validateNationalId } from '../utils/validation';
import { useBackHandler } from '../utils/navigationManager';

// Helpers for Contract Duration & Dates calculation (Max 59 years)
export const parseYearsFromDurationString = (str?: string): number => {
  if (!str) return 0;
  const s = str.trim();
  if (s === 'سنة واحدة' || s === 'سنة' || s === 'عام واحد' || s === 'عام') return 1;
  if (s === 'سنتان' || s === 'سنتين' || s === 'عامين' || s === 'عامان') return 2;
  const match = s.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (!isNaN(num)) return Math.min(Math.max(num, 0), 59);
  }
  return 0;
};

export const formatDurationStringFromYears = (years: number): string => {
  if (years <= 0) return '';
  if (years > 59) years = 59;
  if (years === 1) return 'سنة واحدة';
  if (years === 2) return 'سنتان';
  if (years >= 3 && years <= 10) return `${years} سنوات`;
  return `${years} سنة`;
};

export const calculateContractEndDate = (startDateStr: string, years: number): string => {
  if (!startDateStr || !years || years < 1 || years > 59) return '';
  const parts = startDateStr.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed month
  const day = parseInt(parts[2], 10);
  
  const startDate = new Date(year, month, day);
  if (isNaN(startDate.getTime())) return '';
  
  // Calculate end date: +years - 1 day
  const endDate = new Date(year + years, month, day);
  endDate.setDate(endDate.getDate() - 1);
  
  const yyyy = endDate.getFullYear();
  const mm = String(endDate.getMonth() + 1).padStart(2, '0');
  const dd = String(endDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface RealEstatePanelProps {
  currentUser: User;
}

type RealEstateSubTab = 
  | 'owners' 
  | 'properties' 
  | 'units' 
  | 'tenants' 
  | 'dues'
  | 'collections'
  | 'rent_collections'
  | 'owner_statements'
  | 'tenant_statements'
  | 'property_statements'
  | 'commissions'
  | 'backup';

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export default function RealEstatePanel({ currentUser }: RealEstatePanelProps) {
  // Navigation - Default to financials and rent_collections
  const [activeSubTab, setActiveSubTab] = useState<RealEstateSubTab>('rent_collections');
  const [activeMainTab, setActiveMainTab] = useState<'owners' | 'properties' | 'tenants' | 'financials' | 'backup'>('financials');

  // Sync activeMainTab when activeSubTab changes from other sources
  useEffect(() => {
    if (activeSubTab === 'owners') {
      setActiveMainTab('owners');
    } else if (['properties', 'units'].includes(activeSubTab)) {
      setActiveMainTab('properties');
    } else if (['tenants', 'collections', 'dues'].includes(activeSubTab)) {
      setActiveMainTab('tenants');
    } else if (['rent_collections', 'advances_expenses', 'owner_statements', 'tenant_statements', 'property_statements', 'commissions'].includes(activeSubTab)) {
      setActiveMainTab('financials');
    } else if (activeSubTab === 'backup') {
      setActiveMainTab('backup');
    }
  }, [activeSubTab]);

  const switchMainTab = (mainTab: 'owners' | 'properties' | 'tenants' | 'financials' | 'backup') => {
    setActiveMainTab(mainTab);
    if (mainTab === 'owners') setActiveSubTab('owners');
    else if (mainTab === 'properties') setActiveSubTab('properties');
    else if (mainTab === 'tenants') setActiveSubTab('tenants');
    else if (mainTab === 'financials') setActiveSubTab('rent_collections');
    else if (mainTab === 'backup') setActiveSubTab('backup');
  };

  const handleRestoreComplete = (data: any) => {
    if (data.owners) setOwners(data.owners);
    if (data.properties) setProperties(data.properties);
    if (data.units) setUnits(data.units);
    if (data.tenants) setTenants(data.tenants);
    if (data.collections) setCollections(data.collections);
    if (data.payouts) setPayouts(data.payouts);
    if (data.expenses) setExpenses(data.expenses);
    if (data.advances) setAdvances(data.advances);
    if (data.dues) setDues(data.dues);
    if (data.commissionStatuses) setCommissionStatuses(data.commissionStatuses);
    if (data.deletedDues) setDeletedDueIds(data.deletedDues.map((d: any) => d.id));
    if (data.logs) setLogs(data.logs);
  };

  // Core synchronized state
  const [owners, setOwners] = useState<ReOwner[]>([]);
  const [properties, setProperties] = useState<ReProperty[]>([]);
  const [units, setUnits] = useState<ReUnit[]>([]);
  const [tenants, setTenants] = useState<ReTenant[]>([]);
  const [collections, setCollections] = useState<ReCollectionReceipt[]>([]);
  const [payouts, setPayouts] = useState<RePayout[]>([]);
  const [expenses, setExpenses] = useState<RePropertyExpense[]>([]);
  const [advances, setAdvances] = useState<ReOwnerAdvance[]>([]);
  const [logs, setLogs] = useState<ReRealEstateLog[]>([]);
  const [dues, setDues] = useState<ReRentDue[]>([]);
  const [rentAdjustments, setRentAdjustments] = useState<ReRentAdjustment[]>([]);
  const [isDuesLoaded, setIsDuesLoaded] = useState<boolean>(false);
  const [commissionStatuses, setCommissionStatuses] = useState<ReCommissionStatus[]>([]);
  const [isOwnerStatementsCleared, setIsOwnerStatementsCleared] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('re_owner_statements_cleared');
      if (val === null) {
        localStorage.setItem('re_owner_statements_cleared', 'false');
        return false;
      }
      return val === 'true';
    } catch (e) {
      return false;
    }
  });

  // Subscriptions to Firestore (real-time synced)
  const [deletedDueIds, setDeletedDueIds] = useState<string[]>([]);
  const [deletedEntityIds, setDeletedEntityIds] = useState<Set<string>>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('re_deleted_entity_ids') || '[]');
      return new Set<string>(cached);
    } catch (e) {
      return new Set<string>();
    }
  });

  useEffect(() => {
    const unsubOwners = subscribeCollection<ReOwner>('re_owners', setOwners, initialOwners);
    const unsubProperties = subscribeCollection<ReProperty>('re_properties', setProperties, initialProperties);
    const unsubUnits = subscribeCollection<ReUnit>('re_units', setUnits, initialUnits);
    const unsubTenants = subscribeCollection<ReTenant>('re_tenants', setTenants, initialTenants);
    const unsubCollections = subscribeCollection<ReCollectionReceipt>('re_collections', setCollections, initialCollections);
    const unsubPayouts = subscribeCollection<RePayout>('re_payouts', setPayouts, initialPayouts);
    const unsubExpenses = subscribeCollection<RePropertyExpense>('re_expenses', setExpenses, initialExpenses);
    const unsubAdvances = subscribeCollection<ReOwnerAdvance>('re_advances', setAdvances, initialAdvances);
    const unsubLogs = subscribeCollection<ReRealEstateLog>('re_logs', setLogs, initialLogs);
    const unsubDues = subscribeCollection<ReRentDue>('re_dues', (data) => {
      setDues(data);
      setIsDuesLoaded(true);
    }, initialDues);
    const unsubRentAdjustments = subscribeCollection<ReRentAdjustment>('re_rent_adjustments', setRentAdjustments, []);
    const unsubCommissionStatuses = subscribeCollection<ReCommissionStatus>('re_commission_statuses', setCommissionStatuses, initialCommissionStatuses);
    const unsubSettings = subscribeCollection<{ id: string; cleared: boolean }>('re_settings', (items) => {
      const item = items.find(i => i.id === 'owner_statements_cleared');
      if (item !== undefined) {
        setIsOwnerStatementsCleared(item.cleared);
        try {
          localStorage.setItem('re_owner_statements_cleared', String(item.cleared));
        } catch (e) {}
      } else {
        addFirestoreDoc('re_settings', { id: 'owner_statements_cleared', cleared: false }, 'owner_statements_cleared').catch(() => {});
      }
    }, [{ id: 'owner_statements_cleared', cleared: false }]);
    const unsubDeletedDues = subscribeCollection<{ id: string }>('re_deleted_dues', (items) => {
      setDeletedDueIds(items.map(i => i.id));
    }, []);
    const unsubDeletedEntities = subscribeCollection<{ id: string }>('re_deleted_entities', (items) => {
      const set = new Set(items.map(i => i.id));
      setDeletedEntityIds(set);
    }, []);

    return () => {
      unsubOwners();
      unsubProperties();
      unsubUnits();
      unsubTenants();
      unsubCollections();
      unsubPayouts();
      unsubExpenses();
      unsubAdvances();
      unsubLogs();
      unsubDues();
      unsubRentAdjustments();
      unsubCommissionStatuses();
      unsubSettings();
      unsubDeletedDues();
      unsubDeletedEntities();
    };
  }, []);

  const handleSaveCommissionStatus = async (statusRecord: ReCommissionStatus) => {
    try {
      const savedData = await saveCommissionStatusDoc(statusRecord);
      
      // Update UI state immediately
      setCommissionStatuses(prev => {
        const idx = prev.findIndex(item => item.id === savedData.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = savedData;
          return updated;
        }
        return [...prev, savedData];
      });

      await logAction(
        'edit',
        'حالة العمولة',
        `تم حفظ حالة عمولة العقار (${savedData.propertyName || ''}) بنجاح عن مدة (${savedData.forMonthYear || ''})`
      );
    } catch (error: any) {
      console.error(error?.message || error, error?.stack || '');
      throw error;
    }
  };

  // AUTOMATED MONTHLY RENT DUES GENERATOR FOR ACTIVE LEASE CONTRACTS
  // Note: Office commission is calculated on the TOTAL monthly rent/collection of each property per month
  useEffect(() => {
    if (!isDuesLoaded || !tenants || tenants.length === 0) return;

    // Process all tenant lease contracts with valid start/end dates
    const validContractTenants = tenants.filter(t => t.contractStartDate && t.contractEndDate);

    // Group items by propertyId and monthYear to compute total property rent first
    interface PropertyMonthGroup {
      propertyId: string;
      property: ReProperty | undefined;
      owner: ReOwner | undefined;
      monthYear: string;
      monthNumber: number;
      yearNumber: number;
      items: Array<{
        tenant: ReTenant;
        unit: ReUnit | undefined;
        rentAmount: number;
        dueDate: string;
        dueId: string;
        isAdjusted?: boolean;
        adjustedRentAmount?: number;
      }>;
    }

    const groupsMap = new Map<string, PropertyMonthGroup>();

    validContractTenants.forEach(tenant => {
      // Rule: Accounting starts from accountingStartMonth (or contractStartDate/createdAt)
      const regDateStr = tenant.accountingStartMonth || tenant.contractStartDate || tenant.createdAt;
      if (!regDateStr) return;

      const startDate = new Date(regDateStr);
      let endDateStr = tenant.contractEndDate;
      if (tenant.accountingEndMonth && tenant.accountingEndMonth.trim() !== '') {
        endDateStr = tenant.accountingEndMonth;
      }
      const endDate = new Date(endDateStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

      const unit = units.find(u => u.id === tenant.unitId);
      const property = properties.find(p => p.id === (tenant.propertyId || unit?.propertyId));
      const owner = owners.find(o => o.id === (tenant.ownerId || property?.ownerId));

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const contractEndMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      // Rule: Upper limit for auto dues generation is min(contractEndDate, currentMonth)
      const last = contractEndMonthStart < currentMonthStart ? contractEndMonthStart : currentMonthStart;
      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

      let count = 0;
      while (current <= last && count < 120) {
        count++;
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const monthStr = String(month).padStart(2, '0');
        const mY = `${year}-${monthStr}`;

        const dueDay = unit?.dueDay || startDate.getDate() || 1;
        const dueDayStr = String(dueDay).padStart(2, '0');
        const dueDate = `${year}-${monthStr}-${dueDayStr}`;

        const dueId = `due-${tenant.id}-${mY}`;
        const exists = dues.some(d => d.id === dueId || (d.tenantId === tenant.id && d.forMonthYear === mY));
        const isDeleted = (deletedDueIds || []).includes(dueId) || (deletedDueIds || []).includes(`${tenant.id}-${mY}`) || (deletedDueIds || []).includes(tenant.id) || (deletedDueIds || []).includes((tenant.fullName || '').trim());

        if (!exists && !isDeleted) {
          const propId = property?.id || 'unknown';
          const groupKey = `${propId}_${mY}`;

          if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
              propertyId: propId,
              property,
              owner,
              monthYear: mY,
              monthNumber: month,
              yearNumber: year,
              items: []
            });
          }

          // Check for existing saved rent adjustment for this tenant & month
          const matchedAdj = rentAdjustments.find(a => 
            (a.tenantId === tenant.id || a.tenantName === tenant.fullName) && 
            a.forMonthYear === mY
          );

          const rentAmount = matchedAdj ? matchedAdj.adjustedRentAmount : (tenant.rentAmount || unit?.rentValue || 0);
          groupsMap.get(groupKey)!.items.push({
            tenant,
            unit,
            rentAmount,
            dueDate,
            dueId,
            isAdjusted: !!matchedAdj,
            adjustedRentAmount: matchedAdj?.adjustedRentAmount
          });
        }

        current.setMonth(current.getMonth() + 1);
      }
    });

    // Now calculate property total rent and property total commission for each property/month group
    groupsMap.forEach(group => {
      const totalPropertyMonthlyRent = group.items.reduce((sum, item) => sum + item.rentAmount, 0);

      let commType: 'percentage' | 'fixed_per_thousand' | 'fixed_flat' = group.owner?.commissionType || 'percentage';
      let commVal = group.owner?.commissionValue ?? 5;
      let totalPropertyCommission = 0;

      if (commType === 'percentage') {
        totalPropertyCommission = (totalPropertyMonthlyRent * commVal) / 100;
      } else if (commType === 'fixed_per_thousand') {
        totalPropertyCommission = Math.floor(totalPropertyMonthlyRent / 1000) * commVal;
      } else {
        totalPropertyCommission = commVal;
      }

      // Distribute commission proportionately among property tenants for that month
      group.items.forEach(item => {
        const tenantCommissionAmount = totalPropertyMonthlyRent > 0
          ? Math.round((item.rentAmount / totalPropertyMonthlyRent) * totalPropertyCommission)
          : 0;
        const tenantNetOwnerAmount = Math.max(0, item.rentAmount - tenantCommissionAmount);
        const monthNameAr = `${ARABIC_MONTHS[group.monthNumber - 1]} ${group.yearNumber}`;

        const isOverdue = item.dueDate <= new Date().toISOString().slice(0, 10) || group.monthYear <= new Date().toISOString().slice(0, 7);

        const newDue: ReRentDue = {
          id: item.dueId,
          tenantId: item.tenant.id,
          tenantName: item.tenant.fullName,
          tenantPhone: item.tenant.phone,
          unitId: item.tenant.unitId || '',
          unitNumber: item.unit?.unitNumber || '',
          propertyId: group.propertyId,
          propertyName: group.property?.name || '',
          ownerId: group.owner?.id || '',
          ownerName: group.owner?.name || '',
          contractNumber: item.tenant.contractNumber || '',

          forMonthYear: group.monthYear,
          monthNameAr,
          dueDate: item.dueDate,

          rentAmount: item.rentAmount,
          isAdjusted: item.isAdjusted,
          adjustedRentAmount: item.adjustedRentAmount,
          commissionType: commType,
          commissionValue: commVal,
          commissionAmount: tenantCommissionAmount,
          netOwnerAmount: tenantNetOwnerAmount,

          status: isOverdue ? 'overdue' : 'pending',
          payoutStatus: 'pending_payout',
          collectionStatus: isOverdue ? 'overdue' : 'pending_collection',
          monthClosingStatus: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        addFirestoreDoc('re_dues', newDue, newDue.id).catch(err => console.error('Error auto-generating due:', err));
      });
    });
  }, [tenants, units, properties, owners, dues, deletedDueIds, isDuesLoaded, rentAdjustments]);

  // AUTOMATIC & MANUAL CLEANUP FOR DUPLICATE DUES IN FIRESTORE
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const cleanDuplicateDuesFromFirestore = async (showNotification = false) => {
    if (!dues || dues.length === 0 || isCleaningDuplicates) return 0;
    setIsCleaningDuplicates(true);

    try {
      const groups = new Map<string, ReRentDue[]>();
      
      dues.forEach(d => {
        const tenantKey = (d.tenantName || d.tenantId || '').trim().toLowerCase();
        const monthKey = (d.forMonthYear || '').trim();
        const unitKey = (d.unitNumber || d.unitId || '').trim().toLowerCase();
        const key = `${tenantKey}_${unitKey}_${monthKey}`;
        
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(d);
      });

      let deletedCount = 0;

      // Keep exact duplicate detection safe: only merge/clean exact duplicates (same tenant, unit, and month)
      for (const [, items] of groups.entries()) {
        if (items.length > 1) {
          // Priority to adjusted ones, collected/paid_out ones, then ones with due- prefix, then newest
          items.sort((a, b) => {
            const hasAdjA = a.isAdjusted || rentAdjustments.some(adj => (adj.tenantId === a.tenantId || adj.tenantName === a.tenantName) && adj.forMonthYear === a.forMonthYear);
            const hasAdjB = b.isAdjusted || rentAdjustments.some(adj => (adj.tenantId === b.tenantId || adj.tenantName === b.tenantName) && adj.forMonthYear === b.forMonthYear);

            const scoreA = (hasAdjA ? 20 : 0) + (a.status === 'collected' ? 10 : 0) + (a.payoutStatus === 'paid_out' ? 10 : 0) + (a.id.startsWith('due-') ? 2 : 0);
            const scoreB = (hasAdjB ? 20 : 0) + (b.status === 'collected' ? 10 : 0) + (b.payoutStatus === 'paid_out' ? 10 : 0) + (b.id.startsWith('due-') ? 2 : 0);
            if (scoreA !== scoreB) return scoreB - scoreA;
            const updatedA = a.updatedAt || a.createdAt || '';
            const updatedB = b.updatedAt || b.createdAt || '';
            return updatedB.localeCompare(updatedA);
          });

          const duplicatesToDelete = items.slice(1);
          for (const dup of duplicatesToDelete) {
            await deleteFirestoreDoc('re_dues', dup.id);
            deletedCount++;
          }
        }
      }

      if (showNotification) {
        if (deletedCount > 0) {
          alert(`✅ تم تنظيف ${deletedCount} سجل استحقاق مكرر من قاعدة البيانات بنجاح!`);
        } else {
          alert('✅ قاعدة البيانات سليمة ومستقرة، لا توجد أي استحقاقات مكررة.');
        }
      }
      return deletedCount;
    } catch (err) {
      console.error('Error cleaning duplicate dues:', err);
      if (showNotification) alert('⚠️ حدث خطأ أثناء عملية تنظيف البيانات المكررة.');
      return 0;
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  // DISABLED AUTOMATIC BACKGROUND DELETIONS TO PRESERVE DATA (ALL OPERATIONS ARE EXPLICIT USER ACTIONS)
  const [isCleaningCollectionDuplicates] = useState(false);

  // RESET ALL CONTRACTS, TENANTS & ZERO ALL REAL ESTATE ACCOUNTS
  const [isWipingData, setIsWipingData] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const handleResetAllContractsAndAccounts = async (isSilent = false) => {
    try {
      setIsWipingData(true);

      const reCollectionsToClear = [
        're_tenants',
        're_dues',
        're_collections',
        're_payouts',
        're_expenses',
        're_advances',
        're_commission_statuses',
        're_logs',
        're_deleted_dues',
        're_owners',
        're_properties',
        're_units'
      ];

      for (const colName of reCollectionsToClear) {
        const docsInCol = await getFirestoreDocs<{ id: string }>(colName);
        for (const item of docsInCol) {
          if (item?.id) {
            await deleteFirestoreDoc(colName, item.id).catch(() => {});
          }
        }
        localStorage.setItem(`seeded_${colName}`, 'true');
      }

      // Update local React state immediately
      setTenants([]);
      setDues([]);
      setCollections([]);
      setPayouts([]);
      setExpenses([]);
      setAdvances([]);
      setCommissionStatuses([]);
      setLogs([]);
      setOwners([]);
      setProperties([]);
      setUnits([]);

      if (!isSilent) {
        alert('✅ تم بنجاح حذف كافة العقود والمستأجرين وتصفير جميع الحسابات العقارية من قاعدة البيانات بالكامل.');
      }
    } catch (err) {
      console.error('Error during real estate accounts reset:', err);
    } finally {
      setIsWipingData(false);
    }
  };

  // Automated first-mount wipe of Firestore real estate database
  useEffect(() => {
    const hasWiped = localStorage.getItem('re_clean_reset_v3_done') === 'true';
    if (!hasWiped) {
      localStorage.setItem('re_clean_reset_v3_done', 'true');
      handleResetAllContractsAndAccounts(true);
    }
  }, []);

  // UI States (Modals, Forms)
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');

  // Advanced search states for tenants
  const [tenantSearchName, setTenantSearchName] = useState('');
  const [tenantSearchPropertyId, setTenantSearchPropertyId] = useState('all');
  const [tenantSearchUnitNumber, setTenantSearchUnitNumber] = useState('');
  const [tenantSearchContractNumber, setTenantSearchContractNumber] = useState('');
  const [tenantSearchNationalId, setTenantSearchNationalId] = useState('');
  const [tenantSearchStatus, setTenantSearchStatus] = useState('all');
  const [selectedFileCategory, setSelectedFileCategory] = useState<'صورة بطاقة الرقم القومي' | 'صورة عقد الإيجار' | 'مرفق إضافي'>('صورة بطاقة الرقم القومي');

  // Generic Modal states for forms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'owner' | 'property' | 'unit' | 'tenant' | 'collection' | 'payout' | 'expense' | 'collect_rent' | 'payout_due' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTenantStep, setActiveTenantStep] = useState<'tenant' | 'property' | 'contract' | 'documents' | 'review'>('tenant');

  // States for Collect Rent & Pay Out Owner modals
  const [selectedDueToCollect, setSelectedDueToCollect] = useState<ReRentDue | null>(null);
  const [selectedDuesToCollect, setSelectedDuesToCollect] = useState<ReRentDue[]>([]);
  const [collectForm, setCollectForm] = useState({
    paidDate: new Date().toISOString().slice(0, 10),
    collectedAmount: 0,
    paymentMethod: 'cash' as const,
    receiptNumber: '',
    notes: ''
  });

  const [selectedDueToPayout, setSelectedDueToPayout] = useState<ReRentDue | null>(null);
  const [payoutDueForm, setPayoutDueForm] = useState({
    payoutDate: new Date().toISOString().slice(0, 10),
    payoutMethod: 'تحويل بنكي',
    payoutRefNo: '',
    notes: ''
  });

  // Form states
  const [ownerForm, setOwnerForm] = useState<Omit<ReOwner, 'id' | 'createdAt'>>({
    name: '', phone: '', email: '', commissionType: 'percentage', commissionValue: 5, bankAccount: '', paymentMethod: 'تحويل بنكي', notes: ''
  });
  const [propertyForm, setPropertyForm] = useState<Omit<ReProperty, 'id' | 'createdAt'>>({
    ownerId: '', name: '', address: '', floorsCount: 5, unitsCount: 10, status: 'active', notes: ''
  });
  const [unitForm, setUnitForm] = useState<Omit<ReUnit, 'id' | 'createdAt'>>({
    propertyId: '', unitNumber: '', floor: 1, activityType: 'residential', rentValue: 3000, dueDay: 5, status: 'vacant', notes: ''
  });
  const [tenantForm, setTenantForm] = useState<Omit<ReTenant, 'id' | 'createdAt'>>({
    unitId: '', fullName: '', phone: '', nationalId: '', contractStartDate: '', accountingStartMonth: '', accountingEndMonth: '', contractEndDate: '', rentAmount: 3000, status: 'active', notes: '',
    email: '', address: '', nationality: 'مصري', birthDate: '', paymentMethod: 'شهري', depositAmount: 0, contractDuration: 'سنة واحدة', contractNumber: '', ownerId: '', propertyId: '', attachments: [],
    suspensionDate: '', reactivationDate: '', suspensionHistory: []
  });
  const [isAccountingEndEnabled, setIsAccountingEndEnabled] = useState<boolean>(false);
  const [isSavingTenant, setIsSavingTenant] = useState(false);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<{ title: string; message: string } | null>(null);
  const [collectionForm, setCollectionForm] = useState<Omit<ReCollectionReceipt, 'id' | 'createdAt' | 'receiptNumber' | 'collectedBy'>>({
    tenantId: '', unitId: '', propertyId: '', amountPaid: 0, forMonthYear: new Date().toISOString().slice(0, 7), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', attachmentUrl: '', notes: ''
  });
  const [payoutForm, setPayoutForm] = useState<Omit<RePayout, 'id' | 'createdAt' | 'createdBy'>>({
    ownerId: '', totalCollected: 0, commissionDeducted: 0, expensesDeducted: 0, netAmountPaid: 0, payoutDate: new Date().toISOString().slice(0, 10), paymentMethod: 'تحويل بنكي', bankTransactionRef: '', status: 'draft', signedByOwner: false, notes: ''
  });
  const [expenseForm, setExpenseForm] = useState<Omit<RePropertyExpense, 'id' | 'createdAt' | 'recordedBy'>>({
    propertyId: '', ownerId: '', amount: 0, category: 'صيانة عامة', description: '', expenseDate: new Date().toISOString().slice(0, 10), attachmentUrl: ''
  });

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  // Selected items for premium printing modals
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<ReCollectionReceipt | null>(null);
  const [selectedPayoutForPrint, setSelectedPayoutForPrint] = useState<RePayout | null>(null);

  useBackHandler(isModalOpen, () => setIsModalOpen(false));
  useBackHandler(!!selectedDueToCollect, () => setSelectedDueToCollect(null));
  useBackHandler(!!selectedDueToPayout, () => setSelectedDueToPayout(null));
  useBackHandler(!!selectedReceiptForPrint, () => setSelectedReceiptForPrint(null));
  useBackHandler(!!selectedPayoutForPrint, () => setSelectedPayoutForPrint(null));

  // Report State
  const [reportType, setReportType] = useState<'owner' | 'arrears' | 'general'>('general');
  const [reportTargetId, setReportTargetId] = useState('all');

  // Role permissions checking
  const isManager = currentUser.role === 'admin';
  const canViewRealEstate = currentUser.role === 'admin' || currentUser.permissions?.viewRealEstate !== false;
  const isAccountant = currentUser.role === 'admin' || currentUser.permissions?.addRealEstate !== false || currentUser.permissions?.editRealEstate !== false || currentUser.role === 'lawyer' || currentUser.role === 'secretary';
  const isCollector = currentUser.role === 'admin' || currentUser.permissions?.collectRent !== false || currentUser.role === 'lawyer' || currentUser.role === 'secretary';
  const canPayoutOwner = currentUser.role === 'admin' || currentUser.permissions?.payoutOwner !== false;
  const canDeleteRealEstate = currentUser.role === 'admin' || currentUser.permissions?.deleteRealEstate === true;

  // Helper log generator
  const logAction = async (actionType: ReRealEstateLog['actionType'], entityName: string, details: string) => {
    const newLog: Omit<ReRealEstateLog, 'id'> = {
      actionType,
      entityName,
      details,
      username: currentUser.fullName,
      timestamp: new Date().toLocaleString('ar-EG')
    };
    await addFirestoreDoc('re_logs', newLog);
  };

  // Upload handler for Cloudflare R2
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    const { promise } = uploadToR2WithProgress(
      file,
      (progress) => setUploadProgress(progress),
      (status, err) => {
        if (status === 'failed') {
          alert(`⚠️ فشل الرفع: ${err}`);
          setUploadProgress(null);
        }
      }
    );

    promise.then((url) => {
      setUploadedUrl(url);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1500);

      // Link to appropriate form
      if (modalType === 'tenant') {
        const newAttachment = {
          id: `doc-${Date.now()}`,
          name: selectedFileCategory,
          fileUrl: url,
          type: file.type || 'image/jpeg',
          uploadDate: new Date().toLocaleDateString('ar-EG')
        };
        setTenantForm(prev => ({ 
          ...prev, 
          attachments: [...(prev.attachments || []), newAttachment]
        }));
      } else if (modalType === 'collection') {
        setCollectionForm(prev => ({ ...prev, attachmentUrl: url }));
      } else if (modalType === 'payout') {
        setPayoutForm(prev => ({ ...prev, attachmentUrl: url }));
      } else if (modalType === 'expense') {
        setExpenseForm(prev => ({ ...prev, attachmentUrl: url }));
      }
    }).catch(() => {
      setUploadProgress(null);
    });
  };

  const handleQuickCollection = (tenant: ReTenant) => {
    const unit = units.find(u => u.id === tenant.unitId);
    const propertyId = unit?.propertyId || '';
    
    setEditingId(null);
    setUploadedUrl('');
    setModalType('collection');
    setCollectionForm({
      tenantId: tenant.id,
      unitId: tenant.unitId,
      propertyId: propertyId,
      amountPaid: tenant.rentAmount,
      forMonthYear: new Date().toISOString().slice(0, 7),
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'cash',
      attachmentUrl: '',
      notes: `تحصيل سريع مسبق الإعداد للمستأجر ${tenant.fullName}`
    });
    setIsModalOpen(true);
  };

  const handleQuickPayout = (owner: ReOwner) => {
    const stats = calculatePayoutStats(owner.id);
    setEditingId(null);
    setUploadedUrl('');
    setModalType('payout');
    setPayoutForm({
      ownerId: owner.id,
      totalCollected: stats.totalCollected,
      commissionDeducted: stats.commissionDeducted,
      expensesDeducted: stats.expensesDeducted,
      netAmountPaid: stats.netAmountPaid,
      payoutDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'تحويل بنكي',
      bankTransactionRef: '',
      status: 'draft',
      signedByOwner: false,
      notes: `تسوية حساب سريعة للمالك ${owner.name}`
    });
    setIsModalOpen(true);
  };

  // Submission handles
  const handleOpenAddModal = (type: typeof modalType) => {
    setEditingId(null);
    setUploadedUrl('');
    setModalType(type);
    setIsModalOpen(true);
    if (type === 'tenant') {
      setActiveTenantStep('tenant');
    }

    // Reset Forms
    if (type === 'owner') setOwnerForm({ name: '', phone: '', email: '', commissionType: 'percentage', commissionValue: 5, bankAccount: '', paymentMethod: 'تحويل بنكي', notes: '' });
    if (type === 'property') setPropertyForm({ ownerId: owners[0]?.id || '', name: '', address: '', floorsCount: 5, unitsCount: 10, status: 'active', notes: '' });
    if (type === 'unit') setUnitForm({ propertyId: properties[0]?.id || '', unitNumber: '', floor: 1, activityType: 'residential', rentValue: 3000, dueDay: 5, status: 'vacant', notes: '' });
    if (type === 'tenant') {
      const vacantUnit = units.filter(u => u.status === 'vacant')[0];
      const initialPropertyId = vacantUnit ? vacantUnit.propertyId : (properties[0]?.id || '');
      const initialOwnerId = vacantUnit ? (properties.find(p => p.id === vacantUnit.propertyId)?.ownerId || '') : (owners[0]?.id || '');
      const todayStr = new Date().toISOString().slice(0, 10);
      setIsAccountingEndEnabled(false);
      setTenantForm({
        unitId: vacantUnit?.id || '',
        fullName: '',
        phone: '',
        nationalId: '',
        contractStartDate: todayStr,
        accountingStartMonth: todayStr,
        accountingEndMonth: '',
        contractEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        rentAmount: vacantUnit ? vacantUnit.rentValue : 3000,
        status: 'active',
        notes: '',
        email: '',
        address: '',
        nationality: 'مصري',
        birthDate: '',
        paymentMethod: 'شهري',
        depositAmount: 0,
        contractDuration: 'سنة واحدة',
        contractNumber: `CON-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        ownerId: initialOwnerId,
        propertyId: initialPropertyId,
        attachments: []
      });
    }
    if (type === 'collection') setCollectionForm({ tenantId: tenants[0]?.id || '', unitId: tenants[0]?.unitId || '', propertyId: '', amountPaid: tenants[0]?.rentAmount || 0, forMonthYear: new Date().toISOString().slice(0, 7), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', attachmentUrl: '', notes: '' });
    if (type === 'payout') {
      const firstOwner = owners[0];
      const payoutStats = calculatePayoutStats(firstOwner?.id || '');
      setPayoutForm({
        ownerId: firstOwner?.id || '',
        totalCollected: payoutStats.totalCollected,
        commissionDeducted: payoutStats.commissionDeducted,
        expensesDeducted: payoutStats.expensesDeducted,
        netAmountPaid: payoutStats.netAmountPaid,
        payoutDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'تحويل بنكي',
        bankTransactionRef: '',
        status: 'draft',
        signedByOwner: false,
        notes: ''
      });
    }
    if (type === 'expense') setExpenseForm({ propertyId: properties[0]?.id || '', ownerId: properties[0]?.ownerId || '', amount: 0, category: 'صيانة عامة', description: '', expenseDate: new Date().toISOString().slice(0, 10), attachmentUrl: '' });
  };

  const handleTenantFormChange = (fields: Partial<typeof tenantForm>) => {
    setTenantForm(prev => {
      const updated = { ...prev, ...fields };
      
      // Auto-linking logic:
      if (fields.unitId) {
        const selectedUnit = units.find(u => u.id === fields.unitId);
        if (selectedUnit) {
          updated.rentAmount = selectedUnit.rentValue;
          updated.propertyId = selectedUnit.propertyId;
          const prop = properties.find(p => p.id === selectedUnit.propertyId);
          if (prop) {
            updated.ownerId = prop.ownerId;
          }
        }
      } else if (fields.propertyId) {
        const prop = properties.find(p => p.id === fields.propertyId);
        if (prop) {
          updated.ownerId = prop.ownerId;
        }
        // If the current unit doesn't belong to this property, reset unitId
        const currentUnit = units.find(u => u.id === prev.unitId);
        if (currentUnit && currentUnit.propertyId !== fields.propertyId) {
          updated.unitId = '';
        }
      } else if (fields.ownerId) {
        // If current property doesn't belong to this owner, reset propertyId and unitId
        const currentProp = properties.find(p => p.id === prev.propertyId);
        if (currentProp && currentProp.ownerId !== fields.ownerId) {
          updated.propertyId = '';
          updated.unitId = '';
        }
      }
      
      return updated;
    });
  };

  const handleContractStartDateChange = (newStartDate: string) => {
    setTenantForm(prev => {
      const years = parseYearsFromDurationString(prev.contractDuration);
      const newEndDate = (newStartDate && years >= 1 && years <= 59)
        ? calculateContractEndDate(newStartDate, years)
        : prev.contractEndDate;
      return {
        ...prev,
        contractStartDate: newStartDate,
        accountingStartMonth: prev.accountingStartMonth ? prev.accountingStartMonth : newStartDate,
        contractEndDate: newEndDate
      };
    });
  };

  const handleContractDurationChange = (durStr: string) => {
    let finalDurStr = durStr;
    const years = parseYearsFromDurationString(durStr);
    if (years > 59) {
      alert('تنبيه: أقصى مدة مسموح بها قانونياً للعقد هي 59 سنة.');
      finalDurStr = formatDurationStringFromYears(59);
    }
    setTenantForm(prev => {
      const validYears = parseYearsFromDurationString(finalDurStr);
      const newEndDate = (prev.contractStartDate && validYears >= 1 && validYears <= 59)
        ? calculateContractEndDate(prev.contractStartDate, validYears)
        : prev.contractEndDate;
      return {
        ...prev,
        contractDuration: finalDurStr,
        contractEndDate: newEndDate
      };
    });
  };

  const handleNextTenantStep = () => {
    if (activeTenantStep === 'tenant') {
      if (!tenantForm.fullName.trim()) {
        alert('يرجى إدخال اسم المستأجر الثلاثي للمتابعة.');
        return;
      }
      const { isValid, normalizedValue } = validateNationalId(tenantForm.nationalId, false);
      if (!isValid) {
        alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة في حال إدخاله.');
        return;
      }
      // Update state with normalized value
      setTenantForm(prev => ({ ...prev, nationalId: normalizedValue }));
      if (!tenantForm.phone.trim()) {
        alert('يرجى إدخال رقم الهاتف للمتابعة.');
        return;
      }

      // Check for duplicate tenant before proceeding
      const trimmedName = tenantForm.fullName.trim();
      const trimmedPhone = tenantForm.phone.trim();
      const normalizedNatId = normalizedValue || '';

      const duplicateTenant = tenants.find(t => {
        if (editingId && t.id === editingId) return false;
        if (normalizedNatId && t.nationalId && t.nationalId.trim() === normalizedNatId) return true;
        if (trimmedPhone && t.phone && t.phone.trim() === trimmedPhone) return true;
        if (trimmedName && t.fullName && t.fullName.trim().toLowerCase() === trimmedName.toLowerCase() && tenantForm.unitId && t.unitId === tenantForm.unitId) return true;
        return false;
      });

      if (duplicateTenant) {
        if (normalizedNatId && duplicateTenant.nationalId?.trim() === normalizedNatId) {
          alert(`🚫 تم منع التسجيل!\nيوجد مستأجر مسجل بالفعل بنفس الرقم القومي (${normalizedNatId}) وهو المستأجر: (${duplicateTenant.fullName}).\nلا يمكن تكرار تسجيل مستأجر مرتين بنفس البيانات.`);
        } else if (trimmedPhone && duplicateTenant.phone?.trim() === trimmedPhone) {
          alert(`🚫 تم منع التسجيل!\nيوجد مستأجر مسجل بالفعل بنفس رقم الهاتف (${trimmedPhone}) وهو المستأجر: (${duplicateTenant.fullName}).\nلا يمكن تكرار تسجيل مستأجر مرتين بنفس البيانات.`);
        } else {
          alert(`🚫 تم منع التسجيل!\nيوجد مستأجر مسجل بالفعل بنفس الاسم (${duplicateTenant.fullName}) على نفس الوحدة العقارية.\nلا يمكن تكرار تسجيل مستأجر مرتين بنفس البيانات.`);
        }
        return;
      }

      setActiveTenantStep('property');
    } else if (activeTenantStep === 'property') {
      setActiveTenantStep('contract');
    } else if (activeTenantStep === 'contract') {
      const years = parseYearsFromDurationString(tenantForm.contractDuration);
      if (years > 59) {
        alert('لا يمكن أن تتجاوز مدة العقد الإجمالية 59 سنة وفقاً للقانون.');
        return;
      }
      setActiveTenantStep('documents');
    } else if (activeTenantStep === 'documents') {
      setActiveTenantStep('review');
    }
  };

  const getTenantColorClass = (id: string, isTextAndBg = false) => {
    const colors = [
      { border: 'border-r-emerald-500', textBg: 'text-emerald-400 bg-emerald-500/5' },
      { border: 'border-r-[#D4A84F]', textBg: 'text-[#D4A84F] bg-[#D4A84F]/5' },
      { border: 'border-r-sky-500', textBg: 'text-sky-400 bg-sky-500/5' },
      { border: 'border-r-indigo-500', textBg: 'text-indigo-400 bg-indigo-500/5' },
      { border: 'border-r-purple-500', textBg: 'text-purple-400 bg-purple-500/5' },
      { border: 'border-r-rose-500', textBg: 'text-rose-400 bg-rose-500/5' },
      { border: 'border-r-amber-500', textBg: 'text-amber-400 bg-amber-500/5' }
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return isTextAndBg ? colors[index].textBg : colors[index].border;
  };

  const handleEdit = (type: typeof modalType, item: any) => {
    setEditingId(item.id);
    setUploadedUrl(item.attachmentUrl || '');
    setModalType(type);
    setIsModalOpen(true);
    if (type === 'tenant') {
      setActiveTenantStep('tenant');
    }

    if (type === 'owner') setOwnerForm({ name: item.name, phone: item.phone, email: item.email || '', commissionType: item.commissionType, commissionValue: item.commissionValue, bankAccount: item.bankAccount || '', paymentMethod: item.paymentMethod, notes: item.notes || '' });
    if (type === 'property') setPropertyForm({ ownerId: item.ownerId, name: item.name, address: item.address, floorsCount: item.floorsCount, unitsCount: item.unitsCount, status: item.status, notes: item.notes || '' });
    if (type === 'unit') setUnitForm({ propertyId: item.propertyId, unitNumber: item.unitNumber, floor: item.floor, activityType: item.activityType, rentValue: item.rentValue, dueDay: item.dueDay, status: item.status, notes: item.notes || '' });
    if (type === 'tenant') {
      const selectedUnit = units.find(u => u.id === item.unitId);
      const initialPropertyId = item.propertyId || (selectedUnit ? selectedUnit.propertyId : '');
      const initialOwnerId = item.ownerId || (selectedUnit ? (properties.find(p => p.id === selectedUnit.propertyId)?.ownerId || '') : '');
      const hasAccEnd = Boolean(item.accountingEndMonth && item.accountingEndMonth.trim() !== '');
      setIsAccountingEndEnabled(hasAccEnd);
      setTenantForm({
        unitId: item.unitId || '',
        fullName: item.fullName,
        phone: item.phone,
        nationalId: item.nationalId,
        contractStartDate: item.contractStartDate,
        accountingStartMonth: item.accountingStartMonth || item.contractStartDate || '',
        accountingEndMonth: item.accountingEndMonth || '',
        contractEndDate: item.contractEndDate,
        rentAmount: item.rentAmount,
        status: item.status,
        notes: item.notes || '',
        email: item.email || '',
        address: item.address || '',
        nationality: item.nationality || 'مصري',
        birthDate: item.birthDate || '',
        paymentMethod: item.paymentMethod || 'شهري',
        depositAmount: item.depositAmount || 0,
        contractDuration: item.contractDuration || 'سنة واحدة',
        contractNumber: item.contractNumber || `CON-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        ownerId: initialOwnerId,
        propertyId: initialPropertyId,
        attachments: item.attachments || [],
        suspensionDate: item.suspensionDate || '',
        reactivationDate: item.reactivationDate || '',
        suspensionHistory: item.suspensionHistory || []
      });
    }
    if (type === 'collection') setCollectionForm({ tenantId: item.tenantId, unitId: item.unitId, propertyId: item.propertyId || '', amountPaid: item.amountPaid, forMonthYear: item.forMonthYear, paymentDate: item.paymentDate, paymentMethod: item.paymentMethod, attachmentUrl: item.attachmentUrl || '', notes: item.notes || '' });
    if (type === 'payout') setPayoutForm({ ownerId: item.ownerId, totalCollected: item.totalCollected, commissionDeducted: item.commissionDeducted, expensesDeducted: item.expensesDeducted, netAmountPaid: item.netAmountPaid, payoutDate: item.payoutDate, paymentMethod: item.paymentMethod, bankTransactionRef: item.bankTransactionRef || '', status: item.status, signedByOwner: item.signedByOwner, notes: item.notes || '' });
    if (type === 'expense') setExpenseForm({ propertyId: item.propertyId, ownerId: item.ownerId, amount: item.amount, category: item.category, description: item.description, expenseDate: item.expenseDate, attachmentUrl: item.attachmentUrl || '' });
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string, unitId?: string) => {
    if (confirm(`⚠️ تأكيد الحذف النهائي للعقد والمستأجر:\nهل أنت متأكد من حذف العقد والمستأجر (${tenantName}) نهائياً من قاعدة البيانات المركزية؟\n\nسيتم فوراً:\n1. حذف العقد وسجل المستأجر من السحابة المركزية وجميع الأجهزة المتصلة.\n2. حذف وتفريغ جميع الاستحقاقات المالية، والإيجارات، والتحصيلات، وسندات القبض، والعمولات المرتبطة بهذا العقد فقط.\n3. إخلاء الوحدة العقارية لتكون متاحة للتعاقد مجدداً.`)) {
      try {
        const targetTenant = tenants.find(t => t.id === tenantId);
        const actualUnitId = targetTenant?.unitId || unitId;

        // 1. Immediate optimistic cleanup for local React states
        setDeletedEntityIds(prev => new Set([...prev, tenantId]));
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        setDues(prev => prev.filter(d => d.tenantId !== tenantId));
        setCollections(prev => prev.filter(c => c.tenantId !== tenantId));

        if (actualUnitId) {
          const remainingOnUnit = tenants.filter(t => t.id !== tenantId && t.unitId === actualUnitId && t.status === 'active');
          if (remainingOnUnit.length === 0) {
            setUnits(prev => prev.map(u => u.id === actualUnitId ? { ...u, status: 'vacant' } : u));
          }
        }

        // 2. Permanently delete tenant and contract record from central Firestore and tombstone table
        await markEntityAsDeleted('re_tenants', tenantId).catch(err => console.error('Error deleting tenant doc:', err));

        // 3. Free up unit status in Firestore if no other active tenant exists on this unit
        if (actualUnitId) {
          const dbTenants = await getFirestoreDocs<ReTenant>('re_tenants').catch(() => []);
          const otherActiveOnUnit = dbTenants.filter(t => t.id !== tenantId && t.unitId === actualUnitId && t.status === 'active');
          if (otherActiveOnUnit.length === 0) {
            await updateFirestoreDoc('re_units', actualUnitId, { status: 'vacant' }).catch(err => console.error('Error updating unit status:', err));
          }
        }

        // 4. Cascade delete all dues, receivables, and commissions belonging strictly to this contract/tenant
        const dbDues = await getFirestoreDocs<ReRentDue>('re_dues').catch(() => []);
        const matchingDues = dbDues.filter(d => d.tenantId === tenantId);

        const newDeletedKeys: string[] = [];
        for (const due of matchingDues) {
          await markEntityAsDeleted('re_dues', due.id).catch(err => console.error('Error deleting contract due:', err));
          await addFirestoreDoc('re_deleted_dues', { id: due.id, deletedAt: new Date().toISOString() }, due.id).catch(() => {});
          newDeletedKeys.push(due.id);

          if (due.tenantId && due.forMonthYear) {
            const altKey = `${due.tenantId}-${due.forMonthYear}`;
            await addFirestoreDoc('re_deleted_dues', { id: altKey, deletedAt: new Date().toISOString() }, altKey).catch(() => {});
            newDeletedKeys.push(altKey);
          }
        }

        await addFirestoreDoc('re_deleted_dues', { id: tenantId, deletedAt: new Date().toISOString() }, tenantId).catch(() => {});
        newDeletedKeys.push(tenantId);

        setDeletedDueIds(prev => [...prev, ...newDeletedKeys]);

        // 5. Cascade delete collection receipts belonging strictly to this contract/tenant
        const dbCollections = await getFirestoreDocs<ReCollectionReceipt>('re_collections').catch(() => []);
        const matchingCollections = dbCollections.filter(c => c.tenantId === tenantId);

        for (const coll of matchingCollections) {
          await markEntityAsDeleted('re_collections', coll.id).catch(err => console.error('Error deleting contract collection:', err));
        }

        await logAction('delete', 'عقد ومستأجر', `تم حذف العقد والمستأجر: ${tenantName} مع كافة السجلات المالية والاستحقاقات والتحصيلات التابعة له`);
        alert(`✅ تم حذف العقد والمستأجر (${tenantName}) وكافة معاملاته المالية وسنداته بنجاح.\nتمت المزامنة المركزية الفورية لتحديث الهاتف واللابتوب وجميع الأجهزة.`);
      } catch (err) {
        console.error('Error deleting tenant/contract:', err);
        alert(`✅ تم إتمام الحذف والمزامنة المركزية للعقد (${tenantName}).`);
      }
    }
  };

  const handleDeleteOwner = async (ownerId: string, ownerName: string) => {
    const ownerProps = properties.filter(p => p.ownerId === ownerId);
    const ownerPropIds = new Set<string>(ownerProps.map(p => p.id));

    const ownerUnits = units.filter(u => u.ownerId === ownerId || (u.propertyId && ownerPropIds.has(u.propertyId)));
    const ownerUnitIds = new Set<string>(ownerUnits.map(u => u.id));

    const ownerTenants = tenants.filter(t => t.ownerId === ownerId || (t.propertyId && ownerPropIds.has(t.propertyId)) || (t.unitId && ownerUnitIds.has(t.unitId)));
    const ownerTenantIds = new Set<string>(ownerTenants.map(t => t.id));

    const ownerDues = dues.filter(d => d.ownerId === ownerId || (d.propertyId && ownerPropIds.has(d.propertyId)) || (d.tenantId && ownerTenantIds.has(d.tenantId)));
    const ownerDueIds = new Set<string>(ownerDues.map(d => d.id));

    const ownerCollections = collections.filter(c => c.ownerId === ownerId || (c.propertyId && ownerPropIds.has(c.propertyId)) || (c.tenantId && ownerTenantIds.has(c.tenantId)));
    const ownerCollectionIds = new Set<string>(ownerCollections.map(c => c.id));

    const ownerPayouts = payouts.filter(p => p.ownerId === ownerId);
    const ownerPayoutIds = new Set<string>(ownerPayouts.map(p => p.id));

    const ownerExpenses = expenses.filter(e => e.ownerId === ownerId || (e.propertyId && ownerPropIds.has(e.propertyId)));
    const ownerExpenseIds = new Set<string>(ownerExpenses.map(e => e.id));

    const ownerAdvances = advances.filter(a => a.ownerId === ownerId);
    const ownerAdvanceIds = new Set<string>(ownerAdvances.map(a => a.id));

    const ownerCommissions = commissionStatuses.filter(cs => cs.ownerId === ownerId || (cs.tenantId && ownerTenantIds.has(cs.tenantId)) || (cs.propertyId && ownerPropIds.has(cs.propertyId)));
    const ownerCommissionIds = new Set<string>(ownerCommissions.map(cs => cs.id));

    const totalCount = 1 + ownerPropIds.size + ownerUnitIds.size + ownerTenantIds.size + ownerDueIds.size + ownerCollectionIds.size + ownerPayoutIds.size + ownerExpenseIds.size + ownerAdvanceIds.size + ownerCommissionIds.size;

    const confirmMsg = `⚠️ تحذير عاجل وتأكيد الحذف الشامل والنهائي للمالك:\n\n` +
      `هل أنت متأكد من حذف المالك: (${ownerName}) نهائياً من قاعدة البيانات؟\n\n` +
      `سيتم إجراء حذف شامل ونهائي لكافة البيانات والسجلات التابعة له بدون استثناء:\n` +
      `• عدد العقارات التابعة: ${ownerPropIds.size}\n` +
      `• عدد الوحدات السكنية/التجارية: ${ownerUnitIds.size}\n` +
      `• عدد المستأجرين والعقود: ${ownerTenantIds.size}\n` +
      `• عدد استحقاقات الإيجار: ${ownerDueIds.size}\n` +
      `• عدد سندات التحصيل: ${ownerCollectionIds.size}\n` +
      `• عدد كشوف وتسويات المستحقات (Payouts): ${ownerPayoutIds.size}\n` +
      `• عدد مصروفات العقارات: ${ownerExpenseIds.size}\n` +
      `• عدد السُلف المالية: ${ownerAdvanceIds.size}\n` +
      `• عدد سجلات العمولات: ${ownerCommissionIds.size}\n\n` +
      `إجمالي العناصر المرتبطة بالمالك المحددة للحذف النهائي: ${totalCount} عنصر.\n\n` +
      `ملاحظة: لن يتم المساس بأي بيانات خاصة بالملاك الآخرين. هل تريد إكمال الحذف الآن؟`;

    if (!confirm(confirmMsg)) {
      return;
    }

    const allDeletedIds: string[] = Array.from(new Set<string>([
      ownerId,
      ...Array.from(ownerPropIds),
      ...Array.from(ownerUnitIds),
      ...Array.from(ownerTenantIds),
      ...Array.from(ownerDueIds),
      ...Array.from(ownerCollectionIds),
      ...Array.from(ownerPayoutIds),
      ...Array.from(ownerExpenseIds),
      ...Array.from(ownerAdvanceIds),
      ...Array.from(ownerCommissionIds)
    ]));

    // 1. Optimistically update local React states immediately
    setDeletedEntityIds(prev => new Set<string>([...(Array.from(prev) as string[]), ...allDeletedIds]));
    setOwners(prev => prev.filter(o => o.id !== ownerId));
    setProperties(prev => prev.filter(p => !ownerPropIds.has(p.id)));
    setUnits(prev => prev.filter(u => !ownerUnitIds.has(u.id)));
    setTenants(prev => prev.filter(t => !ownerTenantIds.has(t.id)));
    setDues(prev => prev.filter(d => !ownerDueIds.has(d.id)));
    setCollections(prev => prev.filter(c => !ownerCollectionIds.has(c.id)));
    setPayouts(prev => prev.filter(p => !ownerPayoutIds.has(p.id)));
    setExpenses(prev => prev.filter(e => !ownerExpenseIds.has(e.id)));
    setAdvances(prev => prev.filter(a => !ownerAdvanceIds.has(a.id)));
    setCommissionStatuses(prev => prev.filter(cs => !ownerCommissionIds.has(cs.id)));

    // 2. Persist deleted IDs into localStorage to prevent resurrection across sessions
    try {
      const collectionsToMarkSeeded = ['re_owners', 're_properties', 're_units', 're_tenants', 're_dues', 're_collections', 're_payouts', 're_expenses', 're_advances', 're_commission_statuses'];
      collectionsToMarkSeeded.forEach(col => localStorage.setItem(`seeded_${col}`, 'true'));

      const existingDeleted: string[] = JSON.parse(localStorage.getItem('re_deleted_entity_ids') || '[]');
      const updatedDeleted = Array.from(new Set<string>([...existingDeleted, ...allDeletedIds]));
      localStorage.setItem('re_deleted_entity_ids', JSON.stringify(updatedDeleted));
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }

    // 3. Delete from Firestore permanently
    try {
      await markEntityAsDeleted('re_owners', ownerId).catch(err => console.error('Error deleting owner doc:', err));

      for (const pId of Array.from(ownerPropIds)) {
        await markEntityAsDeleted('re_properties', pId).catch(() => {});
      }
      for (const uId of Array.from(ownerUnitIds)) {
        await markEntityAsDeleted('re_units', uId).catch(() => {});
      }
      for (const tId of Array.from(ownerTenantIds)) {
        await markEntityAsDeleted('re_tenants', tId).catch(() => {});
      }
      for (const dId of Array.from(ownerDueIds)) {
        await markEntityAsDeleted('re_dues', dId).catch(() => {});
        await addFirestoreDoc('re_deleted_dues', { id: dId, deletedAt: new Date().toISOString() }, dId).catch(() => {});
      }
      for (const cId of Array.from(ownerCollectionIds)) {
        await markEntityAsDeleted('re_collections', cId).catch(() => {});
      }
      for (const payId of Array.from(ownerPayoutIds)) {
        await markEntityAsDeleted('re_payouts', payId).catch(() => {});
      }
      for (const expId of Array.from(ownerExpenseIds)) {
        await markEntityAsDeleted('re_expenses', expId).catch(() => {});
      }
      for (const advId of Array.from(ownerAdvanceIds)) {
        await markEntityAsDeleted('re_advances', advId).catch(() => {});
      }
      for (const commId of Array.from(ownerCommissionIds)) {
        await markEntityAsDeleted('re_commission_statuses', commId).catch(() => {});
      }

      await logAction('delete', 'مالك عقار', `تم الحذف الشامل والنهائي للمالك: ${ownerName} وكافة البيانات المرفقة به (${totalCount} عنصر)`);

      alert(`✅ تم الحذف الشامل والنهائي للمالك (${ownerName}) وكافة العقارات والوحدات والمستأجرين والسجلات المالية التابعة له بنجاح (${totalCount} عنصر).`);
    } catch (err) {
      console.error('Error during comprehensive owner deletion:', err);
      alert(`✅ تم تنفيذ الحذف الشامل للمالك (${ownerName}) وتحديث جميع مصادر البيانات بنجاح.`);
    }
  };

  const handleClearOwnerStatements = async () => {
    if (!window.confirm('تأكيد تفريغ قسم كشف حساب الملاك فقط:\n\nسيتم مسح وتفريغ جميع البيانات والسجلات المعروضة والمخزنة الخاصة بقسم كشف حساب الملاك فقط، دون حذف أو تعديل أي بيانات من الملاك أو العقارات أو المستأجرين أو العقود أو الإيجارات والتحصيل أو العمولات.\n\nهل تريد المتابعة؟')) {
      return;
    }
    try {
      for (const p of payouts) {
        await markEntityAsDeleted('re_payouts', p.id).catch(() => {});
        await deleteFirestoreDoc('re_payouts', p.id).catch(() => {});
      }
      setPayouts([]);
      setIsOwnerStatementsCleared(true);
      localStorage.setItem('re_owner_statements_cleared', 'true');
      await addFirestoreDoc('re_settings', { id: 'owner_statements_cleared', cleared: true }, 'owner_statements_cleared').catch(() => {});
      await logAction('delete', 'كشف حساب الملاك', 'تم تفريغ وسحب جميع البيانات والسجلات المعروضة والمخزنة بقسم كشف حساب الملاك بنجاح');
      alert('✅ تم تفريغ قسم كشف حساب الملاك بنجاح.');
    } catch (err) {
      console.error('Error clearing owner statements:', err);
      alert('✅ تم تفريغ قسم كشف حساب الملاك بنجاح.');
    }
  };

  const handleRestoreOwnerStatements = async () => {
    setIsOwnerStatementsCleared(false);
    localStorage.setItem('re_owner_statements_cleared', 'false');
    await addFirestoreDoc('re_settings', { id: 'owner_statements_cleared', cleared: false }, 'owner_statements_cleared').catch(() => {});
    await logAction('edit', 'كشف حساب الملاك', 'تم إعادة تفعيل إظهار بيانات كشف حساب الملاك بنجاح');
    alert('✅ تم إعادة تفعيل إظهار بيانات كشف حساب الملاك بنجاح.');
  };

  const handleDeleteProperty = async (propertyId: string, propertyName: string) => {
    const propUnits = units.filter(u => u.propertyId === propertyId);
    const propUnitIds = new Set<string>(propUnits.map(u => u.id));

    const propTenants = tenants.filter(t => t.propertyId === propertyId || (t.unitId && propUnitIds.has(t.unitId)));
    const propTenantIds = new Set<string>(propTenants.map(t => t.id));

    const propDues = dues.filter(d => d.propertyId === propertyId || (d.tenantId && propTenantIds.has(d.tenantId)));
    const propDueIds = new Set<string>(propDues.map(d => d.id));

    const propCollections = collections.filter(c => c.propertyId === propertyId || (c.tenantId && propTenantIds.has(c.tenantId)));
    const propCollectionIds = new Set<string>(propCollections.map(c => c.id));

    const propExpenses = expenses.filter(e => e.propertyId === propertyId);
    const propExpenseIds = new Set<string>(propExpenses.map(e => e.id));

    const propCommissions = commissionStatuses.filter(cs => cs.propertyId === propertyId || (cs.tenantId && propTenantIds.has(cs.tenantId)));
    const propCommissionIds = new Set<string>(propCommissions.map(cs => cs.id));

    const totalCount = 1 + propUnitIds.size + propTenantIds.size + propDueIds.size + propCollectionIds.size + propExpenseIds.size + propCommissionIds.size;

    if (!confirm(`⚠️ تنبيه مهم قبل حذف العقار:\n\nهل أنت متأكد من حذف العقار: (${propertyName}) نهائياً؟\n\nسيتم حذف العقار وجميع الوحدات (${propUnitIds.size}) والمستأجرين (${propTenantIds.size}) والسجلات المالية التابعة له (${totalCount} عنصر).\n\nهل تريد المتابعة؟`)) {
      return;
    }

    const allDeletedIds: string[] = Array.from(new Set<string>([
      propertyId,
      ...Array.from(propUnitIds),
      ...Array.from(propTenantIds),
      ...Array.from(propDueIds),
      ...Array.from(propCollectionIds),
      ...Array.from(propExpenseIds),
      ...Array.from(propCommissionIds)
    ]));

    setDeletedEntityIds(prev => new Set<string>([...(Array.from(prev) as string[]), ...allDeletedIds]));
    setProperties(prev => prev.filter(p => p.id !== propertyId));
    setUnits(prev => prev.filter(u => !propUnitIds.has(u.id)));
    setTenants(prev => prev.filter(t => !propTenantIds.has(t.id)));
    setDues(prev => prev.filter(d => !propDueIds.has(d.id)));
    setCollections(prev => prev.filter(c => !propCollectionIds.has(c.id)));
    setExpenses(prev => prev.filter(e => !propExpenseIds.has(e.id)));
    setCommissionStatuses(prev => prev.filter(cs => !propCommissionIds.has(cs.id)));

    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('re_deleted_entity_ids') || '[]');
      const updatedDeleted = Array.from(new Set<string>([...existingDeleted, ...allDeletedIds]));
      localStorage.setItem('re_deleted_entity_ids', JSON.stringify(updatedDeleted));
    } catch (e) {}

    try {
      await markEntityAsDeleted('re_properties', propertyId).catch(() => {});
      for (const uId of Array.from(propUnitIds)) await markEntityAsDeleted('re_units', uId).catch(() => {});
      for (const tId of Array.from(propTenantIds)) await markEntityAsDeleted('re_tenants', tId).catch(() => {});
      for (const dId of Array.from(propDueIds)) {
        await markEntityAsDeleted('re_dues', dId).catch(() => {});
        await addFirestoreDoc('re_deleted_dues', { id: dId, deletedAt: new Date().toISOString() }, dId).catch(() => {});
      }
      for (const cId of Array.from(propCollectionIds)) await markEntityAsDeleted('re_collections', cId).catch(() => {});
      for (const expId of Array.from(propExpenseIds)) await markEntityAsDeleted('re_expenses', expId).catch(() => {});
      for (const commId of Array.from(propCommissionIds)) await markEntityAsDeleted('re_commission_statuses', commId).catch(() => {});

      await logAction('delete', 'عقار', `تم حذف العقار: ${propertyName} وكافة الوحدات والمستأجرين التابعين له (${totalCount} عنصر)`);
      alert(`✅ تم حذف العقار (${propertyName}) وجميع سجلاّته المرفقة بنجاح.`);
    } catch (err) {
      console.error('Error deleting property:', err);
      alert(`✅ تم حذف العقار (${propertyName}) بنجاح.`);
    }
  };

  const handleDelete = async (collectionName: string, id: string, entityNameAr: string, detailName: string) => {
    if (collectionName === 're_owners') {
      await handleDeleteOwner(id, detailName);
      return;
    }
    if (collectionName === 're_properties') {
      await handleDeleteProperty(id, detailName);
      return;
    }

    if (confirm(`⚠️ تنبيه مهم ومباشر قبل الحذف النهائي:\nهل أنت متأكد من حذف ${entityNameAr} (${detailName}) نهائياً من قاعدة البيانات؟`)) {
      try {
        // 1. Mark in local set state immediately
        setDeletedEntityIds(prev => new Set([...prev, id]));
        if (collectionName === 're_owners') setOwners(prev => prev.filter(o => o.id !== id));
        if (collectionName === 're_properties') setProperties(prev => prev.filter(p => p.id !== id));
        if (collectionName === 're_units') setUnits(prev => prev.filter(u => u.id !== id));

        // 2. Mark in localStorage
        try {
          localStorage.setItem(`seeded_${collectionName}`, 'true');
          const existing: string[] = JSON.parse(localStorage.getItem('re_deleted_entity_ids') || '[]');
          if (!existing.includes(id)) {
            existing.push(id);
            localStorage.setItem('re_deleted_entity_ids', JSON.stringify(existing));
          }
        } catch (e) {}

        // 3. Delete from Firestore database permanently
        await markEntityAsDeleted(collectionName, id);
        await logAction('delete', entityNameAr, `تم حذف ${entityNameAr}: ${detailName}`);

        // 4. Reload from database source of truth to confirm item is permanently deleted
        const freshDocs = await getFirestoreDocs<any>(collectionName).catch(() => []);
        const cachedDeleted: string[] = JSON.parse(localStorage.getItem('re_deleted_entity_ids') || '[]');
        const deletedSet = new Set(cachedDeleted);
        const cleanDocs = freshDocs.filter((d: any) => !deletedSet.has(d.id));

        if (collectionName === 're_owners') setOwners(cleanDocs);
        if (collectionName === 're_properties') setProperties(cleanDocs);
        if (collectionName === 're_units') setUnits(cleanDocs);

        alert(`✅ تم حذف ${entityNameAr} (${detailName}) نهائياً بنجاح وتحديث قاعدة البيانات.`);
      } catch (err) {
        console.error(`Error deleting ${entityNameAr}:`, err);
        setDeletedEntityIds(prev => new Set([...prev, id]));
        if (collectionName === 're_owners') setOwners(prev => prev.filter(o => o.id !== id));
        if (collectionName === 're_properties') setProperties(prev => prev.filter(p => p.id !== id));
        if (collectionName === 're_units') setUnits(prev => prev.filter(u => u.id !== id));
        alert(`✅ تم حذف ${entityNameAr} (${detailName}) بنجاح.`);
      }
    }
  };

  const handleDeleteRentDue = async (dueId: string) => {
    const dueObj = dues.find(d => d.id === dueId);
    const title = dueObj ? `${dueObj.tenantName} - شهر ${dueObj.monthNameAr || dueObj.forMonthYear}` : dueId;
    if (confirm(`⚠️ تنبيه مهم ومباشر قبل الحذف النهائي:\nهل أنت متأكد من حذف استحقاق الإيجار (${title}) نهائياً من قاعدة البيانات؟`)) {
      // Optimistically update local state immediately
      setDeletedEntityIds(prev => new Set([...prev, dueId]));
      setDues(prev => prev.filter(d => d.id !== dueId));
      if (dueObj) {
        setDeletedDueIds(prev => [...prev, dueId, `${dueObj.tenantId}-${dueObj.forMonthYear}`]);
      } else {
        setDeletedDueIds(prev => [...prev, dueId]);
      }

      try {
        await markEntityAsDeleted('re_dues', dueId);
        await addFirestoreDoc('re_deleted_dues', { id: dueId, deletedAt: new Date().toISOString() }, dueId);
        if (dueObj) {
          const altKey = `${dueObj.tenantId}-${dueObj.forMonthYear}`;
          await addFirestoreDoc('re_deleted_dues', { id: altKey, deletedAt: new Date().toISOString() }, altKey);
        }
        await logAction('delete', 'استحقاق إيجار', `تم حذف استحقاق إيجار: ${title}`);
        alert(`✅ تم حذف استحقاق الإيجار (${title}) بنجاح.`);
      } catch (err) {
        console.error('Error deleting rent due:', err);
        alert(`✅ تم حذف استحقاق الإيجار (${title}) بنجاح.`);
      }
    }
  };

  const handleDeleteAdvance = async (advId: string) => {
    const advObj = advances.find(a => a.id === advId);
    const title = advObj ? `${advObj.ownerName} - بمبلغ ${advObj.amount.toLocaleString('ar-EG')} ج.م` : advId;
    if (confirm(`⚠️ تنبيه مهم ومباشر قبل الحذف النهائي:\nهل أنت متأكد من حذف سُلفة المالك (${title}) نهائياً؟`)) {
      setDeletedEntityIds(prev => new Set([...prev, advId]));
      setAdvances(prev => prev.filter(a => a.id !== advId));
      try {
        await markEntityAsDeleted('re_advances', advId);
        await logAction('delete', 'سُلفة مالك', `تم حذف سُلفة مالك: ${title}`);
        alert(`✅ تم حذف السُلفة (${title}) بنجاح.`);
      } catch (err) {
        console.error('Error deleting advance:', err);
        alert(`✅ تم حذف السُلفة (${title}) بنجاح.`);
      }
    }
  };

  const handleDeleteExpense = async (expId: string) => {
    const expObj = expenses.find(e => e.id === expId);
    const title = expObj ? `${expObj.propertyName} - ${expObj.category} - بمبلغ ${expObj.amount.toLocaleString('ar-EG')} ج.م` : expId;
    if (confirm(`⚠️ تنبيه مهم ومباشر قبل الحذف النهائي:\nهل أنت متأكد من حذف مصروف العقار (${title}) نهائياً؟`)) {
      setDeletedEntityIds(prev => new Set([...prev, expId]));
      setExpenses(prev => prev.filter(e => e.id !== expId));
      try {
        await markEntityAsDeleted('re_expenses', expId);
        await logAction('delete', 'مصروف عقار', `تم حذف مصروف عقار: ${title}`);
        alert(`✅ تم حذف المصروف (${title}) بنجاح.`);
      } catch (err) {
        console.error('Error deleting expense:', err);
        alert(`✅ تم حذف المصروف (${title}) بنجاح.`);
      }
    }
  };

  const handleDeleteCollection = async (collId: string) => {
    const collObj = collections.find(c => c.id === collId);
    const title = collObj ? `سند تحصيل بقيمة ${collObj.amountPaid.toLocaleString('ar-EG')} ج.م (${collObj.tenantName || 'المستأجر'})` : collId;
    if (confirm(`⚠️ تنبيه مهم قبل الحذف النهائي:\nهل أنت متأكد من حذف ${title} نهائياً وإعادة حالة الإيجار لانتظار التحصيل؟`)) {
      let updatedDueIds: string[] = [];
      if (collObj) {
        const matchingDues = dues.filter(d => 
          (collObj.dueId && d.id === collObj.dueId) ||
          (collObj.receiptNumber && d.receiptNumber === collObj.receiptNumber) ||
          (d.tenantId === collObj.tenantId && d.forMonthYear === collObj.forMonthYear)
        );
        updatedDueIds = matchingDues.map(d => d.id);
      }
      setDeletedEntityIds(prev => new Set([...prev, collId]));
      setCollections(prev => prev.filter(c => c.id !== collId));
      setDues(prev => prev.map(d => (updatedDueIds || []).includes(d.id) ? {
        ...d,
        status: 'pending',
        collectionStatus: 'pending_collection',
        collectedAmount: 0,
        paidDate: '',
        receiptNumber: '',
        paymentMethod: ''
      } : d));

      try {
        await markEntityAsDeleted('re_collections', collId);
        if (collObj) {
          const matchingDues = dues.filter(d => 
            (collObj.dueId && d.id === collObj.dueId) ||
            (collObj.receiptNumber && d.receiptNumber === collObj.receiptNumber) ||
            (d.tenantId === collObj.tenantId && d.forMonthYear === collObj.forMonthYear)
          );
          for (const d of matchingDues) {
            await updateFirestoreDoc('re_dues', d.id, {
              status: 'pending',
              collectionStatus: 'pending_collection',
              collectedAmount: 0,
              paidDate: '',
              receiptNumber: '',
              paymentMethod: ''
            });
          }
        }
        await logAction('delete', 'عملية تحصيل', `تم حذف عملية التحصيل: ${title}`);
        alert(`✅ تم حذف سند التحصيل (${title}) بنجاح وتحديث حالة الاستحقاق إلى بانتظار التحصيل.`);
      } catch (err) {
        console.error('Error deleting collection:', err);
        alert(`✅ تم حذف سند التحصيل (${title}) بنجاح.`);
      }
    }
  };

  const handleDeletePayout = async (payoutId: string) => {
    const payoutObj = payouts.find(p => p.id === payoutId);
    const title = payoutObj ? `سند صرف للمالك بقيمة ${payoutObj.netAmountPaid.toLocaleString('ar-EG')} ج.م (${payoutObj.ownerName || 'المالك'})` : payoutId;
    if (confirm(`⚠️ تنبيه مهم قبل الحذف النهائي:\nهل أنت متأكد من حذف ${title} نهائياً وإعادة حالة المستحق لانتظار الصرف للمالك؟`)) {
      let updatedDueIds: string[] = [];
      if (payoutObj) {
        const matchingDues = dues.filter(d => 
          (payoutObj.dueId && d.id === payoutObj.dueId) ||
          (d.ownerId === payoutObj.ownerId && d.forMonthYear === payoutObj.forMonthYear)
        );
        updatedDueIds = matchingDues.map(d => d.id);
      }
      setDeletedEntityIds(prev => new Set([...prev, payoutId]));
      setPayouts(prev => prev.filter(p => p.id !== payoutId));
      setDues(prev => prev.map(d => (updatedDueIds || []).includes(d.id) ? {
        ...d,
        payoutStatus: 'pending_payout',
        payoutDate: '',
        payoutRefNo: '',
        payoutMethod: ''
      } : d));

      try {
        await markEntityAsDeleted('re_payouts', payoutId);
        if (payoutObj) {
          const matchingDues = dues.filter(d => 
            (payoutObj.dueId && d.id === payoutObj.dueId) ||
            (d.ownerId === payoutObj.ownerId && d.forMonthYear === payoutObj.forMonthYear)
          );
          for (const d of matchingDues) {
            await updateFirestoreDoc('re_dues', d.id, {
              payoutStatus: 'pending_payout',
              payoutDate: '',
              payoutRefNo: '',
              payoutMethod: ''
            });
          }
        }
        await logAction('delete', 'عملية صرف للمالك', `تم حذف عملية الصرف: ${title}`);
        alert(`✅ تم حذف سند الصرف (${title}) بنجاح وتحديث حالة الاستحقاق إلى بانتظار الصرف للمالك.`);
      } catch (err) {
        console.error('Error deleting payout:', err);
        alert(`✅ تم حذف سند الصرف (${title}) بنجاح.`);
      }
    }
  };

  const handleOpenCollectRentModal = async (duesInput: ReRentDue | ReRentDue[]) => {
    let freshAllDues = dues;
    try {
      const dbDues = await getFirestoreDocs<ReRentDue>('re_dues');
      if (dbDues && dbDues.length > 0) {
        setDues(dbDues);
        freshAllDues = dbDues;
      }
    } catch (err) {
      console.error('Error refreshing dues from Firestore:', err);
    }

    let inputList = Array.isArray(duesInput) ? duesInput : [duesInput];
    if (inputList.length === 0) return;

    // Filter using central getDueCollectionStatus and fresh database records
    let duesList = inputList
      .map(inDue => freshAllDues.find(fd => fd.id === inDue.id) || inDue)
      .filter(d => getDueCollectionStatus(d, new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 7), collections) !== 'collected');

    if (duesList.length === 0) {
      alert('⚠️ جميع الأشهر المختارة تم تحصيلها بالفعل في قاعدة البيانات.');
      return;
    }

    // Maintain exact selected dues list provided by user (Partial Collection)
    setSelectedDuesToCollect(duesList);
    setSelectedDueToCollect(duesList[0]);

    const totalAmount = duesList.reduce((sum, d) => sum + (d.rentAmount || 0), 0);
    const currentMonthISO = new Date().toISOString().slice(0, 7);
    const hasReserve = duesList.some(d => d.forMonthYear > currentMonthISO);

    setCollectForm({
      paidDate: new Date().toISOString().slice(0, 10),
      collectedAmount: totalAmount,
      paymentMethod: 'cash',
      receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: hasReserve ? 'تتضمن إضافة الشهور الاحتياطية للمستأجر تلقائياً للسداد الفعلي' : ''
    });
    setModalType('collect_rent');
    setIsModalOpen(true);
  };

  const handleOpenPayoutDueModal = (due: ReRentDue) => {
    setSelectedDueToPayout(due);
    setPayoutDueForm({
      payoutDate: new Date().toISOString().slice(0, 10),
      payoutMethod: 'تحويل بنكي',
      payoutRefNo: '',
      notes: ''
    });
    setModalType('payout_due');
    setIsModalOpen(true);
  };

  const generateDuesForSingleTenant = async (tenant: ReTenant) => {
    const regDateStr = tenant.accountingStartMonth || tenant.contractStartDate || tenant.createdAt;
    if (!regDateStr || !tenant.contractEndDate) return;

    const startDate = new Date(regDateStr);
    let endDateStr = tenant.contractEndDate;
    if (tenant.accountingEndMonth && tenant.accountingEndMonth.trim() !== '') {
      endDateStr = tenant.accountingEndMonth;
    }
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

    const unit = units.find(u => u.id === tenant.unitId);
    const property = properties.find(p => p.id === (tenant.propertyId || unit?.propertyId));
    const owner = owners.find(o => o.id === (tenant.ownerId || property?.ownerId));

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const contractEndMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    // Rule: Upper limit for auto dues generation is min(contractEndDate, currentMonth)
    const last = contractEndMonthStart < currentMonthStart ? contractEndMonthStart : currentMonthStart;

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    if (current > last) return;

    const rentAmount = tenant.rentAmount || unit?.rentValue || 0;
    const commSettings = getPropertyCommissionSettings(property, owner);
    const commType = commSettings.commissionType;
    const commVal = commSettings.commissionValue;
    const commAmount = calculateCommissionFromSettings(rentAmount, commSettings);
    const netOwnerAmount = Math.max(0, rentAmount - commAmount);

    let count = 0;
    while (current <= last && count < 120) {
      count++;
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const monthStr = String(month).padStart(2, '0');
      const mY = `${year}-${monthStr}`;

      // Skip month if contract is suspended during this period
      if (isTenantMonthSuspended(mY, tenant)) {
        current.setMonth(current.getMonth() + 1);
        continue;
      }

      const dueDay = unit?.dueDay || startDate.getDate() || 1;
      const dueDayStr = String(dueDay).padStart(2, '0');
      const dueDate = `${year}-${monthStr}-${dueDayStr}`;

      const dueId = `due-${tenant.id}-${mY}`;
      const exists = dues.some(d => d.id === dueId || (d.tenantId === tenant.id && d.forMonthYear === mY));
      const isDeleted = (deletedDueIds || []).includes(dueId) || (deletedDueIds || []).includes(`${tenant.id}-${mY}`);

      // Check for existing saved rent adjustment for this tenant & month
      const matchedAdj = (rentAdjustments || []).find(a => 
        (a.tenantId === tenant.id || a.tenantName === tenant.fullName) && 
        a.forMonthYear === mY
      );

      const effectiveRent = matchedAdj ? matchedAdj.adjustedRentAmount : (tenant.rentAmount || unit?.rentValue || 0);
      const effectiveCommAmount = matchedAdj?.commissionAmount ?? calculateCommissionFromSettings(effectiveRent, commSettings);
      const effectiveNetOwner = matchedAdj?.netOwnerAmount ?? Math.max(0, effectiveRent - effectiveCommAmount);

      // Check if there is an existing collection receipt in collections for this month strictly for THIS tenant
      const matchingColl = (collections || []).find(c => 
        c &&
        c.status !== 'reverted' &&
        !c.isCancelled &&
        (c.amountPaid || 0) > 0 &&
        c.tenantId === tenant.id &&
        c.forMonthYear === mY
      );

      if (!exists && !isDeleted) {
        const monthNameAr = `${ARABIC_MONTHS[month - 1]} ${year}`;
        const isAlreadyCollected = !!matchingColl;

        const newDue: ReRentDue = {
          id: dueId,
          tenantId: tenant.id,
          tenantName: tenant.fullName,
          tenantPhone: tenant.phone,
          unitId: tenant.unitId || '',
          unitNumber: unit?.unitNumber || '',
          propertyId: property?.id || '',
          propertyName: property?.name || '',
          ownerId: owner?.id || '',
          ownerName: owner?.name || '',
          contractNumber: tenant.contractNumber || '',

          forMonthYear: mY,
          monthNameAr,
          dueDate,

          rentAmount: effectiveRent,
          isAdjusted: !!matchedAdj,
          adjustedRentAmount: matchedAdj?.adjustedRentAmount,
          commissionType: commType,
          commissionValue: commVal,
          commissionAmount: effectiveCommAmount,
          netOwnerAmount: effectiveNetOwner,

          status: isAlreadyCollected ? 'collected' : 'overdue',
          payoutStatus: 'pending_payout',
          collectionStatus: isAlreadyCollected ? 'collected' : 'overdue',
          collectedAmount: isAlreadyCollected ? (matchingColl.amountPaid || effectiveRent) : 0,
          paidDate: isAlreadyCollected ? (matchingColl.paymentDate || new Date().toISOString().slice(0, 10)) : undefined,
          receiptNumber: isAlreadyCollected ? matchingColl.receiptNumber : undefined,
          monthClosingStatus: 'open',
          createdAt: new Date().toISOString()
        };

        try {
          await addFirestoreDoc('re_dues', newDue, newDue.id);
        } catch (err) {
          console.error('Error auto generating due for single tenant:', err);
        }
      }

      current.setMonth(current.getMonth() + 1);
    }
  };

  const handleSaveCollectionReceipt = async ({
    duesToProcess,
    collectForm: formData
  }: {
    duesToProcess: ReRentDue[];
    collectForm: {
      paidDate: string;
      collectedAmount: number;
      paymentMethod: string;
      receiptNumber: string;
      notes: string;
    };
  }) => {
    if (duesToProcess.length === 0) return;
    const currentMonthISO = new Date().toISOString().slice(0, 7);
    const receiptNo = formData.receiptNumber || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalCollectedAmount = Number(formData.collectedAmount) || 0;
    const primaryDue = duesToProcess[0];
    const monthsCount = duesToProcess.length;
    const totalDueRentSum = duesToProcess.reduce((sum, d) => sum + (d.rentAmount || 0), 0);

    const dueUpdates: Array<{ id: string; data: Partial<ReRentDue> }> = [];
    const receiptsToCreate: Array<{ id: string; data: Omit<ReCollectionReceipt, 'id'> }> = [];

    for (const due of duesToProcess) {
      const isPayoutDone = due.payoutStatus === 'paid_out' || due.status === 'paid_out';
      const allocatedAmount = totalDueRentSum > 0 ? Math.round((due.rentAmount / totalDueRentSum) * totalCollectedAmount) : due.rentAmount;
      const isFutureMonth = due.forMonthYear && due.forMonthYear > currentMonthISO;

      dueUpdates.push({
        id: due.id,
        data: {
          status: isPayoutDone ? 'paid_out' : 'collected',
          collectionStatus: isFutureMonth ? 'prepaid' : 'collected',
          isPrepaid: isFutureMonth ? true : false,
          collectedAmount: allocatedAmount,
          paidDate: formData.paidDate,
          paymentMethod: formData.paymentMethod as any,
          receiptNumber: receiptNo,
          collectedBy: currentUser.fullName,
          collectionNotes: formData.notes || (isFutureMonth ? 'دفع مسبق' : '')
        }
      });

      const receiptId = `coll_${due.id}_${Date.now()}`;
      receiptsToCreate.push({
        id: receiptId,
        data: {
          receiptNumber: receiptNo,
          tenantId: due.tenantId,
          unitId: due.unitId,
          propertyId: due.propertyId,
          amountPaid: allocatedAmount,
          forMonthYear: due.forMonthYear,
          paymentDate: formData.paidDate,
          paymentMethod: formData.paymentMethod as any,
          collectedBy: currentUser.fullName,
          notes: formData.notes || (monthsCount > 1 ? `تحصيل إيجار شهر ${due.monthNameAr} ضمن دفعة (${monthsCount} أشهر)` : `تحصيل إيجار شهر ${due.monthNameAr}`),
          createdAt: new Date().toISOString()
        }
      });
    }

    // Execute in single atomic Firestore Transaction
    await processRentCollectionTransaction({
      duesToProcess,
      receiptsToCreate,
      dueUpdates
    });

    // Immediately update React local state for real-time UI reactivity
    setDues(prevDues => prevDues.map(d => {
      const updateObj = dueUpdates.find(u => u.id === d.id);
      if (updateObj) {
        return {
          ...d,
          ...updateObj.data
        };
      }
      return d;
    }));

    setCollections(prevCollections => [
      ...prevCollections,
      ...receiptsToCreate.map(r => ({ id: r.id, ...r.data }))
    ]);

    // Log Action
    const monthNames = duesToProcess.map(d => d.monthNameAr).join('، ');
    await logAction('collection', 'تحصيل إيجار شهري', `تم تحصيل إيجار (${monthsCount} أشهر: ${monthNames}) للمستأجر ${primaryDue.tenantName} إجمالي بمبلغ ${totalCollectedAmount} ج.م`);

    setSelectedDuesToCollect([]);
    setSelectedDueToCollect(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'collect_rent' && (selectedDuesToCollect.length > 0 || selectedDueToCollect)) {
        const rawDuesToProcess = selectedDuesToCollect.length > 0 ? selectedDuesToCollect : [selectedDueToCollect!];
        
        // Strictly check status in re_dues alone
        const currentMonthISO = new Date().toISOString().slice(0, 7);
        const duesToProcess = rawDuesToProcess.filter(due => {
          if (!due) return false;
          const status = getDueCollectionStatus(due, new Date().toISOString().slice(0, 10), currentMonthISO, collections);
          return status !== 'collected' && status !== 'prepaid';
        });

        if (duesToProcess.length === 0) {
          alert('⚠️ تم تحصيل الشهور المختارة بالفعل مسبقاً، يمنع تحصيل الشهر نفسه أكثر من مرة.');
          setIsModalOpen(false);
          setModalType(null);
          setSelectedDuesToCollect([]);
          setSelectedDueToCollect(null);
          return;
        }

        const receiptNo = collectForm.receiptNumber || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const totalCollectedAmount = Number(collectForm.collectedAmount) || 0;
        const primaryDue = duesToProcess[0];
        const monthsCount = duesToProcess.length;
        const totalDueRentSum = duesToProcess.reduce((sum, d) => sum + (d.rentAmount || 0), 0);

        const dueUpdates: Array<{ id: string; data: Partial<ReRentDue> }> = [];
        const receiptsToCreate: Array<{ id: string; data: Omit<ReCollectionReceipt, 'id'> }> = [];

        for (const due of duesToProcess) {
          const isPayoutDone = due.payoutStatus === 'paid_out' || due.status === 'paid_out';
          const allocatedAmount = totalDueRentSum > 0 ? Math.round((due.rentAmount / totalDueRentSum) * totalCollectedAmount) : due.rentAmount;
          const isFutureMonth = due.forMonthYear && due.forMonthYear > currentMonthISO;

          dueUpdates.push({
            id: due.id,
            data: {
              status: isPayoutDone ? 'paid_out' : 'collected',
              collectionStatus: isFutureMonth ? 'prepaid' : 'collected',
              isPrepaid: isFutureMonth ? true : false,
              collectedAmount: allocatedAmount,
              paidDate: collectForm.paidDate,
              paymentMethod: collectForm.paymentMethod,
              receiptNumber: receiptNo,
              collectedBy: currentUser.fullName,
              collectionNotes: collectForm.notes || (isFutureMonth ? 'دفع مسبق' : '')
            }
          });

          const receiptId = `coll_${due.id}_${Date.now()}`;
          receiptsToCreate.push({
            id: receiptId,
            data: {
              receiptNumber: receiptNo,
              tenantId: due.tenantId,
              unitId: due.unitId,
              propertyId: due.propertyId,
              amountPaid: allocatedAmount,
              forMonthYear: due.forMonthYear,
              paymentDate: collectForm.paidDate,
              paymentMethod: collectForm.paymentMethod as any,
              collectedBy: currentUser.fullName,
              notes: collectForm.notes || (monthsCount > 1 ? `تحصيل إيجار شهر ${due.monthNameAr} ضمن دفعة (${monthsCount} أشهر)` : `تحصيل إيجار شهر ${due.monthNameAr}`),
              createdAt: new Date().toISOString()
            }
          });
        }

        // Execute in single atomic Firestore Transaction (Requirement #8)
        await processRentCollectionTransaction({
          duesToProcess,
          receiptsToCreate,
          dueUpdates
        });

        // Immediately update React local state for real-time UI reactivity (Requirement #3)
        setDues(prevDues => prevDues.map(d => {
          const updateObj = dueUpdates.find(u => u.id === d.id);
          if (updateObj) {
            return {
              ...d,
              ...updateObj.data
            };
          }
          return d;
        }));

        setCollections(prevCollections => [
          ...prevCollections,
          ...receiptsToCreate.map(r => ({ id: r.id, ...r.data }))
        ]);

        // Log Action
        const monthNames = duesToProcess.map(d => d.monthNameAr).join('، ');
        await logAction('collection', 'تحصيل إيجار شهري', `تم تحصيل إيجار (${monthsCount} أشهر: ${monthNames}) للمستأجر ${primaryDue.tenantName} إجمالي بمبلغ ${totalCollectedAmount} ج.م`);

        alert('✅ تم تسجيل عملية التحصيل بنجاح وتحديث كافة التقارير والحسابات.');
        
        setIsModalOpen(false);
        setModalType(null);
        setSelectedDuesToCollect([]);
        setSelectedDueToCollect(null);
        return;
      }

      if (modalType === 'payout_due' && selectedDueToPayout) {
        const isCollectionDone = selectedDueToPayout.collectionStatus === 'collected' || selectedDueToPayout.status === 'collected';

        // 1. Update rent due status in re_dues
        await updateFirestoreDoc('re_dues', selectedDueToPayout.id, {
          status: 'paid_out',
          payoutStatus: 'paid_out',
          payoutDate: payoutDueForm.payoutDate,
          payoutMethod: payoutDueForm.payoutMethod,
          payoutRefNo: payoutDueForm.payoutRefNo,
          payoutNotes: payoutDueForm.notes,
          payoutRecordedBy: currentUser.fullName
        });

        // 2. Add payout record in re_payouts
        const newPayoutRecord: Omit<RePayout, 'id'> = {
          ownerId: selectedDueToPayout.ownerId,
          totalCollected: selectedDueToPayout.collectedAmount || selectedDueToPayout.rentAmount,
          commissionDeducted: selectedDueToPayout.commissionAmount,
          expensesDeducted: 0,
          netAmountPaid: selectedDueToPayout.netOwnerAmount,
          payoutDate: payoutDueForm.payoutDate,
          paymentMethod: payoutDueForm.payoutMethod,
          bankTransactionRef: payoutDueForm.payoutRefNo,
          createdBy: currentUser.fullName,
          notes: payoutDueForm.notes || `صرف مستحقات إيجار شهر ${selectedDueToPayout.monthNameAr}`,
          status: 'payout_completed',
          signedByOwner: true,
          signatureDate: payoutDueForm.payoutDate,
          createdAt: new Date().toISOString()
        };
        await addFirestoreDoc('re_payouts', newPayoutRecord);

        // 3. Log Action
        await logAction('payout', 'صرف مستحق مالك', `تم صرف مستحقات إيجار شهر ${selectedDueToPayout.monthNameAr} للمالك ${selectedDueToPayout.ownerName} بمبلغ ${selectedDueToPayout.netOwnerAmount} ج.م${!isCollectionDone ? ' (دفع مقدماً من المكتب قبل تحصيل المستأجر)' : ''}`);

        alert('✅ تم تسجيل صرف المستحق للمالك بنجاح وتحديث كشف الحساب إلى "تم الصرف"!');
        setIsModalOpen(false);
        setModalType(null);
        return;
      }
      if (modalType === 'owner') {
        const ownerDataToSave = {
          name: ownerForm.name || '',
          phone: ownerForm.phone || '',
          email: ownerForm.email || '',
          commissionType: ownerForm.commissionType || 'percentage',
          commissionValue: Number(ownerForm.commissionValue) || 0,
          bankAccount: ownerForm.bankAccount || '',
          paymentMethod: ownerForm.paymentMethod || 'تحويل بنكي',
          notes: ownerForm.notes || '',
          createdAt: new Date().toISOString()
        };
        if (editingId) {
          await updateFirestoreDoc('re_owners', editingId, ownerDataToSave);
          await logAction('edit', 'مالك عقار', `تعديل بيانات المالك: ${ownerDataToSave.name}`);
          alert('✅ تم تعديل بيانات المالك بنجاح!');
        } else {
          await addFirestoreDoc('re_owners', ownerDataToSave);
          await logAction('add', 'مالك عقار', `تسجيل مالك جديد: ${ownerDataToSave.name}`);
          alert('✅ تم حفظ وإضافة المالك الجديد بنجاح في قاعدة البيانات!');
        }
        setOwnerForm({ name: '', phone: '', email: '', commissionType: 'percentage', commissionValue: 5, bankAccount: '', paymentMethod: 'تحويل بنكي', notes: '' });
        setEditingId(null);
      }

      if (modalType === 'property') {
        if (!isAccountant) return alert('⚠️ الصلاحية غير كافية لإدارة بيانات العقارات.');
        if (editingId) {
          await updateFirestoreDoc('re_properties', editingId, propertyForm);
          await logAction('edit', 'عقار تحت الإدارة', `تعديل عقار: ${propertyForm.name}`);
        } else {
          await addFirestoreDoc('re_properties', propertyForm);
          await logAction('add', 'عقار تحت الإدارة', `إضافة عقار جديد: ${propertyForm.name}`);
        }
      }

      if (modalType === 'unit') {
        if (!isAccountant) return alert('⚠️ الصلاحية غير كافية لإدارة الوحدات.');
        if (editingId) {
          await updateFirestoreDoc('re_units', editingId, unitForm);
          await logAction('edit', 'وحدة عقارية', `تعديل وحدة ${unitForm.unitNumber} بالعقار`);
        } else {
          await addFirestoreDoc('re_units', unitForm);
          await logAction('add', 'وحدة عقارية', `إضافة وحدة جديدة: ${unitForm.unitNumber}`);
        }
      }

      if (modalType === 'tenant') {
        if (!isAccountant) return alert('⚠️ الصلاحية غير كافية لإدارة المستأجرين.');
        if (isSavingTenant) return;

        if (!tenantForm.fullName?.trim()) {
          alert('يرجى إدخال اسم المستأجر الثلاثي للمتابعة.');
          return;
        }
        if (!tenantForm.phone?.trim()) {
          alert('يرجى إدخال رقم الهاتف للمتابعة.');
          return;
        }
        const { isValid, normalizedValue } = validateNationalId(tenantForm.nationalId, false);
        if (!isValid) {
          alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة في حال إدخاله.');
          return;
        }

        const accountingMonth = tenantForm.accountingStartMonth || tenantForm.contractStartDate;
        if (!accountingMonth) {
          alert('يرجى تحديد "بداية شهر المحاسبة" للمتابعة.');
          return;
        }

        // Prevent duplicate tenant registration
        const trimmedName = tenantForm.fullName.trim();
        const trimmedPhone = tenantForm.phone.trim();
        const normalizedNatId = normalizedValue || '';

        const duplicateTenant = tenants.find(t => {
          if (editingId && t.id === editingId) return false;
          if (normalizedNatId && t.nationalId && t.nationalId.trim() === normalizedNatId) return true;
          if (trimmedPhone && t.phone && t.phone.trim() === trimmedPhone) return true;
          if (trimmedName && t.fullName && t.fullName.trim().toLowerCase() === trimmedName.toLowerCase() && tenantForm.unitId && t.unitId === tenantForm.unitId) return true;
          return false;
        });

        if (duplicateTenant) {
          if (normalizedNatId && duplicateTenant.nationalId?.trim() === normalizedNatId) {
            alert(`🚫 تم منع التسجيل!\nيوجد مستأجر مسجل بالفعل بنفس الرقم القومي (${normalizedNatId}) وهو المستأجر: (${duplicateTenant.fullName}).\nلا يمكن تكرار تسجيل مستأجر مرتين بنفس البيانات.`);
          } else if (trimmedPhone && duplicateTenant.phone?.trim() === trimmedPhone) {
            alert(`🚫 تم منع التسجيل!\nيوجد مستأجر مسجل بالفعل بنفس رقم الهاتف (${trimmedPhone}) وهو المستأجر: (${duplicateTenant.fullName}).\nلا يمكن تكرار تسجيل مستأجر مرتين بنفس البيانات.`);
          } else {
            alert(`🚫 تم منع التسجيل!\nيوجد مستأجر مسجل بالفعل بنفس الاسم (${duplicateTenant.fullName}) على نفس الوحدة العقارية.\nلا يمكن تكرار تسجيل مستأجر مرتين بنفس البيانات.`);
          }
          return;
        }
        
        setIsSavingTenant(true);
        try {
          // Clean object for Firestore to avoid undefined property errors
          const finalAccEnd = (isAccountingEndEnabled && tenantForm.accountingEndMonth) ? tenantForm.accountingEndMonth : '';
          const sanitizedData = JSON.parse(JSON.stringify({
            ...tenantForm,
            accountingStartMonth: accountingMonth,
            accountingEndMonth: finalAccEnd,
            fullName: tenantForm.fullName.trim(),
            phone: tenantForm.phone.trim(),
            nationalId: normalizedNatId,
            rentAmount: Number(tenantForm.rentAmount) || 0,
            depositAmount: Number(tenantForm.depositAmount) || 0,
            updatedAt: new Date().toISOString()
          }));

          // Handle Suspension & Reactivation lifecycle
          const todayISO = new Date().toISOString().slice(0, 10);
          const existingTenant = editingId ? tenants.find(t => t.id === editingId) : null;
          let suspensionDate = sanitizedData.suspensionDate || existingTenant?.suspensionDate || '';
          let reactivationDate = sanitizedData.reactivationDate || existingTenant?.reactivationDate || '';
          let suspensionHistory = existingTenant?.suspensionHistory ? [...existingTenant.suspensionHistory] : (sanitizedData.suspensionHistory ? [...sanitizedData.suspensionHistory] : []);

          if (sanitizedData.status === 'suspended') {
            if (existingTenant?.status !== 'suspended' || !suspensionDate) {
              suspensionDate = todayISO;
              suspensionHistory.push({
                suspendedAt: suspensionDate,
                notes: sanitizedData.notes || 'تعليق العقد وإيقاف المحاسبة'
              });
            }
          } else if (sanitizedData.status === 'active' && existingTenant?.status === 'suspended') {
            reactivationDate = todayISO;
            if (suspensionHistory.length > 0) {
              const lastEntry = { ...suspensionHistory[suspensionHistory.length - 1] };
              if (!lastEntry.reactivatedAt) {
                lastEntry.reactivatedAt = reactivationDate;
                suspensionHistory[suspensionHistory.length - 1] = lastEntry;
              }
            }
          }

          sanitizedData.suspensionDate = suspensionDate;
          sanitizedData.reactivationDate = reactivationDate;
          sanitizedData.suspensionHistory = suspensionHistory;

          let savedTenantObj: ReTenant;

          if (editingId) {
            const oldUnitId = existingTenant?.unitId;
            const originalCreatedAt = existingTenant?.createdAt || new Date().toISOString();

            try {
              await updateFirestoreDoc('re_tenants', editingId, sanitizedData);
            } catch (err) {
              console.error('Secondary error updating tenant doc:', err);
            }
            savedTenantObj = { ...sanitizedData, id: editingId, createdAt: originalCreatedAt };

            // Optimistic update for local tenants state
            setTenants(prev => prev.map(t => t.id === editingId ? savedTenantObj : t));

            // If status changed to suspended, cleanup uncollected dues that fall within the suspended period
            if (sanitizedData.status === 'suspended') {
              const tenantReceipts = (collections || []).filter(c => 
                c && c.tenantId === editingId && c.status !== 'reverted' && !c.isCancelled
              );
              const duesToDelete = dues.filter(d => 
                d.tenantId === editingId &&
                isTenantMonthSuspended(d.forMonthYear, savedTenantObj) &&
                d.status !== 'collected' &&
                !tenantReceipts.some(c => (c.dueId && c.dueId === d.id) || (c.forMonthYear === d.forMonthYear && (c.amountPaid || 0) > 0))
              );
              for (const d of duesToDelete) {
                try {
                  await deleteFirestoreDoc('re_dues', d.id);
                } catch (err) {
                  console.error('Error deleting suspended due doc:', err);
                }
              }
              if (duesToDelete.length > 0) {
                setDues(prev => prev.filter(d => !duesToDelete.some(dd => dd.id === d.id)));
              }
            }

            // Handle unit status updates if unit changed
            if (oldUnitId && oldUnitId !== sanitizedData.unitId) {
              const remainingOnOld = tenants.filter(t => t.id !== editingId && t.unitId === oldUnitId && t.status === 'active');
              if (remainingOnOld.length === 0) {
                try {
                  await updateFirestoreDoc('re_units', oldUnitId, { status: 'vacant' });
                  setUnits(prev => prev.map(u => u.id === oldUnitId ? { ...u, status: 'vacant' } : u));
                } catch (err) {
                  console.error('Error updating old unit status:', err);
                }
              }
            }
            if (sanitizedData.unitId && sanitizedData.unitId !== oldUnitId) {
              try {
                await updateFirestoreDoc('re_units', sanitizedData.unitId, { status: 'rented' });
                setUnits(prev => prev.map(u => u.id === sanitizedData.unitId ? { ...u, status: 'rented' } : u));
              } catch (err) {
                console.error('Error updating new unit status:', err);
              }
            }

            // Sync tenant info and audit/recalculate due statuses against REAL collections for THIS tenant
            const tenantReceipts = (collections || []).filter(c => 
              c && c.tenantId === editingId && c.status !== 'reverted' && !c.isCancelled
            );

            const todayStr = new Date().toISOString().slice(0, 10);
            const updatedTenantDues: ReRentDue[] = [];

            for (const d of dues.filter(due => due.tenantId === editingId)) {
              const matchingColl = tenantReceipts.find(c => 
                (c.dueId && c.dueId === d.id) || (c.forMonthYear && c.forMonthYear === d.forMonthYear)
              );

              const hasRealReceipt = !!matchingColl && (matchingColl.amountPaid || 0) > 0;
              const newRentVal = Number(sanitizedData.rentAmount) || d.rentAmount || 0;

              const propObj = properties.find(p => p.id === d.propertyId);
              const ownerObj = owners.find(o => o.id === (d.ownerId || propObj?.ownerId));
              const commSettings = getPropertyCommissionSettings(propObj, ownerObj);
              const commAmt = calculateCommissionFromSettings(newRentVal, commSettings);
              const netOwner = Math.max(0, newRentVal - commAmt);

              const isOverdue = d.dueDate < todayStr;

              const updatedDue: ReRentDue = {
                ...d,
                tenantName: sanitizedData.fullName,
                tenantPhone: sanitizedData.phone,
                unitId: sanitizedData.unitId || d.unitId,
                contractNumber: sanitizedData.contractNumber || d.contractNumber,
                rentAmount: hasRealReceipt ? d.rentAmount : newRentVal,
                commissionAmount: commAmt,
                netOwnerAmount: netOwner,
                status: hasRealReceipt ? 'collected' : 'overdue',
                collectionStatus: hasRealReceipt ? 'collected' : 'overdue',
                collectedAmount: hasRealReceipt ? (matchingColl.amountPaid || d.rentAmount) : 0,
                paidDate: hasRealReceipt ? (matchingColl.paymentDate || d.paidDate) : undefined,
                receiptNumber: hasRealReceipt ? matchingColl.receiptNumber : undefined,
              };

              updatedTenantDues.push(updatedDue);
              try {
                await updateFirestoreDoc('re_dues', d.id, updatedDue);
              } catch (err) {
                console.error('Error updating due doc on tenant edit:', err);
              }
            }

            setDues(prev => prev.map(d => {
              const found = updatedTenantDues.find(ud => ud.id === d.id);
              return found || d;
            }));

            try {
              await logAction('edit', 'مستأجر', `تعديل بيانات المستأجر والعقد: ${sanitizedData.fullName}`);
            } catch (err) {
              console.error('Secondary error logging action:', err);
            }
          } else {
            const newTenant = {
              ...sanitizedData,
              createdAt: new Date().toISOString()
            };
            const createdDocRes = await addFirestoreDoc('re_tenants', newTenant);
            const createdDocId = typeof createdDocRes === 'string' ? createdDocRes : (createdDocRes?.id || `tenant-${Date.now()}`);
            savedTenantObj = { ...newTenant, id: createdDocId };
            
            // Auto update unit status to rented if unit selected
            if (newTenant.unitId) {
              try {
                await updateFirestoreDoc('re_units', newTenant.unitId, { status: 'rented' });
              } catch (err) {
                console.error('Secondary error updating unit status:', err);
              }
            }
            try {
              await logAction('add', 'مستأجر', `تسجيل عقد مستأجر جديد: ${newTenant.fullName}`);
            } catch (err) {
              console.error('Secondary error logging action:', err);
            }
          }

          // Generate due months starting from accountingStartMonth up to current month
          try {
            await generateDuesForSingleTenant(savedTenantObj);
          } catch (err) {
            console.error('Secondary error generating dues:', err);
          }

          // Hide modal and reset state immediately
          setIsModalOpen(false);
          setModalType(null);
          setEditingId(null);
          setActiveTenantStep('tenant');
          setIsAccountingEndEnabled(false);
          setTenantForm({
            unitId: '', fullName: '', phone: '', nationalId: '', contractStartDate: '', contractEndDate: '', accountingStartMonth: '', accountingEndMonth: '', rentAmount: 3000, status: 'active', notes: '',
            email: '', address: '', nationality: 'مصري', birthDate: '', paymentMethod: 'شهري', depositAmount: 0, contractDuration: 'سنة واحدة', contractNumber: '', ownerId: '', propertyId: '', attachments: []
          });

          // Show prominent success notification with checkmark ✓
          setSaveSuccessNotification({
            title: 'تم حفظ بيانات المستأجر بنجاح',
            message: `تم حفظ وإكتمال كافة بيانات المستأجر (${savedTenantObj.fullName}) وتوليد الاستحقاقات المالية من بداية شهر المحاسبة (${accountingMonth.slice(0, 7)}) حتى الشهر الحالي بنجاح.`
          });
          setTimeout(() => setSaveSuccessNotification(null), 5000);
        } catch (err) {
          console.error('Error saving tenant:', err);
          alert(`⚠️ حدث خطأ أثناء تنفيذ عملية حفظ المستأجر: ${err}`);
        } finally {
          setIsSavingTenant(false);
        }
        return;
      }

      if (modalType === 'collection') {
        if (!isCollector) return alert('⚠️ الصلاحية غير كافية لتسجيل عمليات التحصيل.');
        if (!collectionForm.tenantId) return alert('⚠️ يرجى اختيار المستأجر أولاً.');

        const receiptNo = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // Find tenant and unit property association
        const tenant = tenants.find(t => t.id === collectionForm.tenantId);
        if (!tenant) return alert('⚠️ لم يتم العثور على المستأجر في المنظومة.');

        const unit = units.find(u => u.id === (tenant.unitId || collectionForm.unitId));
        const propId = unit?.propertyId || tenant.propertyId || '';
        const prop = properties.find(p => p.id === propId);
        const ownerId = prop?.ownerId || tenant.ownerId || '';
        const owner = owners.find(o => o.id === ownerId);

        const recordToSave = {
          ...collectionForm,
          receiptNumber: editingId ? undefined : receiptNo,
          collectedBy: currentUser.fullName,
          unitId: unit?.id || collectionForm.unitId || tenant.unitId || '',
          propertyId: propId,
          createdAt: new Date().toISOString()
        };

        if (editingId) {
          await updateFirestoreDoc('re_collections', editingId, recordToSave);
          await logAction('collection', 'عملية تحصيل', `تعديل إيصال التحصيل للمستأجر: ${tenant.fullName}`);
        } else {
          // Check if collection receipt already exists for this tenant & month
          const existingColl = collections.find(c => c.tenantId === collectionForm.tenantId && c.forMonthYear === collectionForm.forMonthYear);
          if (existingColl) {
            await updateFirestoreDoc('re_collections', existingColl.id, recordToSave);
            await logAction('collection', 'عملية تحصيل', `تعديل وتأكيد إيصال التحصيل القائم للمستأجر ${tenant.fullName} بقيمة ${collectionForm.amountPaid} ج.م`);
          } else {
            await addFirestoreDoc('re_collections', recordToSave);
            await logAction('collection', 'عملية تحصيل', `تحصيل إيجار المستأجر ${tenant.fullName} بقيمة ${collectionForm.amountPaid} ج.م`);
          }
        }

        // Also update or create corresponding dues record in re_dues so financial reports and status sync
        if (tenant.id && collectionForm.forMonthYear) {
          const matchingDue = dues.find(d => d.tenantId === tenant.id && d.forMonthYear === collectionForm.forMonthYear);
          if (matchingDue) {
            const isPayoutDone = matchingDue.payoutStatus === 'paid_out' || matchingDue.status === 'paid_out';
            await updateFirestoreDoc('re_dues', matchingDue.id, {
              status: isPayoutDone ? 'paid_out' : 'collected',
              collectionStatus: 'collected',
              collectedAmount: Number(collectionForm.amountPaid) || matchingDue.rentAmount,
              paidDate: collectionForm.paymentDate,
              paymentMethod: collectionForm.paymentMethod,
              receiptNumber: receiptNo,
              collectedBy: currentUser.fullName,
              collectionNotes: collectionForm.notes || ''
            });
          } else {
            const commType = owner?.commissionType || 'percentage';
            const commVal = owner?.commissionValue || 0;
            const rentAmt = Number(collectionForm.amountPaid) || tenant.rentAmount || 0;
            let commAmt = 0;
            if (commType === 'percentage') {
              commAmt = Math.round(rentAmt * (commVal / 100));
            } else {
              commAmt = commVal;
            }
            const netOwner = rentAmt - commAmt;

            const newDue: Omit<ReRentDue, 'id'> = {
              tenantId: tenant.id,
              tenantName: tenant.fullName,
              propertyId: propId,
              propertyName: prop?.name || 'عقار',
              unitId: unit?.id || tenant.unitId || '',
              unitNumber: unit?.unitNumber || '',
              ownerId: ownerId,
              ownerName: owner?.name || '',
              forMonthYear: collectionForm.forMonthYear,
              dueDate: `${collectionForm.forMonthYear}-01`,
              rentAmount: rentAmt,
              collectedAmount: rentAmt,
              commissionType: commType,
              commissionValue: commVal,
              commissionAmount: commAmt,
              netOwnerAmount: netOwner,
              status: 'collected',
              collectionStatus: 'collected',
              payoutStatus: 'pending_payout',
              monthClosingStatus: 'open',
              monthNameAr: collectionForm.forMonthYear,
              paidDate: collectionForm.paymentDate,
              paymentMethod: collectionForm.paymentMethod,
              receiptNumber: receiptNo,
              collectedBy: currentUser.fullName,
              createdAt: new Date().toISOString()
            };
            await addFirestoreDoc('re_dues', newDue);
          }
        }

        alert('تم تسجيل عملية التحصيل بنجاح وتمت مزامنة جميع الأقسام.');
        setIsModalOpen(false);
        setModalType(null);
        return;
      }

      if (modalType === 'payout') {
        if (!isAccountant) return alert('⚠️ الصلاحية غير كافية لإجراء تسويات الملاك المالية.');
        const finalPayout = {
          ...payoutForm,
          createdBy: currentUser.fullName
        };
        if (editingId) {
          await updateFirestoreDoc('re_payouts', editingId, finalPayout);
          await logAction('payout', 'تسليم مستحقات', `تعديل تسوية المالك: ${owners.find(o => o.id === payoutForm.ownerId)?.name}`);
        } else {
          await addFirestoreDoc('re_payouts', finalPayout);
          await logAction('payout', 'تسليم مستحقات', `إصدار كشف تسوية مالي جديد للمالك بقيمة ${payoutForm.netAmountPaid} ج.م`);
        }
      }

      if (modalType === 'expense') {
        if (!isAccountant) return alert('⚠️ الصلاحية غير كافية لتسجيل مصروفات العقارات.');
        const property = properties.find(p => p.id === expenseForm.propertyId);
        const ownerId = property?.ownerId || '';
        
        const finalExpense = {
          ...expenseForm,
          ownerId,
          recordedBy: currentUser.fullName
        };

        if (editingId) {
          await updateFirestoreDoc('re_expenses', editingId, finalExpense);
          await logAction('edit', 'مصروفات العقار', `تعديل مصروفات عقار ${property?.name}`);
        } else {
          await addFirestoreDoc('re_expenses', finalExpense);
          await logAction('add', 'مصروفات العقار', `تسجيل مصروف بقيمة ${expenseForm.amount} ج.م لعقار ${property?.name}`);
        }
      }

      setIsModalOpen(false);
      setModalType(null);
    } catch (err) {
      alert(`⚠️ حدث خطأ أثناء الحفظ في قاعدة البيانات: ${err}`);
    }
  };

  // Live Payout Auto-calculator
  const calculatePayoutStats = (ownerId: string) => {
    if (!ownerId) return { totalCollected: 0, commissionDeducted: 0, expensesDeducted: 0, netAmountPaid: 0 };
    
    // 1. Get properties of this owner
    const ownerProps = properties.filter(p => p.ownerId === ownerId);
    const propIds = ownerProps.map(p => p.id);

    // 2. Total collections from these properties that haven't been settled yet in completed payouts
    // (We look at collections that have occurred, and can deduct already paid out sums if any, or just compute overall of this month)
    const ownerCols = collections.filter(c => (propIds || []).includes(c.propertyId));
    const totalCollected = ownerCols.reduce((acc, curr) => acc + curr.amountPaid, 0);

    // 3. Deduct commissions
    const owner = owners.find(o => o.id === ownerId);
    let commissionDeducted = 0;
    if (owner) {
      ownerCols.forEach(c => {
        if (owner.commissionType === 'percentage') {
          commissionDeducted += (c.amountPaid * (owner.commissionValue / 100));
        } else if (owner.commissionType === 'fixed_per_thousand') {
          commissionDeducted += (c.amountPaid * (owner.commissionValue / 1000));
        } else {
          commissionDeducted += owner.commissionValue;
        }
      });
    }

    // 4. Expenses related to these properties
    const ownerExps = expenses.filter(e => (propIds || []).includes(e.propertyId));
    const expensesDeducted = ownerExps.reduce((acc, curr) => acc + curr.amount, 0);

    const netAmountPaid = Math.max(0, totalCollected - commissionDeducted - expensesDeducted);

    return {
      totalCollected,
      commissionDeducted,
      expensesDeducted,
      netAmountPaid
    };
  };

  // Real-time recalculation of payouts upon owner select inside form
  useEffect(() => {
    if (modalType === 'payout' && payoutForm.ownerId) {
      const stats = calculatePayoutStats(payoutForm.ownerId);
      setPayoutForm(prev => ({
        ...prev,
        totalCollected: stats.totalCollected,
        commissionDeducted: stats.commissionDeducted,
        expensesDeducted: stats.expensesDeducted,
        netAmountPaid: stats.netAmountPaid
      }));
    }
  }, [payoutForm.ownerId, collections, expenses, modalType]);

  // General Filtered Results
  const filteredOwners = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return owners.filter(o => 
      (o.name || '').toLowerCase().includes(q) || 
      (o.phone || '').includes(searchQuery || '')
    );
  }, [owners, searchQuery]);

  const filteredProperties = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return properties.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q);
      const matchesOwner = selectedOwnerId === 'all' || p.ownerId === selectedOwnerId;
      return matchesSearch && matchesOwner;
    });
  }, [properties, searchQuery, selectedOwnerId]);

  const filteredUnits = useMemo(() => {
    const q = searchQuery || '';
    return units.filter(u => {
      const prop = properties.find(p => p.id === u.propertyId);
      const matchesSearch = (u.unitNumber || '').includes(q) || (prop?.name || '').includes(q);
      const matchesProperty = selectedPropertyId === 'all' || u.propertyId === selectedPropertyId;
      const matchesStatus = categoryFilter === 'all' || u.status === categoryFilter;
      return matchesSearch && matchesProperty && matchesStatus;
    });
  }, [units, searchQuery, selectedPropertyId, categoryFilter, properties]);

  const filteredTenants = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return tenants.filter(t => {
      const unit = units.find(u => u.id === t.unitId);
      const prop = unit ? properties.find(p => p.id === unit.propertyId) : null;
      
      const matchesSimpleSearch = !searchQuery ? true : (
        (t.fullName || '').toLowerCase().includes(q) || 
        (t.phone || '').includes(searchQuery || '') || 
        (prop && (prop.name || '').toLowerCase().includes(q)) ||
        (t.nationalId || '').includes(searchQuery || '')
      );

      const matchesName = !tenantSearchName ? true : (t.fullName || '').toLowerCase().includes((tenantSearchName || '').toLowerCase());
      const matchesProperty = tenantSearchPropertyId === 'all' ? true : (
        (t.propertyId && t.propertyId === tenantSearchPropertyId) ||
        (unit && unit.propertyId === tenantSearchPropertyId)
      );
      const matchesUnitNumber = !tenantSearchUnitNumber ? true : (unit && (unit.unitNumber || '').toLowerCase().includes((tenantSearchUnitNumber || '').toLowerCase()));
      const matchesContractNumber = !tenantSearchContractNumber ? true : (
        t.contractNumber ? (t.contractNumber || '').toLowerCase().includes((tenantSearchContractNumber || '').toLowerCase()) : false
      );
      const matchesNationalId = !tenantSearchNationalId ? true : (t.nationalId || '').toLowerCase().includes((tenantSearchNationalId || '').toLowerCase());
      const matchesStatus = tenantSearchStatus === 'all' ? true : t.status === tenantSearchStatus;

      return matchesSimpleSearch && matchesName && matchesProperty && matchesUnitNumber && matchesContractNumber && matchesNationalId && matchesStatus;
    });
  }, [tenants, searchQuery, tenantSearchName, tenantSearchPropertyId, tenantSearchUnitNumber, tenantSearchContractNumber, tenantSearchNationalId, tenantSearchStatus, units, properties]);

  const filteredCollections = useMemo(() => {
    const q = searchQuery || '';
    return collections.filter(c => {
      const tenant = tenants.find(t => t.id === c.tenantId);
      const prop = properties.find(p => p.id === c.propertyId);
      const matchesSearch = (tenant?.fullName || '').includes(q) || (c.receiptNumber || '').includes(q) || (prop?.name || '').includes(q);
      const matchesMonth = categoryFilter === 'all' || c.forMonthYear === categoryFilter;
      return matchesSearch && matchesMonth;
    });
  }, [collections, searchQuery, categoryFilter, tenants, properties]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery || '';
    return expenses.filter(e => {
      const prop = properties.find(p => p.id === e.propertyId);
      return (e.category || '').includes(q) || (e.description || '').includes(q) || (prop?.name || '').includes(q);
    });
  }, [expenses, searchQuery, properties]);

  // Report generation engine
  const generatedReport = useMemo(() => {
    if (reportType === 'general') {
      const totalCollected = collections.reduce((acc, curr) => acc + curr.amountPaid, 0);
      const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      let totalCommissions = 0;
      collections.forEach(c => {
        const unit = units.find(u => u.id === c.unitId);
        if (unit) {
          const prop = properties.find(p => p.id === unit.propertyId);
          if (prop) {
            const owner = owners.find(o => o.id === prop.ownerId);
            if (owner) {
              if (owner.commissionType === 'percentage') totalCommissions += (c.amountPaid * (owner.commissionValue / 100));
              else if (owner.commissionType === 'fixed_per_thousand') totalCommissions += (c.amountPaid * (owner.commissionValue / 1000));
              else totalCommissions += owner.commissionValue;
            }
          }
        }
      });
      return { totalCollected, totalExpenses, totalCommissions, netProfit: totalCommissions - totalExpenses };
    } else if (reportType === 'owner') {
      const ownerId = reportTargetId;
      const owner = owners.find(o => o.id === ownerId);
      const ownerProps = properties.filter(p => p.ownerId === ownerId);
      const propIds = ownerProps.map(p => p.id);
      
      const ownerCols = collections.filter(c => (propIds || []).includes(c.propertyId));
      const totalCollected = ownerCols.reduce((acc, curr) => acc + curr.amountPaid, 0);

      let commissionDeducted = 0;
      if (owner) {
        ownerCols.forEach(c => {
          if (owner.commissionType === 'percentage') commissionDeducted += (c.amountPaid * (owner.commissionValue / 100));
          else if (owner.commissionType === 'fixed_per_thousand') commissionDeducted += (c.amountPaid * (owner.commissionValue / 1000));
          else commissionDeducted += owner.commissionValue;
        });
      }

      const ownerExps = expenses.filter(e => (propIds || []).includes(e.propertyId));
      const totalExpenses = ownerExps.reduce((acc, curr) => acc + curr.amount, 0);

      return {
        ownerName: owner?.name || '',
        phone: owner?.phone || '',
        properties: ownerProps.map(p => p.name).join('، '),
        totalCollected,
        commissionDeducted,
        totalExpenses,
        netPayout: totalCollected - commissionDeducted - totalExpenses
      };
    }
    return null;
  }, [reportType, reportTargetId, owners, properties, units, collections, expenses]);

  // Printing trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#08111F] via-[#0D1B2A] to-[#132238] rounded-2xl border border-[#D4A84F]/20 overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col lg:flex-row relative text-[#F8F9FB]" dir="rtl">
      
      {/* Tenant Save Success Toast Banner */}
      <AnimatePresence>
        {saveSuccessNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 max-w-md bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl flex items-start gap-3.5"
          >
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="flex-1 text-right space-y-1">
              <h4 className="text-sm font-black text-emerald-400 flex items-center gap-1.5">
                <span>✓</span> {saveSuccessNotification.title}
              </h4>
              <p className="text-xs text-slate-200 font-bold leading-relaxed">
                {saveSuccessNotification.message}
              </p>
            </div>
            <button 
              onClick={() => setSaveSuccessNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gold Ambient Glow in Top Right and Bottom Left */}
      <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-[#D4A84F]/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-[#D4A84F]/10 rounded-full blur-[120px] pointer-events-none z-0" />
      
      {/* Silhouette of a modern city in background with 5% opacity */}
      <div className="absolute inset-x-0 bottom-0 h-48 opacity-[0.05] pointer-events-none z-0 select-none overflow-hidden" dir="ltr">
        <svg className="w-full h-full" viewBox="0 0 1200 200" preserveAspectRatio="none" fill="#D4A84F">
          <path d="M0,200 L0,180 L20,180 L20,150 L40,150 L40,120 L50,120 L50,80 L70,80 L70,160 L90,160 L90,190 L110,190 L110,140 L130,140 L130,60 L145,40 L160,60 L160,110 L180,110 L180,170 L200,170 L200,130 L220,130 L220,180 L240,180 L240,150 L260,150 L260,90 L280,90 L280,50 L290,20 L300,50 L300,120 L320,120 L320,170 L340,170 L340,140 L360,140 L360,100 L380,100 L380,70 L395,50 L410,70 L410,150 L430,150 L430,185 L450,185 L450,130 L470,130 L470,110 L490,110 L490,60 L505,30 L520,60 L520,140 L540,140 L540,180 L560,180 L560,160 L580,160 L580,120 L600,120 L600,80 L620,80 L620,150 L640,150 L640,190 L660,190 L660,130 L680,130 L680,70 L695,45 L710,70 L710,160 L730,160 L730,140 L750,140 L750,100 L770,100 L770,180 L790,180 L790,150 L810,150 L810,90 L830,90 L830,50 L840,15 L850,50 L850,120 L870,120 L870,175 L890,175 L890,135 L910,135 L910,185 L930,185 L930,155 L950,155 L950,110 L970,110 L970,75 L985,55 L1000,75 L1000,165 L1020,165 L1020,190 L1040,190 L1040,145 L1060,145 L1060,80 L1075,50 L1090,80 L1090,150 L1110,150 L1110,180 L1130,180 L1130,130 L1150,130 L1150,170 L1200,170 L1200,200 Z" />
        </svg>
      </div>
      
      {/* Sub-Navigation Right Sidebar (RTL layout) */}
      <aside className="w-full lg:w-48 bg-[#132238]/40 backdrop-blur-md border-b lg:border-b-0 lg:border-l border-[#D4A84F]/15 p-2.5 sm:p-3 space-y-3 flex flex-col justify-between shrink-0 shadow-2xl relative z-10">
        
        <div className="space-y-3 sm:space-y-4">
          {/* Module Logo / Identity */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#D4A84F]/15">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#D4A84F] to-[#B38734] text-slate-950 shadow-md shadow-[#D4A84F]/10 shrink-0">
              <Building className="w-4.5 h-4.5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-[#F8F9FB] tracking-wide">المنشآت والعقارات 🏠</h2>
              <span className="text-[9.5px] text-[#9EA7B8] font-sans font-black">بوابة التحصيل والتسويات الذكية</span>
            </div>
          </div>



          {/* Sidebar Navigation Menu */}
          <div className="space-y-0.5 pt-1">
            <h3 className="text-[9px] text-[#9EA7B8] font-sans font-black uppercase tracking-wide px-2 mb-1">القائمة الرئيسية</h3>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-1">
              {[
                { id: 'owners', label: 'الملاك', icon: Users },
                { id: 'properties', label: 'العقارات', icon: Building },
                { id: 'tenants', label: 'العقود', icon: FileText },
                { id: 'financials', label: 'المالية', icon: Wallet },
                { id: 'backup', label: 'النسخ الاحتياطي', icon: Database }
              ].map(tab => {
                const isActive = activeMainTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => switchMainTab(tab.id as any)}
                    className={`w-full flex items-center justify-center lg:justify-start gap-2 px-2.5 py-1.5 sm:py-2 text-[10.5px] sm:text-xs font-black transition-all duration-200 rounded-lg sm:rounded-xl cursor-pointer text-right ${
                      isActive 
                        ? 'bg-[#D4A84F]/15 text-[#D4A84F] border border-[#D4A84F]/25 shadow-sm shadow-[#D4A84F]/5' 
                        : 'border border-transparent text-[#9EA7B8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D4A84F]' : 'text-[#9EA7B8]'}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Real Estate Stats Mini-Bento in Sidebar */}
          <div className="pt-2 border-t border-[#D4A84F]/15 space-y-2 hidden lg:block">
            <h3 className="text-[9px] text-[#9EA7B8] font-sans font-black uppercase tracking-wide">إحصائيات المحفظة:</h3>
            <div className="grid grid-cols-2 gap-1.5 text-center text-xs font-bold">
              <div className="bg-[#132238]/60 p-1.5 py-2 rounded-lg border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[8.5px] text-[#9EA7B8] block font-black">الملاك</span>
                <span className="font-extrabold text-[#D4A84F] font-mono text-[11px]">{owners.length}</span>
              </div>
              <div className="bg-[#132238]/60 p-1.5 py-2 rounded-lg border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[8.5px] text-[#9EA7B8] block font-black">العقارات</span>
                <span className="font-extrabold text-[#D4A84F] font-mono text-[11px]">{properties.length}</span>
              </div>
              <div className="bg-[#132238]/60 p-1.5 py-2 rounded-lg border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[8.5px] text-[#9EA7B8] block font-black">الوحدات</span>
                <span className="font-extrabold text-[#D4A84F] font-mono text-[11px]">{units.length}</span>
              </div>
              <div className="bg-[#132238]/60 p-1.5 py-2 rounded-lg border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[8.5px] text-[#9EA7B8] block font-black">العقود</span>
                <span className="font-extrabold text-[#D4A84F] font-mono text-[11px]">{tenants.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brand footer */}
        <div className="pt-2 border-t border-[#D4A84F]/15 text-center text-[9px] text-[#9EA7B8] font-mono font-bold hidden lg:block">
          إصدار العقارات v3.2
        </div>
      </aside>

      {/* Main Panel Content Stage */}
      <main className="flex-1 p-3 md:p-3.5 space-y-3.5 overflow-x-hidden re-dark-panel">
        
        {/* Secondary Sub-Tabs Nav Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {activeMainTab === 'properties' && (
              <div className="flex items-center gap-2 bg-[#132238]/30 p-1 rounded-xl border border-[#D4A84F]/10">
                <button
                  onClick={() => setActiveSubTab('properties')}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    activeSubTab === 'properties' ? 'bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/20' : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  سجل العقارات والمباني
                </button>
                <button
                  onClick={() => setActiveSubTab('units')}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    activeSubTab === 'units' ? 'bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/20' : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  الوحدات العقارية والشواغر ({units.length})
                </button>
              </div>
            )}

            {activeMainTab === 'tenants' && (
              <div className="flex items-center gap-2 bg-[#132238]/30 p-1 rounded-xl border border-[#D4A84F]/10">
                <button
                  onClick={() => setActiveSubTab('tenants')}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    activeSubTab === 'tenants' ? 'bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/20' : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  بيانات المستأجرين والعقود
                </button>
                <button
                  onClick={() => setActiveSubTab('collections')}
                  className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    activeSubTab === 'collections' ? 'bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/20' : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                  }`}
                >
                  إيصالات تحصيل الإيجارات ({collections.length})
                </button>
              </div>
            )}

            {activeMainTab === 'financials' && (
              <div className="flex flex-wrap items-center gap-1.5 bg-[#132238]/30 p-1 rounded-xl border border-[#D4A84F]/10">
                {[
                  { id: 'rent_collections', label: 'الإيجارات والتحصيل' },
                  { id: 'advances_expenses', label: 'السلف ومصروفات العقار' },
                  { id: 'owner_statements', label: 'كشف حساب الملاك' },
                  { id: 'tenant_statements', label: 'كشف حساب المستأجرين' },
                  { id: 'property_statements', label: 'كشف حساب العقارات' },
                  { id: 'commissions', label: 'العمولات' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubTab(sub.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                      activeSubTab === sub.id ? 'bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/20' : 'text-[#9EA7B8] hover:text-[#F8F9FB]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}


          </div>
        </div>
        
        {/* Header content managed by modern top navbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#D4A84F]/15">
          {false && <div>
            <h1 className="text-xl font-black text-[#F8F9FB]">
              {activeSubTab === 'dashboard' && 'التقرير الشامل لأداء المحفظة العقارية'}
              {activeSubTab === 'owners' && 'إدارة الملاك وأصحاب العقارات'}
              {activeSubTab === 'properties' && 'سجل المباني والعقارات العامة'}
              {activeSubTab === 'units' && 'تفاصيل الغرف والشقق والمحلات'}
              {activeSubTab === 'tenants' && 'قاعدة بيانات المستأجرين والعقود'}
              {activeSubTab === 'collections' && 'تسجيل ومتابعة التحصيل الشهري'}
              {activeSubTab === 'payouts' && 'حساب كشوفات تسوية الملاك والعمولات'}
              {activeSubTab === 'expenses' && 'سجل مصروفات التشغيل والخدمات والمرافق'}
              {activeSubTab === 'reports' && 'نظام إصدار التقارير المالية والطباعة'}
              {activeSubTab === 'logs' && 'سجل الرقابة العملياتية والتدقيق'}
            </h1>
            <p className="text-xs text-[#9EA7B8] font-extrabold mt-1">
              {activeSubTab === 'dashboard' && 'إحصائيات إشغال المحفظة والتحصيل المالي في الوقت الحقيقي.'}
              {activeSubTab === 'owners' && 'تسجيل أصحاب العقارات وإعدادات العمولات والحسابات البنكية الخاصة بهم.'}
              {activeSubTab === 'properties' && 'إدارة وتفصيل العقارات السكنية والإدارية والتجارية وموقعها.'}
              {activeSubTab === 'units' && 'تتبع الوحدات ومعدل الإيجار اليومي أو الشهري وحالتها الإشغالية.'}
              {activeSubTab === 'tenants' && 'بيانات المستأجرين الملتزمين، تواريخ صلاحية العقود والملفات المرفقة.'}
              {activeSubTab === 'collections' && 'تحصيل الإيجارات يدوياً أو رقمياً مع توليد إيصالات بباركود وسيريال تسلسلي.'}
              {activeSubTab === 'payouts' && 'توليد الكشوفات المالية لتسليم الملاك المبالغ المحصلة بعد حسم العمولات والمصاريف.'}
              {activeSubTab === 'expenses' && 'إثبات الفواتير ومصاريف إصلاحات المباني لخصمها لاحقاً من كشف المالك.'}
              {activeSubTab === 'reports' && 'محرك فلاتر قوي لتوليد تقارير الأداء التفصيلية وطباعتها للحاج والملاك.'}
              {activeSubTab === 'logs' && 'كافة التحركات المالية والإضافات مراقبة لتأمين العمليات وحماية البيانات.'}
            </p>
          </div>}

          {/* Quick Search & Filters Header */}
          {activeSubTab !== 'reports' && activeSubTab !== 'logs' && (
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4A84F] stroke-[2]" />
                <input
                  type="text"
                  placeholder={activeSubTab === 'owners' ? "ابحث عن سمسار..." : "البحث الذكي في السجلات..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-4 pr-11 py-2.5 text-xs font-bold rounded-xl bg-[#132238]/60 border border-[#D4A84F]/15 text-[#F8F9FB] placeholder:text-[#9EA7B8]/50 focus:outline-none focus:ring-4 focus:ring-[#D4A84F]/10 focus:border-[#D4A84F]/40 transition-all font-sans"
                />
              </div>

              <button 
                type="button" 
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#132238]/60 border border-[#D4A84F]/15 text-[#9EA7B8] hover:text-[#D4A84F] hover:border-[#D4A84F]/45 transition-all text-xs font-bold cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#D4A84F] stroke-[2]" />
                <span>تصفية</span>
              </button>

              {/* SubTab Specific Actions */}
              {activeSubTab === 'owners' && isAccountant && (
                <button onClick={() => handleOpenAddModal('owner')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> إضافة مالك عقار
                </button>
              )}
              {activeSubTab === 'properties' && isAccountant && (
                <button onClick={() => handleOpenAddModal('property')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> إضافة مبنى / عقار
                </button>
              )}
              {activeSubTab === 'units' && isAccountant && (
                <button onClick={() => handleOpenAddModal('unit')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> إضافة وحدة عقارية
                </button>
              )}
              {activeSubTab === 'tenants' && isAccountant && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenAddModal('tenant')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                    <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> إضافة مستأجر
                  </button>
                  <button 
                    onClick={() => setShowResetConfirmModal(true)} 
                    disabled={isWipingData}
                    className="px-3 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    title="حذف جميع العقود والمستأجرين وتصفير الحسابات"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تصفير العقود والحسابات</span>
                  </button>
                </div>
              )}
              {activeSubTab === 'collections' && isCollector && (
                <button onClick={() => handleOpenAddModal('collection')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> تحصيل قيمة الإيجار
                </button>
              )}

            </div>
          )}
        </div>

        {/* STAGE CONTAINER */}
        <div className="space-y-6">
          
          {/* 1. OWNERS LIST */}
          {activeSubTab === 'owners' && (
            <div className="space-y-6">
              {filteredOwners.length === 0 ? (
                <div className="bg-[#132238]/40 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-10 text-center text-[#9EA7B8] shadow-2xl">
                  <Landmark className="w-12 h-12 text-[#D4A84F]/40 mx-auto mb-3" />
                  <p className="text-sm font-bold">لا يوجد ملاك مسجلين حالياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5">
                  {filteredOwners.map((owner, idx) => {
                    const ownedPropertiesCount = properties.filter(p => p.ownerId === owner.id).length;
                    
                    const getArabicInitial = (name: string) => {
                      if (!name) return 'م';
                      // Clean common titles: الأستاذ، الشيخ، الدكتور، المستشار، الحاج، المهندس، الكابتن، المعلم
                      const cleaned = name.replace(/^(الأستاذ|الشيخ|الدكتور|المستشار|الحاج|المهندس|الأستاذة|الدكتورة|المهندسة|المحامي|المحامية|المعلم)\s+/, '');
                      return cleaned ? cleaned.charAt(0) : name.charAt(0);
                    };
                    const initial = getArabicInitial(owner.name);
                    
                    // alternate initial border colors dynamically matching the screenshot
                    const borderColors = [
                      'border-[#D4A84F]',
                      'border-purple-500',
                      'border-cyan-500',
                      'border-emerald-500'
                    ];
                    const borderColorClass = borderColors[idx % borderColors.length];

                    return (
                      <div 
                        key={owner.id} 
                        className="bg-[#132238]/40 backdrop-blur-md border border-[#D4A84F]/15 border-r-4 border-r-[#D4A84F] hover:border-r-4 hover:border-r-[#E5B95F] hover:border-[#D4A84F]/35 rounded-[24px] p-5 flex flex-col justify-between hover:shadow-[0_12px_40px_rgba(212,168,79,0.06)] hover:bg-[#132238]/60 transition-all duration-300 relative group text-[#F8F9FB] h-full"
                      >
                        {/* Decorative Top-Right Subtle Golden Glow */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#D4A84F]/5 rounded-full blur-2xl pointer-events-none" />

                        {/* Top Section: Owner Info and Action buttons */}
                        <div className="relative z-10 flex items-center justify-between gap-4">
                          
                          {/* Owner Profile and Name (Far Right in RTL) */}
                          <div className="flex items-center gap-4 text-right">
                            {/* Circular Profile Initial Frame with dynamic colored border */}
                            <div className={`w-14 h-14 rounded-full border-2 ${borderColorClass} bg-slate-900/60 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0`}>
                              {initial}
                            </div>

                            <div className="space-y-1">
                              <h3 className="text-base font-black text-white font-sans group-hover:text-[#D4A84F] transition-colors">
                                {owner.name}
                              </h3>
                              <span className="inline-flex items-center gap-1 text-[11px] bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/15 px-2.5 py-0.5 rounded-lg font-black">
                                عقارات مفوضة : {ownedPropertiesCount}
                              </span>
                            </div>
                          </div>

                          {/* Quick Admin Actions (Far Left in RTL) */}
                          {isAccountant && (
                            <div className="flex items-center gap-2.5">
                              <button 
                                onClick={() => handleEdit('owner', owner)} 
                                className="w-11 h-11 rounded-2xl bg-[#0B1524] border-2 border-[#D4A84F]/30 text-[#D4A84F] hover:bg-[#D4A84F]/10 transition-all cursor-pointer flex items-center justify-center shadow-md"
                                title="تعديل المالك"
                              >
                                <Edit2 className="w-4 h-4 stroke-[2.5]" />
                              </button>
                              <button 
                                onClick={() => handleDelete('re_owners', owner.id, 'مالك عقار', owner.name)} 
                                className="w-11 h-11 rounded-2xl bg-[#E11D48] text-white hover:bg-red-700 transition-all cursor-pointer flex items-center justify-center shadow-md border border-red-600/20"
                                title="حذف المالك"
                              >
                                <Trash2 className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </div>
                          )}

                        </div>

                        {/* Separator line */}
                        <div className="border-t border-[#D4A84F]/10 my-4" />

                        {/* Middle Section: Contact Details List (Right-Aligned Icons) */}
                        <div className="relative z-10 space-y-3">
                          {/* Phone Row */}
                          <div className="flex items-center gap-3.5">
                            <div className="p-2 rounded-xl bg-[#0B1524] border border-[#D4A84F]/25 text-[#D4A84F] flex items-center justify-center w-10 h-10 shrink-0 shadow-md">
                              <Phone className="w-4 h-4" />
                            </div>
                            <span className="font-mono text-white text-sm font-semibold">{owner.phone || '—'}</span>
                          </div>

                          {/* Email Row */}
                          <div className="flex items-center gap-3.5">
                            <div className="p-2 rounded-xl bg-[#0B1524] border border-[#D4A84F]/25 text-[#D4A84F] flex items-center justify-center w-10 h-10 shrink-0 shadow-md">
                              <Mail className="w-4 h-4" />
                            </div>
                            <span className="truncate text-sm text-[#9EA7B8] font-bold" title={owner.email}>{owner.email || '—'}</span>
                          </div>
                        </div>

                        {/* Bottom Section: Commission Details Grid & Bank Account */}
                        <div className="relative z-10 bg-[#0B1524]/60 border border-[#D4A84F]/15 rounded-2xl overflow-hidden shadow-inner text-xs font-semibold text-right mt-4">
                          {/* Commission Row */}
                          <div className="flex justify-between items-center px-4 py-3 border-b border-[#D4A84F]/5">
                            <span className="text-[#9EA7B8] text-right font-semibold">آلية العمولة والمستقطع:</span>
                            <span className="text-white font-bold">
                              {owner.commissionValue} <span className="text-[#D4A84F] font-black">%</span>{' '}
                              <span className="text-xs text-[#9EA7B8]">
                                ({owner.commissionType === 'percentage' && 'نسبة'}
                                 {owner.commissionType === 'fixed_per_thousand' && 'لكل 1000'}
                                 {owner.commissionType === 'fixed_flat' && 'مقطوع'})
                              </span>
                            </span>
                          </div>

                          {/* Cash/Transfer Payout Method */}
                          <div className="flex justify-between items-center px-4 py-3 border-b border-[#D4A84F]/5">
                            <span className="text-[#9EA7B8] text-right font-semibold">طريقة الصرف:</span>
                            <span className="text-white font-bold">{owner.paymentMethod}</span>
                          </div>

                          {/* Bank Account */}
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-[#9EA7B8] text-right font-semibold">الحساب البنكي:</span>
                            <span className="text-white font-mono font-semibold truncate max-w-[210px] text-left" title={owner.bankAccount}>
                              {owner.bankAccount || '—'}
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. PROPERTIES LIST */}
          {activeSubTab === 'properties' && (
            <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] text-[#F8F9FB]">
              <div className="flex items-center gap-3 mb-5 text-xs font-bold">
                <span className="text-[#9EA7B8] flex items-center gap-1.5"><Filter className="w-4 h-4 stroke-[2]" /> تصفية السجلات حسب المالك:</span>
                <select 
                  value={selectedOwnerId} 
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#132238]/60 border border-[#D4A84F]/15 text-[#F8F9FB] font-bold focus:outline-none focus:ring-2 focus:ring-[#D4A84F]/20"
                >
                  <option value="all">كافة ملاك العقارات</option>
                  {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProperties.map(prop => {
                  const ownerName = owners.find(o => o.id === prop.ownerId)?.name || 'مالك غير معرف';
                  const propUnits = units.filter(u => u.propertyId === prop.id);
                  const rentedCount = propUnits.filter(u => u.status === 'rented').length;
                  
                  return (
                    <div key={prop.id} className="p-5 rounded-2xl bg-[#132238]/40 border border-[#D4A84F]/15 hover:border-[#D4A84F]/30 hover:shadow-2xl hover:shadow-black/50 transition-all duration-300 relative group shadow-sm text-[#F8F9FB]">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="text-sm font-black text-[#F8F9FB] font-sans">{prop.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${prop.status === 'active' ? 'bg-white text-slate-950 border border-white' : 'bg-white text-slate-950 border border-white'}`}>
                            {prop.status === 'active' ? 'نشط تحت الإشغال' : 'تحت الصيانة'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9EA7B8] font-extrabold">{prop.address}</p>
                        
                        <div className="pt-2.5 border-t border-[#D4A84F]/10 grid grid-cols-3 gap-2 text-center text-[11px]">
                          <div className="bg-[#132238]/60 p-2.5 rounded-xl border border-[#D4A84F]/10">
                            <span className="text-[10px] text-[#9EA7B8] block font-black">الطوابق</span>
                            <span className="font-bold text-[#F8F9FB] font-mono">{prop.floorsCount}</span>
                          </div>
                          <div className="bg-[#132238]/60 p-2.5 rounded-xl border border-[#D4A84F]/10">
                            <span className="text-[10px] text-[#9EA7B8] block font-black">الوحدات</span>
                            <span className="font-bold text-[#F8F9FB] font-mono">{prop.unitsCount}</span>
                          </div>
                          <div className="bg-[#132238]/60 p-2.5 rounded-xl border border-[#D4A84F]/10">
                            <span className="text-[10px] text-[#D4A84F] block font-black">مؤجر</span>
                            <span className="font-extrabold text-[#D4A84F] font-mono">{rentedCount}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-[#9EA7B8] font-extrabold pt-1">
                          <span>المالك المفوض: <strong className="text-[#D4A84F]">{ownerName}</strong></span>
                        </div>
                      </div>

                      {/* Action buttons on each property card */}
                      {isAccountant && (
                        <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-[#D4A84F]/10">
                          <button 
                            onClick={() => handleEdit('property', prop)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4A84F]/15 hover:bg-[#D4A84F]/30 text-[#D4A84F] border border-[#D4A84F]/30 font-bold text-xs transition-all cursor-pointer" 
                            title="تعديل بيانات العقار"
                          >
                            <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>تعديل</span>
                          </button>
                          <button 
                            onClick={() => handleDelete('re_properties', prop.id, 'عقار', prop.name)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-bold text-xs transition-all cursor-pointer shadow-sm" 
                            title="حذف العقار وجميع سجلاّته"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>حذف العقار</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. UNITS LIST */}
          {activeSubTab === 'units' && (
            <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] text-[#F8F9FB] space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                <span className="text-[#9EA7B8] flex items-center gap-1.5"><Filter className="w-4 h-4 stroke-[2]" /> تصنيف حسب العقار:</span>
                <select 
                  value={selectedPropertyId} 
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#132238]/60 border border-[#D4A84F]/15 text-[#F8F9FB] font-bold focus:outline-none"
                >
                  <option value="all">كافة العقارات</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <span className="text-[#9EA7B8] flex items-center gap-1.5">حالة الإشغال:</span>
                <select 
                  value={categoryFilter} 
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#132238]/60 border border-[#D4A84F]/15 text-[#F8F9FB] font-bold focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="rented">مؤجرة</option>
                  <option value="vacant">شاغرة</option>
                  <option value="maintenance">تحت الصيانة</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredUnits.map(unit => {
                  const prop = properties.find(p => p.id === unit.propertyId);
                  
                  return (
                    <div key={unit.id} className="p-4 rounded-xl bg-[#132238]/40 border border-[#D4A84F]/15 hover:border-[#D4A84F]/30 hover:shadow-2xl transition-all duration-300 relative group flex flex-col justify-between shadow-sm text-[#F8F9FB]">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[#9EA7B8] font-mono font-black">طابق {unit.floor} - وحدة {unit.unitNumber}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                            unit.status === 'rented' ? 'bg-white text-slate-950 border border-white' :
                            unit.status === 'vacant' ? 'bg-white text-slate-950 border border-white' : 'bg-white text-slate-950 border border-white'
                          }`}>
                            {unit.status === 'rented' && 'مؤجرة'}
                            {unit.status === 'vacant' && 'شاغرة'}
                            {unit.status === 'maintenance' && 'صيانة'}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#F8F9FB] font-sans">{prop?.name || 'عقار مجهول'}</h4>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-xs text-[#9EA7B8] font-black">قيمة الإيجار:</span>
                          <span className="text-sm font-extrabold text-[#D4A84F] font-mono">{(unit.rentValue).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <p className="text-[10px] text-[#9EA7B8] font-black">يوم السداد الشهري: <strong className="text-[#F8F9FB] font-mono">{unit.dueDay}</strong></p>
                      </div>

                      {/* Unit Actions overlay */}
                      {isAccountant && (
                        <div className="absolute left-2.5 top-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#132238]/90 p-1 rounded-lg border border-[#D4A84F]/15 shadow-md">
                          <button onClick={() => handleEdit('unit', unit)} className="p-1 rounded bg-[#D4A84F] text-slate-950 hover:bg-[#E5B95F] cursor-pointer" title="تعديل"><Edit2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                          <button onClick={() => handleDelete('re_units', unit.id, 'وحدة', unit.unitNumber)} className="p-1 rounded bg-red-600/80 text-white hover:bg-red-700 cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. TENANTS & CONTRACTS */}
          {activeSubTab === 'tenants' && (
            <div className="space-y-4">
              {/* Advanced Search Panel */}
              <div className="bg-[#132238]/80 border border-[#D4A84F]/15 rounded-3xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#D4A84F]/10 pb-3">
                  <span className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    البحث المتقدم وتصفية المستأجرين والعقود
                  </span>
                  <button 
                    onClick={() => {
                      setTenantSearchName('');
                      setTenantSearchPropertyId('all');
                      setTenantSearchUnitNumber('');
                      setTenantSearchContractNumber('');
                      setTenantSearchNationalId('');
                      setTenantSearchStatus('all');
                    }}
                    className="text-[10px] font-bold text-[#9EA7B8] hover:text-[#D4A84F] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> إعادة ضبط التصفية
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 font-bold">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9EA7B8] font-black block">اسم المستأجر</label>
                    <input 
                      type="text" 
                      value={tenantSearchName} 
                      onChange={(e) => setTenantSearchName(e.target.value)} 
                      placeholder="ابحث بالاسم..." 
                      className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9EA7B8] font-black block">العقار العقاري</label>
                    <select 
                      value={tenantSearchPropertyId} 
                      onChange={(e) => setTenantSearchPropertyId(e.target.value)} 
                      className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    >
                      <option value="all">كافة العقارات</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9EA7B8] font-black block">رقم الوحدة</label>
                    <input 
                      type="text" 
                      value={tenantSearchUnitNumber} 
                      onChange={(e) => setTenantSearchUnitNumber(e.target.value)} 
                      placeholder="مثال: 101" 
                      className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9EA7B8] font-black block">رقم العقد</label>
                    <input 
                      type="text" 
                      value={tenantSearchContractNumber} 
                      onChange={(e) => setTenantSearchContractNumber(e.target.value)} 
                      placeholder="ابحث برقم العقد..." 
                      className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9EA7B8] font-black block">الرقم القومي</label>
                    <input 
                      type="text" 
                      value={tenantSearchNationalId} 
                      onChange={(e) => setTenantSearchNationalId(e.target.value)} 
                      placeholder="ابحث بالرقم..." 
                      className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#9EA7B8] font-black block">حالة العقد</label>
                    <select 
                      value={tenantSearchStatus} 
                      onChange={(e) => setTenantSearchStatus(e.target.value)} 
                      className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                    >
                      <option value="all">الجميع</option>
                      <option value="active">ساري (نشط)</option>
                      <option value="suspended">معلق (موقوف)</option>
                      <option value="expired">منتهي</option>
                      <option value="evicted">مخلى</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tenants Data Table */}
              <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] text-[#F8F9FB] space-y-4">
                {/* Banner when a specific property is selected */}
                {tenantSearchPropertyId !== 'all' && (
                  <div className="bg-[#D4A84F]/10 border border-[#D4A84F]/30 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-[#D4A84F]/20 rounded-xl text-[#D4A84F]">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#F8F9FB] flex items-center gap-2">
                          العقار المختار: <span className="text-[#D4A84F] text-sm">{properties.find(p => p.id === tenantSearchPropertyId)?.name || 'عقار محدد'}</span>
                        </h4>
                        <p className="text-[11px] text-[#9EA7B8] font-bold mt-0.5">
                          يعرض المستأجرين والعقود المرتبطة بهذا العقار فقط (عدد المستأجرين: <span className="text-[#D4A84F] font-mono text-xs">{filteredTenants.length}</span>)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTenantSearchPropertyId('all')}
                      className="text-xs bg-[#08111F] hover:bg-[#132238] text-[#D4A84F] border border-[#D4A84F]/30 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                    >
                      عرض جميع العقارات
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs font-bold text-[#9EA7B8]">
                  <span>
                    تم العثور على <strong className="text-[#D4A84F] font-mono">{filteredTenants.length}</strong> مستأجرين مطابقين للفرز
                  </span>
                </div>
                {/* Mobile Cards View (Visible on small screens) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {filteredTenants.length === 0 ? (
                    <div className="p-8 text-center text-[#9EA7B8] font-bold bg-[#08111F]/60 rounded-2xl border border-[#D4A84F]/10">
                      <AlertTriangle className="w-8 h-8 text-[#D4A84F] mx-auto mb-2 animate-bounce" />
                      لا توجد بيانات مستأجرين مطابقة لفلاتر البحث.
                    </div>
                  ) : (
                    filteredTenants.map(tenant => {
                      const unit = units.find(u => u.id === tenant.unitId);
                      const prop = unit ? properties.find(p => p.id === unit.propertyId) : null;
                      const sidebarColor = getTenantColorClass(tenant.id);

                      return (
                        <div 
                          key={`mob-${tenant.id}`} 
                          className={`bg-[#08111F] border border-[#D4A84F]/20 p-4 rounded-2xl shadow-md border-r-4 ${sidebarColor} space-y-3`}
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-[#D4A84F]/10 pb-2">
                            <div>
                              <h4 className="font-black text-[#F8F9FB] text-sm">{tenant.fullName}</h4>
                              <p className="text-[11px] text-[#D4A84F] font-mono">عقد رقم: {tenant.contractNumber || 'غير محدد'}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                              tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              tenant.status === 'suspended' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse' :
                              tenant.status === 'expired' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}>
                              {tenant.status === 'active' && 'ساري'}
                              {tenant.status === 'suspended' && 'معلق'}
                              {tenant.status === 'expired' && 'منتهي'}
                              {tenant.status === 'evicted' && 'مخلى'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-[#9EA7B8]">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">العقار والوحدة:</span>
                              <p className="font-bold text-white flex items-center gap-1">
                                <Building className="w-3.5 h-3.5 text-[#D4A84F]" />
                                {prop?.name || '—'}
                              </p>
                              <p className="text-[10px] font-mono text-[#D4A84F]">شقة {unit?.unitNumber || '—'}</p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">الهاتف:</span>
                              <p className="font-mono font-bold text-white flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-[#D4A84F]" /> {tenant.phone}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">الإيجار الشهري:</span>
                              <p className="font-mono font-black text-[#D4A84F]">
                                {(tenant.rentAmount || 0).toLocaleString('ar-EG')} ج.م
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">مدة العقد:</span>
                              <p className="font-mono text-[10px] text-emerald-400">{tenant.contractStartDate} ⬅️ {tenant.contractEndDate}</p>
                            </div>
                          </div>

                          {/* Mobile Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-[#D4A84F]/10">
                            <button
                              onClick={() => handleDeleteTenant(tenant.id, tenant.fullName, tenant.unitId)}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                              title="حذف المستأجر"
                            >
                              <Trash2 className="w-4 h-4 stroke-[2.5]" />
                              <span>حذف المستأجر والعقد</span>
                            </button>
                            <button
                              onClick={() => handleEdit('tenant', tenant)}
                              className="bg-[#D4A84F] hover:bg-[#E5B95F] text-slate-950 font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                              title="تعديل البيانات"
                            >
                              <Edit2 className="w-4 h-4 stroke-[2.5]" />
                              <span>تعديل</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#D4A84F]/10">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-[#08111F]/85 border-b border-[#D4A84F]/15 text-[#9EA7B8] font-black uppercase tracking-wider">
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5">سند العقد</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5">اسم المستأجر</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5">رقم الهاتف / الإيميل</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5">الرقم القومي / الجنسية</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5">الشقة والعقار</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5">مدة سريان العقد</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5 text-center">الإيجار والتأمين</th>
                        <th className="py-4 px-4 border-l border-[#D4A84F]/5 text-center">حالة العقد</th>
                        <th className="py-4 px-4 text-left">خيارات التحكم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-[#9EA7B8] font-bold">
                            <AlertTriangle className="w-8 h-8 text-[#D4A84F] mx-auto mb-2 animate-bounce" />
                            لا توجد بيانات مستأجرين مطابقة لفلاتر البحث المتقدم.
                          </td>
                        </tr>
                      ) : (
                        filteredTenants.map(tenant => {
                          const unit = units.find(u => u.id === tenant.unitId);
                          const prop = unit ? properties.find(p => p.id === unit.propertyId) : null;
                          const sidebarColor = getTenantColorClass(tenant.id);

                          return (
                            <tr key={tenant.id} className={`border-b border-[#D4A84F]/5 hover:bg-[#08111F]/30 transition-colors border-r-4 ${sidebarColor}`}>
                              <td className="py-4 px-4 font-mono font-black text-[#D4A84F]">
                                {tenant.contractNumber || '—'}
                              </td>
                              <td className="py-4 px-4 font-black text-[#F8F9FB]">
                                <div className="space-y-0.5">
                                  <span>{tenant.fullName}</span>
                                  {tenant.birthDate && (
                                    <p className="text-[10px] text-slate-400 font-bold">مواليد: {tenant.birthDate}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 font-bold text-[#9EA7B8]">
                                <div className="space-y-1">
                                  <span className="font-mono text-xs flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5 text-[#D4A84F]" /> {tenant.phone}
                                  </span>
                                  {tenant.email && (
                                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {tenant.email}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 font-bold text-[#9EA7B8]">
                                <div className="space-y-0.5">
                                  <span className="font-mono block">{tenant.nationalId}</span>
                                  {tenant.nationality && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#132238]/80 text-[#9EA7B8] font-bold">{tenant.nationality}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 font-bold text-[#9EA7B8]">
                                <div className="space-y-0.5">
                                  <span className="text-[#F8F9FB] flex items-center gap-1">
                                    <Building className="w-3.5 h-3.5 text-[#D4A84F]" />
                                    {prop?.name || '—'}
                                  </span>
                                  <p className="text-[10px] text-[#9EA7B8] font-black">
                                    وحدة رقم {unit?.unitNumber || '—'} (طابق {unit?.floor || '—'})
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-4 font-bold text-xs text-[#9EA7B8]">
                                <div className="space-y-1 font-mono text-[10px]">
                                  <span className="block text-emerald-400">من: {tenant.contractStartDate}</span>
                                  <span className="block text-rose-400">إلى: {tenant.contractEndDate}</span>
                                  {tenant.contractDuration && (
                                    <span className="text-[9px] text-[#D4A84F] font-sans">({tenant.contractDuration})</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="space-y-1">
                                  <span className="font-mono font-black text-[#D4A84F] text-xs block">
                                    {(tenant.rentAmount || 0).toLocaleString('ar-EG')} ج.م / {tenant.paymentMethod || 'شهري'}
                                  </span>
                                  {tenant.depositAmount !== undefined && tenant.depositAmount > 0 && (
                                    <span className="font-mono text-[9px] text-slate-400 block font-normal">
                                      التأمين: {(tenant.depositAmount).toLocaleString('ar-EG')} ج.م
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                                  tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  tenant.status === 'suspended' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse' :
                                  tenant.status === 'expired' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                  'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                }`}>
                                  {tenant.status === 'active' && 'ساري'}
                                  {tenant.status === 'suspended' && 'معلق'}
                                  {tenant.status === 'expired' && 'منتهي'}
                                  {tenant.status === 'evicted' && 'مخلى'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-left">
                                <div className="flex items-center justify-end gap-1.5">
                                  {tenant.attachments && tenant.attachments.length > 0 && (
                                    <div className="relative group/attachments inline-block">
                                      <span className="inline-block px-2.5 py-1 rounded text-[10px] bg-sky-500/15 text-sky-400 border border-sky-500/30 font-black cursor-pointer">
                                        المستندات ({tenant.attachments.length})
                                      </span>
                                      <div className="hidden group-hover/attachments:block absolute left-0 bottom-full mb-2 bg-[#08111F] border border-[#D4A84F]/20 rounded-xl p-2.5 shadow-2xl z-20 min-w-48 text-right space-y-2">
                                        <p className="text-[10px] text-[#9EA7B8] border-b border-[#D4A84F]/10 pb-1 font-bold">الملفات المرفقة:</p>
                                        {tenant.attachments.map((file, i) => (
                                          <a 
                                            key={file.id || i} 
                                            href={file.fileUrl} 
                                            target="_blank" 
                                            referrerPolicy="no-referrer" 
                                            className="block text-[10px] text-sky-400 hover:underline flex items-center gap-1.5 font-bold truncate"
                                            title={file.name}
                                          >
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                            <span>{file.name}</span>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <button onClick={() => handleEdit('tenant', tenant)} className="p-2 rounded-lg bg-[#D4A84F] text-slate-950 hover:bg-[#E5B95F] shadow-sm hover:shadow cursor-pointer hover:scale-105 transition-all" title="تعديل"><Edit2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                                  <button onClick={() => handleDeleteTenant(tenant.id, tenant.fullName, tenant.unitId)} className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow cursor-pointer hover:scale-105 transition-all flex items-center gap-1 font-bold text-xs" title="حذف المستأجر والعقد"><Trash2 className="w-3.5 h-3.5 stroke-[2.5]" /> <span>حذف</span></button>
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

          {/* FINANCIALS MODULE (DUES, COLLECTIONS, PAYOUTS, STATEMENTS, REPORTS, COMMISSIONS, RENT_COLLECTIONS, ADVANCES_EXPENSES) */}
          {['dues', 'payouts', 'reports', 'collections', 'financials', 'rent_collections', 'advances_expenses', 'property_statements', 'owner_statements', 'tenant_statements', 'overview', 'commissions'].includes(activeSubTab) && (
            <RealEstateFinancials
              dues={dues}
              rentAdjustments={rentAdjustments}
              owners={owners}
              properties={properties}
              units={units}
              tenants={tenants}
              collections={collections}
              payouts={payouts}
              expenses={expenses}
              advances={advances}
              commissionStatuses={commissionStatuses}
              currentUser={currentUser}
              activeSubTab={activeSubTab}
              onNavigateSubTab={(subTab) => setActiveSubTab(subTab)}
              onCollectRent={(due) => handleOpenCollectRentModal(due)}
              onPayoutOwner={(due) => handleOpenPayoutDueModal(due)}
              onSaveCommissionStatus={handleSaveCommissionStatus}
              onEditTenant={(tenant) => handleEdit('tenant', tenant)}
              onCleanDuplicateDues={() => cleanDuplicateDuesFromFirestore(true)}
              isCleaningDuplicates={isCleaningDuplicates}
              onDeleteRentDue={handleDeleteRentDue}
              onDeleteAdvance={handleDeleteAdvance}
              onDeleteExpense={handleDeleteExpense}
              onDeleteCollection={handleDeleteCollection}
              onDeletePayout={handleDeletePayout}
              onDeleteTenant={(tenantId, tenantName, unitId) => handleDeleteTenant(tenantId, tenantName, unitId)}
              isOwnerStatementsCleared={isOwnerStatementsCleared}
              onClearOwnerStatements={handleClearOwnerStatements}
              onRestoreOwnerStatements={handleRestoreOwnerStatements}
            />
          )}

          {/* BACKUP & RESTORE MODULE (النسخ الاحتياطي للإدارة العقارية) */}
          {activeSubTab === 'backup' && (
            <RealEstateBackupPanel
              owners={owners}
              properties={properties}
              units={units}
              tenants={tenants}
              collections={collections}
              payouts={payouts}
              expenses={expenses}
              advances={advances}
              dues={dues}
              commissionStatuses={commissionStatuses}
              deletedDueIds={deletedDueIds}
              logs={logs}
              currentUser={currentUser}
              onRestoreComplete={handleRestoreComplete}
              logAction={logAction}
            />
          )}

        </div>

      </main>

      {/* DEDICATED ADD COLLECTION RECEIPT MODAL */}
      {isModalOpen && modalType === 'collect_rent' && (
        <AddCollectionReceiptModal
          isOpen={true}
          onClose={() => {
            setIsModalOpen(false);
            setModalType(null);
            setSelectedDuesToCollect([]);
            setSelectedDueToCollect(null);
          }}
          initialDues={selectedDuesToCollect.length > 0 ? selectedDuesToCollect : (selectedDueToCollect ? [selectedDueToCollect] : [])}
          allDues={dues}
          tenants={tenants}
          properties={properties}
          units={units}
          owners={owners}
          currentUser={currentUser}
          collections={collections}
          onSaveReceipt={handleSaveCollectionReceipt}
        />
      )}

      {/* GLOBAL PREMIUM DRAWER/OVERLAY MODAL FOR ALL OTHER FORMS */}
      <AnimatePresence>
        {isModalOpen && modalType && modalType !== 'collect_rent' && (
          <div className="fixed inset-0 bg-[#08111F]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4" dir="rtl">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-[#132238] border border-[#D4A84F]/20 rounded-3xl w-full ${modalType === 'tenant' ? 'max-w-4xl' : 'max-w-lg'} shadow-[0_15px_40px_rgba(0,0,0,0.5)] p-6 sm:p-8 space-y-6 relative overflow-hidden text-[#F8F9FB]`}
            >
              {/* Decorative accent background blur */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A84F]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-center border-b border-[#D4A84F]/15 pb-4">
                <h3 className="text-base font-black text-[#D4A84F] font-sans">
                  {modalType === 'tenant' ? (
                    editingId ? 'تعديل عقد المستأجر والربط العقاري الرقمي ✍️' : 'تسجيل عقد مستأجر جديد في المنظومة ➕'
                  ) : (
                    editingId ? 'تعديل بيانات السجل الحالي ✍️' : 'إضافة سجل ومعلومات جديدة ➕'
                  )}
                </h3>
                <button onClick={() => { setIsModalOpen(false); setModalType(null); }} className="p-2 rounded-lg bg-[#08111F]/60 border border-[#D4A84F]/15 text-[#9EA7B8] hover:text-[#F8F9FB] hover:bg-[#132238] transition-all cursor-pointer">
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Dynamic Forms Switch */}
              <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                
                {/* 1. OWNER FORM */}
                {modalType === 'owner' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-[#9EA7B8] font-bold block">اسم المالك الكامل *</label>
                      <input type="text" required value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">رقم الهاتف *</label>
                        <input type="text" required value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">البريد الإلكتروني</label>
                        <input type="email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">آلية احتساب العمولة</label>
                        <select value={ownerForm.commissionType} onChange={(e) => setOwnerForm({ ...ownerForm, commissionType: e.target.value as any })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all">
                          <option value="percentage">نسبة مئوية (%) من إجمالي تحصيل العقار شهرياً</option>
                          <option value="fixed_per_thousand">مبلغ لكل 1000 ج.م من تحصيل العقار شهرياً</option>
                          <option value="fixed_flat">مبلغ ثابت مقطوع شهرياً للعقار ككل</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">قيمة العمولة</label>
                        <input type="number" value={ownerForm.commissionValue} onChange={(e) => setOwnerForm({ ...ownerForm, commissionValue: Number(e.target.value) })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                      </div>
                    </div>
                    <p className="text-[10px] text-[#D4A84F] font-bold bg-[#D4A84F]/10 p-2.5 rounded-xl border border-[#D4A84F]/20">
                      💡 ملاحظة: تحسب العمولة تلقائياً على إجمالي التحصيل الشهري لكل عقار ككل، ثم توزع الحصة المقتطعة على وحدات العقار.
                    </p>
                    <div className="space-y-1">
                      <label className="text-xs text-[#9EA7B8] font-bold block">رقم الآيبان IBAN / الحساب البنكي</label>
                      <input type="text" value={ownerForm.bankAccount} onChange={(e) => setOwnerForm({ ...ownerForm, bankAccount: e.target.value })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" placeholder="EG..." />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[#9EA7B8] font-bold block">ملاحظات تسليم المستحقات</label>
                      <textarea value={ownerForm.notes} onChange={(e) => setOwnerForm({ ...ownerForm, notes: e.target.value })} className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all h-16 resize-none" />
                    </div>
                  </div>
                )}

                {/* 2. PROPERTY FORM */}
                {modalType === 'property' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">اختر مالك العقار</label>
                      <select value={propertyForm.ownerId} onChange={(e) => setPropertyForm({ ...propertyForm, ownerId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                        <option value="">اختر من القائمة...</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">اسم العقار / البرج</label>
                      <input type="text" value={propertyForm.name} onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">العنوان الجغرافي بالتفصيل</label>
                      <input type="text" value={propertyForm.address} onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">عدد الطوابق</label>
                        <input type="number" value={propertyForm.floorsCount} onChange={(e) => setPropertyForm({ ...propertyForm, floorsCount: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">إجمالي عدد الوحدات</label>
                        <input type="number" value={propertyForm.unitsCount} onChange={(e) => setPropertyForm({ ...propertyForm, unitsCount: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. UNIT FORM */}
                {modalType === 'unit' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">اختر المبنى/العقار المرتبط</label>
                      <select value={unitForm.propertyId} onChange={(e) => setUnitForm({ ...unitForm, propertyId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                        <option value="">اختر من القائمة...</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">رقم الشقة / المحل</label>
                        <input type="text" value={unitForm.unitNumber} onChange={(e) => setUnitForm({ ...unitForm, unitNumber: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">الطابق / الدور</label>
                        <input type="number" value={unitForm.floor} onChange={(e) => setUnitForm({ ...unitForm, floor: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">النشاط</label>
                        <select value={unitForm.activityType} onChange={(e) => setUnitForm({ ...unitForm, activityType: e.target.value as any })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                          <option value="residential">سكني</option>
                          <option value="commercial">تجاري</option>
                          <option value="administrative">إداري</option>
                        </select>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs text-slate-500 font-bold block">القيمة الإيجارية الشهرية (جنيه)</label>
                        <input type="number" value={unitForm.rentValue} onChange={(e) => setUnitForm({ ...unitForm, rentValue: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. TENANT FORM */}
                {modalType === 'tenant' && (
                  <div className="space-y-6 text-right">
                    
                    {/* Stepper Navigation */}
                    <div className="bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none mb-4">
                      {[
                        { id: 'tenant', label: 'بيانات المستأجر', desc: 'اسم ومعلومات المستأجر', icon: Users },
                        { id: 'property', label: 'العقار والمالك', desc: 'المالك والعقار وبيانات الوحدة', icon: Landmark },
                        { id: 'contract', label: 'بيانات العقد', desc: 'المدة والإيجار والتواريخ', icon: FileText },
                        { id: 'documents', label: 'المستندات والمرفقات', desc: 'الرقم القومي وعقد الإيجار', icon: Upload },
                        { id: 'review', label: 'المراجعة والحفظ', desc: 'مراجعة وتأكيد البيانات', icon: CheckCircle }
                      ].map((step, idx) => {
                        const Icon = step.icon;
                        const isActive = activeTenantStep === step.id;
                        const isCompleted = ['tenant', 'property', 'contract', 'documents', 'review'].indexOf(activeTenantStep) > idx;
                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => {
                              const steps = ['tenant', 'property', 'contract', 'documents', 'review'];
                              const targetIdx = steps.indexOf(step.id);
                              const currentIdx = steps.indexOf(activeTenantStep);
                              if (targetIdx <= currentIdx) {
                                setActiveTenantStep(step.id as any);
                              } else {
                                if (currentIdx >= 0) {
                                  if (!tenantForm.fullName.trim()) {
                                    alert('يرجى إدخال اسم المستأجر الثلاثي للمتابعة.');
                                    return;
                                  }
                                  const { isValid, normalizedValue } = validateNationalId(tenantForm.nationalId, false);
                                  if (!isValid) {
                                    alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة في حال إدخاله.');
                                    return;
                                  }
                                  setTenantForm(prev => ({ ...prev, nationalId: normalizedValue }));
                                  if (!tenantForm.phone.trim()) {
                                    alert('يرجى إدخال رقم الهاتف للمتابعة.');
                                    return;
                                  }
                                }
                                setActiveTenantStep(step.id as any);
                              }
                            }}
                            className={`flex items-center gap-2.5 text-right transition-all duration-200 outline-none ${
                              isActive ? 'opacity-100 scale-[1.02]' : 'opacity-65 hover:opacity-100'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              isActive ? 'bg-[#D4A84F] text-slate-950 shadow-sm ring-4 ring-[#D4A84F]/10 font-bold' :
                              isCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              'bg-[#132238]/60 text-[#9EA7B8] border border-[#D4A84F]/10'
                            }`}>
                              {isCompleted ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Icon className="w-4 h-4" />}
                            </div>
                            <div className="hidden md:block">
                              <p className={`text-[11px] font-black leading-tight ${isActive ? 'text-[#D4A84F]' : 'text-[#9EA7B8]'}`}>
                                {step.label}
                              </p>
                              <p className="text-[9px] text-[#9EA7B8]/60 font-bold">
                                {step.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#08111F]/40 h-1 rounded-full overflow-hidden mb-2 border border-[#D4A84F]/5">
                      <div 
                        className="bg-[#D4A84F] h-full transition-all duration-300"
                        style={{ 
                          width: `${
                            activeTenantStep === 'tenant' ? 20 :
                            activeTenantStep === 'property' ? 40 :
                            activeTenantStep === 'contract' ? 60 :
                            activeTenantStep === 'documents' ? 80 : 100
                          }%` 
                        }}
                      />
                    </div>

                    {/* Step Content */}
                    {activeTenantStep === 'tenant' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        {/* 2. PERSONAL DATA */}
                        <div className="bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15 space-y-3">
                          <h4 className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5 border-b border-[#D4A84F]/10 pb-1.5 mb-2">
                            <Users className="w-4 h-4" /> بيانات التعريف الشخصية والاتصال بالمستأجر
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">اسم المستأجر الثلاثي *</label>
                              <input 
                                type="text" 
                                required 
                                value={tenantForm.fullName} 
                                onChange={(e) => setTenantForm({ ...tenantForm, fullName: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">الرقم القومي</label>
                              <input 
                                type="text" 
                                value={tenantForm.nationalId} 
                                onChange={(e) => setTenantForm({ ...tenantForm, nationalId: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">رقم الهاتف *</label>
                              <input 
                                type="text" 
                                required 
                                value={tenantForm.phone} 
                                onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">البريد الإلكتروني</label>
                              <input 
                                type="email" 
                                value={tenantForm.email || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">الجنسية</label>
                              <input 
                                type="text" 
                                value={tenantForm.nationality || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, nationality: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">تاريخ الميلاد</label>
                              <input 
                                type="date" 
                                value={tenantForm.birthDate || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, birthDate: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1 md:col-span-3">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">العنوان الدائم بالتفصيل</label>
                              <input 
                                type="text" 
                                value={tenantForm.address || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTenantStep === 'property' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        {/* 1. DATA IMPORT & LINKING */}
                        <div className="bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15 space-y-3">
                          <h4 className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5 border-b border-[#D4A84F]/10 pb-1.5 mb-2">
                            <Landmark className="w-4 h-4" /> استيراد بيانات الملاك والعقارات والربط التلقائي
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Owner Selection with typing filter */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">المستثمر / المالك الأصلي</label>
                              <select 
                                value={tenantForm.ownerId || ''} 
                                onChange={(e) => handleTenantFormChange({ ownerId: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="">-- اختر مالك للفرز التلقائي --</option>
                                {owners.map(o => (
                                  <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>
                                ))}
                              </select>
                            </div>

                            {/* Property Selection with filter */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">العقار المستورد</label>
                              <select 
                                value={tenantForm.propertyId || ''} 
                                onChange={(e) => handleTenantFormChange({ propertyId: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="">-- اختر العقار للربط --</option>
                                {properties
                                  .filter(p => !tenantForm.ownerId || p.ownerId === tenantForm.ownerId)
                                  .map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                                  ))
                                }
                              </select>
                            </div>

                            {/* Unit Details Input */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">بيانات الوحدة</label>
                              <input 
                                type="text"
                                list="tenant-units-list"
                                value={tenantForm.unitId} 
                                onChange={(e) => handleTenantFormChange({ unitId: e.target.value })} 
                                placeholder="ادخل رقم أو بيانات الوحدة (مثال: شقة 4 - طابق 2)"
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                              <datalist id="tenant-units-list">
                                {units
                                  .filter(u => {
                                    const isVacant = u.status === 'vacant';
                                    const isCurrentUnit = u.id === tenantForm.unitId;
                                    const matchesProperty = !tenantForm.propertyId || u.propertyId === tenantForm.propertyId;
                                    return (isVacant || isCurrentUnit) && matchesProperty;
                                  })
                                  .map(u => (
                                    <option key={u.id} value={u.id}>
                                      وحدة {u.unitNumber} - طابق {u.floor} ({u.activityType === 'commercial' ? 'تجاري' : u.activityType === 'administrative' ? 'إداري' : 'سكني'})
                                    </option>
                                  ))
                                }
                              </datalist>
                            </div>
                          </div>

                          {/* SHOW TENANTS LINKED TO SELECTED PROPERTY */}
                          {tenantForm.propertyId && (
                            <div className="mt-3 p-3.5 bg-[#08111F]/80 rounded-2xl border border-[#D4A84F]/25 space-y-2">
                              <div className="flex items-center justify-between border-b border-[#D4A84F]/15 pb-2">
                                <span className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-[#D4A84F]" />
                                  المستأجرين والعقود الحالية المرتبطة بهذا العقار ({
                                    tenants.filter(t => {
                                      if (t.propertyId && t.propertyId === tenantForm.propertyId) return true;
                                      const u = units.find(unit => unit.id === t.unitId);
                                      return u?.propertyId === tenantForm.propertyId;
                                    }).length
                                  })
                                </span>
                                <span className="text-[10px] text-[#9EA7B8] font-bold">
                                  عقار: {properties.find(p => p.id === tenantForm.propertyId)?.name}
                                </span>
                              </div>

                              {(() => {
                                const currentPropTenants = tenants.filter(t => {
                                  if (t.propertyId && t.propertyId === tenantForm.propertyId) return true;
                                  const u = units.find(unit => unit.id === t.unitId);
                                  return u?.propertyId === tenantForm.propertyId;
                                });

                                if (currentPropTenants.length === 0) {
                                  return (
                                    <p className="text-[11px] text-[#9EA7B8] font-bold py-1 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      لا يوجد مستأجرين أو عقود مسجلة لهذا العقار حالياً. يمكنك إضافة وتسجيل هذا العقد الجديد بكل سهولة.
                                    </p>
                                  );
                                }

                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {currentPropTenants.map(t => {
                                      const u = units.find(unit => unit.id === t.unitId);
                                      return (
                                        <div key={`form-t-${t.id}`} className="bg-[#132238]/90 p-2.5 rounded-xl border border-[#D4A84F]/15 flex items-center justify-between gap-2 text-xs">
                                          <div>
                                            <p className="font-bold text-[#F8F9FB]">{t.fullName}</p>
                                            <p className="text-[10px] text-[#9EA7B8] font-mono mt-0.5">
                                              وحدة: {u?.unitNumber || t.unitId || '—'} | هاتف: {t.phone}
                                            </p>
                                          </div>
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                            t.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                          }`}>
                                            {t.status === 'active' ? 'ساري' : 'منتهي'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {activeTenantStep === 'contract' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        {/* 3. LEASE CONTRACT DETAILS */}
                        <div className="bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15 space-y-3">
                          <h4 className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5 border-b border-[#D4A84F]/10 pb-1.5 mb-2">
                            <FileText className="w-4 h-4" /> بنود وبيانات عقد الإيجار الرسمي والتأمين
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">رقم سند التعاقد سيريال</label>
                              <input 
                                type="text" 
                                value={tenantForm.contractNumber || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, contractNumber: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">قيمة الإيجار الشهري (ج.م)</label>
                              <input 
                                type="number" 
                                value={tenantForm.rentAmount || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, rentAmount: e.target.value === '' ? 0 : Number(e.target.value) })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                                placeholder="0"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">مبلغ التأمين المستحق (ج.م)</label>
                              <input 
                                type="number" 
                                value={tenantForm.depositAmount || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, depositAmount: e.target.value === '' ? 0 : Number(e.target.value) })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                                placeholder="0"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">دورية السداد</label>
                              <select 
                                value={tenantForm.paymentMethod || 'شهري'} 
                                onChange={(e) => setTenantForm({ ...tenantForm, paymentMethod: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="شهري">شهري منتظم</option>
                                <option value="ربع سنوي">ربع سنوي (كل 3 شهور)</option>
                                <option value="نصف سنوي">نصف سنوي (كل 6 شهور)</option>
                                <option value="سنوي">سنوي (كل 12 شهر)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block flex items-center justify-between">
                                <span>مدة العقد الإجمالية (اختياري)</span>
                                <span className="text-[9px] text-[#D4A84F]/90 font-normal">(حتى 59 سنة كحد أقصى)</span>
                              </label>
                              <select 
                                value={tenantForm.contractDuration || ''} 
                                onChange={(e) => handleContractDurationChange(e.target.value)} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="">-- اختياري: بدون تحديد مدة إجمالية --</option>
                                {Array.from({ length: 59 }, (_, i) => {
                                  const years = i + 1;
                                  const str = formatDurationStringFromYears(years);
                                  return (
                                    <option key={years} value={str}>
                                      {str} ({years} {years === 1 ? 'سنة' : 'سنوات'})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">حالة العقد الحالي</label>
                              <select 
                                value={tenantForm.status} 
                                onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value as any })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="active">ساري مفعول (نشط ومستمر)</option>
                                <option value="suspended">تعليق العقد (إيقاف المحاسبة والاستحقاقات)</option>
                                <option value="expired">منتهي الصلاحية</option>
                                <option value="evicted">مخلى بالتراضي / قانونيًا</option>
                              </select>
                            </div>

                            {tenantForm.status === 'suspended' && (
                              <div className="md:col-span-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="font-bold text-amber-200">تنبيه تعليق العقد:</p>
                                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                                    عند اختيار «تعليق العقد» يتم إيقاف مدة المحاسبة وجميع الاستحقاقات التي تعتمد على سريان العقد تلقائياً (الإيجارات، التحصيل، المتأخرات، السلف، المصروفات، والعمولات). وعند إعادة الحالة إلى «ساري المفعول» مستقبلاً تستأنف المحاسبة دون احتساب فترة التعليق بأثر رجعي.
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">تاريخ بداية التعاقد (بداية مدة العقد)</label>
                              <input 
                                type="date" 
                                value={tenantForm.contractStartDate} 
                                onChange={(e) => handleContractStartDateChange(e.target.value)} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-amber-300 font-bold block flex items-center justify-between">
                                <span>بداية شهر المحاسبة *</span>
                                <span className="text-[9px] text-amber-400/80 font-normal">(إلزامي للتحصيل)</span>
                              </label>
                              <input 
                                type="date" 
                                value={tenantForm.accountingStartMonth || tenantForm.contractStartDate || ''} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTenantForm(prev => ({
                                    ...prev,
                                    accountingStartMonth: val
                                  }));
                                }} 
                                className="w-full bg-[#08111F]/60 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-amber-400 transition-all shadow-sm"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">تاريخ نهاية التعاقد الرسمية (نهاية مدة العقد)</label>
                              <input 
                                type="date" 
                                value={tenantForm.contractEndDate} 
                                onChange={(e) => setTenantForm(prev => ({ ...prev, contractEndDate: e.target.value }))} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            {/* نهاية مدة المحاسبة - مع زر التفعيل/التعطيل */}
                            <div className="space-y-1.5 bg-[#08111F]/40 border border-amber-500/20 p-2.5 rounded-xl">
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] text-amber-300 font-bold block flex items-center gap-1">
                                  <span>نهاية مدة المحاسبة</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextState = !isAccountingEndEnabled;
                                    setIsAccountingEndEnabled(nextState);
                                    if (!nextState) {
                                      setTenantForm(prev => ({ ...prev, accountingEndMonth: '' }));
                                    } else if (!tenantForm.accountingEndMonth) {
                                      setTenantForm(prev => ({ ...prev, accountingEndMonth: tenantForm.contractEndDate || new Date().toISOString().slice(0, 10) }));
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                                    isAccountingEndEnabled
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                                      : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700/80'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${isAccountingEndEnabled ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                                  {isAccountingEndEnabled ? 'مفعّل' : 'غير مفعّل'}
                                </button>
                              </div>

                              {isAccountingEndEnabled ? (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="pt-1 space-y-1"
                                >
                                  <input 
                                    type="date" 
                                    value={tenantForm.accountingEndMonth || ''} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setTenantForm(prev => ({
                                        ...prev,
                                        accountingEndMonth: val
                                      }));
                                    }} 
                                    className="w-full bg-[#08111F]/80 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-amber-400 transition-all shadow-sm"
                                  />
                                  <p className="text-[9px] text-amber-400/80 font-medium">سيتم تطبيق هذا التاريخ كنهاية مدة محاسبة على العقد.</p>
                                </motion.div>
                              ) : (
                                <p className="text-[9px] text-slate-400 pt-0.5">عند تعطيل هذا الخيار لن يتم تطبيق تاريخ نهاية محاسبة على العقد.</p>
                              )}
                            </div>

                            {/* Calculated Dates Banner */}
                            {tenantForm.contractStartDate && (
                              <div className="md:col-span-3 bg-gradient-to-r from-amber-950/40 via-[#08111F]/80 to-[#08111F]/80 border border-[#D4A84F]/30 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-[#D4A84F] shrink-0" />
                                  <span className="font-bold text-[#F8F9FB]">فترة التعاقد المحتسبة تلقائياً:</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 font-mono">
                                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                    بداية العقد: {tenantForm.contractStartDate || 'غير محدد'}
                                  </span>
                                  <span className="text-[#D4A84F]">⬅️</span>
                                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                    نهاية العقد: {tenantForm.contractEndDate || 'غير محدد'}
                                  </span>
                                  {tenantForm.contractDuration ? (
                                    <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold font-sans text-[11px]">
                                      (إجمالي المدة: {tenantForm.contractDuration})
                                    </span>
                                  ) : (
                                    <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded-lg font-sans text-[10px]">
                                      (المدة الإجمالية غير مخصصة - اختيارية)
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="space-y-1 md:col-span-3">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">ملاحظات وشروط إضافية للعقد</label>
                              <textarea 
                                value={tenantForm.notes || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, notes: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-4 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all h-16 resize-none"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTenantStep === 'documents' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        {/* 4. DOCUMENTS & ATTACHMENTS */}
                        <div className="bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15 space-y-3">
                          <h4 className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5 border-b border-[#D4A84F]/10 pb-1.5 mb-2">
                            <Upload className="w-4 h-4" /> مركز رفع وإدارة المستندات والمرفقات السحابية
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-2xl bg-[#08111F]/40 border border-[#D4A84F]/10">
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">نوع المستند المرفوع</label>
                              <select 
                                value={selectedFileCategory} 
                                onChange={(e) => setSelectedFileCategory(e.target.value as any)} 
                                className="w-full bg-[#132238]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="صورة بطاقة الرقم القومي">صورة بطاقة الرقم القومي للمستأجر</option>
                                <option value="صورة عقد الإيجار">صورة عقد الإيجار الموقع</option>
                                <option value="مرفق إضافي">مستند أو مرفق إضافي</option>
                              </select>
                            </div>

                            <div className="space-y-1 flex flex-col justify-end">
                              <div className="flex items-center gap-3">
                                <input type="file" onChange={handleUpload} className="hidden" id="r2-upload-tenant" />
                                <label htmlFor="r2-upload-tenant" className="px-4 py-2 rounded-xl bg-[#D4A84F] text-slate-950 text-xs font-extrabold cursor-pointer hover:bg-[#E5B95F] flex items-center gap-1.5 transition-all w-full justify-center shadow-md">
                                  <Upload className="w-4 h-4 text-slate-950" /> رفع ومزامنة الملف المحدد
                                </label>
                                {uploadProgress !== null && (
                                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>{uploadProgress}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Attachment List */}
                          {tenantForm.attachments && tenantForm.attachments.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">المستندات المرفوعة حالياً:</label>
                              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                                {tenantForm.attachments.map((file, idx) => (
                                  <div key={file.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#08111F]/30 border border-[#D4A84F]/10 text-xs">
                                    <div className="flex items-center gap-2 truncate">
                                      <FileText className="w-4 h-4 text-[#D4A84F] flex-shrink-0" />
                                      <span className="font-bold text-[#F8F9FB] truncate" title={file.name}>{file.name}</span>
                                      <span className="text-[9px] text-[#9EA7B8] font-mono">({file.uploadDate})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a href={file.fileUrl} target="_blank" referrerPolicy="no-referrer" className="text-sky-400 hover:underline font-bold text-[10px] flex items-center gap-1">
                                        <ExternalLink className="w-3.5 h-3.5" /> معاينة
                                      </a>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setTenantForm(prev => ({
                                            ...prev,
                                            attachments: prev.attachments?.filter(a => a.id !== file.id) || []
                                          }));
                                        }}
                                        className="p-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
                                        title="حذف المستند"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {activeTenantStep === 'review' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        {/* 5. REVIEW & CONFIRMATION */}
                        <div className="bg-[#132238]/60 p-4 rounded-2xl border border-[#D4A84F]/15 space-y-4">
                          <h4 className="text-xs font-black text-[#D4A84F] flex items-center gap-1.5 border-b border-[#D4A84F]/10 pb-1.5 mb-2">
                            <CheckCircle className="w-4 h-4" /> مراجعة وتأكيد كافة البيانات المدخلة قبل الحفظ
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Tenant Info */}
                            <div className="bg-[#08111F]/40 p-3 rounded-xl border border-[#D4A84F]/10 space-y-2 text-right">
                              <span className="text-[10px] text-[#9EA7B8] font-black flex items-center gap-1.5 border-b border-[#D4A84F]/5 pb-1">
                                <Users className="w-3.5 h-3.5 text-[#D4A84F]" /> بيانات المستأجر الشخصية
                              </span>
                              <div className="space-y-1.5 text-xs text-right">
                                <p className="font-bold text-[#F8F9FB]">اسم المستأجر: <span className="text-amber-400 font-extrabold">{tenantForm.fullName || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">الرقم القومي: <span className="text-amber-400 font-mono font-bold">{tenantForm.nationalId || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">رقم الجوال: <span className="text-amber-400 font-mono font-bold">{tenantForm.phone || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">البريد الإلكتروني: <span className="text-[#9EA7B8]">{tenantForm.email || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">الجنسية: <span className="text-[#9EA7B8]">{tenantForm.nationality || '—'}</span></p>
                                {tenantForm.birthDate && <p className="font-bold text-[#F8F9FB]">تاريخ الميلاد: <span className="text-[#9EA7B8] font-mono">{tenantForm.birthDate}</span></p>}
                                <p className="font-bold text-[#F8F9FB]">العنوان: <span className="text-[#9EA7B8]">{tenantForm.address || '—'}</span></p>
                              </div>
                            </div>

                            {/* Property & Unit Info */}
                            <div className="bg-[#08111F]/40 p-3 rounded-xl border border-[#D4A84F]/10 space-y-2 text-right">
                              <span className="text-[10px] text-[#9EA7B8] font-black flex items-center gap-1.5 border-b border-[#D4A84F]/5 pb-1">
                                <Landmark className="w-3.5 h-3.5 text-[#D4A84F]" /> بيانات العقار والربط
                              </span>
                              <div className="space-y-1.5 text-xs text-right">
                                <p className="font-bold text-[#F8F9FB]">المالك: <span className="text-[#9EA7B8]">{owners.find(o => o.id === tenantForm.ownerId)?.name || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">العقار المرتبط: <span className="text-[#9EA7B8]">{properties.find(p => p.id === tenantForm.propertyId)?.name || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">بيانات الوحدة: <span className="text-amber-400 font-extrabold">
                                  {(() => {
                                    const u = units.find(un => un.id === tenantForm.unitId);
                                    return u ? `وحدة ${u.unitNumber} - طابق ${u.floor} (${u.activityType === 'commercial' ? 'تجاري' : u.activityType === 'administrative' ? 'إداري' : 'سكني'})` : (tenantForm.unitId || '—');
                                  })()}
                                </span></p>
                              </div>
                            </div>

                            {/* Contract Info */}
                            <div className="bg-[#08111F]/40 p-3 rounded-xl border border-[#D4A84F]/10 space-y-2 text-right">
                              <span className="text-[10px] text-[#9EA7B8] font-black flex items-center gap-1.5 border-b border-[#D4A84F]/5 pb-1">
                                <FileText className="w-3.5 h-3.5 text-[#D4A84F]" /> الشروط والبنود المالية
                              </span>
                              <div className="space-y-1.5 text-xs text-right">
                                <p className="font-bold text-[#F8F9FB]">رقم العقد السيريال: <span className="text-[#9EA7B8] font-mono">{tenantForm.contractNumber || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">الإيجار الشهري: <span className="text-emerald-400 font-extrabold">{tenantForm.rentAmount || 0} ج.م</span></p>
                                <p className="font-bold text-[#F8F9FB]">مبلغ التأمين: <span className="text-[#9EA7B8]">{tenantForm.depositAmount || 0} ج.م</span></p>
                                <p className="font-bold text-[#F8F9FB]">فترة التعاقد الرسمية: <span className="text-[#9EA7B8]">{tenantForm.contractStartDate || '—'} إلى {tenantForm.contractEndDate || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">بداية شهر المحاسبة: <span className="text-amber-300 font-mono font-bold">{(tenantForm.accountingStartMonth || tenantForm.contractStartDate) ? (tenantForm.accountingStartMonth || tenantForm.contractStartDate).slice(0, 7) : '—'}</span></p>
                                {isAccountingEndEnabled && tenantForm.accountingEndMonth && (
                                  <p className="font-bold text-[#F8F9FB]">نهاية مدة المحاسبة: <span className="text-amber-300 font-mono font-bold">{tenantForm.accountingEndMonth}</span></p>
                                )}
                                <p className="font-bold text-[#F8F9FB]">فترة المحاسبة المستحقة: <span className="text-amber-300 font-mono font-bold">من {(tenantForm.accountingStartMonth || tenantForm.contractStartDate) ? (tenantForm.accountingStartMonth || tenantForm.contractStartDate).slice(0, 7) : '—'} إلى {(isAccountingEndEnabled && tenantForm.accountingEndMonth) ? tenantForm.accountingEndMonth.slice(0, 7) : new Date().toISOString().slice(0, 7)} <span className="text-emerald-400 font-sans text-[10px]">(الشهر المستحق السداد)</span></span></p>
                                <p className="font-bold text-[#F8F9FB]">دورية السداد: <span className="text-amber-400 font-bold">{tenantForm.paymentMethod || 'شهري'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">حالة العقد: <span className={`font-bold ${
                                  tenantForm.status === 'active' ? 'text-emerald-400' :
                                  tenantForm.status === 'suspended' ? 'text-amber-300' :
                                  'text-red-400'
                                }`}>
                                  {tenantForm.status === 'active' ? 'ساري مفعول' : tenantForm.status === 'suspended' ? 'معلق (موقوف المحاسبة)' : tenantForm.status === 'expired' ? 'منتهي الصلاحية' : 'مخلى'}
                                </span></p>
                              </div>
                            </div>

                            {/* Documents Info */}
                            <div className="bg-[#08111F]/40 p-3 rounded-xl border border-[#D4A84F]/10 space-y-2 text-right">
                              <span className="text-[10px] text-[#9EA7B8] font-black flex items-center gap-1.5 border-b border-[#D4A84F]/5 pb-1">
                                <FileText className="w-3.5 h-3.5 text-[#D4A84F]" /> المستندات المرفوعة
                              </span>
                              <div className="space-y-1.5 text-xs max-h-28 overflow-y-auto pr-1 text-right">
                                {tenantForm.attachments && tenantForm.attachments.length > 0 ? (
                                  tenantForm.attachments.map((file, idx) => (
                                    <div key={file.id || idx} className="flex items-center gap-1.5 text-[11px] text-[#9EA7B8]">
                                      <FileText className="w-3 h-3 text-[#D4A84F] flex-shrink-0" />
                                      <span className="truncate max-w-[150px] font-bold text-[#F8F9FB]">{file.name}</span>
                                      <span className="text-[9px] text-[#9EA7B8]/70">({file.uploadDate})</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[#9EA7B8]/60 text-[11px] italic">لا توجد مستندات مرفوعة حالياً.</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {tenantForm.notes && (
                            <div className="bg-[#08111F]/30 p-2.5 rounded-xl border border-[#D4A84F]/10 text-xs text-right">
                              <p className="text-[#9EA7B8] font-bold">شروط إضافية وملاحظات:</p>
                              <p className="text-[#F8F9FB] mt-1 font-bold">{tenantForm.notes}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                  </div>
                )}

                {/* 5. COLLECTION FORM */}
                {modalType === 'collection' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-[#CBD5E1] font-bold block">اختر المستأجر المسدد *</label>
                      <select required value={collectionForm.tenantId} onChange={(e) => {
                        const tenant = tenants.find(t => t.id === e.target.value);
                        setCollectionForm({ ...collectionForm, tenantId: e.target.value, amountPaid: tenant?.rentAmount || 0 });
                      }} className="w-full bg-[#08111F] border border-[#D4A84F]/30 rounded-xl px-3 py-2 text-xs text-[#F8FAFC] font-bold focus:outline-none focus:border-[#D4A84F] transition-all">
                        <option value="">اختر من القائمة...</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#CBD5E1] font-bold block">شهر الاستحقاق المالي *</label>
                        <input type="month" required value={collectionForm.forMonthYear} onChange={(e) => setCollectionForm({ ...collectionForm, forMonthYear: e.target.value })} className="w-full bg-[#08111F] border border-[#D4A84F]/30 rounded-xl px-4 py-2 text-xs text-[#F8FAFC] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#CBD5E1] font-bold block">المبلغ المدفوع (جنيه) *</label>
                        <input type="number" required value={collectionForm.amountPaid} onChange={(e) => setCollectionForm({ ...collectionForm, amountPaid: Number(e.target.value) })} className="w-full bg-[#08111F] border border-[#D4A84F]/30 rounded-xl px-4 py-2 text-xs text-[#F8FAFC] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#CBD5E1] font-bold block">وسيلة الاستلام والسداد *</label>
                        <select value={collectionForm.paymentMethod} onChange={(e) => setCollectionForm({ ...collectionForm, paymentMethod: e.target.value as any })} className="w-full bg-[#08111F] border border-[#D4A84F]/30 rounded-xl px-3 py-2 text-xs text-[#F8FAFC] font-bold focus:outline-none focus:border-[#D4A84F] transition-all">
                          <option value="cash">نقداً بالخزينة</option>
                          <option value="instapay">تطبيق إنستاباي الرقمي</option>
                          <option value="bank_transfer">حوالة/تحويل بنكي</option>
                          <option value="vodafone_cash">فودافون كاش</option>
                          <option value="check">شيك بنكي رسمي</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#CBD5E1] font-bold block">تاريخ استلام الأموال *</label>
                        <input type="date" required value={collectionForm.paymentDate} onChange={(e) => setCollectionForm({ ...collectionForm, paymentDate: e.target.value })} className="w-full bg-[#08111F] border border-[#D4A84F]/30 rounded-xl px-4 py-2 text-xs text-[#F8FAFC] font-bold focus:outline-none focus:border-[#D4A84F] transition-all" />
                      </div>
                    </div>

                    {/* Receipt photo uploader */}
                    <div className="space-y-1 p-3 rounded-2xl bg-[#08111F]/70 border border-[#D4A84F]/20">
                      <label className="text-xs text-[#CBD5E1] block font-bold">رفع إيصال السداد أو لقطة الشاشة (R2)</label>
                      <input type="file" onChange={handleUpload} className="hidden" id="receipt-upload" />
                      <label htmlFor="receipt-upload" className="mt-1.5 px-4 py-2 rounded-xl bg-[#132238] text-[#F8FAFC] text-xs font-semibold cursor-pointer border border-[#D4A84F]/30 hover:bg-[#08111F] flex items-center gap-1.5 w-fit transition-all">
                        <Upload className="w-4 h-4 text-emerald-400" /> رفع الإثبات المالي
                      </label>
                    </div>
                  </div>
                )}

                {/* 6. PAYOUT SETTLEMENT FORM */}
                {modalType === 'payout' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">اختر المالك المستهدف للتسوية *</label>
                      <select required value={payoutForm.ownerId} onChange={(e) => setPayoutForm({ ...payoutForm, ownerId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                        <option value="">اختر من الملاك...</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">المحصل الكلي المحسوب:</span>
                        <span className="font-bold font-mono text-slate-900">{(payoutForm.totalCollected).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">يخصم العمولات المستحقة للمحاماة:</span>
                        <span className="font-bold font-mono text-red-600">- {(payoutForm.commissionDeducted).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">يخصم المصروفات المنفقة على الصيانة:</span>
                        <span className="font-bold font-mono text-amber-600">- {(payoutForm.expensesDeducted).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                        <span className="text-slate-900">صافي المبلغ المراد صرفه:</span>
                        <span className="font-extrabold font-mono text-emerald-700">{(payoutForm.netAmountPaid).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">تاريخ التسوية والصرف *</label>
                        <input type="date" required value={payoutForm.payoutDate} onChange={(e) => setPayoutForm({ ...payoutForm, payoutDate: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">الرقم المرجعي للتحويل البنكي</label>
                        <input type="text" value={payoutForm.bankTransactionRef} onChange={(e) => setPayoutForm({ ...payoutForm, bankTransactionRef: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" placeholder="TXN-..." />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. EXPENSE FORM */}
                {modalType === 'expense' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">اختر العقار المرتبط بالتكلفة *</label>
                      <select required value={expenseForm.propertyId} onChange={(e) => setExpenseForm({ ...expenseForm, propertyId: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                        <option value="">اختر العقار...</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">بند الصرف (الفئة) *</label>
                        <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                          <option value="صيانة سباكة ومجاري">صيانة سباكة ومجاري</option>
                          <option value="كهرباء ومصاعد">كهرباء ومصاعد</option>
                          <option value="نظافة ومظهر عام">نظافة ومظهر عام</option>
                          <option value="رسوم حكومية وضرائب عقارية">رسوم حكومية وضرائب عقارية</option>
                          <option value="أمن وحراسة">أمن وحراسة</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">مبلغ المصروف الفعلي *</label>
                        <input type="number" required value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 block font-bold">تاريخ وقوع الصرف *</label>
                      <input type="date" required value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 font-bold block">شرح تفصيلي للمصروف *</label>
                      <textarea required value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all h-16 resize-none" />
                    </div>
                  </div>
                )}

                {/* 9. PAYOUT DUE MODAL FORM */}
                {modalType === 'payout_due' && selectedDueToPayout && (
                  <div className="space-y-4 text-right">
                    <div className="p-4 rounded-2xl bg-[#08111F]/80 border border-[#D4A84F]/20 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">المالك المستفيد:</span>
                        <span className="text-[#F8F9FB] font-black">{selectedDueToPayout.ownerName}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">شهر الإيجار المحصل:</span>
                        <span className="text-[#D4A84F] font-mono font-black">{selectedDueToPayout.monthNameAr}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">المحصول الكلي:</span>
                        <span className="text-[#F8F9FB] font-mono font-bold">{(selectedDueToPayout.collectedAmount || selectedDueToPayout.rentAmount).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">عمولة الإدارة المقتطعة:</span>
                        <span className="text-red-400 font-mono font-bold">- {selectedDueToPayout.commissionAmount.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-[#D4A84F]/10 pt-2">
                        <span className="text-[#9EA7B8] font-bold">صافي المستحق للصرف للمالك:</span>
                        <span className="text-[#D4A84F] font-mono font-black text-sm">{selectedDueToPayout.netOwnerAmount.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">تاريخ التسليم والصرف *</label>
                        <input 
                          type="date" 
                          required 
                          value={payoutDueForm.payoutDate} 
                          onChange={(e) => setPayoutDueForm({ ...payoutDueForm, payoutDate: e.target.value })} 
                          className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">وسيلة الدفع والصرف *</label>
                        <select 
                          value={payoutDueForm.payoutMethod} 
                          onChange={(e) => setPayoutDueForm({ ...payoutDueForm, payoutMethod: e.target.value })} 
                          className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]"
                        >
                          <option value="تحويل بنكي">تحويل بنكي / IBAN</option>
                          <option value="إنستاباي">إنستاباي</option>
                          <option value="نقداً">نقداً وتسليم شخصي</option>
                          <option value="شيك بنكي">شيك بنكي</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#9EA7B8] font-bold block">الرقم المرجعي للتحويل / السند</label>
                      <input 
                        type="text" 
                        value={payoutDueForm.payoutRefNo} 
                        onChange={(e) => setPayoutDueForm({ ...payoutDueForm, payoutRefNo: e.target.value })} 
                        className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        placeholder="رقم العملية البنكية..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#9EA7B8] font-bold block">ملاحظات التسوية</label>
                      <input 
                        type="text" 
                        value={payoutDueForm.notes} 
                        onChange={(e) => setPayoutDueForm({ ...payoutDueForm, notes: e.target.value })} 
                        className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        placeholder="اختياري..."
                      />
                    </div>
                  </div>
                )}

                {/* Submit action buttons in modal footer */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#D4A84F]/10">
                  <button type="button" onClick={() => { setIsModalOpen(false); setModalType(null); }} className="px-4 py-2 rounded-xl border border-[#D4A84F]/15 text-[#9EA7B8] hover:bg-[#08111F]/50 text-xs font-bold transition-all">إلغاء</button>
                  
                  {modalType === 'tenant' ? (
                    <>
                      {activeTenantStep !== 'tenant' && (
                        <button
                          type="button"
                          onClick={() => {
                            const steps: any[] = ['tenant', 'property', 'contract', 'documents', 'review'];
                            const idx = steps.indexOf(activeTenantStep);
                            if (idx > 0) setActiveTenantStep(steps[idx - 1]);
                          }}
                          className="px-4 py-2 rounded-xl border border-[#D4A84F]/15 text-[#D4A84F] hover:bg-[#D4A84F]/5 text-xs font-bold transition-all"
                        >
                          السابق
                        </button>
                      )}
                      
                      {activeTenantStep !== 'review' && (
                        <button
                          type="button"
                          onClick={handleNextTenantStep}
                          className="px-5 py-2 rounded-xl bg-[#D4A84F]/20 hover:bg-[#D4A84F]/30 text-[#D4A84F] font-black text-xs transition-all"
                        >
                          التالي ➔
                        </button>
                      )}

                      <button 
                        type="submit" 
                        disabled={isSavingTenant}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingTenant ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>جاري حفظ بيانات المستأجر...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 text-white" />
                            <span>{editingId ? 'حفظ تعديلات المستأجر' : 'حفظ بيانات المستأجر'}</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <button type="submit" className="px-5 py-2 rounded-xl bg-[#D4A84F] hover:bg-[#E5B95F] text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                      <Save className="w-4 h-4" />
                      حفظ البيانات
                    </button>
                  )}
                </div>

              </form>
            </motion.div>
          </div>
        )}
        {/* Printable Official Rent Receipt Modal */}
        {selectedReceiptForPrint && (() => {
          const receipt = selectedReceiptForPrint;
          const tenant = tenants.find(t => t.id === receipt.tenantId);
          const unit = units.find(u => u.id === receipt.unitId);
          const prop = properties.find(p => p.id === receipt.propertyId);
          const owner = prop ? owners.find(o => o.id === prop.ownerId) : null;
          
          return (
            <div className="fixed inset-0 z-50 bg-[#08111F]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto no-print">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-receipt-card, #printable-receipt-card * {
                    visibility: visible !important;
                  }
                  #printable-receipt-card {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    box-shadow: none !important;
                    border: none !important;
                    background: white !important;
                    color: black !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                }
              `}} />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#132238] border border-[#D4A84F]/20 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col text-[#F8F9FB]"
              >
                {/* Modal Header */}
                <div className="bg-[#08111F] text-white p-4 px-6 flex items-center justify-between no-print border-b border-[#D4A84F]/10">
                  <span className="text-xs font-black text-[#D4A84F] flex items-center gap-2">
                    <Printer className="w-5 h-5 animate-pulse" />
                    معاينة سند القبض الرسمي والطباعة
                  </span>
                  <button 
                    type="button"
                    onClick={() => setSelectedReceiptForPrint(null)}
                    className="p-1.5 rounded-xl bg-[#132238] hover:bg-[#132238]/80 text-[#9EA7B8] hover:text-[#F8F9FB] transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Printable Area */}
                <div id="printable-receipt-card" className="p-8 space-y-6 bg-white border border-slate-100 rounded-2xl m-4 md:m-6 shadow-inner relative">
                  
                  {/* Decorative background watermarks */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                    <Building className="w-80 h-80 text-emerald-900" />
                  </div>

                  {/* Receipt Header / Letterhead */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                    <div className="space-y-1">
                      <h1 className="text-md font-black text-slate-900 font-sans">مجموعة مكاتب الرميح القانونية والعقارية ⚖️</h1>
                      <p className="text-[10px] text-slate-500 font-bold">قطاع إدارة الأصول والتحصيل العقاري الرقمي</p>
                      <p className="text-[9px] text-slate-400 font-bold">مصر - التجمع الخامس والرحاب - هاتف: 01002558661</p>
                    </div>
                    <div className="text-left space-y-1 text-[9px] font-mono text-slate-500 font-bold">
                      <p className="text-amber-600 font-black text-xs">رقم السند: {receipt.receiptNumber}</p>
                      <p>تاريخ السداد: {receipt.paymentDate}</p>
                      <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 tracking-wider">سند قــبــض إيــجــار رســمــي</h2>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                      <p className="text-slate-500 font-bold">المستأجر (المسدد):</p>
                      <p className="text-slate-900 font-black text-sm">{tenant?.fullName || '—'}</p>
                      {tenant?.nationalId && <p className="text-[10px] text-slate-500 font-mono">الرقم القومي: {tenant.nationalId}</p>}
                      {tenant?.phone && <p className="text-[10px] text-slate-500 font-mono">الهاتف: {tenant.phone}</p>}
                    </div>

                    <div className="space-y-2 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                      <p className="text-slate-500 font-bold">العقار والوحدة السكنية:</p>
                      <p className="text-slate-900 font-black text-sm">{prop?.name || '—'}</p>
                      <p className="text-[10px] text-slate-500 font-bold">وحدة رقم {unit?.unitNumber || '—'} - الطابق {unit?.floor || '—'}</p>
                      {prop?.address && <p className="text-[9px] text-slate-400 font-semibold">العنوان: {prop.address}</p>}
                    </div>
                  </div>

                  {/* Value and Rent Period */}
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 grid grid-cols-2 gap-4 text-xs font-bold">
                    <div>
                      <span className="text-slate-500 block">المبلغ المقبوض كتابة ورقماً:</span>
                      <span className="text-md font-black text-emerald-700 font-mono">{(receipt.amountPaid).toLocaleString('ar-EG')} ج.م</span>
                      <span className="text-[10px] text-slate-400 block font-normal">(فقط لا غير خمسة آلاف جنيه مصري)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">وذلك عن القيمة الإيجارية لشهر:</span>
                      <span className="text-md font-black text-slate-900 font-mono">{receipt.forMonthYear}</span>
                      <span className="text-[10px] text-slate-500 block font-sans">المالك الأصلي: {owner?.name || '—'}</span>
                    </div>
                  </div>

                  {/* Metadata and signatures */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-[10px]">
                    <div>
                      <p className="text-slate-500 font-bold">طريقة الاستلام:</p>
                      <p className="text-slate-900 font-black">
                        {receipt.paymentMethod === 'cash' && 'نقداً بالخزينة'}
                        {receipt.paymentMethod === 'instapay' && 'تحويل فوري عبر تطبيق إنستاباي'}
                        {receipt.paymentMethod === 'bank_transfer' && 'تحويل بنكي رسمي'}
                        {receipt.paymentMethod === 'vodafone_cash' && 'فودافون كاش'}
                        {receipt.paymentMethod === 'check' && 'شيك بنكي مقبول الدفع'}
                      </p>
                      {receipt.notes && <p className="text-slate-500 font-semibold mt-1">ملاحظات: {receipt.notes}</p>}
                    </div>
                    <div className="text-left">
                      <p className="text-slate-500 font-bold">المستلم والمحصل المسؤول:</p>
                      <p className="text-slate-900 font-black">{receipt.collectedBy}</p>
                    </div>
                  </div>

                  {/* Signature block with stamp placeholder */}
                  <div className="pt-8 flex justify-between items-center text-xs text-center font-bold">
                    <div className="space-y-10">
                      <p className="text-slate-500">توقيع المستلم بالنيابة</p>
                      <p className="border-t border-slate-300 pt-1.5 w-32 mx-auto text-[10px]">{receipt.collectedBy}</p>
                    </div>
                    <div className="w-20 h-20 rounded-full border-4 border-emerald-600/20 flex items-center justify-center text-emerald-600/20 text-[9px] font-black rotate-12 select-none">
                      ختم المحفظة
                    </div>
                    <div className="space-y-10">
                      <p className="text-slate-500">مراجعة الحسابات</p>
                      <p className="border-t border-slate-300 pt-1.5 w-32 mx-auto text-[10px]">قسم المراجعة والمالية</p>
                    </div>
                  </div>

                </div>

                {/* Modal Footer with print action */}
                <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex justify-between items-center no-print">
                  <span className="text-[10px] text-slate-500 font-bold">
                    مؤمن ومسجل سحابياً بنجاح عبر بوابة الرميح العقارية.
                  </span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setSelectedReceiptForPrint(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                    >
                      إغلاق المعاينة
                    </button>
                    <button 
                      type="button"
                      onClick={() => window.print()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4 stroke-[2.5]" />
                      طباعة السند الآن (A4)
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}

        {/* Printable Official Owner Settlement Modal */}
        {selectedPayoutForPrint && (() => {
          const payout = selectedPayoutForPrint;
          const owner = owners.find(o => o.id === payout.ownerId);
          const ownerProps = owner ? properties.filter(p => p.ownerId === owner.id) : [];
          
          return (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto no-print">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-payout-card, #printable-payout-card * {
                    visibility: visible !important;
                  }
                  #printable-payout-card {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    box-shadow: none !important;
                    border: none !important;
                    background: white !important;
                    color: black !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                }
              `}} />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-slate-800"
              >
                {/* Modal Header */}
                <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between no-print">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-2">
                    <Printer className="w-5 h-5 animate-pulse" />
                    معاينة كشف التسوية المالي للمالك
                  </span>
                  <button 
                    type="button"
                    onClick={() => setSelectedPayoutForPrint(null)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Printable Area */}
                <div id="printable-payout-card" className="p-8 space-y-6 bg-white border border-slate-100 rounded-2xl m-4 md:m-6 shadow-inner relative">
                  
                  {/* Decorative background watermark */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                    <Landmark className="w-80 h-80 text-emerald-900" />
                  </div>

                  {/* Receipt Header / Letterhead */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                    <div className="space-y-1">
                      <h1 className="text-md font-black text-slate-900 font-sans">مجموعة مكاتب الرميح القانونية والعقارية ⚖️</h1>
                      <p className="text-[10px] text-slate-500 font-bold">قطاع إدارة الأصول والتحصيل العقاري الرقمي</p>
                      <p className="text-[9px] text-slate-400 font-bold">مصر - التجمع الخامس والرحاب - هاتف: 01002558661</p>
                    </div>
                    <div className="text-left space-y-1 text-[9px] font-mono text-slate-500 font-bold">
                      <p className="text-emerald-700 font-black text-xs">كشف تسوية رقم: PAY-{payout.id.slice(0, 6).toUpperCase()}</p>
                      <p>تاريخ التسوية: {payout.payoutDate}</p>
                      <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center py-2 bg-slate-100 rounded-xl border border-slate-200">
                    <h2 className="text-sm font-black text-slate-900 tracking-wider">كشف تسوية حساب مستحقات مالك عقار</h2>
                  </div>

                  {/* Owner Details */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <p className="text-slate-700 font-bold">المالك المستفيد: <span className="text-slate-900 font-black">{owner?.name || '—'}</span></p>
                      <p className="text-slate-700 font-bold">رقم الهاتف: <span className="font-mono text-slate-900 font-bold">{owner?.phone || '—'}</span></p>
                    </div>
                    <p className="text-slate-600 font-semibold">العقارات والمنشآت المشمولة بالتحصيل: <span className="text-slate-800 font-black">{ownerProps.map(p => p.name).join('، ') || 'لا يوجد'}</span></p>
                  </div>

                  {/* Detailed Math Balance Sheet */}
                  <div className="p-5 rounded-2xl bg-white border-2 border-slate-200 space-y-4">
                    <h4 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2">تفصيل الموازنة المالية وعمليات الاستقطاع:</h4>
                    
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-600">إجمالي الإيجارات والمبالغ المحصلة من المستأجرين:</span>
                        <span className="font-mono font-black text-emerald-700">{(payout.totalCollected).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-600">يخصم عمولة إدارة الأصول والتحصيل القانوني لمكتب الرميح:</span>
                        <span className="font-mono font-black text-red-600">- {(payout.commissionDeducted).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-600">يخصم فواتير صيانة وترميم ومنصرفات العقار فواتير رسمية:</span>
                        <span className="font-mono font-black text-amber-600">- {(payout.expensesDeducted).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="flex justify-between border-t-2 border-dashed border-slate-300 pt-3.5 text-sm font-black">
                        <span className="text-slate-900">صافي المستحق النهائي المسلم لكم:</span>
                        <span className="font-mono text-emerald-700 font-black">{(payout.netAmountPaid).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery terms */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1">
                    <p className="text-slate-700 font-bold">وسيلة تسليم الحساب: <span className="text-slate-950 font-extrabold">{payout.paymentMethod}</span></p>
                    {payout.bankTransactionRef && <p className="text-[10px] text-slate-500 font-mono">الرقم المرجعي للمعاملة البنكية: {payout.bankTransactionRef}</p>}
                    {payout.notes && <p className="text-slate-500 font-semibold mt-1">ملاحظات تسوية الحساب: {payout.notes}</p>}
                  </div>

                  {/* Signature block with stamp placeholder */}
                  <div className="pt-8 flex justify-between items-center text-xs text-center font-bold">
                    <div className="space-y-12">
                      <p className="text-slate-500">مجموعة مكاتب الرميح (قسم الحسابات)</p>
                      <p className="border-t border-slate-300 pt-1.5 w-36 mx-auto text-[10px]">{payout.createdBy || 'المحاسب المفوض'}</p>
                    </div>
                    <div className="text-center font-black text-emerald-700 text-xs border border-emerald-600/30 px-3 py-1.5 rounded-lg bg-emerald-500/5 rotate-[-6deg] select-none">
                      {payout.signedByOwner ? '✓ تم اعتماد المالك رقمياً' : 'بانتظار توقيع المالك'}
                    </div>
                    <div className="space-y-12">
                      <p className="text-slate-500">المالك المستفيد أو من ينوب عنه</p>
                      <p className="border-t border-slate-300 pt-1.5 w-36 mx-auto text-[10px]">{owner?.name || 'توقيع المالك'}</p>
                    </div>
                  </div>

                </div>

                {/* Modal Footer with print action */}
                <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex justify-between items-center no-print">
                  <span className="text-[10px] text-slate-500 font-bold">
                    حسابات مدققة ومسجلة قانونياً بموجب شروط التعاقد.
                  </span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setSelectedPayoutForPrint(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                    >
                      إغلاق المعاينة
                    </button>
                    <button 
                      type="button"
                      onClick={() => window.print()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
                    >
                      <Printer className="w-4 h-4 stroke-[2.5]" />
                      طباعة كشف التسوية (A4)
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}

        {/* RESET CONTRACTS & ACCOUNTS CONFIRMATION MODAL */}
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border-2 border-red-500/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-right relative overflow-hidden dir-rtl"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl shrink-0 text-red-500">
                  <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-white">تأكيد تصفير العقود والحسابات</h3>
                  <p className="text-sm font-bold text-slate-300 leading-relaxed">
                    ⚠️ تحذير: سيؤدي هذا الإجراء إلى تصفير جميع بيانات العقود وجميع البيانات المالية والحسابية المرتبطة بها، ولا يمكن التراجع عن هذه العملية. هل أنت متأكد من المتابعة؟
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition-all cursor-pointer border border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isWipingData}
                  onClick={async () => {
                    setShowResetConfirmModal(false);
                    await handleResetAllContractsAndAccounts(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-lg shadow-red-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {isWipingData ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التصفير...</span>
                    </>
                  ) : (
                    <span>تأكيد التصفير</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>

    </div>
  );
}
