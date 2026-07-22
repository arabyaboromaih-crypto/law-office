/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Client, Company, Case, CompanyPartner, CompanyDoc, User, HearingSession } from '../types';
import { 
  Users, Building2, Plus, Search, Phone, Mail, MapPin, Briefcase, FileText, 
  MessageSquare, Trash2, Edit3, X, Eye, Printer, UserPlus, FileUp, CheckCircle, Archive,
  ChevronLeft, ChevronRight, Upload, Paperclip, RefreshCw, PlusCircle, FolderOpen
} from 'lucide-react';
import { saveFileToIndexedDB, getFileFromIndexedDB, uploadToR2, getProxiedUrl } from '../utils/fileStorage';
import MultiUploadManager from './MultiUploadManager';
import { toAr } from '../utils/arabicNumbers';
import { validateNationalId } from '../utils/validation';
import { 
  BaseModal, FormCard, SectionHeader, FormGrid, FormField, 
  PrimaryButton, SecondaryButton, DangerButton 
} from './FormComponents';

interface ClientsPanelProps {
  clients: Client[];
  companies: Company[];
  cases: Case[];
  currentUser: User;
  sessions?: HearingSession[];
  users?: User[];
  onAddClient: (c: Client) => void;
  onUpdateClient: (c: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onAddCompany: (co: Company) => void;
  onUpdateCompany: (co: Company) => void;
  onArchiveCompany: (coId: string, reason: string, notes: string) => void;
  onDeleteCompany: (companyId: string) => void;
  onNavigateToTab?: (tab: any) => void;
  onSetCasesSearchQuery?: (query: string) => void;
  returnToClient?: { id: string; name: string } | null;
  onSetReturnToClient?: (ret: { id: string; name: string } | null) => void;
  selectedClientId?: string | null;
  onClearSelectedClientId?: () => void;
  onSetSelectedClientIdForReturn?: (id: string | null) => void;
}

export default function ClientsPanel({ 
  clients, companies, cases, currentUser, sessions = [], users = [], onAddClient, onUpdateClient, onDeleteClient, onAddCompany, onUpdateCompany, onArchiveCompany, onDeleteCompany,
  onNavigateToTab, onSetCasesSearchQuery,
  returnToClient, onSetReturnToClient, selectedClientId, onClearSelectedClientId, onSetSelectedClientIdForReturn
}: ClientsPanelProps) {
  
  // Tabs: Clients vs Companies
  const [activeSubTab, setActiveSubTab] = useState<'clients' | 'companies'>('clients');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Archive Company Modal
  const [archiveCoTarget, setArchiveCoTarget] = useState<Company | null>(null);
  const [archiveCoReason, setArchiveCoReason] = useState('انتهاء التعاقد مع المكتب');
  const [customArchiveCoReason, setCustomArchiveCoReason] = useState('');
  const [archiveCoNotes, setArchiveCoNotes] = useState('');
  const [archiveCoPassword, setArchiveCoPassword] = useState('');
  const [archiveCoError, setArchiveCoError] = useState('');

  // View Company Documents Modal
  const [viewDocsCompany, setViewDocsCompany] = useState<Company | null>(null);

  // Client form states
  const [clName, setClName] = useState('');
  const [clNationalId, setClNationalId] = useState('');
  const [clPhone, setClPhone] = useState('');
  const [clSecondaryPhone, setClSecondaryPhone] = useState('');
  const [clEmail, setClEmail] = useState('');
  const [clAddress, setClAddress] = useState('');
  const [clJob, setClJob] = useState('');
  const [clNotes, setClNotes] = useState('');
  const [clCompanyId, setClCompanyId] = useState('');

  // Individual Client Stepper states
  const [activeClientFormTab, setActiveClientFormTab] = useState<'basic' | 'contact' | 'attachments'>('basic');
  
  // Staging states for Client files
  const [stagedIdCard, setStagedIdCard] = useState<{
    file: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image';
    size: string;
    originalName: string;
  } | null>(null);
  const [idCardUrl, setIdCardUrl] = useState('');
  const [idCardName, setIdCardName] = useState('');
  const [isIdCardUploading, setIsIdCardUploading] = useState(false);

  const [stagedPowerOfAttorney, setStagedPowerOfAttorney] = useState<{
    file: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image';
    size: string;
    originalName: string;
  } | null>(null);
  const [powerOfAttorneyUrl, setPowerOfAttorneyUrl] = useState('');
  const [powerOfAttorneyName, setPowerOfAttorneyName] = useState('');
  const [isPoaUploading, setIsPoaUploading] = useState(false);

  const idCardFileInputRef = React.useRef<HTMLInputElement>(null);
  const poaFileInputRef = React.useRef<HTMLInputElement>(null);

  // Company form states
  const [coName, setCoName] = useState('');
  const [coType, setCoType] = useState('شركة ذات مسئولية محدودة');
  const [coRegister, setCoRegister] = useState('');
  const [coTaxCard, setCoTaxCard] = useState('');
  const [coVat, setCoVat] = useState('');
  const [coActivity, setCoActivity] = useState('');
  const [coAddress, setCoAddress] = useState('');
  const [coPhone, setCoPhone] = useState('');
  const [coOfficeFileNumber, setCoOfficeFileNumber] = useState('');
  const [coPartners, setCoPartners] = useState<CompanyPartner[]>([]);
  const [activeCompanyFormTab, setActiveCompanyFormTab] = useState<'basic' | 'partners' | 'docs'>('basic');

  // File staging states for Company documents
  const [stagedCompanyFile, setStagedCompanyFile] = useState<{
    file: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image';
    size: string;
    originalName: string;
  } | null>(null);
  const [isCompanyFileUploading, setIsCompanyFileUploading] = useState(false);
  const [companyFileUploader, setCompanyFileUploader] = useState('');
  const [companyFileCategory, setCompanyFileCategory] = useState('عقد تأسيس');
  const companyFileInputRef = React.useRef<HTMLInputElement>(null);

  // Partner Form State (Temp)
  const [partName, setPartName] = useState('');
  const [partPercentage, setPartPercentage] = useState(50);
  const [partShare, setPartShare] = useState(1000000);
  const [partId, setPartId] = useState('');
  const [partPhone, setPartPhone] = useState('');
  const [partAddress, setPartAddress] = useState('');

  // Corporate doc form state (Temp)
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'pdf' | 'word' | 'image'>('pdf');
  const [companyDocsList, setCompanyDocsList] = useState<CompanyDoc[]>([]);

  // Filter Active
  const activeCompanies = companies.filter(c => !c.isArchived);

  // Client cases and companies detail modal state
  const [selectedClientDetails, setSelectedClientDetails] = useState<Client | null>(null);

  useEffect(() => {
    if (selectedClientId) {
      const found = clients.find(c => c.id === selectedClientId);
      if (found) {
        setSelectedClientDetails(found);
        if (onClearSelectedClientId) {
          onClearSelectedClientId();
        }
      }
    }
  }, [selectedClientId, clients, onClearSelectedClientId]);

  // Delete client verification states
  const [deleteClientTarget, setDeleteClientTarget] = useState<Client | null>(null);
  const [deleteClientPassword, setDeleteClientPassword] = useState('');
  const [deleteClientError, setDeleteClientError] = useState('');

  // Delete company verification states
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<Company | null>(null);
  const [deleteCompanyPassword, setDeleteCompanyPassword] = useState('');
  const [deleteCompanyError, setDeleteCompanyError] = useState('');

  const handleDeleteClientSubmit = () => {
    if (!deleteClientTarget) return;
    if (!deleteClientPassword) {
      setDeleteClientError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    const userPassword = currentUser.password || currentUser.phone;
    if (deleteClientPassword !== userPassword) {
      setDeleteClientError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك.');
      return;
    }
    onDeleteClient(deleteClientTarget.id);
    setDeleteClientTarget(null);
    setDeleteClientPassword('');
    setDeleteClientError('');
  };

  const handleDeleteCompanySubmit = () => {
    if (!deleteCompanyTarget) return;
    if (!deleteCompanyPassword) {
      setDeleteCompanyError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    const userPassword = currentUser.password || currentUser.phone;
    if (deleteCompanyPassword !== userPassword) {
      setDeleteCompanyError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك.');
      return;
    }
    onDeleteCompany(deleteCompanyTarget.id);
    setDeleteCompanyTarget(null);
    setDeleteCompanyPassword('');
    setDeleteCompanyError('');
  };

  // Helper for WhatsApp Click
  const handleWhatsAppClick = (phoneNumber: string) => {
    // Egyptian phone numbers usually 01xxxxxxxxx. Convert to 201xxxxxxxxx
    let cleaned = phoneNumber.replace(/\s+/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '20' + cleaned.substring(1);
    } else if (!cleaned.startsWith('20')) {
      cleaned = '20' + cleaned;
    }
    const url = `https://wa.me/${cleaned}`;
    window.open(url, '_blank');
  };

  // Filter clients
  const filteredClients = clients.filter(cl => {
    const name = cl.name || '';
    const phone = cl.phone || '';
    const nationalId = cl.nationalId || '';
    const job = cl.job || '';
    const address = cl.address || '';
    
    const matchesSearch = 
      name.includes(searchQuery) ||
      phone.includes(searchQuery) ||
      nationalId.includes(searchQuery) ||
      job.includes(searchQuery) ||
      address.includes(searchQuery);
    return matchesSearch;
  });

  // Filter companies
  const filteredCompanies = activeCompanies.filter(co => {
    const name = co.name || '';
    const commercialRegister = co.commercialRegister || '';
    const taxCard = co.taxCard || '';
    const activityType = co.activityType || '';
    
    const matchesSearch = 
      name.includes(searchQuery) ||
      commercialRegister.includes(searchQuery) ||
      taxCard.includes(searchQuery) ||
      activityType.includes(searchQuery);
    return matchesSearch;
  });

  // Get count of cases for a client
  const getClientCasesCount = (clientName: string) => {
    return cases.filter(c => c.clientName === clientName && !c.isArchived).length;
  };

  // Open Client Modal
  const handleOpenClientForm = (client: Client | null) => {
    setEditingClient(client);
    if (client) {
      setClName(client.name);
      setClNationalId(client.nationalId || '');
      setClPhone(client.phone);
      setClSecondaryPhone(client.secondaryPhone || '');
      setClEmail(client.email || '');
      setClAddress(client.address);
      setClJob(client.job);
      setClNotes(client.notes || '');
      setClCompanyId(client.companyId || '');
      setIdCardUrl(client.idCardUrl || '');
      setIdCardName(client.idCardName || '');
      setPowerOfAttorneyUrl(client.powerOfAttorneyUrl || '');
      setPowerOfAttorneyName(client.powerOfAttorneyName || '');
    } else {
      setClName('');
      setClNationalId('');
      setClPhone('');
      setClSecondaryPhone('');
      setClEmail('');
      setClAddress('');
      setClJob('');
      setClNotes('');
      setClCompanyId('');
      setIdCardUrl('');
      setIdCardName('');
      setPowerOfAttorneyUrl('');
      setPowerOfAttorneyName('');
    }
    setStagedIdCard(null);
    setStagedPowerOfAttorney(null);
    setActiveClientFormTab('basic');
    setShowClientModal(true);
  };

  const handleIdCardDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'pdf' | 'word' | 'image' = 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '')) {
      detectedType = 'image';
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      detectedType = 'word';
    }

    const objectUrl = URL.createObjectURL(file);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const originalCleanName = file.name.split('.').slice(0, -1).join('.') || file.name;

    setStagedIdCard({
      file,
      fileUrl: objectUrl,
      type: detectedType,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName
    });
    setIdCardName(originalCleanName);
    e.target.value = '';
  };

  const handlePoaDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'pdf' | 'word' | 'image' = 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '')) {
      detectedType = 'image';
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      detectedType = 'word';
    }

    const objectUrl = URL.createObjectURL(file);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const originalCleanName = file.name.split('.').slice(0, -1).join('.') || file.name;

    setStagedPowerOfAttorney({
      file,
      fileUrl: objectUrl,
      type: detectedType,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName
    });
    setPowerOfAttorneyName(originalCleanName);
    e.target.value = '';
  };

  const handleUploadIdCard = async () => {
    if (!stagedIdCard) {
      alert('الرجاء اختيار ملف الهوية أو جواز السفر أولاً');
      return;
    }
    try {
      setIsIdCardUploading(true);
      const finalFileId = `client-id-${Date.now()}`;
      
      // Upload to R2 for online cloud storage
      let cloudUrl = '';
      try {
        cloudUrl = await uploadToR2(stagedIdCard.file);
      } catch (err) {
        console.warn('R2 upload failed, falling back to local storage', err);
      }

      // Save to IndexedDB for robust offline fallback
      await saveFileToIndexedDB(finalFileId, stagedIdCard.file);
      
      setIdCardUrl(cloudUrl || stagedIdCard.fileUrl);
      setIsIdCardUploading(false);
      alert('✅ تم تحميل وثيقة الهوية بنجاح وتخزينها سحابياً ومحلياً!');
    } catch (error) {
      console.error('Failed to upload ID Card:', error);
      setIsIdCardUploading(false);
      alert('حدث خطأ أثناء رفع المستند، يرجى المحاولة لاحقاً.');
    }
  };

  const handleUploadPoa = async () => {
    if (!stagedPowerOfAttorney) {
      alert('الرجاء اختيار ملف التوكيل أولاً');
      return;
    }
    try {
      setIsPoaUploading(true);
      const finalFileId = `client-poa-${Date.now()}`;
      
      // Upload to R2 for online cloud storage
      let cloudUrl = '';
      try {
        cloudUrl = await uploadToR2(stagedPowerOfAttorney.file);
      } catch (err) {
        console.warn('R2 upload failed, falling back to local storage', err);
      }

      // Save to IndexedDB for robust offline fallback
      await saveFileToIndexedDB(finalFileId, stagedPowerOfAttorney.file);
      
      setPowerOfAttorneyUrl(cloudUrl || stagedPowerOfAttorney.fileUrl);
      setIsPoaUploading(false);
      alert('✅ تم تحميل وثيقة التوكيل بنجاح وتخزينها سحابياً ومحلياً!');
    } catch (error) {
      console.error('Failed to upload Power of Attorney:', error);
      setIsPoaUploading(false);
      alert('حدث خطأ أثناء رفع المستند، يرجى المحاولة لاحقاً.');
    }
  };

  // Submit Client Form
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clName) {
      setActiveClientFormTab('basic');
      alert('الرجاء ملء الاسم بالكامل للموكل');
      return;
    }
    if (!clPhone) {
      setActiveClientFormTab('contact');
      alert('الرجاء ملء رقم الهاتف الأساسي للموكل');
      return;
    }

    let finalClientNationalId = clNationalId || '';
    if (clNationalId && clNationalId.trim().length > 0) {
      const { isValid, normalizedValue } = validateNationalId(clNationalId);
      if (!isValid) {
        setActiveClientFormTab('basic');
        alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة.');
        return;
      }
      finalClientNationalId = normalizedValue;
    }

    const clientData: Client = {
      id: editingClient ? editingClient.id : `client-${Date.now()}`,
      name: clName,
      nationalId: finalClientNationalId,
      phone: clPhone,
      secondaryPhone: clSecondaryPhone || '',
      email: clEmail || '',
      address: clAddress,
      job: clJob,
      notes: clNotes || '',
      companyId: clCompanyId || '',
      idCardUrl: idCardUrl || undefined,
      idCardName: idCardName || undefined,
      powerOfAttorneyUrl: powerOfAttorneyUrl || undefined,
      powerOfAttorneyName: powerOfAttorneyName || undefined
    };

    try {
      if (editingClient) {
        await onUpdateClient(clientData);
        alert('تم تحديث بيانات الموكل بنجاح!');
      } else {
        await onAddClient(clientData);
        alert('تم حفظ وتسجيل الموكل الجديد بنجاح!');
      }
      setSearchQuery('');
      setShowClientModal(false);
    } catch (err) {
      console.error("Failed to submit client:", err);
      alert('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.');
    }
  };

  // Add Partner to Company Form
  const handleAddPartner = () => {
    if (!partName || !partPhone) {
      alert('يرجى ملء اسم الشريك وهاتفه أولاً');
      return;
    }

    let finalPartId = partId;
    if (partId && partId.trim().length > 0) {
      const { isValid, normalizedValue } = validateNationalId(partId);
      if (!isValid) {
        alert('الرقم القومي يجب أن يتكون من 14 رقمًا صحيحة.');
        return;
      }
      finalPartId = normalizedValue;
    }

    const partner: CompanyPartner = {
      name: partName,
      participationPercentage: Number(partPercentage),
      shareValue: Number(partShare),
      nationalId: finalPartId,
      phone: partPhone,
      address: partAddress
    };
    setCoPartners([...coPartners, partner]);
    // Reset partner fields
    setPartName('');
    setPartId('');
    setPartPhone('');
    setPartAddress('');
  };

  // Remove Partner from Company Form
  const handleRemovePartner = (index: number) => {
    setCoPartners(coPartners.filter((_, i) => i !== index));
  };

  // Add Document to Company Form
  const handleAddCompanyDoc = () => {
    if (!docName) {
      alert('يرجى كتابة اسم المستند القانوني المرفق');
      return;
    }
    const newDoc: CompanyDoc = {
      id: `cd-${Date.now()}`,
      name: docName,
      type: docType,
      uploadDate: new Date().toISOString().split('T')[0],
      fileUrl: '#'
    };
    setCompanyDocsList([...companyDocsList, newDoc]);
    setDocName('');
  };

  // Remove Document from Company Form
  const handleRemoveCompanyDoc = (docId: string) => {
    setCompanyDocsList(companyDocsList.filter(d => d.id !== docId));
  };

  // Device upload for Company files
  const handleCompanyDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'pdf' | 'word' | 'image' | 'doc' = 'pdf';
    if (fileExtension === 'pdf') {
      detectedType = 'pdf';
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      detectedType = 'word';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '')) {
      detectedType = 'image';
    } else {
      detectedType = 'doc';
    }

    const objectUrl = URL.createObjectURL(file);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const originalCleanName = file.name.split('.').slice(0, -1).join('.') || file.name;

    setStagedCompanyFile({
      file,
      fileUrl: objectUrl,
      type: (detectedType === 'doc' ? 'pdf' : detectedType) as any,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName
    });

    setDocName(originalCleanName);
    setDocType((detectedType === 'doc' ? 'pdf' : detectedType) as any);
    e.target.value = '';
  };

  // View Company Doc (IndexedDB + Blob URLs)
  const handleViewCompanyDoc = async (doc: CompanyDoc | { id?: string; name: string; type: 'pdf' | 'word' | 'image'; fileUrl: string; downloadURL?: string; size?: string; uploadDate?: string; }) => {
    let fileUrl = doc.downloadURL || doc.fileUrl;
    if (doc.id) {
      const dbBlob = await getFileFromIndexedDB(doc.id);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    }
    const finalFileUrl = !fileUrl || fileUrl === '#'
      ? (doc.type === 'pdf'
          ? '/sample.pdf'
          : doc.type === 'image'
            ? 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80'
            : '')
      : fileUrl;

    if (finalFileUrl) {
      let targetUrl = finalFileUrl;
      if (doc.type === 'pdf') {
        targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(doc.name)}&fileId=${doc.id || ''}`;
      }
      const win = window.open(targetUrl, '_blank');
      if (win) {
        win.focus();
      } else {
        alert('⚠️ يرجى السماح بالنوافذ المنبثقة لفتح المستند.');
      }
    } else {
      alert('❌ رابط المستند غير متوفر.');
    }
  };

  // Open Company Form Modal
  const handleOpenCompanyForm = (company: Company | null) => {
    setEditingCompany(company);
    setActiveCompanyFormTab('basic');
    setStagedCompanyFile(null);
    setCompanyFileUploader(currentUser ? currentUser.fullName : '');
    
    if (company) {
      setCoName(company.name);
      setCoType(company.companyType || 'شركة ذات مسئولية محدودة');
      setCoRegister(company.commercialRegister);
      setCoTaxCard(company.taxCard);
      setCoVat(company.vatCertificate || '');
      setCoActivity(company.activityType);
      setCoAddress(company.address);
      setCoPhone(company.phone);
      setCoOfficeFileNumber(company.officeFileNumber || '');
      setCoPartners(company.partners || []);
      setCompanyDocsList(company.documents || []);
    } else {
      setCoName('');
      setCoType('شركة ذات مسئولية محدودة');
      setCoRegister('');
      setCoTaxCard('');
      setCoVat('');
      setCoActivity('');
      setCoAddress('');
      setCoPhone('');
      setCoOfficeFileNumber('');
      setCoPartners([]);
      setCompanyDocsList([]);
    }
    setShowCompanyModal(true);
  };

  // Submit Company Form
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coName || !coRegister || !coTaxCard) {
      alert('يرجى ملء اسم الشركة، السجل التجاري والبطاقة الضريبية');
      return;
    }

    const companyData: Company = {
      id: editingCompany ? editingCompany.id : `company-${Date.now()}`,
      name: coName,
      companyType: coType,
      commercialRegister: coRegister,
      taxCard: coTaxCard,
      vatCertificate: coVat || '',
      activityType: coActivity,
      address: coAddress,
      phone: coPhone,
      officeFileNumber: coOfficeFileNumber || undefined,
      partners: coPartners,
      documents: companyDocsList,
      isArchived: editingCompany ? editingCompany.isArchived : false
    };

    try {
      if (editingCompany) {
        await onUpdateCompany(companyData);
        alert('تم تحديث بيانات الشركة بنجاح!');
      } else {
        await onAddCompany(companyData);
        alert('تم حفظ وتسجيل الشركة الجديدة بنجاح!');
      }
      setSearchQuery('');
      setShowCompanyModal(false);
    } catch (err) {
      console.error("Failed to submit company:", err);
      alert('حدث خطأ أثناء حفظ بيانات الشركة، يرجى المحاولة مرة أخرى.');
    }
  };

  // Handle Archive Company
  const handleArchiveCoSubmit = () => {
    if (!archiveCoTarget) return;
    if (!archiveCoPassword) {
      setArchiveCoError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    const userPassword = currentUser.password || currentUser.phone;
    if (archiveCoPassword !== userPassword) {
      setArchiveCoError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك.');
      return;
    }
    const finalReason = archiveCoReason === 'سبب آخر' ? customArchiveCoReason : archiveCoReason;
    onArchiveCompany(archiveCoTarget.id, finalReason || 'انتهاء التعاقد', archiveCoNotes);
    setArchiveCoTarget(null);
    setArchiveCoPassword('');
    setArchiveCoError('');
  };

  // Print Complete Company Profile
  const handlePrintCompanyProfile = (co: Company) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>الملف القانوني لشركة - ${co.name}</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 20px; line-height: 1.8; }
              .header { text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 35px; }
              .header h1 { margin: 0; font-size: 24px; color: #b45309; }
              .section-title { font-size: 16px; font-weight: bold; background-color: #f1f5f9; padding: 6px 12px; margin-top: 25px; border-right: 4px solid #b45309; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              td, th { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; text-align: right; }
              th { background-color: #f8fafc; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>مؤسسة رميح للمحاماة والاستشارات القانونية</h1>
              <p>الملف القانوني وسجل التأسيس والشركاء للشركات التجارية والخدمية</p>
            </div>

            <div class="section-title">بيانات القيد والتسجيل الضريبي</div>
            <table>
              <tr>
                <th style="width: 25%">اسم الشركة الكلي</th>
                <td><strong>${co.name}</strong></td>
                <th style="width: 25%">السجل التجاري</th>
                <td>${co.commercialRegister}</td>
              </tr>
              <tr>
                <th>البطاقة الضريبية</th>
                <td>${co.taxCard}</td>
                <th>شهادة القيمة المضافة</th>
                <td>${co.vatCertificate || 'لا توجد'}</td>
              </tr>
              <tr>
                <th>طبيعة النشاط والترخيص</th>
                <td>${co.activityType}</td>
                <th>هاتف الاتصال</th>
                <td>${co.phone}</td>
              </tr>
              <tr>
                <th>المقر الرئيسي / العنوان</th>
                <td colspan="3">${co.address}</td>
              </tr>
              <tr>
                <th>رقم ملف الشركة بالمكتب</th>
                <td colspan="3"><strong>${co.officeFileNumber || 'غير مسجل'}</strong></td>
              </tr>
            </table>

            <div class="section-title">بيانات الشركاء والحصص الرأسمالية</div>
            <table>
              <thead>
                <tr>
                  <th>اسم الشريك</th>
                  <th>نسبة المشاركة</th>
                  <th>قيمة الحصة الرأسمالية</th>
                  <th>الرقم القومي</th>
                  <th>الهاتف</th>
                </tr>
              </thead>
              <tbody>
                ${co.partners.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.participationPercentage}%</td>
                    <td>${p.shareValue.toLocaleString()} ج.م</td>
                    <td>${p.nationalId}</td>
                    <td>${p.phone}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="section-title">سجل المستندات ووثائق التأسيس المرفقة</div>
            <table>
              <thead>
                <tr>
                  <th>اسم المستند</th>
                  <th>نوع الملف</th>
                  <th>تاريخ الإيداع القانوني بمكتبنا</th>
                </tr>
              </thead>
              <tbody>
                ${co.documents.map(d => `
                  <tr>
                    <td>${d.name}</td>
                    <td>${d.type.toUpperCase()}</td>
                    <td>${d.uploadDate}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-3.5 animate-fadeIn">
      
      {returnToClient && !selectedClientDetails && (
        <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl text-right animate-fadeIn" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Users className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">تتبع الجلسة نشط للموكل: {returnToClient.name}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold">يمكنك إعادة فتح نافذة تفاصيل الموكل الكاملة بضغطة زر واحدة.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                const found = clients.find(c => c.id === returnToClient.id);
                if (found) {
                  setSelectedClientDetails(found);
                }
                if (onSetReturnToClient) {
                  onSetReturnToClient(null);
                }
              }}
              className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              فتح نافذة الموكل الحالية
            </button>
            <button
              onClick={() => {
                if (onSetReturnToClient) {
                  onSetReturnToClient(null);
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء التتبع
            </button>
          </div>
        </div>
      )}
      
      {/* Panel Header */}
      <div className="flex items-center justify-between" dir="rtl">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">
            👤 سجل الموكلين الأفراد ({clients.length})
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            إدارة ملفات الموكلين الطبيعيين وبيانات الاتصال والملحوظات القانونية
          </p>
        </div>
      </div>

      {/* Control Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <span className="absolute right-3 top-3 text-slate-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            placeholder="البحث بالسجل: الاسم، الهاتف، الرقم القومي، الوظيفة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 text-right"
            dir="rtl"
          />
        </div>

        {/* Action Button */}
        {currentUser.permissions.addClient && (
          <button
            onClick={() => handleOpenClientForm(null)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer w-full md:w-auto"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>إضافة موكل فردي جديد</span>
          </button>
        )}
      </div>

      {/* VIEW: CLIENTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {filteredClients.map((cl) => {
            const caseCount = getClientCasesCount(cl.name);
            return (
              <div key={cl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-800 text-sm">
                      {cl.name}
                    </h3>
                    <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">
                      {cl.job}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-2">
                    <p className="flex items-center gap-1.5 font-mono">
                      💳 <strong>الرقم القومي:</strong> {cl.nationalId || 'غير مسجل'}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <strong>الهاتف:</strong> {cl.phone}
                      {cl.secondaryPhone && <span className="text-slate-400">/ {cl.secondaryPhone}</span>}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <strong>العنوان:</strong> {cl.address}
                    </p>
                    {cl.email && (
                      <p className="flex items-center gap-1.5 font-mono">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {cl.email}
                      </p>
                    )}
                  </div>

                  {cl.notes && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg leading-relaxed">
                      💡 <strong>ملاحظات:</strong> {cl.notes}
                    </p>
                  )}
                  
                  {cl.companyId && (
                    <div className="text-[10px] bg-blue-50 text-blue-800 p-1.5 rounded inline-flex items-center gap-2 font-semibold">
                      <span>🏢 مرتبط بشركة: {companies.find(co => co.id === cl.companyId)?.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`هل أنت متأكد من إلغاء ارتباط الموكل (${cl.name}) بهذه الشركة بالنظام؟`)) {
                            onUpdateClient({ ...cl, companyId: '' });
                            alert('تم إلغاء ارتباط الموكل بالشركة بنجاح!');
                          }
                        }}
                        className="text-red-500 hover:text-red-700 font-extrabold text-[12px] hover:bg-red-50 px-1 rounded transition-all cursor-pointer"
                        title="احذف رابط موكل الشركة بالنظام"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Litigations and Associated Companies count indicator and Details action button */}
                  <div className="pt-2.5 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">الارتباطات القضائية والتجارية:</span>
                      <span className="font-bold text-slate-700 font-mono text-[11px]">
                        {caseCount} قضايا • {companies.filter(co => co.id === cl.companyId || co.partners?.some(p => p.name === cl.name || p.phone === cl.phone || (cl.nationalId && p.nationalId === cl.nationalId))).length} شركات
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedClientDetails(cl)}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-slate-900 text-xs py-1.5 px-3 border border-amber-200 hover:border-amber-300 font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>قضايا وشركات الموكل</span>
                    </button>
                  </div>
                </div>

                {/* Footer Buttons with WhatsApp quick action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleWhatsAppClick(cl.phone)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-colors"
                      title="المراسلة المباشرة السريعة عبر الواتساب للموكل"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    {cl.secondaryPhone && (
                      <button
                        onClick={() => handleWhatsAppClick(cl.secondaryPhone!)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg text-xs"
                        title="الواتساب للهاتف الثاني"
                      >
                        W2
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {currentUser.permissions.editClient && (
                      <button
                        onClick={() => handleOpenClientForm(cl)}
                        className="text-xs text-blue-600 hover:underline font-bold"
                      >
                        تعديل البيانات
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDeleteClientTarget(cl);
                        setDeleteClientPassword('');
                        setDeleteClientError('');
                      }}
                      className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition-all shadow-xs"
                      title="حذف الموكل نهائياً"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      {/* CLIENT MODAL */}
      <BaseModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        title={editingClient ? `تعديل الموكل: ${editingClient.name}` : 'تسجيل موكل فردي جديد بالملفات'}
        description="تسجيل وتحديث بيانات الموكل القانونية وأرقام هواتفه والملاحظات والشركة التابع لها"
        icon={Users}
        size="3xl"
      >
        {showClientModal && (
          <>
            {/* Stepper Navigation */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none mb-6">
          {[
            { id: 'basic', label: 'البيانات الأساسية', desc: 'الاسم والرقم والوظيفة', icon: Users },
            { id: 'contact', label: 'الاتصال والارتباط', desc: 'الهواتف والعنوان والشركة', icon: Phone },
            { id: 'attachments', label: 'الوثائق والأوراق', desc: 'صورة البطاقة والتوكيل', icon: Paperclip }
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeClientFormTab === step.id;
            const isCompleted = ['basic', 'contact', 'attachments'].indexOf(activeClientFormTab) > idx;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setActiveClientFormTab(step.id as any);
                }}
                className={`flex items-center gap-2.5 text-right transition-all duration-200 outline-none ${
                  isActive ? 'opacity-100 scale-[1.02]' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-slate-900 text-amber-400 shadow-sm ring-4 ring-slate-100' :
                  isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                  'bg-white text-slate-400 border border-slate-200'
                }`}>
                  {isCompleted ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="hidden md:block">
                  <p className={`text-[11px] font-black leading-tight ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold">
                    {step.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleClientSubmit} className="space-y-4">
          {/* Step 1: Basic Info */}
          {activeClientFormTab === 'basic' && (
            <div className="space-y-4">
              <FormCard title="البيانات الأساسية للموكل" icon={Users}>
                <FormGrid cols={2}>
                  <FormField label="الاسم بالكامل (ثلاثي)" required>
                    <input
                      type="text"
                      required
                      placeholder="الاسم كامل"
                      value={clName}
                      onChange={(e) => setClName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    />
                  </FormField>
                  <FormField label="الرقم القومي (14 رقم - اختياري)" isMono>
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="2xxxxxxxxxxxxx"
                      value={clNationalId}
                      onChange={(e) => setClNationalId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
                      dir="ltr"
                    />
                  </FormField>
                </FormGrid>

                <FormGrid cols={2}>
                  <FormField label="المهنة / الوظيفة">
                    <input
                      type="text"
                      placeholder="مثال: محاسب، طبيب، تاجر"
                      value={clJob}
                      onChange={(e) => setClJob(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    />
                  </FormField>
                  <FormField label="البريد الإلكتروني (اختياري)">
                    <input
                      type="email"
                      placeholder="name@domain.com"
                      value={clEmail}
                      onChange={(e) => setClEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all text-left"
                      dir="ltr"
                    />
                  </FormField>
                </FormGrid>
              </FormCard>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {activeClientFormTab === 'contact' && (
            <div className="space-y-4">
              <FormCard title="بيانات الاتصال والارتباط" icon={Phone}>
                <FormGrid cols={2}>
                  <FormField label="رقم الهاتف الأساسي" required isMono>
                    <input
                      type="tel"
                      required
                      placeholder="01xxxxxxxxx"
                      value={clPhone}
                      onChange={(e) => setClPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
                      dir="ltr"
                    />
                  </FormField>
                  <FormField label="رقم هاتف إضافي (اختياري)" isMono>
                    <input
                      type="tel"
                      placeholder="01xxxxxxxxx"
                      value={clSecondaryPhone}
                      onChange={(e) => setClSecondaryPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
                      dir="ltr"
                    />
                  </FormField>
                </FormGrid>

                <FormField label="العنوان التفصيلي لمراسلات القضايا">
                  <input
                    type="text"
                    placeholder="محل الإقامة المختار"
                    value={clAddress}
                    onChange={(e) => setClAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                  />
                </FormField>

                <FormField label="ربط الشركة المرتبطة بالمواكل (اختياري)">
                  <select
                    value={clCompanyId}
                    onChange={(e) => setClCompanyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                  >
                    <option value="">لا يوجد ارتباط بشركة</option>
                    {companies.map(co => (
                      <option key={co.id} value={co.id}>{co.name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="ملاحظات وتحذيرات الملف">
                  <textarea
                    placeholder="اكتب أية ملاحظات تفصيلية هنا..."
                    value={clNotes}
                    onChange={(e) => setClNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                  />
                </FormField>
              </FormCard>
            </div>
          )}

          {/* Step 3: Attachments / Docs */}
          {activeClientFormTab === 'attachments' && (
            <div className="space-y-4">
              <FormCard title="المستندات والأوراق الرسمية للموكل" icon={Paperclip}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right" dir="rtl">
                  {/* Slot 1: ID Card / Passport */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">المستند الأول</span>
                        <h5 className="text-xs font-black text-slate-800">صورة بطاقة الرقم القومي أو جواز السفر</h5>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                        يرجى رفع صورة واضحة لبطاقة الهوية الوطنية المكونة من 14 رقماً أو جواز السفر لتوثيق الهوية الشخصية للموكل.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* File Info Box */}
                      {(stagedIdCard || idCardUrl) ? (
                        <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              {idCardUrl ? 'مستند مرفوع ونشط 🌐' : 'ملف مؤقت جاهز للرفع ⏳'}
                            </span>
                            <span className="text-slate-400 font-semibold text-[10px]">
                              {stagedIdCard?.size || 'مرفوع سحابياً'}
                            </span>
                          </div>
                          
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-xs font-bold text-slate-800 truncate" title={idCardName}>
                            📄 {idCardName || 'مستند الهوية'}
                          </div>

                          {/* Quick Actions (View / Delete) */}
                          <div className="flex items-center gap-2 pt-1">
                            {/* الاطلاع (View) */}
                            <a
                              href={idCardUrl ? getProxiedUrl(idCardUrl) : stagedIdCard?.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 py-1.5 px-2.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              اطلاع ومعاينة
                            </a>

                            {/* الحذف (Delete) */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('هل أنت متأكد من حذف هذا المستند؟')) {
                                  setStagedIdCard(null);
                                  setIdCardUrl('');
                                  setIdCardName('');
                                  if (idCardFileInputRef.current) idCardFileInputRef.current.value = '';
                                }
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 py-1.5 px-2.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              حذف المستند
                            </button>
                          </div>

                          {/* Show miniature image preview if it is an image */}
                          {(idCardUrl || stagedIdCard?.fileUrl) && !idCardUrl.endsWith('.pdf') && !stagedIdCard?.fileUrl?.endsWith('.pdf') && (
                            <img
                              src={idCardUrl ? getProxiedUrl(idCardUrl) : stagedIdCard?.fileUrl}
                              alt="ID Preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-20 object-cover rounded-lg border border-slate-200 mt-2"
                            />
                          )}
                        </div>
                      ) : (
                        <MultiUploadManager
                          singleMode={true}
                          allowedExtensions={['.pdf', '.jpg', '.jpeg', '.png', '.webp']}
                          defaultCategory="الهوية الشخصية"
                          onFilesUploaded={async (uploadedFiles) => {
                            if (uploadedFiles.length > 0) {
                              const f = uploadedFiles[0];
                              setIdCardUrl(f.fileUrl);
                              setIdCardName(f.name);
                              setStagedIdCard({
                                file: new File([], f.name),
                                fileUrl: f.fileUrl,
                                type: f.type === 'pdf' ? 'pdf' : 'image',
                                size: f.size,
                                originalName: f.name
                              });
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Slot 2: Power of Attorney (صورة التوكيل) */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">المستند الثاني</span>
                        <h5 className="text-xs font-black text-slate-800">صورة توكيل القضايا الرسمي</h5>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                        يرجى رفع صورة التوكيل العام أو الخاص المحرر بمكتب الشهر العقاري لمباشرة القضايا والنزاعات بالنيابة عن الموكل.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* File Info Box */}
                      {(stagedPowerOfAttorney || powerOfAttorneyUrl) ? (
                        <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              {powerOfAttorneyUrl ? 'توكيل مرفوع ونشط 🌐' : 'توكيل مؤقت جاهز للرفع ⏳'}
                            </span>
                            <span className="text-slate-400 font-semibold text-[10px]">
                              {stagedPowerOfAttorney?.size || 'مرفوع سحابياً'}
                            </span>
                          </div>
                          
                          <div className="bg-white p-2 rounded-lg border border-slate-100 text-xs font-bold text-slate-800 truncate" title={powerOfAttorneyName}>
                            📄 {powerOfAttorneyName || 'مستند التوكيل'}
                          </div>

                          {/* Quick Actions (View / Delete) */}
                          <div className="flex items-center gap-2 pt-1">
                            {/* الاطلاع (View) */}
                            <a
                              href={powerOfAttorneyUrl ? getProxiedUrl(powerOfAttorneyUrl) : stagedPowerOfAttorney?.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 py-1.5 px-2.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              اطلاع ومعاينة
                            </a>

                            {/* الحذف (Delete) */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('هل أنت متأكد من حذف توكيل القضايا هذا؟')) {
                                  setStagedPowerOfAttorney(null);
                                  setPowerOfAttorneyUrl('');
                                  setPowerOfAttorneyName('');
                                  if (poaFileInputRef.current) poaFileInputRef.current.value = '';
                                }
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 py-1.5 px-2.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              حذف التوكيل
                            </button>
                          </div>

                          {/* Show miniature image preview if it is an image */}
                          {(powerOfAttorneyUrl || stagedPowerOfAttorney?.fileUrl) && !powerOfAttorneyUrl.endsWith('.pdf') && !stagedPowerOfAttorney?.fileUrl?.endsWith('.pdf') && (
                            <img
                              src={powerOfAttorneyUrl ? getProxiedUrl(powerOfAttorneyUrl) : stagedPowerOfAttorney?.fileUrl}
                              alt="Poa Preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-20 object-cover rounded-lg border border-slate-200 mt-2"
                            />
                          )}
                        </div>
                      ) : (
                        <MultiUploadManager
                          singleMode={true}
                          allowedExtensions={['.pdf', '.jpg', '.jpeg', '.png', '.webp']}
                          defaultCategory="التوكيل الرسمي"
                          onFilesUploaded={async (uploadedFiles) => {
                            if (uploadedFiles.length > 0) {
                              const f = uploadedFiles[0];
                              setPowerOfAttorneyUrl(f.fileUrl);
                              setPowerOfAttorneyName(f.name);
                              setStagedPowerOfAttorney({
                                file: new File([], f.name),
                                fileUrl: f.fileUrl,
                                type: f.type === 'pdf' ? 'pdf' : 'image',
                                size: f.size,
                                originalName: f.name
                              });
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </FormCard>
            </div>
          )}

          <div className="flex justify-between items-center gap-3 pt-4 border-t">
            {/* Right Side: Back/Previous button */}
            {activeClientFormTab !== 'basic' ? (
              <SecondaryButton
                type="button"
                onClick={() => {
                  if (activeClientFormTab === 'attachments') setActiveClientFormTab('contact');
                  else if (activeClientFormTab === 'contact') setActiveClientFormTab('basic');
                }}
              >
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </div>
              </SecondaryButton>
            ) : (
              <SecondaryButton type="button" onClick={() => setShowClientModal(false)}>
                إلغاء وإغلاق
              </SecondaryButton>
            )}

            {/* Left Side: Next/Submit button */}
            <div className="flex items-center gap-2">
              {activeClientFormTab !== 'attachments' ? (
                <PrimaryButton
                  type="button"
                  onClick={() => {
                    if (activeClientFormTab === 'basic') {
                      setActiveClientFormTab('contact');
                    } else if (activeClientFormTab === 'contact') {
                      setActiveClientFormTab('attachments');
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    التالي
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                </PrimaryButton>
              ) : (
                <PrimaryButton type="submit">
                  {editingClient ? 'تأكيد وحفظ تعديلات الموكل ✏️' : 'تأكيد وإضافة الموكل الجديد 🎉'}
                </PrimaryButton>
              )}
            </div>
          </div>
        </form>
          </>
        )}
      </BaseModal>

      {/* COMPANY FORM MODAL */}
      <BaseModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        title={editingCompany ? `تعديل ملف وتأسيس شركة: ${coName}` : 'تأسيس وتسجيل ملف تجاري جديد للشركات'}
        description="تسجيل الكيان القانوني للمنشأة وتوثيق السجل والبطاقة الضريبية وحصص الشركاء والمستندات التأسيسية"
        icon={Building2}
        size="4xl"
      >
        {showCompanyModal && (
          <>
            {/* Stepper Navigation */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none mb-6">
          {[
            { id: 'basic', label: 'البيانات والتأسيس', desc: 'القيد التجاري والنشاط', icon: Building2 },
            { id: 'partners', label: 'سجل الشركاء', desc: 'الحصص وتوزيع الأرباح', icon: Users },
            { id: 'docs', label: 'مستندات التأسيس', desc: 'العقود والأوراق الرسمية', icon: Paperclip }
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeCompanyFormTab === step.id;
            const isCompleted = ['basic', 'partners', 'docs'].indexOf(activeCompanyFormTab) > idx;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setActiveCompanyFormTab(step.id as any);
                }}
                className={`flex items-center gap-2.5 text-right transition-all duration-200 outline-none ${
                  isActive ? 'opacity-100 scale-[1.02]' : 'opacity-65 hover:opacity-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-slate-900 text-amber-400 shadow-sm ring-4 ring-slate-100' :
                  isCompleted ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                  'bg-white text-slate-400 border border-slate-200'
                }`}>
                  {isCompleted ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="hidden md:block">
                  <p className={`text-[11px] font-black leading-tight ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                    {step.label}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold">
                    {step.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Form Container */}
        <form
          onSubmit={handleCompanySubmit}
          className="space-y-6"
        >
          {/* Step 1: Basic Info */}
          {activeCompanyFormTab === 'basic' && (
            <div className="space-y-6">
              <FormCard title="بيانات الهوية والقيد التجاري للشركة" icon={Building2}>
                <FormGrid cols={2}>
                  <FormField label="اسم الشركة بالكامل" required>
                    <input
                      type="text"
                      required
                      placeholder="مثال: شركة النيل للتطوير الاستثماري"
                      value={coName}
                      onChange={(e) => setCoName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    />
                  </FormField>
                  <FormField label="نوع وشكل المنشأة القانوني" required>
                    <select
                      value={coType}
                      onChange={(e) => setCoType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    >
                      <option value="شركة ذات مسئولية محدودة">شركة ذات مسئولية محدودة (ش.م.م)</option>
                      <option value="شركة الشخص الواحد ذات مسئولية محدودة">شركة الشخص الواحد ذات مسئولية محدودة</option>
                      <option value="شركة مساهمة مصرية">شركة مساهمة مصرية</option>
                      <option value="شركة توصية بسيطة">شركة توصية بسيطة</option>
                      <option value="شركة تضامن">شركة تضامن</option>
                      <option value="شركة فرع لشركة أجنبية">شركة فرع لشركة أجنبية</option>
                      <option value="منشأة فردية">منشأة فردية</option>
                      <option value="مكتب تمثيل أجنبي">مكتب تمثيل أجنبي</option>
                    </select>
                  </FormField>
                </FormGrid>

                <FormGrid cols={3}>
                  <FormField label="رقم السجل التجاري والجهة الموثقة" required>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 12450 الجيزة"
                      value={coRegister}
                      onChange={(e) => setCoRegister(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    />
                  </FormField>
                  <FormField label="رقم الملف الضريبي والبطاقة" required isMono>
                    <input
                      type="text"
                      required
                      placeholder="514-921-311"
                      value={coTaxCard}
                      onChange={(e) => setCoTaxCard(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left text-slate-800"
                      dir="ltr"
                    />
                  </FormField>
                  <FormField label="شهادة القيمة المضافة (إن وجدت)">
                    <input
                      type="text"
                      placeholder="ق م 4102"
                      value={coVat}
                      onChange={(e) => setCoVat(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    />
                  </FormField>
                </FormGrid>

                <FormGrid cols={3}>
                  <FormField label="طبيعة النشاط الاستثماري والتجاري">
                    <input
                      type="text"
                      placeholder="تصدير واستيراد، مقاولات، اتصالات"
                      value={coActivity}
                      onChange={(e) => setCoActivity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    />
                  </FormField>
                  <div className="md:col-span-2">
                    <FormField label="عنوان المقر القانوني التفصيلي">
                      <input
                        type="text"
                        placeholder="الشارع، المبنى، الدور والمدينة بالتفصيل"
                        value={coAddress}
                        onChange={(e) => setCoAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                      />
                    </FormField>
                  </div>
                </FormGrid>

                <FormGrid cols={3}>
                  <FormField label="هاتف المنشأة الرئيسي" isMono>
                    <input
                      type="tel"
                      placeholder="02xxxxxxx"
                      value={coPhone}
                      onChange={(e) => setCoPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
                      dir="ltr"
                    />
                  </FormField>
                  <FormField label="رقم ملف الشركة بالمكتب (اختياري)">
                    <div className="relative flex items-center">
                      <FolderOpen className="absolute right-3 w-5 h-5 text-amber-500 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="مثال: م/2026/12"
                        value={coOfficeFileNumber}
                        onChange={(e) => setCoOfficeFileNumber(e.target.value)}
                        className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                      />
                    </div>
                  </FormField>
                </FormGrid>
              </FormCard>
            </div>
          )}

          {/* Step 2: Partners Registry */}
          {activeCompanyFormTab === 'partners' && (
            <div className="space-y-6">
              <FormCard title="إضافة شريك جديد إلى سجل الحصص" icon={Users}>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="اسم الشريك بالكامل">
                    <input
                      type="text"
                      placeholder="الاسم ثلاثي أو رباعي"
                      value={partName}
                      onChange={(e) => setPartName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </FormField>
                  <FormField label="نسبة الشراكة في رأس المال (%)">
                    <input
                      type="number"
                      placeholder="50"
                      value={partPercentage}
                      onChange={(e) => setPartPercentage(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </FormField>
                  <FormField label="قيمة الحصة المساهم بها (ج.م)">
                    <input
                      type="number"
                      placeholder="1000000"
                      value={partShare}
                      onChange={(e) => setPartShare(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </FormField>
                  <FormField label="الرقم القومي للشريك" isMono>
                    <input
                      type="text"
                      placeholder="2xxxxxxxxxxxxx"
                      value={partId}
                      onChange={(e) => setPartId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </FormField>
                  <FormField label="رقم الهاتف للتواصل" isMono>
                    <input
                      type="tel"
                      placeholder="01xxxxxxxxx"
                      value={partPhone}
                      onChange={(e) => setPartPhone(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                      dir="ltr"
                    />
                  </FormField>
                  <FormField label="عنوان الإقامة المختار للشريك">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="العنوان التفصيلي ومحل الإقامة"
                        value={partAddress}
                        onChange={(e) => setPartAddress(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs flex-1"
                      />
                      <PrimaryButton
                        type="button"
                        onClick={handleAddPartner}
                        className="px-4 py-1.5 shrink-0 font-bold"
                      >
                        إضافة الشريك
                      </PrimaryButton>
                    </div>
                  </FormField>
                </div>

                {/* Partners List rendered as beautiful cards */}
                <div className="mt-5 space-y-3">
                  <h4 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-500" />
                    شركاء المنشأة المقيدين ومساهماتهم الحالية ({coPartners.length})
                  </h4>

                  {coPartners.length === 0 ? (
                    <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-[11px] text-slate-400 italic">لم يتم إضافة أي شركاء إلى سجل الحصص بعد.</p>
                      <p className="text-[9px] text-slate-400 mt-1">يرجى ملء تفاصيل الشريك في الحقول أعلاه ثم الضغط على زر "إضافة الشريك".</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                      {coPartners.map((p, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 hover:border-amber-400/50 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
                          <div className="absolute top-0 bottom-0 right-0 w-1 bg-amber-50" />
                          <div className="space-y-2 pr-2 text-right">
                            <div className="flex items-center justify-between">
                              <strong className="text-[11px] font-black text-slate-900">{p.name}</strong>
                              <span className="bg-amber-50 text-amber-700 border border-amber-100/50 px-2 py-0.5 rounded text-[9px] font-black leading-none">
                                {p.participationPercentage}% من رأس المال
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] border-t border-slate-100 pt-2 text-slate-600">
                              <div><strong>قيمة الحصة:</strong> {p.shareValue.toLocaleString()} ج.م</div>
                              <div><strong>الرقم القومي:</strong> {p.nationalId || '-'}</div>
                              <div><strong>الهاتف:</strong> {p.phone || '-'}</div>
                              <div className="col-span-2 truncate"><strong>العنوان:</strong> {p.address || '-'}</div>
                            </div>
                          </div>
                          
                          <div className="flex justify-end mt-3 border-t border-slate-100 pt-2 pr-2">
                            <button
                              type="button"
                              onClick={() => handleRemovePartner(idx)}
                              className="text-[10px] text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg font-bold transition-all animate-pulse"
                            >
                              حذف من السجل
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FormCard>
            </div>
          )}

          {/* Step 3: Documents and Contracts */}
          {activeCompanyFormTab === 'docs' && (
            <div className="space-y-6">
              <FormCard title="مستندات وعقود التأسيس للشركة" icon={FileText}>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-5">
                  <div className="space-y-4">
                    <MultiUploadManager
                      categories={['عقد تأسيس', 'سجل تجاري', 'بطاقة ضريبية', 'قيمة مضافة', 'توكيل قانوني', 'تفويض بنكي', 'أخرى']}
                      defaultCategory="عقد تأسيس"
                      uploaderName={currentUser.fullName}
                      onFilesUploaded={(newFiles) => {
                        setCompanyDocsList(prev => {
                          const converted = newFiles.map(f => ({
                            id: f.id,
                            name: f.name,
                            type: f.type === 'word' ? 'word' : f.type === 'pdf' ? 'pdf' : 'image' as any,
                            uploadDate: f.uploadDate,
                            fileUrl: f.fileUrl,
                            storagePath: f.storagePath || `companies/docs/${f.id}`
                          }));
                          return [...prev, ...converted];
                        });
                      }}
                    />
                  </div>

                  {/* Uploaded company docs list as custom separate cards */}
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-black text-slate-850 flex items-center gap-1.5">
                        <Paperclip className="w-5 h-5 text-amber-500" />
                        المستندات وعقود التأسيس المرفقة بالشركة حالياً ({companyDocsList.length})
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">بوابة مؤسسة رميح للمحاماة الرقمية</span>
                    </div>

                    {companyDocsList.length === 0 ? (
                      <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-xs">
                        <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[11px] text-slate-400 italic">لا توجد أوراق أو مستندات تأسيسية مرفقة بهذه الشركة حالياً.</p>
                        <p className="text-[9px] text-slate-400 mt-1">يرجى رفع المستند وإضافة بياناته من حقل الملفات المتاحة بالأعلى.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                        {companyDocsList.map((d) => {
                          const formatConfig = 
                            d.type === 'pdf' ? { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200/60' } :
                            d.type === 'word' ? { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200/60' } :
                            { label: 'IMAGE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };

                          return (
                            <div 
                              key={d.id} 
                              className="bg-white border border-slate-200 hover:border-amber-400/50 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group text-right"
                            >
                              <div className={`absolute top-0 bottom-0 right-0 w-1 ${
                                d.type === 'pdf' ? 'bg-rose-500' : d.type === 'word' ? 'bg-blue-500' : 'bg-emerald-500'
                              }`} />

                              <div className="space-y-3 pr-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="truncate flex-1">
                                    <h6 className="text-[11px] font-black text-slate-950 truncate" title={d.name}>
                                      📄 {d.name}
                                    </h6>
                                  </div>
                                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border leading-none ${formatConfig.bg}`}>
                                    {formatConfig.label}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] border-t border-slate-150 pt-2.5">
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">طبيعة المستند:</span>
                                    <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded text-[9px] inline-block mt-0.5">
                                      💼 تأسيسي ورسمي
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">حجم الملف:</span>
                                    <span className="font-mono font-bold text-slate-700 inline-block mt-1">
                                      💾 1.54 MB
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">تاريخ الضم والرفع:</span>
                                    <span className="font-mono font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                                      📅 {d.uploadDate}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">بواسطة الزميل:</span>
                                    <span className="font-bold text-slate-700 truncate block mt-0.5">
                                      👤 {currentUser ? currentUser.fullName : 'المدير العام'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 mt-3 pr-2">
                                <button
                                  type="button"
                                  onClick={() => handleViewCompanyDoc(d)}
                                  className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  👁️ عرض المستند
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCompanyDoc(d.id)}
                                  className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer"
                                >
                                  إزالة 🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </FormCard>
            </div>
          )}

          {/* Modal Actions Footer */}
          <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl shrink-0" dir="rtl">
            {/* Right Side: Back or Cancel */}
            <div>
              {activeCompanyFormTab !== 'basic' ? (
                <button
                  type="button"
                  onClick={() => {
                    const tabs: ('basic' | 'partners' | 'docs')[] = ['basic', 'partners', 'docs'];
                    const currentIdx = tabs.indexOf(activeCompanyFormTab);
                    if (currentIdx > 0) {
                      setActiveCompanyFormTab(tabs[currentIdx - 1]);
                    }
                  }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs rounded-xl font-bold transition-all active:scale-95 cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
              )}
            </div>

            {/* Left Side: Next, Quick Save, or Submit */}
            <div className="flex items-center gap-2.5">
              {activeCompanyFormTab !== 'docs' && (
                <button
                  type="button"
                  onClick={() => {
                    // Validation before proceeding
                    if (activeCompanyFormTab === 'basic') {
                      if (!coName.trim()) {
                        alert('يرجى كتابة اسم الشركة بالكامل للمتابعة.');
                        return;
                      }
                      if (!coRegister.trim()) {
                        alert('يرجى كتابة رقم السجل التجاري والجهة للمتابعة.');
                        return;
                      }
                      if (!coTaxCard.trim()) {
                        alert('يرجى كتابة رقم الملف الضريبي والبطاقة للمتابعة.');
                        return;
                      }
                    }

                    const tabs: ('basic' | 'partners' | 'docs')[] = ['basic', 'partners', 'docs'];
                    const currentIdx = tabs.indexOf(activeCompanyFormTab);
                    if (currentIdx < tabs.length - 1) {
                      setActiveCompanyFormTab(tabs[currentIdx + 1]);
                    }
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {/* Quick Save Option for Power Users */}
              {activeCompanyFormTab !== 'docs' && (
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  حفظ وتأكيد الآن
                </button>
              )}

              {activeCompanyFormTab === 'docs' && (
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-black transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  {editingCompany ? 'حفظ كافة التغييرات النهائية' : 'تأكيد وحفظ ملف الشركة'}
                </button>
              )}
            </div>
          </div>
        </form>
          </>
        )}
      </BaseModal>

      {/* ARCHIVE COMPANY MODAL */}
      <BaseModal
        isOpen={!!archiveCoTarget}
        onClose={() => {
          setArchiveCoTarget(null);
          setArchiveCoPassword('');
          setArchiveCoError('');
        }}
        title="ترحيل بروفايل الشركة إلى الأرشيف"
        description={archiveCoTarget ? `سيتم الاحتفاظ بكافة بيانات تأسيس شركة (${archiveCoTarget.name}) والشركاء والمستندات وعقود التأسيس، مع إيقاف نشاطها الفعال بالمكتب` : ''}
        icon={Archive}
        size="md"
      >
        {archiveCoTarget && (
          <>
            {archiveCoError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold">
            {archiveCoError}
          </div>
        )}

        <div className="space-y-4">
          <FormField label="أسباب الأرشفة" required>
            <select
              value={archiveCoReason}
              onChange={(e) => setArchiveCoReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
            >
              <option value="تصفية الشركة">تصفية الشركة</option>
              <option value="إيقاف النشاط">إيقاف النشاط الاختياري</option>
              <option value="انتهاء التعاقد مع المكتب">انتهاء التعاقد السنوي مع مكتبنا</option>
              <option value="دمج الشركة">دمج الشركة بمؤسسة أخرى</option>
              <option value="انتهاء العمل المطلوب">انتهاء العمل المطلوب</option>
              <option value="إيقاف العمل مؤقتاً">إيقاف العمل مؤقتاً</option>
              <option value="سبب آخر">سبب آخر (أدخل يدوياً)</option>
            </select>
          </FormField>

          {archiveCoReason === 'سبب آخر' && (
            <FormField label="سبب الأرشفة اليدوي" required>
              <input
                type="text"
                placeholder="مثال: فض الشراكة"
                value={customArchiveCoReason}
                onChange={(e) => setCustomArchiveCoReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
              />
            </FormField>
          )}

          <FormField label="ملاحظات وقرارات ختامية">
            <textarea
              placeholder="اكتب أية تفاصيل عن تسوية الحسابات قبل الأرشفة..."
              value={archiveCoNotes}
              onChange={(e) => setArchiveCoNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
            />
          </FormField>

          <FormField label="كلمة مرور الدخول الخاصة بك لتأكيد الأرشفة" required isMono>
            <input
              type="password"
              placeholder="أدخل كلمة المرور الخاصة بك"
              value={archiveCoPassword}
              onChange={(e) => setArchiveCoPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
              dir="ltr"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <SecondaryButton
            type="button"
            onClick={() => {
              setArchiveCoTarget(null);
              setArchiveCoPassword('');
              setArchiveCoError('');
            }}
          >
            إلغاء
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={handleArchiveCoSubmit}
          >
            تأكيد الأرشفة للشركة
          </PrimaryButton>
        </div>
          </>
        )}
      </BaseModal>

      {/* COMPANY DOCUMENT VIEWER MODAL */}
      {viewDocsCompany && (
        <BaseModal
          isOpen={!!viewDocsCompany}
          onClose={() => setViewDocsCompany(null)}
          title={`ملف المستندات الكامل وعقود التأسيس: ${viewDocsCompany.name}`}
          description={`عرض وتحميل كافة الأوراق الرسمية الموثقة للشركة (${viewDocsCompany.companyType})`}
          icon={FolderOpen}
          size="3xl"
        >
          <div className="space-y-6 text-right" dir="rtl">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black text-slate-900">سجل الهوية والقيد التجاري</p>
                <p className="text-[9px] text-slate-500 font-bold mt-0.5">رقم السجل: {viewDocsCompany.registrationNumber} | رقم البطاقة الضريبية: {viewDocsCompany.taxCardNumber}</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-amber-50 text-amber-700 border border-amber-200/50 px-3 py-1 rounded-lg text-[10px] font-black">
                  {viewDocsCompany.companyType}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                المستندات الملحقة والمسجلة بالملف ({viewDocsCompany.documents?.length || 0})
              </h4>

              {(!viewDocsCompany.documents || viewDocsCompany.documents.length === 0) ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-400 italic">لم يتم إرفاق أي مستندات أو عقود تأسيس لهذا الملف التجاري بعد.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {viewDocsCompany.documents.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="bg-white border border-slate-250 hover:border-amber-400/50 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3 group relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-500 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 group-hover:text-amber-600 transition-colors">{doc.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            النوع: {doc.type.toUpperCase()} | الحجم: {doc.size || 'غير معروف'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const fileData = await getFileFromIndexedDB(doc.id);
                              if (!fileData) {
                                alert('عذراً، لم يتم العثور على الملف محلياً.');
                                return;
                              }
                              const blobUrl = URL.createObjectURL(fileData);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = doc.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(blobUrl);
                            } catch (e) {
                              console.error(e);
                              alert('حدث خطأ أثناء محاولة تحميل الملف.');
                            }
                          }}
                          className="bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold text-[10px] py-1.5 px-3 rounded-lg border border-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          تحميل المستند 📥
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <SecondaryButton type="button" onClick={() => setViewDocsCompany(null)}>
                إغلاق النافذة
              </SecondaryButton>
            </div>
          </div>
        </BaseModal>
      )}

      {/* Permanent Delete Client Modal */}
      {deleteClientTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6 text-right" dir="rtl">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">تأكيد حذف الموكل نهائياً</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              يرجى العلم أن حذف الموكل <strong className="text-slate-800">"{deleteClientTarget.name}"</strong> نهائياً سيقوم بإزالته بالكامل من دفاتر وملفات المؤسسة ولا يمكن التراجع عن هذه الخطوة.
            </p>

            {deleteClientError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {deleteClientError}
              </div>
            )}

            <div className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة مرور الدخول الخاصة بك للتأكيد</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={deleteClientPassword}
                  onChange={(e) => setDeleteClientPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteClientTarget(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء وتراجع
              </button>
              <button
                onClick={handleDeleteClientSubmit}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Company Modal */}
      {deleteCompanyTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6 text-right" dir="rtl">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">تأكيد حذف الشركة نهائياً</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              يرجى العلم أن حذف سجلات شركة <strong className="text-slate-800">"{deleteCompanyTarget.name}"</strong> وعقودها نهائياً سيقوم بإزالتها بالكامل ولا يمكن التراجع عن هذه الخطوة.
            </p>

            {deleteCompanyError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {deleteCompanyError}
              </div>
            )}

            <div className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة مرور الدخول الخاصة بك للتأكيد</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={deleteCompanyPassword}
                  onChange={(e) => setDeleteCompanyPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteCompanyTarget(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء وتراجع
              </button>
              <button
                onClick={handleDeleteCompanySubmit}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💼 CLIENT CASES AND COMPANIES PORTFOLIO MODAL */}
      {selectedClientDetails && (() => {
        const cl = clients.find(c => c.id === selectedClientDetails.id) || selectedClientDetails;
        const clientCases = cases.filter(c => c.clientId === cl.id || c.clientName === cl.name);
        const clientCompanies = companies.filter(co => 
          co.id === cl.companyId || 
          co.partners?.some(p => 
            p.name === cl.name || 
            p.phone === cl.phone || 
            (cl.nationalId && p.nationalId === cl.nationalId)
          )
        );

        // Comprehensive Portfolio Print Handler
        const handlePrintClientPortfolio = () => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية التقرير.');
            return;
          }

          const now = new Date();
          const formattedDate = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
          const formattedTime = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          const totalPages = 1 + clientCases.length;

          const getHeaderHtml = (pageIndex: number) => `
            <div class="page-header">
              <div class="brand-section">
                <h1 class="brand-title">مؤسسة رميح للمحاماة</h1>
                <p class="brand-subtitle">والاستشارات القانونية وأعمال الطعن والتمثيل القضائي</p>
              </div>
              <div class="logo-container">
                <img src="/icon-192.png" class="logo-img" onerror="this.style.display='none'; document.getElementById('alt-logo-${pageIndex}').style.display='flex';" />
                <div id="alt-logo-${pageIndex}" class="logo-sim" style="display: none;">⚖️</div>
              </div>
              <div class="meta-section">
                <strong>RUMEIH LAW FIRM</strong><br/>
                الموكل: ${cl.name}<br/>
                تاريخ الطباعة: ${toAr(formattedDate)} - ${toAr(formattedTime)}
              </div>
            </div>
          `;

          const getFooterHtml = (pageIndex: number) => `
            <div class="page-footer">
              <div>بوابة الإدارة الرقمية المتكاملة لمؤسسة رميح القانونية © ٢٠٢٦</div>
              <div style="font-weight: bold; color: #b45309;">صفحة ${toAr(pageIndex)} من ${toAr(totalPages)}</div>
            </div>
          `;

          const casesHtml = clientCases.map((c, idx) => {
            const pageNum = idx + 2;
            const assignedLawyer = users.find(u => u.id === c.assignedLawyerId);
            const lawyerName = assignedLawyer ? assignedLawyer.fullName : 'غير معين';

            const caseSessions = sessions.filter(s => s.caseId === c.id);
            const sortedSessions = [...caseSessions].sort((a, b) => a.date.localeCompare(b.date));
            const firstSessionDate = sortedSessions.length > 0 ? sortedSessions[0].date : 'غير محدد';

            const lastSession = sortedSessions[sortedSessions.length - 1];
            const lastAction = lastSession 
              ? `جلسة بتاريخ ${toAr(lastSession.date)}: ${lastSession.decision || lastSession.notes || 'بانتظار القرار'}` 
              : 'لا توجد إجراءات أو جلسات مسجلة بعد';

            const filingDate = c.files && c.files.length > 0 
              ? [...c.files].sort((a,b) => a.uploadDate.localeCompare(b.uploadDate))[0].uploadDate 
              : `01-01-${c.caseYearFirstInstance || '2026'}`;

            const fileListHtml = c.files && c.files.length > 0 
              ? `
                <table class="nested-table">
                  <thead>
                    <tr>
                      <th style="width: 10%;">م</th>
                      <th style="width: 50%;">اسم المستند / المرفق</th>
                      <th style="width: 20%;">التصنيف</th>
                      <th style="width: 20%;">تاريخ الرفع</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${c.files.map((f, fIdx) => `
                      <tr>
                        <td>${toAr(fIdx + 1)}</td>
                        <td><strong>${f.name}</strong></td>
                        <td><span class="badge category-badge">${f.category || 'مستند'}</span></td>
                        <td>${toAr(f.uploadDate || 'غير محدد')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `
              : '<p class="no-data">⚠️ لم يتم إرفاق أو رفع أي مستندات أو حوافظ أوراق داخل ملف هذه القضية الإلكتروني حتى تاريخه.</p>';

            const sessionsListHtml = sortedSessions.length > 0
              ? `
                <table class="nested-table">
                  <thead>
                    <tr>
                      <th style="width: 10%;">م</th>
                      <th style="width: 25%;">تاريخ الجلسة</th>
                      <th style="width: 20%;">تاريخ الجلسة القادمة</th>
                      <th style="width: 45%;">القرار / الإجراء المتخذ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sortedSessions.map((s, sIdx) => `
                      <tr>
                        <td>${toAr(sIdx + 1)}</td>
                        <td><strong>${toAr(s.date)} ${s.time ? `الساعة ${toAr(s.time)}` : ''}</strong></td>
                        <td>${s.nextHearingDate ? toAr(s.nextHearingDate) : 'غير محدد'}</td>
                        <td>${s.decision || s.notes || 'بانتظار القرار أو النطق بالحكم'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `
              : '<p class="no-data">⚠️ لم تسجل أي جلسات بعد لهذه القضية.</p>';

            const opponentsListHtml = c.opponentsList && c.opponentsList.length > 0
              ? c.opponentsList.map(op => `${op.name} (${op.role})`).join(' ، ')
              : `${c.opponent.name} (${c.opponent.role})`;

            return `
              <div class="report-page">
                ${getHeaderHtml(pageNum)}

                <div class="case-header-bar">
                  <span>الملف القضائي رقم (${toAr(idx + 1)}) : قضية رقم ${toAr(c.caseNumberFirstInstance)} لسنة ${toAr(c.caseYearFirstInstance)}</span>
                </div>

                <table class="data-table">
                  <tr>
                    <th>الرقم المسلسل</th>
                    <td class="highlight-cell">${toAr(idx + 1)}</td>
                    <th>رقم القضية</th>
                    <td class="highlight-cell"><strong>${toAr(c.caseNumberFirstInstance)} / ${toAr(c.caseYearFirstInstance)}</strong></td>
                  </tr>
                  <tr>
                    <th>موضوع الدعوى</th>
                    <td colspan="3">${c.subject || 'غير محدد'}</td>
                  </tr>
                  <tr>
                    <th>نوع الدعوى</th>
                    <td>${c.type}</td>
                    <th>نوع التقاضي / الدرجة</th>
                    <td>${c.degree}</td>
                  </tr>
                  <tr>
                    <th>المحكمة المختصة</th>
                    <td>${c.court}</td>
                    <th>الدائرة القضائية</th>
                    <td>${c.circuit}</td>
                  </tr>
                  <tr>
                    <th>تاريخ القيد بالمكتب</th>
                    <td>${toAr(filingDate)}</td>
                    <th>تاريخ أول جلسة</th>
                    <td>${toAr(firstSessionDate)}</td>
                  </tr>
                  <tr>
                    <th>حالة القضية الحالية</th>
                    <td class="status-cell"><strong>${c.status}</strong></td>
                    <th>المحامي المسؤول</th>
                    <td>${lawyerName}</td>
                  </tr>
                  <tr>
                    <th>الخصوم والصفات</th>
                    <td colspan="3">${opponentsListHtml}</td>
                  </tr>
                  <tr>
                    <th>أتعاب القضية والماليات</th>
                    <td colspan="3" class="highlight-cell" style="background-color: #fffbeb;">
                      إجمالي الأتعاب المقررة: <strong>${toAr(c.totalFees.toLocaleString())} ج.م</strong> | 
                      المسدد الفعلي: <strong>${toAr(c.paidFees.toLocaleString())} ج.م</strong> | 
                      المتبقي المطلوب: <strong style="color: #dc2626;">${toAr(c.remainingFees.toLocaleString())} ج.م</strong>
                    </td>
                  </tr>
                  <tr>
                    <th>الملاحظات والتوجيهات</th>
                    <td colspan="3">${c.notes || 'لا توجد ملاحظات إضافية مسجلة على هذه القضية.'}</td>
                  </tr>
                  <tr>
                    <th>آخر إجراء تم على القضية</th>
                    <td colspan="3" class="action-cell">💡 <strong>${lastAction}</strong></td>
                  </tr>
                </table>

                <div class="sub-section-title">📅 سجل جلسات وقرارات القضية المنعقدة</div>
                ${sessionsListHtml}

                <div class="sub-section-title">📂 الحوافظ والمرفقات والملفات الرقمية المودعة</div>
                ${fileListHtml}

                ${getFooterHtml(pageNum)}
              </div>
            `;
          }).join('');

          printWindow.document.write(`
            <html dir="rtl" lang="ar">
              <head>
                <meta charset="utf-8">
                <title>التقرير القضائي والمالي الشامل للموكل - ${cl.name}</title>
                <style>
                  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                  
                  @page {
                    size: A4;
                    margin: 15mm 15mm 15mm 15mm;
                  }
                  
                  body {
                    font-family: 'Cairo', sans-serif;
                    direction: rtl;
                    text-align: right;
                    background-color: #ffffff;
                    color: #1e293b;
                    margin: 0;
                    padding: 0;
                    line-height: 1.5;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }

                  .print-btn-float {
                    position: fixed;
                    bottom: 25px;
                    left: 25px;
                    background-color: #b45309;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-family: 'Cairo', sans-serif;
                    font-size: 13px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(180,83,9,0.25);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    z-index: 9999;
                    transition: all 0.2s;
                  }
                  .print-btn-float:hover {
                    background-color: #92400e;
                    transform: translateY(-2px);
                  }

                  @media print {
                    .print-btn-float {
                      display: none !important;
                    }
                    body {
                      background-color: transparent;
                    }
                  }

                  .report-page {
                    page-break-after: always;
                    position: relative;
                    min-height: 260mm;
                    box-sizing: border-box;
                    padding-bottom: 25mm;
                  }
                  .report-page:last-child {
                    page-break-after: avoid;
                  }

                  /* Page Header styling */
                  .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 3px double #b45309;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                  }
                  .brand-section {
                    text-align: right;
                  }
                  .brand-title {
                    font-size: 16px;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                  }
                  .brand-subtitle {
                    font-size: 9px;
                    color: #b45309;
                    margin: 3px 0 0 0;
                    font-weight: 700;
                  }
                  .logo-container {
                    text-align: center;
                  }
                  .logo-img {
                    width: 50px;
                    height: 50px;
                    object-fit: contain;
                  }
                  .logo-sim {
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, #b45309, #78350f);
                    color: white;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    margin: 0 auto;
                  }
                  .meta-section {
                    text-align: left;
                    font-size: 9px;
                    color: #475569;
                    line-height: 1.4;
                    direction: ltr;
                  }

                  /* Page Footer styling */
                  .page-footer {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 8px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 9px;
                    color: #64748b;
                  }

                  /* Cover page elements */
                  .cover-container {
                    border: 6px double #b45309;
                    padding: 30px;
                    margin: 20px 0;
                    background-color: #fffbeb;
                    border-radius: 16px;
                    text-align: center;
                  }
                  .cover-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 0 0 8px 0;
                  }
                  .cover-subtitle {
                    font-size: 12px;
                    color: #b45309;
                    font-weight: 700;
                    margin: 0 0 20px 0;
                  }

                  .section-title {
                    font-size: 13px;
                    font-weight: 800;
                    background-color: #0f172a;
                    color: #ffffff;
                    padding: 6px 12px;
                    margin-top: 20px;
                    margin-bottom: 12px;
                    border-right: 5px solid #b45309;
                    border-radius: 0 6px 6px 0;
                  }

                  .sub-section-title {
                    font-size: 11px;
                    font-weight: 800;
                    color: #78350f;
                    margin-top: 15px;
                    margin-bottom: 8px;
                    border-right: 3px solid #b45309;
                    padding-right: 8px;
                  }

                  /* Tables styling */
                  .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                  }
                  .data-table th, .data-table td {
                    border: 1px solid #cbd5e1;
                    padding: 8px 10px;
                    font-size: 11px;
                    text-align: right;
                    line-height: 1.4;
                  }
                  .data-table th {
                    background-color: #f8fafc;
                    font-weight: 700;
                    color: #334155;
                    width: 18%;
                  }
                  .data-table td {
                    color: #0f172a;
                  }
                  .data-table td.highlight-cell {
                    font-weight: 700;
                    background-color: #fafaf9;
                  }
                  .data-table td.status-cell {
                    color: #b45309;
                    background-color: #fffbeb;
                  }
                  .data-table td.action-cell {
                    background-color: #f0fdf4;
                    color: #15803d;
                    border: 1px solid #bbf7d0;
                  }

                  .nested-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 12px;
                  }
                  .nested-table th, .nested-table td {
                    border: 1px solid #e2e8f0;
                    padding: 6px 8px;
                    font-size: 10px;
                    text-align: right;
                  }
                  .nested-table th {
                    background-color: #f1f5f9;
                    font-weight: 700;
                    color: #475569;
                  }

                  .case-header-bar {
                    background: linear-gradient(90deg, #1e293b, #0f172a);
                    color: #fbbf24;
                    padding: 8px 15px;
                    border-radius: 6px;
                    font-weight: 800;
                    font-size: 12px;
                    margin-bottom: 15px;
                    border-right: 4px solid #b45309;
                  }

                  .badge {
                    display: inline-block;
                    padding: 2px 6px;
                    font-size: 9px;
                    font-weight: 700;
                    border-radius: 4px;
                  }
                  .category-badge {
                    background-color: #f1f5f9;
                    color: #475569;
                    border: 1px solid #cbd5e1;
                  }

                  .financial-box {
                    background-color: #fffbeb;
                    border: 1px solid #fde68a;
                    padding: 12px;
                    border-radius: 8px;
                    margin-top: 15px;
                    font-size: 11px;
                    font-weight: bold;
                    color: #78350f;
                    text-align: center;
                  }

                  .no-data {
                    font-size: 11px;
                    color: #64748b;
                    font-style: italic;
                    margin: 8px 0;
                    padding: 6px;
                    border: 1px dashed #e2e8f0;
                    border-radius: 4px;
                  }
                </style>
              </head>
              <body>
                <button class="print-btn-float" onclick="window.print()">🖨️ طباعة التقرير الشامل</button>

                <!-- PAGE 1: COVER & CLIENT INFORMATION -->
                <div class="report-page">
                  ${getHeaderHtml(1)}

                  <div class="cover-container">
                    <h2 class="cover-title">التقرير القضائي والمالي الشامل والملف الموحد</h2>
                    <p class="cover-subtitle">بوابة الإدارة القانونية الذكية والتمثيل القضائي والطعن لمؤسسة رميح</p>
                  </div>

                  <div class="section-title">أولاً: بيانات ومعرفات الموكل الشخصية والاتصال</div>
                  <table class="data-table">
                    <tr>
                      <th>اسم الموكل بالكامل</th>
                      <td class="highlight-cell" style="font-size: 12px;"><strong>${cl.name}</strong></td>
                      <th>الرقم القومي (الهوية)</th>
                      <td>${cl.nationalId ? toAr(cl.nationalId) : 'غير مسجل'}</td>
                    </tr>
                    <tr>
                      <th>رقم الهاتف الرئيسي</th>
                      <td class="highlight-cell">${toAr(cl.phone)}</td>
                      <th>الهاتف البديل / الثانوي</th>
                      <td>${cl.secondaryPhone ? toAr(cl.secondaryPhone) : 'غير مسجل'}</td>
                    </tr>
                    <tr>
                      <th>العنوان الوطني الحالي</th>
                      <td colspan="3">${cl.address}</td>
                    </tr>
                    <tr>
                      <th>البريد الإلكتروني</th>
                      <td style="direction: ltr; text-align: right;">${cl.email || 'غير مسجل'}</td>
                      <th>الوظيفة / المهنة</th>
                      <td>${cl.job}</td>
                    </tr>
                    <tr>
                      <th>ملاحظات وتصنيف الموكل</th>
                      <td colspan="3">${cl.notes || 'لا توجد ملاحظات إضافية مسجلة عن الموكل.'}</td>
                    </tr>
                  </table>

                  <div class="section-title">ثانياً: ملخص وموقف المحفظة القضائية والمالية للموكل</div>
                  <table class="data-table">
                    <tr>
                      <th>عدد القضايا النشطة والملفات</th>
                      <td class="highlight-cell" style="font-size: 13px; color: #b45309;"><strong>${toAr(clientCases.length)} قضية</strong></td>
                      <th>عدد الكيانات والشركات المرتبطة</th>
                      <td class="highlight-cell" style="font-size: 13px; color: #b45309;"><strong>${toAr(clientCompanies.length)} شركة</strong></td>
                    </tr>
                    <tr>
                      <th>إجمالي الأتعاب المستحقة</th>
                      <td style="color: #1e293b; font-weight: bold;">${toAr(clientCases.reduce((sum, c) => sum + c.totalFees, 0).toLocaleString())} ج.م</td>
                      <th>إجمالي المبالغ المسددة فعلياً</th>
                      <td style="color: #15803d; font-weight: bold;">${toAr(clientCases.reduce((sum, c) => sum + c.paidFees, 0).toLocaleString())} ج.م</td>
                    </tr>
                    <tr>
                      <th>المتبقي المطلوب تحصيله</th>
                      <td colspan="3" class="highlight-cell" style="font-size: 13px; color: #dc2626; background-color: #fef2f2;">
                        <strong>${toAr(clientCases.reduce((sum, c) => sum + c.remainingFees, 0).toLocaleString())} ج.م</strong>
                      </td>
                    </tr>
                  </table>

                  ${clientCompanies.length > 0 ? `
                    <div class="sub-section-title">🏢 الكيانات والشركات والمساهمات الرأسمالية للموكل</div>
                    <table class="nested-table">
                      <thead>
                        <tr>
                          <th>اسم الشركة</th>
                          <th>طبيعة النشاط</th>
                          <th>السجل التجاري</th>
                          <th>الصفة / نوع المساهمة</th>
                          <th>المشاركة برأس المال</th>
                          <th>نسبة المشاركة</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${clientCompanies.map(co => {
                          const partnerInfo = co.partners?.find(p => p.name === cl.name || p.phone === cl.phone || (cl.nationalId && p.nationalId === cl.nationalId));
                          const relation = co.id === cl.companyId 
                            ? 'شركة أساسية مرتبطة بالموكل' 
                            : (partnerInfo ? 'شريك مساهم بالشركة' : 'مرتبط بالشركة');
                          const shareText = partnerInfo ? `${toAr(partnerInfo.shareValue.toLocaleString())} ج.م` : '-';
                          const percentText = partnerInfo ? `${toAr(partnerInfo.participationPercentage)}%` : '-';
                          return `
                            <tr>
                              <td><strong>${co.name}</strong></td>
                              <td>${co.activityType}</td>
                              <td>${toAr(co.commercialRegister)}</td>
                              <td>${relation}</td>
                              <td>${shareText}</td>
                              <td>${percentText}</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  ` : ''}

                  ${getFooterHtml(1)}
                </div>

                <!-- SUBSEQUENT PAGES: DETAILS OF EACH CASE -->
                ${casesHtml}

                <script>
                  window.onload = function() {
                    // Slight delay to ensure fonts and styles render perfectly before printing
                    setTimeout(function() {
                      window.print();
                    }, 500);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        };

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh] text-right" dir="rtl">
              
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-amber-500 animate-pulse" />
                    <span>سجل قضايا وشركات الموكل: <span className="text-amber-600">{cl.name}</span></span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">تجميع تلقائي موحد لكافة المنازعات القضائية، التكليفات القانونية ومساهمات الشراكة التجارية والشركات</p>
                </div>
                <button 
                  onClick={() => setSelectedClientDetails(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto py-5 space-y-6 flex-1 px-1">
                
                {/* Client Quick Stats Header Panel */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 border border-slate-200">
                  <div className="text-right space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">إجمالي القضايا النشطة</span>
                    <strong className="text-base font-black text-slate-800 font-mono block">{clientCases.length} قضايا</strong>
                  </div>
                  <div className="text-right space-y-1 border-r border-slate-200 pr-3">
                    <span className="text-[10px] text-slate-400 font-bold block">الشركات والكيانات المرتبطة</span>
                    <strong className="text-base font-black text-slate-800 font-mono block">{clientCompanies.length} شركات</strong>
                  </div>
                  <div className="text-right space-y-1 border-r border-slate-200 pr-3">
                    <span className="text-[10px] text-slate-400 font-bold block">إجمالي أتعاب القضايا</span>
                    <strong className="text-base font-black text-amber-700 font-mono block">
                      {clientCases.reduce((sum, c) => sum + c.totalFees, 0).toLocaleString()} ج.م
                    </strong>
                  </div>
                  <div className="text-right space-y-1 border-r border-slate-200 pr-3">
                    <span className="text-[10px] text-slate-400 font-bold block">إجمالي المتبقي المطلوب تحصيله</span>
                    <strong className="text-base font-black text-red-600 font-mono block">
                      {clientCases.reduce((sum, c) => sum + c.remainingFees, 0).toLocaleString()} ج.م
                    </strong>
                  </div>
                </div>

                {/* Client Documents Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-amber-500" />
                      <span>المستندات والأوراق الثبوتية للموكل</span>
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* ID Card / Passport Slot */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold">صورة بطاقة الرقم القومي أو جواز السفر</p>
                        <strong className="text-xs text-slate-800 font-extrabold block mt-0.5">
                          {cl.idCardName || 'لم يتم رفع مستند الهوية'}
                        </strong>
                      </div>
                      {cl.idCardUrl ? (
                        <a
                          href={getProxiedUrl(cl.idCardUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          عرض المستند
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          غير متوفر
                        </span>
                      )}
                    </div>

                    {/* Power of Attorney Slot */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold">صورة توكيل القضايا الرسمي</p>
                        <strong className="text-xs text-slate-800 font-extrabold block mt-0.5">
                          {cl.powerOfAttorneyName || 'لم يتم رفع توكيل رسمي'}
                        </strong>
                      </div>
                      {cl.powerOfAttorneyUrl ? (
                        <a
                          href={getProxiedUrl(cl.powerOfAttorneyUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          عرض المستند
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          غير متوفر
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-section 1: Cases */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-5 h-5 text-amber-500" />
                      <span>القضايا النشطة والمنازعات القضائية للموكل ({clientCases.length})</span>
                    </h4>
                  </div>

                  {clientCases.length === 0 ? (
                    <div className="p-5 bg-slate-50 text-slate-400 text-xs text-center border border-dashed border-slate-200">
                      لا توجد قضايا مسجلة باسم هذا الموكل حالياً.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto w-full bg-slate-50/20">
                      <table className="w-full text-right text-xs min-w-[750px]">
                        <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">رقم القضية والسنة</th>
                            <th className="p-2.5">نوع القضية ودرجتها</th>
                            <th className="p-2.5">المحكمة والدائرة</th>
                            <th className="p-2.5">الخصم</th>
                            <th className="p-2.5 text-center">حالة القضية</th>
                            <th className="p-2.5">الموقف المالي والأتعاب</th>
                            <th className="p-2.5 text-center w-[120px]">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {clientCases.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5">
                                <strong className="text-slate-800 font-bold">{c.caseNumberFirstInstance} / {c.caseYearFirstInstance}</strong>
                              </td>
                              <td className="p-2.5">
                                <span className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 text-[10px] font-bold rounded">
                                  {c.type}
                                </span>
                                <span className="text-slate-400 block text-[10px] mt-0.5">{c.degree}</span>
                              </td>
                              <td className="p-2.5">
                                <span className="block font-bold">{c.court}</span>
                                <span className="text-slate-400 block text-[10px] mt-0.5">{c.circuit}</span>
                              </td>
                              <td className="p-2.5">
                                <span className="block font-semibold">{c.opponent.name}</span>
                                <span className="text-slate-400 block text-[10px] mt-0.5">{c.opponent.role}</span>
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-2 py-0.5 font-bold">
                                  {c.status}
                                </span>
                              </td>
                              <td className="p-2.5 space-y-0.5 font-mono text-[11px]">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">الإجمالي:</span>
                                  <span className="font-bold text-slate-700">{c.totalFees.toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">المسدد:</span>
                                  <span className="font-bold text-emerald-600">{c.paidFees.toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-100 pt-0.5">
                                  <span className="text-slate-400">المتبقي:</span>
                                  <span className="font-bold text-red-600">{c.remainingFees.toLocaleString()} ج.م</span>
                                </div>
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSetReturnToClient) {
                                      onSetReturnToClient({ id: cl.id, name: cl.name });
                                    }
                                    if (onSetCasesSearchQuery) {
                                      onSetCasesSearchQuery(c.caseNumberFirstInstance);
                                    }
                                    if (onNavigateToTab) {
                                      onNavigateToTab('cases');
                                    }
                                    setSelectedClientDetails(null);
                                  }}
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                                  <span>فتح القضية</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Sub-section 2: Companies */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-amber-500" />
                      <span>الشركات ومساهمات الشراكة المرتبطة للموكل ({clientCompanies.length})</span>
                    </h4>
                  </div>

                  {clientCompanies.length === 0 ? (
                    <div className="p-5 bg-slate-50 text-slate-400 text-xs text-center border border-dashed border-slate-200">
                      لا توجد مساهمات شركات أو قيد للشركات باسم الموكل بالملفات.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clientCompanies.map(co => {
                        const partnerInfo = co.partners?.find(p => p.name === cl.name || p.phone === cl.phone || (cl.nationalId && p.nationalId === cl.nationalId));
                        const isPrimary = co.id === cl.companyId;

                        return (
                          <div key={co.id} className="bg-slate-50/50 p-4 border border-slate-200 flex flex-col justify-between gap-3">
                            <div className="space-y-2 text-right">
                              <div className="flex items-center justify-between">
                                <strong className="text-slate-800 text-xs font-black">{co.name}</strong>
                                <span className="bg-amber-100/70 text-amber-900 px-2 py-0.5 text-[9px] font-bold">
                                  {co.activityType}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono">
                                {co.officeFileNumber && (
                                  <div className="col-span-2 text-amber-700 font-bold">
                                    <strong>ملف المكتب:</strong> {co.officeFileNumber}
                                  </div>
                                )}
                                <div><strong>السجل التجاري:</strong> {co.commercialRegister}</div>
                                <div><strong>البطاقة الضريبية:</strong> {co.taxCard}</div>
                              </div>

                              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-600 flex items-center gap-1.5">
                                  {isPrimary ? '🏢 الشركة الأساسية للموكل' : '🤝 شريك مساهم في رأس المال'}
                                  {isPrimary && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`هل أنت متأكد من إلغاء ارتباط الموكل (${cl.name}) بهذه الشركة بالنظام؟`)) {
                                          onUpdateClient({ ...cl, companyId: '' });
                                          setSelectedClientDetails(prev => prev ? { ...prev, companyId: '' } : null);
                                          alert('تم إلغاء ارتباط الموكل بالشركة بنجاح!');
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 font-black text-xs underline cursor-pointer"
                                      title="احذف رابط موكل الشركة بالنظام"
                                    >
                                      (إلغاء الارتباط 🔗)
                                    </button>
                                  )}
                                </span>
                                {partnerInfo && (
                                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-extrabold font-mono">
                                    {partnerInfo.participationPercentage}% من رأس المال
                                  </span>
                                )}
                              </div>

                              {partnerInfo && (
                                <div className="text-[10px] text-slate-500 bg-white p-2 border border-slate-100 flex justify-between font-mono">
                                  <span>قيمة الحصة المساهم بها:</span>
                                  <strong className="text-slate-800">{partnerInfo.shareValue.toLocaleString()} ج.م</strong>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handlePrintCompanyProfile(co)}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 py-2 px-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-3xs"
                              >
                                <Printer className="w-3.5 h-3.5 shrink-0" />
                                <span>طباعة ملف الشركة</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                <button
                  onClick={handlePrintClientPortfolio}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>طباعة التقرير القضائي والمالي الشامل للموكل</span>
                </button>

                <button
                  onClick={() => setSelectedClientDetails(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-4 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
