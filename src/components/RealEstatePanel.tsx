import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Landmark, Building, Home, Users, 
  Receipt, Wallet, CreditCard, FileBarChart, History,
  Plus, Search, Edit2, Trash2, Printer, Check, X, 
  AlertTriangle, Eye, Shield, FileText, Upload, RefreshCw, Filter, ExternalLink,
  Phone, Mail, ChevronLeft, ChevronRight, CheckCircle, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReRealEstateLog, ReRentDue, User 
} from '../types';
import { 
  subscribeCollection, addFirestoreDoc, 
  updateFirestoreDoc, deleteFirestoreDoc 
} from '../services/dbSync';
import { 
  initialOwners, initialProperties, initialUnits, initialTenants, 
  initialCollections, initialPayouts, initialExpenses, initialLogs, initialDues 
} from './RealEstate/RealEstateData';
import RealEstateDashboard from './RealEstate/RealEstateDashboard';
import RealEstateFinancials from './RealEstate/RealEstateFinancials';
import { uploadToR2WithProgress } from '../utils/fileStorage';
import { validateNationalId } from '../utils/validation';

interface RealEstatePanelProps {
  currentUser: User;
}

type RealEstateSubTab = 
  | 'dashboard' 
  | 'owners' 
  | 'properties' 
  | 'units' 
  | 'tenants' 
  | 'dues'
  | 'collections' 
  | 'payouts' 
  | 'expenses' 
  | 'reports' 
  | 'logs';

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export default function RealEstatePanel({ currentUser }: RealEstatePanelProps) {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<RealEstateSubTab>('dashboard');
  const [activeMainTab, setActiveMainTab] = useState<'dashboard' | 'owners' | 'properties' | 'tenants' | 'financials'>('dashboard');

  // Sync activeMainTab when activeSubTab changes from other sources
  useEffect(() => {
    if (activeSubTab === 'dashboard') {
      setActiveMainTab('dashboard');
    } else if (activeSubTab === 'owners') {
      setActiveMainTab('owners');
    } else if (['properties', 'units'].includes(activeSubTab)) {
      setActiveMainTab('properties');
    } else if (['tenants'].includes(activeSubTab)) {
      setActiveMainTab('tenants');
    } else if (['dues', 'payouts', 'collections', 'expenses', 'reports', 'logs'].includes(activeSubTab)) {
      setActiveMainTab('financials');
    }
  }, [activeSubTab]);

  const switchMainTab = (mainTab: 'dashboard' | 'owners' | 'properties' | 'tenants' | 'financials') => {
    setActiveMainTab(mainTab);
    if (mainTab === 'dashboard') setActiveSubTab('dashboard');
    else if (mainTab === 'owners') setActiveSubTab('owners');
    else if (mainTab === 'properties') setActiveSubTab('properties');
    else if (mainTab === 'tenants') setActiveSubTab('tenants');
    else if (mainTab === 'financials') setActiveSubTab('dues');
  };

  // Core synchronized state
  const [owners, setOwners] = useState<ReOwner[]>([]);
  const [properties, setProperties] = useState<ReProperty[]>([]);
  const [units, setUnits] = useState<ReUnit[]>([]);
  const [tenants, setTenants] = useState<ReTenant[]>([]);
  const [collections, setCollections] = useState<ReCollectionReceipt[]>([]);
  const [payouts, setPayouts] = useState<RePayout[]>([]);
  const [expenses, setExpenses] = useState<RePropertyExpense[]>([]);
  const [logs, setLogs] = useState<ReRealEstateLog[]>([]);
  const [dues, setDues] = useState<ReRentDue[]>([]);

  // Subscriptions to Firestore (real-time synced)
  useEffect(() => {
    const unsubOwners = subscribeCollection<ReOwner>('re_owners', setOwners, initialOwners);
    const unsubProperties = subscribeCollection<ReProperty>('re_properties', setProperties, initialProperties);
    const unsubUnits = subscribeCollection<ReUnit>('re_units', setUnits, initialUnits);
    const unsubTenants = subscribeCollection<ReTenant>('re_tenants', setTenants, initialTenants);
    const unsubCollections = subscribeCollection<ReCollectionReceipt>('re_collections', setCollections, initialCollections);
    const unsubPayouts = subscribeCollection<RePayout>('re_payouts', setPayouts, initialPayouts);
    const unsubExpenses = subscribeCollection<RePropertyExpense>('re_expenses', setExpenses, initialExpenses);
    const unsubLogs = subscribeCollection<ReRealEstateLog>('re_logs', setLogs, initialLogs);
    const unsubDues = subscribeCollection<ReRentDue>('re_dues', setDues, initialDues);

    return () => {
      unsubOwners();
      unsubProperties();
      unsubUnits();
      unsubTenants();
      unsubCollections();
      unsubPayouts();
      unsubExpenses();
      unsubLogs();
      unsubDues();
    };
  }, []);

  // AUTOMATED MONTHLY RENT DUES GENERATOR FOR ACTIVE LEASE CONTRACTS
  // Note: Office commission is calculated on the TOTAL monthly rent/collection of each property per month
  useEffect(() => {
    if (!tenants || tenants.length === 0) return;

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
      }>;
    }

    const groupsMap = new Map<string, PropertyMonthGroup>();

    validContractTenants.forEach(tenant => {
      const startDate = new Date(tenant.contractStartDate);
      const endDate = new Date(tenant.contractEndDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

      const unit = units.find(u => u.id === tenant.unitId);
      const property = properties.find(p => p.id === (tenant.propertyId || unit?.propertyId));
      const owner = owners.find(o => o.id === (tenant.ownerId || property?.ownerId));

      let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

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

        if (!exists) {
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

          const rentAmount = tenant.rentAmount || unit?.rentValue || 0;
          groupsMap.get(groupKey)!.items.push({
            tenant,
            unit,
            rentAmount,
            dueDate,
            dueId
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
          commissionType: commType,
          commissionValue: commVal,
          commissionAmount: tenantCommissionAmount,
          netOwnerAmount: tenantNetOwnerAmount,

          status: 'pending',
          payoutStatus: 'pending_payout',
          collectionStatus: 'pending_collection',
          monthClosingStatus: 'open',
          createdAt: new Date().toISOString()
        };

        addFirestoreDoc('re_dues', newDue, newDue.id).catch(err => console.error('Error auto-generating due:', err));
      });
    });
  }, [tenants, units, properties, owners, dues]);

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
    unitId: '', fullName: '', phone: '', nationalId: '', contractStartDate: '', contractEndDate: '', rentAmount: 3000, status: 'active', notes: '',
    email: '', address: '', nationality: 'مصري', birthDate: '', paymentMethod: 'شهري', depositAmount: 0, contractDuration: 'سنة واحدة', contractNumber: '', ownerId: '', propertyId: '', attachments: []
  });
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

  // Report State
  const [reportType, setReportType] = useState<'owner' | 'arrears' | 'general'>('general');
  const [reportTargetId, setReportTargetId] = useState('all');

  // Role permissions checking
  const isManager = currentUser.role === 'admin';
  const isAccountant = currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.role === 'secretary' || currentUser.role === 'employee' || Boolean(currentUser.permissions?.addClient);
  const isCollector = currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.role === 'secretary' || currentUser.role === 'employee' || Boolean(currentUser.permissions?.addClient);

  const getRoleLabel = () => {
    switch(currentUser.role) {
      case 'admin': return 'مدير النظام';
      case 'lawyer': return 'محاسب مالي';
      case 'secretary': return 'محصل ميداني';
      default: return 'مستخدم عادي';
    }
  };

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
      setTenantForm({
        unitId: vacantUnit?.id || '',
        fullName: '',
        phone: '',
        nationalId: '',
        contractStartDate: new Date().toISOString().slice(0, 10),
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

  const handleNextTenantStep = () => {
    if (activeTenantStep === 'tenant') {
      if (!tenantForm.fullName.trim()) {
        alert('يرجى إدخال اسم المستأجر الرباعي للمتابعة.');
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
        alert('يرجى إدخال رقم الجوال الفعال للمتابعة.');
        return;
      }
      setActiveTenantStep('property');
    } else if (activeTenantStep === 'property') {
      setActiveTenantStep('contract');
    } else if (activeTenantStep === 'contract') {
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
      setTenantForm({
        unitId: item.unitId || '',
        fullName: item.fullName,
        phone: item.phone,
        nationalId: item.nationalId,
        contractStartDate: item.contractStartDate,
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
        attachments: item.attachments || []
      });
    }
    if (type === 'collection') setCollectionForm({ tenantId: item.tenantId, unitId: item.unitId, propertyId: item.propertyId || '', amountPaid: item.amountPaid, forMonthYear: item.forMonthYear, paymentDate: item.paymentDate, paymentMethod: item.paymentMethod, attachmentUrl: item.attachmentUrl || '', notes: item.notes || '' });
    if (type === 'payout') setPayoutForm({ ownerId: item.ownerId, totalCollected: item.totalCollected, commissionDeducted: item.commissionDeducted, expensesDeducted: item.expensesDeducted, netAmountPaid: item.netAmountPaid, payoutDate: item.payoutDate, paymentMethod: item.paymentMethod, bankTransactionRef: item.bankTransactionRef || '', status: item.status, signedByOwner: item.signedByOwner, notes: item.notes || '' });
    if (type === 'expense') setExpenseForm({ propertyId: item.propertyId, ownerId: item.ownerId, amount: item.amount, category: item.category, description: item.description, expenseDate: item.expenseDate, attachmentUrl: item.attachmentUrl || '' });
  };

  const handleDelete = async (collectionName: string, id: string, entityNameAr: string, detailName: string) => {
    if (!isManager) {
      alert('⚠️ عذراً، لا تمتلك الصلاحية الكافية لحذف السجلات. يرجى مراجعة مدير النظام.');
      return;
    }
    if (confirm(`هل أنت متأكد من حذف ${entityNameAr} (${detailName}) بشكل نهائي؟`)) {
      await deleteFirestoreDoc(collectionName, id);
      await logAction('delete', entityNameAr, `تم حذف ${entityNameAr}: ${detailName}`);
    }
  };

  const handleOpenCollectRentModal = (due: ReRentDue) => {
    setSelectedDueToCollect(due);
    setCollectForm({
      paidDate: new Date().toISOString().slice(0, 10),
      collectedAmount: due.rentAmount,
      paymentMethod: 'cash',
      receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: ''
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'collect_rent' && selectedDueToCollect) {
        const receiptNo = collectForm.receiptNumber || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const isPayoutDone = selectedDueToCollect.payoutStatus === 'paid_out' || selectedDueToCollect.status === 'paid_out';
        
        // 1. Update rent due status in re_dues
        await updateFirestoreDoc('re_dues', selectedDueToCollect.id, {
          status: isPayoutDone ? 'paid_out' : 'collected',
          collectionStatus: 'collected',
          collectedAmount: collectForm.collectedAmount,
          paidDate: collectForm.paidDate,
          paymentMethod: collectForm.paymentMethod,
          receiptNumber: receiptNo,
          collectedBy: currentUser.fullName,
          collectionNotes: collectForm.notes
        });

        // 2. Add collection receipt in re_collections
        const newReceipt: Omit<ReCollectionReceipt, 'id'> = {
          receiptNumber: receiptNo,
          tenantId: selectedDueToCollect.tenantId,
          unitId: selectedDueToCollect.unitId,
          propertyId: selectedDueToCollect.propertyId,
          amountPaid: collectForm.collectedAmount,
          forMonthYear: selectedDueToCollect.forMonthYear,
          paymentDate: collectForm.paidDate,
          paymentMethod: collectForm.paymentMethod as any,
          collectedBy: currentUser.fullName,
          notes: collectForm.notes || `تحصيل إيجار شهر ${selectedDueToCollect.monthNameAr}`,
          createdAt: new Date().toISOString()
        };
        await addFirestoreDoc('re_collections', newReceipt);

        // 3. Log Action
        await logAction('collection', 'تحصيل إيجار شهري', `تم تحصيل إيجار شهر ${selectedDueToCollect.monthNameAr} للمستأجر ${selectedDueToCollect.tenantName} بمبلغ ${collectForm.collectedAmount} ج.م - صافي المالك: ${selectedDueToCollect.netOwnerAmount} ج.م`);

        alert('✅ تم تحصيل الإيجار بنجاح وتسجيل سند القبض في النظام!');
        setIsModalOpen(false);
        setModalType(null);
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
        const { isValid, normalizedValue } = validateNationalId(tenantForm.nationalId, false);
        if (!isValid) {
          alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة في حال إدخاله.');
          return;
        }
        const finalTenantForm = { ...tenantForm, nationalId: normalizedValue };
        if (editingId) {
          await updateFirestoreDoc('re_tenants', editingId, finalTenantForm);
          await logAction('edit', 'مستأجر', `تعديل بيانات المستأجر: ${finalTenantForm.fullName}`);
        } else {
          const res = await addFirestoreDoc('re_tenants', finalTenantForm);
          // Auto update unit status to rented
          if (finalTenantForm.unitId) {
            await updateFirestoreDoc('re_units', finalTenantForm.unitId, { status: 'rented' });
          }
          await logAction('add', 'مستأجر', `تسجيل عقد مستأجر جديد: ${finalTenantForm.fullName}`);
        }
      }

      if (modalType === 'collection') {
        if (!isCollector) return alert('⚠️ الصلاحية غير كافية لتسجيل عمليات التحصيل.');
        const receiptNo = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // Find tenant and unit property association
        const tenant = tenants.find(t => t.id === collectionForm.tenantId);
        const unit = units.find(u => u.id === (tenant?.unitId || collectionForm.unitId));
        const propId = unit?.propertyId || '';

        const recordToSave = {
          ...collectionForm,
          receiptNumber: editingId ? undefined : receiptNo,
          collectedBy: currentUser.fullName,
          unitId: unit?.id || collectionForm.unitId,
          propertyId: propId
        };

        if (editingId) {
          await updateFirestoreDoc('re_collections', editingId, recordToSave);
          await logAction('collection', 'عملية تحصيل', `تعديل إيصال التحصيل للمستأجر: ${tenant?.fullName}`);
        } else {
          await addFirestoreDoc('re_collections', recordToSave);
          await logAction('collection', 'عملية تحصيل', `تحصيل إيجار المستأجر ${tenant?.fullName} بقيمة ${collectionForm.amountPaid} ج.م`);
        }
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
    const ownerCols = collections.filter(c => propIds.includes(c.propertyId));
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
    const ownerExps = expenses.filter(e => propIds.includes(e.propertyId));
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
    return owners.filter(o => 
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      o.phone.includes(searchQuery)
    );
  }, [owners, searchQuery]);

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOwner = selectedOwnerId === 'all' || p.ownerId === selectedOwnerId;
      return matchesSearch && matchesOwner;
    });
  }, [properties, searchQuery, selectedOwnerId]);

  const filteredUnits = useMemo(() => {
    return units.filter(u => {
      const prop = properties.find(p => p.id === u.propertyId);
      const matchesSearch = u.unitNumber.includes(searchQuery) || prop?.name.includes(searchQuery);
      const matchesProperty = selectedPropertyId === 'all' || u.propertyId === selectedPropertyId;
      const matchesStatus = categoryFilter === 'all' || u.status === categoryFilter;
      return matchesSearch && matchesProperty && matchesStatus;
    });
  }, [units, searchQuery, selectedPropertyId, categoryFilter, properties]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      const unit = units.find(u => u.id === t.unitId);
      const prop = unit ? properties.find(p => p.id === unit.propertyId) : null;
      
      const matchesSimpleSearch = !searchQuery ? true : (
        t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.phone.includes(searchQuery) || 
        (prop && prop.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.nationalId.includes(searchQuery)
      );

      const matchesName = !tenantSearchName ? true : t.fullName.toLowerCase().includes(tenantSearchName.toLowerCase());
      const matchesProperty = tenantSearchPropertyId === 'all' ? true : (unit && unit.propertyId === tenantSearchPropertyId);
      const matchesUnitNumber = !tenantSearchUnitNumber ? true : (unit && unit.unitNumber.toLowerCase().includes(tenantSearchUnitNumber.toLowerCase()));
      const matchesContractNumber = !tenantSearchContractNumber ? true : (
        t.contractNumber ? t.contractNumber.toLowerCase().includes(tenantSearchContractNumber.toLowerCase()) : false
      );
      const matchesNationalId = !tenantSearchNationalId ? true : t.nationalId.toLowerCase().includes(tenantSearchNationalId.toLowerCase());
      const matchesStatus = tenantSearchStatus === 'all' ? true : t.status === tenantSearchStatus;

      return matchesSimpleSearch && matchesName && matchesProperty && matchesUnitNumber && matchesContractNumber && matchesNationalId && matchesStatus;
    });
  }, [tenants, searchQuery, tenantSearchName, tenantSearchPropertyId, tenantSearchUnitNumber, tenantSearchContractNumber, tenantSearchNationalId, tenantSearchStatus, units, properties]);

  const filteredCollections = useMemo(() => {
    return collections.filter(c => {
      const tenant = tenants.find(t => t.id === c.tenantId);
      const prop = properties.find(p => p.id === c.propertyId);
      const matchesSearch = tenant?.fullName.includes(searchQuery) || c.receiptNumber.includes(searchQuery) || prop?.name.includes(searchQuery);
      const matchesMonth = categoryFilter === 'all' || c.forMonthYear === categoryFilter;
      return matchesSearch && matchesMonth;
    });
  }, [collections, searchQuery, categoryFilter, tenants, properties]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const prop = properties.find(p => p.id === e.propertyId);
      return e.category.includes(searchQuery) || e.description.includes(searchQuery) || prop?.name.includes(searchQuery);
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
      
      const ownerCols = collections.filter(c => propIds.includes(c.propertyId));
      const totalCollected = ownerCols.reduce((acc, curr) => acc + curr.amountPaid, 0);

      let commissionDeducted = 0;
      if (owner) {
        ownerCols.forEach(c => {
          if (owner.commissionType === 'percentage') commissionDeducted += (c.amountPaid * (owner.commissionValue / 100));
          else if (owner.commissionType === 'fixed_per_thousand') commissionDeducted += (c.amountPaid * (owner.commissionValue / 1000));
          else commissionDeducted += owner.commissionValue;
        });
      }

      const ownerExps = expenses.filter(e => propIds.includes(e.propertyId));
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
      <aside className="w-full lg:w-52 bg-[#132238]/40 backdrop-blur-md border-l border-[#D4A84F]/15 p-3.5 space-y-4 flex flex-col justify-between shrink-0 shadow-2xl relative z-10">
        
        <div className="space-y-6">
          {/* Module Logo / Identity */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#D4A84F]/15">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#D4A84F] to-[#B38734] text-slate-950 shadow-lg shadow-[#D4A84F]/10">
              <Building className="w-5.5 h-5.5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#F8F9FB] tracking-wide">المنشآت والعقارات 🏠</h2>
              <span className="text-[10px] text-[#9EA7B8] font-sans font-black">بوابة التحصيل والتسويات الذكية</span>
            </div>
          </div>

          {/* Connected User Role status */}
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/15 shadow-inner">
            <Shield className="w-4.5 h-4.5 text-[#D4A84F] stroke-[2]" />
            <div>
              <p className="text-[10px] text-[#9EA7B8] font-sans font-black">المحاسب المفوض:</p>
              <p className="text-[11px] font-extrabold text-[#F8F9FB]">{currentUser.fullName} <span className="text-[9px] font-bold text-[#D4A84F]">({getRoleLabel()})</span></p>
            </div>
          </div>

          {/* Sidebar Navigation Menu */}
          <div className="space-y-1 pt-2">
            <h3 className="text-[10px] text-[#9EA7B8] font-sans font-black uppercase tracking-wide px-2.5 mb-2">القائمة الرئيسية</h3>
            {[
              { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
              { id: 'owners', label: 'الملاك', icon: Users },
              { id: 'properties', label: 'العقارات', icon: Building },
              { id: 'tenants', label: 'العقود', icon: FileText },
              { id: 'financials', label: 'المالية', icon: Wallet }
            ].map(tab => {
              const isActive = activeMainTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchMainTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-black transition-all duration-300 rounded-xl cursor-pointer text-right ${
                    isActive 
                      ? 'bg-[#D4A84F]/15 text-[#D4A84F] border border-[#D4A84F]/25 shadow-md shadow-[#D4A84F]/5' 
                      : 'border border-transparent text-[#9EA7B8] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#D4A84F]' : 'text-[#9EA7B8]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Real Estate Stats Mini-Bento in Sidebar */}
          <div className="pt-4 border-t border-[#D4A84F]/15 space-y-3">
            <h3 className="text-[10px] text-[#9EA7B8] font-sans font-black uppercase tracking-wide">إحصائيات المحفظة:</h3>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
              <div className="bg-[#132238]/60 p-2 py-3 rounded-xl border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[9px] text-[#9EA7B8] block font-black">الملاك</span>
                <span className="font-extrabold text-[#D4A84F] font-mono">{owners.length}</span>
              </div>
              <div className="bg-[#132238]/60 p-2 py-3 rounded-xl border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[9px] text-[#9EA7B8] block font-black">العقارات</span>
                <span className="font-extrabold text-[#D4A84F] font-mono">{properties.length}</span>
              </div>
              <div className="bg-[#132238]/60 p-2 py-3 rounded-xl border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[9px] text-[#9EA7B8] block font-black">الوحدات</span>
                <span className="font-extrabold text-[#D4A84F] font-mono">{units.length}</span>
              </div>
              <div className="bg-[#132238]/60 p-2 py-3 rounded-xl border border-[#D4A84F]/10 shadow-inner">
                <span className="text-[9px] text-[#9EA7B8] block font-black">العقود</span>
                <span className="font-extrabold text-[#D4A84F] font-mono">{tenants.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brand footer */}
        <div className="pt-4 border-t border-[#D4A84F]/15 text-center text-[10px] text-[#9EA7B8] font-mono font-bold">
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
                  { id: 'payouts', label: 'تسوية الملاك كشوف الحساب' },
                  { id: 'expenses', label: 'مصروفات العقارات' },
                  { id: 'reports', label: 'محرك التقارير الذكية' },
                  { id: 'logs', label: 'سجل العمليات والرقابة' }
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
          {activeSubTab !== 'dashboard' && activeSubTab !== 'reports' && activeSubTab !== 'logs' && (
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
                <button onClick={() => handleOpenAddModal('tenant')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> إضافة مستأجر
                </button>
              )}
              {activeSubTab === 'collections' && isCollector && (
                <button onClick={() => handleOpenAddModal('collection')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> تحصيل قيمة الإيجار
                </button>
              )}
              {activeSubTab === 'payouts' && isAccountant && (
                <button onClick={() => handleOpenAddModal('payout')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> تسوية حسابات الملاك
                </button>
              )}
              {activeSubTab === 'expenses' && isAccountant && (
                <button onClick={() => handleOpenAddModal('expense')} className="px-4 py-2.5 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg shadow-[#D4A84F]/10">
                  <Plus className="w-4 h-4 stroke-[3] text-slate-950" /> إثبات مصروف تشغيلي
                </button>
              )}
            </div>
          )}
        </div>

        {/* STAGE CONTAINER */}
        <div className="space-y-6">
          
          {/* 1. DASHBOARD */}
          {activeSubTab === 'dashboard' && (
            <RealEstateDashboard 
              owners={owners}
              properties={properties}
              units={units}
              tenants={tenants}
              collections={collections}
              payouts={payouts}
              expenses={expenses}
              onNavigateToTab={(tabId) => setActiveSubTab(tabId as any)}
            />
          )}

          {/* 2. OWNERS LIST */}
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

                      {/* Admin action widgets overlaying card */}
                      {isAccountant && (
                        <div className="absolute left-3 bottom-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-[#132238]/90 p-1.5 rounded-xl shadow-lg border border-[#D4A84F]/15">
                          <button onClick={() => handleEdit('property', prop)} className="p-1.5 rounded bg-[#D4A84F] text-slate-950 hover:bg-[#E5B95F] cursor-pointer" title="تعديل"><Edit2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                          <button onClick={() => handleDelete('re_properties', prop.id, 'عقار', prop.name)} className="p-1.5 rounded bg-red-600/80 text-white hover:bg-red-700 cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
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
                      <option value="expired">منتهي</option>
                      <option value="evicted">مخلى</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tenants Data Table */}
              <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] text-[#F8F9FB] space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-[#9EA7B8]">
                  <span>
                    تم العثور على <strong className="text-[#D4A84F] font-mono">{filteredTenants.length}</strong> مستأجرين مطابقين للفرز
                  </span>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-[#D4A84F]/10">
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
                                  tenant.status === 'expired' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {tenant.status === 'active' && 'ساري'}
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
                                  {isAccountant && (
                                    <>
                                      <button onClick={() => handleEdit('tenant', tenant)} className="p-2 rounded-lg bg-[#D4A84F] text-slate-950 hover:bg-[#E5B95F] shadow-sm hover:shadow cursor-pointer hover:scale-105 transition-all" title="تعديل"><Edit2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                                      <button onClick={() => handleDelete('re_tenants', tenant.id, 'مستأجر وعقد', tenant.fullName)} className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-700 shadow-sm hover:shadow cursor-pointer hover:scale-105 transition-all" title="حذف"><Trash2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                                    </>
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

          {/* FINANCIALS MODULE (DUES, COLLECTIONS, PAYOUTS, STATEMENTS, CLOSING, REPORTS) */}
          {['dues', 'payouts', 'reports', 'collections', 'financials', 'property_statements', 'owner_statements', 'tenant_statements', 'closing', 'overview'].includes(activeSubTab) && (
            <RealEstateFinancials
              dues={dues}
              owners={owners}
              properties={properties}
              units={units}
              tenants={tenants}
              collections={collections}
              payouts={payouts}
              expenses={expenses}
              currentUser={currentUser}
              activeSubTab={activeSubTab}
              onNavigateSubTab={(subTab) => setActiveSubTab(subTab)}
              onCollectRent={(due) => handleOpenCollectRentModal(due)}
              onPayoutOwner={(due) => handleOpenPayoutDueModal(due)}
            />
          )}

          {/* 8. EXPENSES */}
          {activeSubTab === 'expenses' && (
            <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] text-[#F8F9FB]">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#D4A84F]/15 text-[#9EA7B8] font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4">العقار المرتبط</th>
                      <th className="py-3.5 px-4">الفئة/البند</th>
                      <th className="py-3.5 px-4">شرح وبيان المصروف</th>
                      <th className="py-3.5 px-4">القيمة المصروفة</th>
                      <th className="py-3.5 px-4">تاريخ الفاتورة</th>
                      <th className="py-3.5 px-4">سجل بواسطة</th>
                      <th className="py-3.5 px-4 text-left">خيارات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(expense => {
                      const prop = properties.find(p => p.id === expense.propertyId);
                      return (
                        <tr key={expense.id} className="border-b border-[#D4A84F]/10 hover:bg-[#132238]/30 transition-colors">
                          <td className="py-4 px-4 font-black text-[#F8F9FB]">{prop?.name || '—'}</td>
                          <td className="py-4 px-4 text-[#9EA7B8] font-bold">{expense.category}</td>
                          <td className="py-4 px-4 text-[#9EA7B8] font-bold">{expense.description}</td>
                          <td className="py-4 px-4 font-mono font-black text-red-400">{(expense.amount).toLocaleString('ar-EG')} ج.م</td>
                          <td className="py-4 px-4 font-mono text-[#9EA7B8] font-bold">{expense.expenseDate}</td>
                          <td className="py-4 px-4 text-[#9EA7B8] font-bold">{expense.recordedBy}</td>
                          <td className="py-4 px-4 text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              {expense.attachmentUrl && (
                                <a href={expense.attachmentUrl} target="_blank" rel="noreferrer" className="p-2 rounded bg-[#D4A84F] text-slate-950 hover:bg-[#E5B95F] shadow-sm hover:shadow transition-all" title="معاينة الفاتورة">
                                  <FileText className="w-3.5 h-3.5 stroke-[2]" />
                                </a>
                              )}
                              {isAccountant && (
                                <>
                                  <button onClick={() => handleEdit('expense', expense)} className="p-2 rounded-lg bg-[#D4A84F] text-slate-950 hover:bg-[#E5B95F] shadow-sm hover:shadow cursor-pointer"><Edit2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                                  <button onClick={() => handleDelete('re_expenses', expense.id, 'مصروف عقار', expense.category)} className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-700 shadow-sm hover:shadow cursor-pointer"><Trash2 className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                                </>
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
          )}

          {/* 9. DETAILED REPORTS & PRINTER ENGINE */}
          {activeSubTab === 'reports' && (
            <div className="space-y-6">
              
              {/* Report Configuration Panel */}
              <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] flex flex-wrap items-center justify-between gap-4 text-[#F8F9FB]">
                                {/* Report Content Body based on configuration */}
                {reportType === 'general' && generatedReport && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black text-[#D4A84F] print:text-black border-r-4 border-[#D4A84F] pr-3 font-sans">كشف الحساب الإجمالي لعمولات ومتحصلات القطاع العقاري</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-bold">
                      <div className="p-4 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/10 print:bg-slate-100 print:text-black">
                        <span className="text-[10px] text-[#9EA7B8] block">إجمالي الإيجارات المحصلة</span>
                        <span className="text-lg font-black text-[#F8F9FB] font-mono print:text-black">{(generatedReport.totalCollected).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/10 print:bg-slate-100 print:text-black">
                        <span className="text-[10px] text-[#9EA7B8] block">إجمالي عمولات المكتب المحققة</span>
                        <span className="text-lg font-black text-[#D4A84F] font-mono print:text-black">{(generatedReport.totalCommissions).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/10 print:bg-slate-100 print:text-black">
                        <span className="text-[10px] text-[#9EA7B8] block">إجمالي المصروفات المنفقة</span>
                        <span className="text-lg font-black text-red-400 font-mono print:text-black">{(generatedReport.totalExpenses).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[#D4A84F]/10 border border-[#D4A84F]/20 print:bg-slate-200 print:text-black shadow-sm">
                        <span className="text-[10px] text-[#D4A84F] block">صافي أرباح المكتب من المحفظة</span>
                        <span className="text-lg font-black text-[#D4A84F] font-mono print:text-black">{(generatedReport.netProfit).toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>

                    {/* Detailed tabular statistics */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-[#F8F9FB] print:text-slate-800">بيانات الأداء الإشغالي للمحفظة حالياً</h4>
                      <div className="grid grid-cols-3 gap-4 text-center text-xs font-bold">
                        <div className="p-3.5 rounded-xl border border-[#D4A84F]/10 print:border-slate-300 bg-[#132238]/50 text-[#F8F9FB] print:text-black print:bg-white">
                          <span className="text-[#9EA7B8] block">الوحدات المؤجرة والنشطة</span>
                          <span className="text-sm font-black text-[#D4A84F] print:text-black font-mono">{units.filter(u => u.status === 'rented').length} من أصل {units.length} وحدات</span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-[#D4A84F]/10 print:border-slate-300 bg-[#132238]/50 text-[#F8F9FB] print:text-black print:bg-white">
                          <span className="text-[#9EA7B8] block">الملاك النشطين</span>
                          <span className="text-sm font-black text-[#D4A84F] print:text-black font-mono">{owners.length} ملاك عقارات</span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-[#D4A84F]/10 print:border-slate-300 bg-[#132238]/50 text-[#F8F9FB] print:text-black print:bg-white">
                          <span className="text-[#9EA7B8] block">إجمالي العقارات العامة</span>
                          <span className="text-sm font-black text-[#D4A84F] print:text-black font-mono">{properties.length} عقارات</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportType === 'owner' && generatedReport && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-black text-[#D4A84F] print:text-black border-r-4 border-[#D4A84F] pr-3 font-sans">تقرير كشف تسوية الحساب المالي للمالك: {generatedReport.ownerName}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                      <div className="space-y-1.5 p-4 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/10 print:bg-slate-50 print:border-slate-300">
                        <p className="text-[#9EA7B8] font-bold">رقم الهاتف المستفيد: <span className="font-mono text-[#F8F9FB] print:text-black font-black">{generatedReport.phone}</span></p>
                        <p className="text-[#9EA7B8] font-bold">العقارات والمنشآت المسجلة: <span className="text-[#F8F9FB] print:text-black font-bold">{generatedReport.properties}</span></p>
                      </div>
                      <div className="space-y-1.5 p-4 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/10 print:bg-slate-50 print:border-slate-300">
                        <p className="text-[#9EA7B8] font-bold">القطاع المسؤول: <span className="text-[#F8F9FB] print:text-black font-bold">قسم الحسابات العقارية بمكتب الرميح</span></p>
                        <p className="text-[#9EA7B8] font-bold">حالة المستحقات: <span className="text-[#D4A84F] font-black">جاهزة للصرف الفوري</span></p>
                      </div>
                    </div>

                    {/* Detailed Math Balance Sheet */}
                    <div className="p-5 rounded-2xl bg-[#132238]/60 border border-[#D4A84F]/10 space-y-4 print:bg-white print:border-slate-300">
                      <h4 className="text-sm font-black text-[#D4A84F] print:text-black border-b border-[#D4A84F]/10 pb-2 print:border-slate-300">معادلة احتساب التسوية الصافية:</h4>
                      
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between font-bold">
                          <span className="text-[#9EA7B8] print:text-slate-700">إجمالي المبالغ والايجارات المحصلة من مستأجري العقارات:</span>
                          <span className="font-mono font-black text-[#D4A84F]">{(generatedReport.totalCollected).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-[#9EA7B8] print:text-slate-700">يخصم عمولة المكتب والتحصيل القانوني نيابة عنكم:</span>
                          <span className="font-mono font-black text-red-400">- {(generatedReport.commissionDeducted).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span className="text-[#9EA7B8] print:text-slate-700">يخصم مصروفات صيانة وترميم فواتير العقار:</span>
                          <span className="font-mono font-black text-amber-500">- {(generatedReport.totalExpenses).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        <div className="flex justify-between border-t border-[#D4A84F]/15 pt-3.5 text-sm font-black print:border-slate-300">
                          <span className="text-[#F8F9FB] print:text-black">صافي المبلغ المراد تسليمه للمالك:</span>
                          <span className="font-mono text-[#D4A84F] print:text-emerald-600 font-black">{(generatedReport.netPayout).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                      </div>
                    </div>

                    {/* Signature block */}
                    <div className="pt-8 flex justify-between items-center text-xs text-center font-bold">
                      <div className="space-y-12">
                        <p className="text-[#9EA7B8] print:text-slate-600">قسم الحسابات والتحصيل (مكتب الرميح)</p>
                        <p className="font-black border-t border-[#D4A84F]/15 pt-2 w-40 mx-auto print:border-slate-400">توقيع المحاسب</p>
                      </div>
                      <div className="space-y-12">
                        <p className="text-[#9EA7B8] print:text-slate-600">المالك المستفيد أو من ينوب عنه</p>
                        <p className="font-black border-t border-[#D4A84F]/15 pt-2 w-40 mx-auto print:border-slate-400">توقيع المالك</p>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>
          )}

          {/* 10. SYSTEM AUDIT LOGS */}
          {activeSubTab === 'logs' && (
            <div className="bg-[#132238]/50 backdrop-blur-md border border-[#D4A84F]/15 rounded-3xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.35)] text-[#F8F9FB] space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#D4A84F]/15 text-[#9EA7B8] font-black uppercase tracking-wider">
                      <th className="py-3.5 px-4">نوع الحركة</th>
                      <th className="py-3.5 px-4">الوحدة/البند المستهدف</th>
                      <th className="py-3.5 px-4">تفاصيل العملية</th>
                      <th className="py-3.5 px-4">الموظف المسؤول</th>
                      <th className="py-3.5 px-4">التوقيت والتاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-[#D4A84F]/10 hover:bg-[#132238]/30 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black ${
                            log.actionType === 'add' ? 'bg-[#D4A84F]/10 text-[#D4A84F] border border-[#D4A84F]/20' :
                            log.actionType === 'collection' ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20' :
                            log.actionType === 'delete' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-[#E5B95F]/10 text-[#E5B95F] border border-[#E5B95F]/20'
                          }`}>
                            {log.actionType === 'add' && 'إضافة جديدة'}
                            {log.actionType === 'edit' && 'تعديل سجل'}
                            {log.actionType === 'delete' && 'حذف نهائي'}
                            {log.actionType === 'collection' && 'تحصيل مالي'}
                            {log.actionType === 'payout' && 'تسوية مالية'}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-black text-[#F8F9FB]">{log.entityName}</td>
                        <td className="py-4 px-4 text-[#9EA7B8] font-bold">{log.details}</td>
                        <td className="py-4 px-4 text-[#F8F9FB] font-sans font-bold">{log.username}</td>
                        <td className="py-4 px-4 font-mono text-[#9EA7B8] font-bold">{log.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* GLOBAL PREMIUM DRAWER/OVERLAY MODAL FOR ALL FORMS */}
      <AnimatePresence>
        {isModalOpen && modalType && (
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
                        { id: 'property', label: 'العقار والمالك', desc: 'المالك والبرج والوحدة الشاغرة', icon: Landmark },
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
                                    alert('يرجى إدخال اسم المستأجر الرباعي للمتابعة.');
                                    return;
                                  }
                                  const { isValid, normalizedValue } = validateNationalId(tenantForm.nationalId, true);
                                  if (!isValid) {
                                    alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة.');
                                    return;
                                  }
                                  setTenantForm(prev => ({ ...prev, nationalId: normalizedValue }));
                                  if (!tenantForm.phone.trim()) {
                                    alert('يرجى إدخال رقم الجوال الفعال للمتابعة.');
                                    return;
                                  }
                                }
                                if (targetIdx > 1 && currentIdx >= 1) {
                                  if (!tenantForm.unitId) {
                                    alert('يرجى اختيار وحدة الإيجار الشاغرة للمتابعة.');
                                    return;
                                  }
                                }
                                if (targetIdx > 2 && currentIdx >= 2) {
                                  if (!tenantForm.rentAmount || tenantForm.rentAmount <= 0) {
                                    alert('يرجى إدخال قيمة إيجار شهري صحيحة للمتابعة.');
                                    return;
                                  }
                                  if (!tenantForm.contractStartDate) {
                                    alert('يرجى إدخال تاريخ بداية التعاقد للمتابعة.');
                                    return;
                                  }
                                  if (!tenantForm.contractEndDate) {
                                    alert('يرجى إدخال تاريخ نهاية التعاقد للمتابعة.');
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
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">اسم المستأجر الرباعي *</label>
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
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">رقم الجوال الفعال *</label>
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

                            {/* Vacant Unit Selection */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">وحدة الإيجار الشاغرة</label>
                              <select 
                                value={tenantForm.unitId} 
                                onChange={(e) => handleTenantFormChange({ unitId: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="">-- اختر رقم الوحدة --</option>
                                {units
                                  .filter(u => {
                                    // Show vacant units, but also allow current rented unit if editing
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
                              </select>
                            </div>
                          </div>
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
                                value={tenantForm.rentAmount} 
                                onChange={(e) => setTenantForm({ ...tenantForm, rentAmount: Number(e.target.value) })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">مبلغ التأمين المستحق (ج.م)</label>
                              <input 
                                type="number" 
                                value={tenantForm.depositAmount || 0} 
                                onChange={(e) => setTenantForm({ ...tenantForm, depositAmount: Number(e.target.value) })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
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
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">مدة العقد الإجمالية</label>
                              <input 
                                type="text" 
                                value={tenantForm.contractDuration || ''} 
                                onChange={(e) => setTenantForm({ ...tenantForm, contractDuration: e.target.value })} 
                                placeholder="مثال: سنة واحدة" 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">حالة العقد الحالي</label>
                              <select 
                                value={tenantForm.status} 
                                onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value as any })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              >
                                <option value="active">ساري مفعول</option>
                                <option value="expired">منتهي الصلاحية</option>
                                <option value="evicted">مخلى بالتراضي / قانونيًا</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">تاريخ بداية التعاقد</label>
                              <input 
                                type="date" 
                                value={tenantForm.contractStartDate} 
                                onChange={(e) => setTenantForm({ ...tenantForm, contractStartDate: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-[#9EA7B8] font-bold block">تاريخ نهاية التعاقد</label>
                              <input 
                                type="date" 
                                value={tenantForm.contractEndDate} 
                                onChange={(e) => setTenantForm({ ...tenantForm, contractEndDate: e.target.value })} 
                                className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F] transition-all"
                              />
                            </div>

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
                                <p className="font-bold text-[#F8F9FB]">الوحدة السكنية: <span className="text-amber-400 font-extrabold">
                                  {(() => {
                                    const u = units.find(un => un.id === tenantForm.unitId);
                                    return u ? `وحدة ${u.unitNumber} - طابق ${u.floor} (${u.activityType === 'commercial' ? 'تجاري' : u.activityType === 'administrative' ? 'إداري' : 'سكني'})` : '—';
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
                                <p className="font-bold text-[#F8F9FB]">فترة التعاقد: <span className="text-[#9EA7B8]">{tenantForm.contractStartDate || '—'} إلى {tenantForm.contractEndDate || '—'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">دورية السداد: <span className="text-amber-400 font-bold">{tenantForm.paymentMethod || 'شهري'}</span></p>
                                <p className="font-bold text-[#F8F9FB]">حالة العقد: <span className={`font-bold ${tenantForm.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {tenantForm.status === 'active' ? 'ساري مفعول' : tenantForm.status === 'expired' ? 'منتهي الصلاحية' : 'مخلى'}
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
                      <label className="text-xs text-slate-500 font-bold block">اختر المستأجر المسدد *</label>
                      <select required value={collectionForm.tenantId} onChange={(e) => {
                        const tenant = tenants.find(t => t.id === e.target.value);
                        setCollectionForm({ ...collectionForm, tenantId: e.target.value, amountPaid: tenant?.rentAmount || 0 });
                      }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                        <option value="">اختر من القائمة...</option>
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">شهر الاستحقاق المالي *</label>
                        <input type="month" required value={collectionForm.forMonthYear} onChange={(e) => setCollectionForm({ ...collectionForm, forMonthYear: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">المبلغ المدفوع (جنيه) *</label>
                        <input type="number" required value={collectionForm.amountPaid} onChange={(e) => setCollectionForm({ ...collectionForm, amountPaid: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">وسيلة الاستلام والسداد *</label>
                        <select value={collectionForm.paymentMethod} onChange={(e) => setCollectionForm({ ...collectionForm, paymentMethod: e.target.value as any })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all">
                          <option value="cash">نقداً بالخزينة</option>
                          <option value="instapay">تطبيق إنستاباي الرقمي</option>
                          <option value="bank_transfer">حوالة/تحويل بنكي</option>
                          <option value="vodafone_cash">فودافون كاش</option>
                          <option value="check">شيك بنكي رسمي</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-bold block">تاريخ استلام الأموال *</label>
                        <input type="date" required value={collectionForm.paymentDate} onChange={(e) => setCollectionForm({ ...collectionForm, paymentDate: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-600 focus:bg-white transition-all" />
                      </div>
                    </div>

                    {/* Receipt photo uploader */}
                    <div className="space-y-1 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <label className="text-xs text-slate-500 block font-bold">رفع إيصال السداد أو لقطة الشاشة (R2)</label>
                      <input type="file" onChange={handleUpload} className="hidden" id="receipt-upload" />
                      <label htmlFor="receipt-upload" className="mt-1.5 px-4 py-2 rounded-xl bg-white text-slate-800 text-xs font-semibold cursor-pointer border border-slate-200 hover:bg-slate-100 flex items-center gap-1.5 w-fit transition-all">
                        <Upload className="w-4 h-4 text-emerald-600" /> رفع الإثبات المالي
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

                {/* 8. COLLECT RENT MODAL FORM */}
                {modalType === 'collect_rent' && selectedDueToCollect && (
                  <div className="space-y-4 text-right">
                    <div className="p-4 rounded-2xl bg-[#08111F]/80 border border-[#D4A84F]/20 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">المستأجر:</span>
                        <span className="text-[#F8F9FB] font-black">{selectedDueToCollect.tenantName}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">العقار / الوحدة:</span>
                        <span className="text-[#F8F9FB] font-bold">{selectedDueToCollect.propertyName} - وحدة {selectedDueToCollect.unitNumber}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#9EA7B8] font-bold">شهر الاستحقاق:</span>
                        <span className="text-[#D4A84F] font-mono font-black">{selectedDueToCollect.monthNameAr}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-[#D4A84F]/10 pt-2">
                        <span className="text-[#9EA7B8] font-bold">قيمة الإيجار المستحق:</span>
                        <span className="text-emerald-400 font-mono font-black text-sm">{selectedDueToCollect.rentAmount.toLocaleString('ar-EG')} ج.م</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">تاريخ التحصيل الفعلية *</label>
                        <input 
                          type="date" 
                          required 
                          value={collectForm.paidDate} 
                          onChange={(e) => setCollectForm({ ...collectForm, paidDate: e.target.value })} 
                          className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">المبلغ المحصل فعلياً *</label>
                        <input 
                          type="number" 
                          required 
                          value={collectForm.collectedAmount} 
                          onChange={(e) => setCollectForm({ ...collectForm, collectedAmount: Number(e.target.value) })} 
                          className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">طريقة السداد *</label>
                        <select 
                          value={collectForm.paymentMethod} 
                          onChange={(e) => setCollectForm({ ...collectForm, paymentMethod: e.target.value })} 
                          className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]"
                        >
                          <option value="cash">نقداً بالخزينة</option>
                          <option value="instapay">إنستاباي رقمي</option>
                          <option value="bank_transfer">تحويل بنكي</option>
                          <option value="vodafone_cash">فودافون كاش</option>
                          <option value="check">شيك بنكي</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-[#9EA7B8] font-bold block">رقم الإيصال السيريال</label>
                        <input 
                          type="text" 
                          value={collectForm.receiptNumber} 
                          onChange={(e) => setCollectForm({ ...collectForm, receiptNumber: e.target.value })} 
                          className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-[#9EA7B8] font-bold block">ملاحظات أو رقم التحويل</label>
                      <input 
                        type="text" 
                        value={collectForm.notes} 
                        onChange={(e) => setCollectForm({ ...collectForm, notes: e.target.value })} 
                        className="w-full bg-[#08111F]/60 border border-[#D4A84F]/15 rounded-xl px-3 py-2 text-xs text-[#F8F9FB] font-bold focus:outline-none focus:border-[#D4A84F]" 
                        placeholder="اختياري..."
                      />
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
                      
                      {activeTenantStep !== 'review' ? (
                        <button
                          type="button"
                          onClick={handleNextTenantStep}
                          className="px-5 py-2 rounded-xl bg-[#D4A84F]/20 hover:bg-[#D4A84F]/30 text-[#D4A84F] font-black text-xs transition-all"
                        >
                          التالي
                        </button>
                      ) : (
                        <button type="submit" className="px-5 py-2 rounded-xl bg-[#D4A84F] hover:bg-[#E5B95F] text-slate-950 font-black text-xs shadow-sm transition-all">حفظ وتأكيد العقد</button>
                      )}
                    </>
                  ) : (
                    <button type="submit" className="px-5 py-2 rounded-xl bg-[#D4A84F] hover:bg-[#E5B95F] text-slate-950 font-black text-xs shadow-sm transition-all">حفظ وحفظ التغيرات</button>
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

      </AnimatePresence>

    </div>
  );
}
