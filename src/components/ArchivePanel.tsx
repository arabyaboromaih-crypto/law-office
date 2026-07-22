/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Case, Company, User, CaseFile, CompanyDoc, CompanyPartner, HearingSession, CaseClient, Opponent, Client } from '../types';
import { 
  Archive, RotateCcw, Search, Printer, FileText, Building2, Gavel, Calendar, MapPin, X, Info, Plus, Trash2, Upload, Eye,
  UserCheck, Coins, Paperclip, CheckCircle, PlusCircle, Check, FolderOpen, ChevronRight, ChevronLeft, Users, RefreshCw
} from 'lucide-react';
import { 
  BaseModal, FormCard, SectionHeader, FormGrid, FormField, 
  PrimaryButton, SecondaryButton, DangerButton 
} from './FormComponents';
import { saveFileToIndexedDB, getFileFromIndexedDB, getProxiedUrl, uploadToR2 } from '../utils/fileStorage';
import { toAr } from '../utils/arabicNumbers';
import { CourtSelect } from '../utils/courts';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { storage } from "../services/firebase";

function uploadFile(
  storageRef: any,
  file: File,
  fileId: string,
  onSaveToFirestore?: (downloadURL: string) => Promise<void>
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    console.log(`[R2 Presigned Upload]: Starting upload for file "${file.name}" (ID: ${fileId})...`);
    try {
      const downloadURL = await uploadToR2(file);
      if (onSaveToFirestore) {
        await onSaveToFirestore(downloadURL);
        console.log("[Firestore Sync]: Saved permanent cloud URL successfully.");
      }
      resolve(downloadURL);
    } catch (error: any) {
      console.error("[R2 Presigned Upload Error]:", error);
      reject(error);
    }
  });
}

interface ArchivePanelProps {
  cases: Case[];
  companies: Company[];
  currentUser: User;
  onRestoreCase: (caseId: string) => void;
  onRestoreCompany: (coId: string) => void;
  onAddCase?: (newCase: Case) => void;
  onUpdateCase?: (updatedCase: Case) => void;
  onDeleteCase?: (caseId: string, reason: string, passwordConfirm: string) => boolean;
  onDeleteCompany?: (companyId: string) => void;
  onAddCompany?: (newCompany: Company) => void;
  onUpdateCompany?: (updatedCompany: Company) => void;
  sessions?: HearingSession[];
  onAddSession?: (session: HearingSession) => void;
  users?: User[];
  clients?: Client[];
}

export default function ArchivePanel({ 
  cases, companies, currentUser, onRestoreCase, onRestoreCompany, onAddCase, onUpdateCase, onDeleteCase, onDeleteCompany, onAddCompany, onUpdateCompany, sessions, onAddSession,
  users = [], clients = []
}: ArchivePanelProps) {
  
  // Tabs: Archived Cases vs Archived Companies
  const [activeTab, setActiveTab] = useState<'cases' | 'companies'>('cases');

  // Delete archived case verification states
  const [deleteCaseTarget, setDeleteCaseTarget] = useState<Case | null>(null);
  const [deleteCasePassword, setDeleteCasePassword] = useState('');
  const [deleteCaseError, setDeleteCaseError] = useState('');

  // Delete archived company verification states
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<Company | null>(null);
  const [deleteCompanyPassword, setDeleteCompanyPassword] = useState('');
  const [deleteCompanyError, setDeleteCompanyError] = useState('');

  const handleDeleteCaseSubmit = () => {
    if (!deleteCaseTarget || !onDeleteCase) return;
    if (!deleteCasePassword) {
      setDeleteCaseError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    const userPassword = currentUser.password || currentUser.phone;
    if (deleteCasePassword !== userPassword) {
      setDeleteCaseError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك.');
      return;
    }
    onDeleteCase(deleteCaseTarget.id, 'حذف نهائي من الأرشيف', deleteCasePassword);
    setDeleteCaseTarget(null);
    setDeleteCasePassword('');
    setDeleteCaseError('');
  };

  const handleDeleteCompanySubmit = () => {
    if (!deleteCompanyTarget || !onDeleteCompany) return;
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

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Selected for complete profile popup view before print
  const [selectedCaseProfile, setSelectedCaseProfile] = useState<Case | null>(null);
  const [selectedCompanyProfile, setSelectedCompanyProfile] = useState<Company | null>(null);

  // Add direct archived case state
  const [showAddArchiveModal, setShowAddArchiveModal] = useState(false);
  const [newCaseFiles, setNewCaseFiles] = useState<CaseFile[]>([]);
  const [newCaseClients, setNewCaseClients] = useState<CaseClient[]>([
    { name: '', role: 'موكل', phone: '', email: '' }
  ]);
  const [newCaseOpponents, setNewCaseOpponents] = useState<Opponent[]>([
    { name: '', role: 'خصم', address: '', phone: '', lawyer: '', lawyerPhone: '' }
  ]);

  const handleAddNewClient = () => {
    setNewCaseClients(prev => [...prev, { name: '', role: 'موكل', phone: '', email: '' }]);
  };

  const handleRemoveClient = (index: number) => {
    setNewCaseClients(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateClient = (index: number, updated: Partial<CaseClient>) => {
    setNewCaseClients(prev => prev.map((c, i) => i === index ? { ...c, ...updated } : c));
  };

  const handleAddNewOpponent = () => {
    setNewCaseOpponents(prev => [...prev, { name: '', role: 'خصم', address: '', phone: '', lawyer: '', lawyerPhone: '' }]);
  };

  const handleRemoveOpponent = (index: number) => {
    setNewCaseOpponents(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateOpponent = (index: number, updated: Partial<Opponent>) => {
    setNewCaseOpponents(prev => prev.map((o, i) => i === index ? { ...o, ...updated } : o));
  };
  // Form states for adding direct archived case (matching CasesPanel.tsx fields)
  const [activeFormTab, setActiveFormTab] = useState<'judicial' | 'litigants' | 'financials' | 'attachments' | 'archiving'>('judicial');
  const [caseNo1st, setCaseNo1st] = useState('');
  const [caseYear1st, setCaseYear1st] = useState(new Date().getFullYear().toString());
  const [caseNo2nd, setCaseNo2nd] = useState('');
  const [caseYear2nd, setCaseYear2nd] = useState('');
  const [cassationNumber, setCassationNumber] = useState('');
  const [cassationYear, setCassationYear] = useState('');
  const [court1st, setCourt1st] = useState('');
  const [venue1st, setVenue1st] = useState('');
  const [circuit1st, setCircuit1st] = useState('');
  const [court2nd, setCourt2nd] = useState('');
  const [venue2nd, setVenue2nd] = useState('');
  const [circuit2nd, setCircuit2nd] = useState('');
  const [courtCass, setCourtCass] = useState('');
  const [venueCass, setVenueCass] = useState('');
  const [circuitCass, setCircuitCass] = useState('');
  const [showAppealSection, setShowAppealSection] = useState(false);
  const [showCassationSection, setShowCassationSection] = useState(false);
  const [caseType, setCaseType] = useState<string>('مدني');
  const [customCaseType, setCustomCaseType] = useState('');
  const [nextHearing, setNextHearing] = useState('');
  const [nextHearingTime, setNextHearingTime] = useState('09:00');
  const [caseStatus, setCaseStatus] = useState('مؤرشفة مغلقة');
  const [notes, setNotes] = useState('');
  const [caseSubject, setCaseSubject] = useState('');
  const [prosecutor, setProsecutor] = useState('');
  const [enforcementNo, setEnforcementNo] = useState('');
  const [degree, setDegree] = useState<'أول درجة' | 'استئناف' | 'نقض'>('أول درجة');
  const [totalFees, setTotalFees] = useState(0);
  const [paidFees, setPaidFees] = useState(0);
  const [assignedLawyer, setAssignedLawyer] = useState('');

  // Archiving Specific Section states
  const [archiveDate, setArchiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [archiveReason, setArchiveReason] = useState('صدر حكم نهائي');
  const [archiveStatus, setArchiveStatus] = useState('منتهية'); // منتهية – حكم نهائي – تنفيذ – صلح – تنازل – حفظ – أخرى
  const [archiveFileNumber, setArchiveFileNumber] = useState('');
  const [archiveNotes, setArchiveNotes] = useState('');

  // File Upload Helper States
  const [stagedDeviceFile, setStagedDeviceFile] = useState<{
    file: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image' | 'voice' | 'video' | 'doc';
    size: string;
    originalName: string;
  } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'pdf' | 'word' | 'image' | 'voice' | 'video' | 'doc'>('pdf');
  const [newFileCategory, setNewFileCategory] = useState('صحيفة دعوى');
  const [newFileUploader, setNewFileUploader] = useState(currentUser.fullName);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePrevStep = () => {
    const tabs: ('judicial' | 'litigants' | 'financials' | 'attachments' | 'archiving')[] = ['judicial', 'litigants', 'financials', 'attachments', 'archiving'];
    const currentIdx = tabs.indexOf(activeFormTab);
    if (currentIdx > 0) {
      setActiveFormTab(tabs[currentIdx - 1]);
    }
  };

  const handleNextStep = () => {
    const tabs: ('judicial' | 'litigants' | 'financials' | 'attachments' | 'archiving')[] = ['judicial', 'litigants', 'financials', 'attachments', 'archiving'];
    const currentIdx = tabs.indexOf(activeFormTab);
    if (currentIdx < tabs.length - 1) {
      setActiveFormTab(tabs[currentIdx + 1]);
    }
  };

  // Add direct archived company states
  const [showAddCompanyArchiveModal, setShowAddCompanyArchiveModal] = useState(false);
  const [activeCompanyFormTab, setActiveCompanyFormTab] = useState<'basic' | 'partners' | 'archiving' | 'docs'>('basic');
  const [newCompanyPartners, setNewCompanyPartners] = useState<CompanyPartner[]>([]);
  const [newCompanyDocs, setNewCompanyDocs] = useState<CompanyDoc[]>([]);
  const [newCompanyForm, setNewCompanyForm] = useState({
    name: '',
    companyType: 'شركة مساهمة',
    commercialRegister: '',
    taxCard: '',
    vatCertificate: '',
    activityType: 'مقاولات عمومية وتوريدات',
    phone: '',
    address: '',
    officeFileNumber: '',
    archiveReason: 'تصفية الشركة',
    archiveDate: new Date().toISOString().split('T')[0],
    archiveNotes: '',
  });

  // Partner form states for the add company archive modal
  const [coPartName, setCoPartName] = useState('');
  const [coPartPercentage, setCoPartPercentage] = useState<number>(0);
  const [coPartShare, setCoPartShare] = useState<number>(0);
  const [coPartId, setCoPartId] = useState('');
  const [coPartPhone, setCoPartPhone] = useState('');
  const [coPartAddress, setCoPartAddress] = useState('');

  // Document states for the add company archive modal
  const [coDocName, setCoDocName] = useState('');
  const [coDocType, setCoDocType] = useState<'pdf' | 'word' | 'image' | 'doc'>('pdf');

  const [stagedCompanyFile, setStagedCompanyFile] = useState<{
    file: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image';
    size: string;
    originalName: string;
  } | null>(null);
  const [isCompanyDocUploading, setIsCompanyDocUploading] = useState(false);
  const companyFileInputRef = useRef<HTMLInputElement>(null);

  // Preview state for newly attached documents in the archive registration modals
  const [previewingFile, setPreviewingFile] = useState<{ id: string; name: string; type: string; category?: string; size?: string } | null>(null);

  // Editing state for case details
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [editCaseForm, setEditCaseForm] = useState<Case | null>(null);

  const handleAddCoPartner = () => {
    if (!coPartName.trim()) {
      alert('يرجى كتابة اسم الشريك');
      return;
    }
    const newPartner: CompanyPartner = {
      name: coPartName,
      participationPercentage: Number(coPartPercentage) || 0,
      shareValue: Number(coPartShare) || 0,
      nationalId: coPartId || 'بدون رقم قومي',
      phone: coPartPhone || 'بدون هاتف',
      address: coPartAddress || 'غير مدون'
    };
    setNewCompanyPartners(prev => [...prev, newPartner]);
    setCoPartName('');
    setCoPartPercentage(0);
    setCoPartShare(0);
    setCoPartId('');
    setCoPartPhone('');
    setCoPartAddress('');
  };

  const handleRemoveCoPartner = (index: number) => {
    setNewCompanyPartners(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCoDoc = () => {
    if (!coDocName.trim()) {
      alert('يرجى إدخال اسم المستند القانوني أولاً');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    if (stagedCompanyFile) {
      if (!stagedCompanyFile.file) return;

      setIsCompanyDocUploading(true);

      const fileToUpload = stagedCompanyFile.file;
      const newDocId = `cd-${Date.now()}`;

      const fileExt = fileToUpload.name.split('.').pop() || '';
      const cleanNameWithoutSpaces = coDocName.trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
      const sanitizedFileName = `${cleanNameWithoutSpaces}.${fileExt}`;

      const storagePath = `archived-companies/documents/${sanitizedFileName}`;
      const storageRef = ref(storage, storagePath);

      uploadFile(storageRef, fileToUpload, newDocId, async (downloadURL) => {
        const newDoc: CompanyDoc = {
          id: newDocId,
          name: coDocName.trim(),
          type: coDocType === 'doc' ? 'pdf' : coDocType as any,
          uploadDate: todayStr,
          fileUrl: downloadURL,
          storagePath: storagePath,
          downloadURL: downloadURL
        };

        setNewCompanyDocs(prev => {
          const exists = prev.some(d => d.id === newDocId);
          return exists
            ? prev.map(d => d.id === newDocId ? { ...d, fileUrl: downloadURL, downloadURL: downloadURL } : d)
            : [...prev, newDoc];
        });
      })
      .then(() => {
        setCoDocName('');
        setStagedCompanyFile(null);
        setIsCompanyDocUploading(false);
        alert('✅ تم رفع المستند القانوني وحفظه بنجاح!');
      })
      .catch((err) => {
        setIsCompanyDocUploading(false);
        alert('❌ فشل رفع الملف: ' + err.message);
      });
    } else {
      const newDoc: CompanyDoc = {
        id: `doc-temp-${Date.now()}`,
        name: coDocName.trim(),
        type: coDocType === 'doc' ? 'pdf' : coDocType as any,
        uploadDate: todayStr,
        fileUrl: '#'
      };
      setNewCompanyDocs(prev => [...prev, newDoc]);
      setCoDocName('');
    }
  };

  const handleRemoveCoDoc = (id: string) => {
    const docToDelete = newCompanyDocs.find(d => d.id === id);
    if (docToDelete && docToDelete.storagePath) {
      const storageRef = ref(storage, docToDelete.storagePath);
      deleteObject(storageRef).catch(err => {
        console.warn("Failed to delete archived company doc from storage:", err);
      });
    }
    setNewCompanyDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleLocalCoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    setIsCompanyDocUploading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const uploadedDocs: CompanyDoc[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        let fileType: 'pdf' | 'word' | 'image' = 'pdf';
        if (file.type.includes('image')) {
          fileType = 'image';
        } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
          fileType = 'word';
        }

        const newDocId = `cd-${Date.now()}-${i}`;
        const fileExt = file.name.split('.').pop() || '';
        const cleanNameWithoutSpaces = file.name.split('.').slice(0, -1).join('.').trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
        const sanitizedFileName = `${cleanNameWithoutSpaces}.${fileExt}`;

        const storagePath = `archived-companies/documents/${sanitizedFileName}`;
        const storageRef = ref(storage, storagePath);

        const downloadURL = await uploadFile(storageRef, file, newDocId);
        
        uploadedDocs.push({
          id: newDocId,
          name: file.name.split('.').slice(0, -1).join('.') || file.name,
          type: fileType,
          uploadDate: todayStr,
          fileUrl: downloadURL,
          storagePath: storagePath,
          downloadURL: downloadURL
        });
      }

      setNewCompanyDocs(prev => [...prev, ...uploadedDocs]);
      alert('✅ تم رفع جميع الملفات وحفظها بالأرشيف المغلق بنجاح!');
    } catch (error: any) {
      console.error("Multi upload error:", error);
      alert('❌ فشل رفع بعض الملفات أو كلها: ' + error.message);
    } finally {
      setIsCompanyDocUploading(false);
      e.target.value = '';
    }
  };

  const handleCompanyDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'pdf' | 'word' | 'image' = 'pdf';
    if (fileExtension === 'pdf') {
      detectedType = 'pdf';
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      detectedType = 'word';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExtension || '')) {
      detectedType = 'image';
    }

    const objectUrl = URL.createObjectURL(file);
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const originalCleanName = file.name.split('.').slice(0, -1).join('.') || file.name;
    
    setStagedCompanyFile({
      file,
      fileUrl: objectUrl,
      type: detectedType,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName
    });

    setCoDocName(originalCleanName);
    setCoDocType(detectedType);
    
    e.target.value = '';
  };

  const handleSubmitArchivedCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyForm.name.trim() || !newCompanyForm.commercialRegister.trim()) {
      alert('يرجى ملء البيانات الأساسية: اسم الشركة، ورقم السجل التجاري');
      return;
    }

    if (!onAddCompany) {
      alert('خطأ: لا يوجد صلاحية لتسجيل الشركات');
      return;
    }

    const newCompany: Company = {
      id: `co-archived-${Date.now()}`,
      name: newCompanyForm.name,
      companyType: newCompanyForm.companyType,
      commercialRegister: newCompanyForm.commercialRegister,
      taxCard: newCompanyForm.taxCard || 'غير مدون',
      vatCertificate: newCompanyForm.vatCertificate || 'غير مدون',
      activityType: newCompanyForm.activityType,
      phone: newCompanyForm.phone || 'بدون هاتف',
      address: newCompanyForm.address || 'غير مدون',
      officeFileNumber: newCompanyForm.officeFileNumber || undefined,
      partners: newCompanyPartners,
      documents: newCompanyDocs,
      isArchived: true,
      archiveDate: newCompanyForm.archiveDate,
      archiveReason: newCompanyForm.archiveReason,
      archiveNotes: newCompanyForm.archiveNotes || 'تم تصفية وأرشفة الشركة مباشرة بالدفاتر المغلقة.'
    };

    onAddCompany(newCompany);
    setShowAddCompanyArchiveModal(false);
    setActiveCompanyFormTab('basic');
    setNewCompanyPartners([]);
    setNewCompanyDocs([]);
    setNewCompanyForm({
      name: '',
      companyType: 'شركة مساهمة',
      commercialRegister: '',
      taxCard: '',
      vatCertificate: '',
      activityType: 'مقاولات عمومية وتوريدات',
      phone: '',
      address: '',
      officeFileNumber: '',
      archiveReason: 'تصفية الشركة',
      archiveDate: new Date().toISOString().split('T')[0],
      archiveNotes: '',
    });
    alert(`تم بنجاح تسجيل وأرشفة ملف تصفية شركة [${newCompany.name}] وإلحاق الشركاء والمستندات بملفات الأرشيف المغلق.`);
  };

  // Manual document entry in add modal
  const [tempFileName, setTempFileName] = useState('');
  const [tempFileType, setTempFileType] = useState<'pdf' | 'word' | 'image' | 'doc'>('pdf');
  const [tempFileCategory, setTempFileCategory] = useState<'أحكام' | 'مذكرات' | 'صحف الدعاوى' | 'مستندات رسمية' | 'أخرى'>('مستندات رسمية');

  // Documents inside detail view popup
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<'أحكام' | 'مذكرات' | 'صحف الدعاوى' | 'مستندات رسمية' | 'أخرى'>('مستندات رسمية');
  const [newDocType, setNewDocType] = useState<'pdf' | 'word' | 'image' | 'doc'>('pdf');
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  const handleAddTempFile = () => {
    if (!tempFileName.trim()) {
      alert('يرجى كتابة اسم المستند/الورقة أولاً');
      return;
    }
    const newFile: CaseFile = {
      id: `file-temp-${Date.now()}`,
      name: tempFileName,
      type: tempFileType,
      category: tempFileCategory,
      uploadDate: new Date().toISOString().split('T')[0],
      size: '1.5 MB', // default simulated size
      fileUrl: '#'
    };
    setNewCaseFiles(prev => [...prev, newFile]);
    setTempFileName('');
  };

  const handleRemoveTempFile = (id: string) => {
    setNewCaseFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const newAdded: CaseFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      let fileType: 'pdf' | 'word' | 'image' | 'doc' = 'pdf';
      if (file.type.includes('image')) {
        fileType = 'image';
      } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        fileType = 'word';
      }
      
      let detectedCategory: 'أحكام' | 'مذكرات' | 'صحف الدعاوى' | 'مستندات رسمية' | 'أخرى' = 'مستندات رسمية';
      if (file.name.includes('حكم') || file.name.includes('قرار')) {
        detectedCategory = 'أحكام';
      } else if (file.name.includes('مذكرة')) {
        detectedCategory = 'مذكرات';
      } else if (file.name.includes('صحيفة') || file.name.includes('دعوى')) {
        detectedCategory = 'صحف الدعاوى';
      }

      newAdded.push({
        id: `file-temp-upload-${Date.now()}-${i}`,
        name: file.name,
        type: fileType,
        category: detectedCategory,
        uploadDate: new Date().toISOString().split('T')[0],
        size: sizeInMB,
        fileUrl: '#'
      });
    }
    setNewCaseFiles(prev => [...prev, ...newAdded]);
  };

  const handleDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detect file type from extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let detectedType: 'pdf' | 'word' | 'image' | 'voice' | 'video' | 'doc' = 'pdf';
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
    
    // Stage the file instead of immediately adding to final list
    setStagedDeviceFile({
      file,
      fileUrl: objectUrl,
      type: (detectedType === 'doc' ? 'pdf' : detectedType) as any,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName
    });

    // Pre-fill the form inputs so the user can easily review or edit them
    setNewFileName(originalCleanName);
    if (['pdf', 'word', 'image'].includes(detectedType)) {
      setNewFileType(detectedType as any);
    } else {
      setNewFileType('pdf');
    }
    
    // Clear input value so same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleUploadStagedFile = () => {
    if (!newFileName.trim()) {
      alert('يرجى تحديد اسم المستند لحفظه بفهرس القضية.');
      return;
    }

    const finalSize = stagedDeviceFile ? stagedDeviceFile.size : `${(Math.random() * 3 + 0.5).toFixed(1)} MB`;
    const finalType = stagedDeviceFile ? stagedDeviceFile.type : newFileType;

    const newFile: CaseFile = {
      id: `file-temp-upload-${Date.now()}`,
      name: newFileName,
      type: finalType,
      category: newFileCategory,
      uploadDate: new Date().toISOString().split('T')[0],
      size: finalSize,
      fileUrl: stagedDeviceFile ? stagedDeviceFile.fileUrl : '#'
    };

    setNewCaseFiles(prev => [...prev, newFile]);
    setNewFileName('');
    setStagedDeviceFile(null);
  };

  const handleSubmitArchivedCase = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validClients = newCaseClients.filter(c => c.name.trim() !== '');
    if (validClients.length === 0) {
      alert('يجب إضافة اسم موكل واحد على الأقل لإنشاء القضية.');
      return;
    }

    // Determine court and circuit based on degree
    const activeCourt = degree === 'نقض' ? (courtCass || 'محكمة النقض') : degree === 'استئناف' ? (court2nd || 'غير محددة') : (court1st || 'غير محددة');
    const activeCircuit = degree === 'نقض' ? circuitCass : degree === 'استئناف' ? circuit2nd : circuit1st;
    const activeCaseNo = degree === 'نقض' ? cassationNumber : degree === 'استئناف' ? caseNo2nd : caseNo1st;
    const activeCaseYear = degree === 'نقض' ? cassationYear : degree === 'استئناف' ? caseYear2nd : caseYear1st;

    if (!activeCaseNo.trim() || !activeCaseYear.trim() || !caseType.trim()) {
      alert('يرجى ملء البيانات الأساسية المطلوبة: نوع القضية، ورقم القضية، وسنة القضية');
      return;
    }

    if (!onAddCase) {
      alert('خطأ: لا يوجد صلاحية للإضافة');
      return;
    }

    const firstClient = validClients[0];
    const validOpponents = newCaseOpponents.filter(o => o.name.trim() !== '');
    const firstOpponent = validOpponents[0] || {
      name: 'خصم افتراضي',
      role: 'خصم',
      address: 'غير مدون',
      lawyer: 'غير موكل محامٍ',
      phone: 'بدون هاتف'
    };

    const newCase: Case = {
      id: `case-archived-${Date.now()}`,
      officeFileNo: archiveFileNumber || undefined,
      caseNumberFirstInstance: caseNo1st || 'بدون رقم',
      caseYearFirstInstance: caseYear1st || new Date().getFullYear().toString(),
      caseNumberSecondInstance: caseNo2nd || undefined,
      caseYearSecondInstance: caseYear2nd || undefined,
      cassationNumber: cassationNumber || undefined,
      cassationYear: cassationYear || undefined,
      type: caseType === 'أخرى' && customCaseType ? customCaseType : caseType,
      court: activeCourt,
      circuit: activeCircuit,
      status: 'مؤرشفة مغلقة',
      clientName: firstClient.name,
      clientId: `client-${Date.now()}`, // simulated id
      opponent: firstOpponent,
      clientsList: validClients,
      opponentsList: validOpponents,
      degree: degree,
      totalFees: Number(totalFees) || 0,
      paidFees: Number(paidFees) || 0,
      remainingFees: Math.max(0, (Number(totalFees) || 0) - (Number(paidFees) || 0)),
      payments: [],
      files: newCaseFiles,
      isArchived: true,
      archiveDate: archiveDate,
      archiveReason: archiveReason,
      archiveNotes: `[حالة الأرشفة: ${archiveStatus}] ${archiveNotes || 'تم الأرشفة المباشرة في النظام القانوني الموحد.'} (رقم الملف بالأرشيف: ${archiveFileNumber || 'غير مقيد'})`,
      
      notes: notes,
      subject: caseSubject || undefined,
      prosecutorName: prosecutor || undefined,
      enforcementNumber: enforcementNo || undefined,
      assignedLawyerId: assignedLawyer || undefined,
      
      courtFirstInstance: court1st || undefined,
      venueFirstInstance: venue1st || undefined,
      circuitFirstInstance: circuit1st || undefined,
      courtSecondInstance: court2nd || undefined,
      venueSecondInstance: venue2nd || undefined,
      circuitSecondInstance: circuit2nd || undefined,
      courtCassation: courtCass || undefined,
      venueCassation: venueCass || undefined,
      circuitCassation: circuitCass || undefined,
    } as any;

    onAddCase(newCase);
    setShowAddArchiveModal(false);
    setNewCaseFiles([]);
    setNewCaseClients([{ name: '', role: 'موكل', phone: '', email: '' }]);
    setNewCaseOpponents([{ name: '', role: 'خصم', address: '', phone: '', lawyer: '', lawyerPhone: '' }]);
    
    // Reset all form states
    setActiveFormTab('judicial');
    setCaseNo1st('');
    setCaseYear1st(new Date().getFullYear().toString());
    setCaseNo2nd('');
    setCaseYear2nd('');
    setCassationNumber('');
    setCassationYear('');
    setCourt1st('');
    setVenue1st('');
    setCircuit1st('');
    setCourt2nd('');
    setVenue2nd('');
    setCircuit2nd('');
    setCourtCass('');
    setVenueCass('');
    setCircuitCass('');
    setShowAppealSection(false);
    setShowCassationSection(false);
    setCaseType('مدني');
    setCustomCaseType('');
    setNextHearing('');
    setNextHearingTime('09:00');
    setNotes('');
    setCaseSubject('');
    setProsecutor('');
    setEnforcementNo('');
    setDegree('أول درجة');
    setTotalFees(0);
    setPaidFees(0);
    setAssignedLawyer('');
    setArchiveDate(new Date().toISOString().split('T')[0]);
    setArchiveReason('صدر حكم نهائي');
    setArchiveStatus('منتهية');
    setArchiveFileNumber('');
    setArchiveNotes('');
    setStagedDeviceFile(null);

    alert(`تم بنجاح تسجيل قضية مؤرشفة ومغلقة باسم الموكل [${newCase.clientName}] وإرفاق عدد (${newCase.files.length}) مستنداً وأوراقاً.`);
    setSelectedCaseProfile(newCase); // فتح نافذة الاطلاع والتفاصيل مباشرة بعد التسجيل
  };

  const handleDirectAddDocToExistingCase = () => {
    if (!newDocName.trim()) {
      alert('يرجى إدخال اسم المستند/الورقة أولاً');
      return;
    }
    if (!selectedCaseProfile || !onUpdateCase) return;

    const newFile: CaseFile = {
      id: `file-${Date.now()}`,
      name: newDocName,
      type: newDocType,
      category: newDocCategory,
      uploadDate: new Date().toISOString().split('T')[0],
      size: '1.2 MB', // Simulated size
      fileUrl: '#'
    };

    const updatedCase: Case = {
      ...selectedCaseProfile,
      files: [...(selectedCaseProfile.files || []), newFile]
    };

    onUpdateCase(updatedCase);
    setSelectedCaseProfile(updatedCase); // Update the currently opened modal view
    setNewDocName('');
    setIsAddingDoc(false);
    alert(`تم بنجاح إضافة المستند [${newFile.name}] وإلحاقه بملف القضية المؤرشفة.`);
  };

  const handleExistingCaseLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !selectedCaseProfile || !onUpdateCase) return;

    const newAdded: CaseFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      let fileType: 'pdf' | 'word' | 'image' | 'doc' = 'pdf';
      if (file.type.includes('image')) {
        fileType = 'image';
      } else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
        fileType = 'word';
      }

      let detectedCategory: 'أحكام' | 'مذكرات' | 'صحف الدعاوى' | 'مستندات رسمية' | 'أخرى' = 'مستندات رسمية';
      if (file.name.includes('حكم') || file.name.includes('قرار')) {
        detectedCategory = 'أحكام';
      } else if (file.name.includes('مذكرة')) {
        detectedCategory = 'مذكرات';
      } else if (file.name.includes('صحيفة') || file.name.includes('دعوى')) {
        detectedCategory = 'صحف الدعاوى';
      }

      newAdded.push({
        id: `file-upload-${Date.now()}-${i}`,
        name: file.name,
        type: fileType,
        category: detectedCategory,
        uploadDate: new Date().toISOString().split('T')[0],
        size: sizeInMB,
        fileUrl: '#'
      });
    }

    const updatedCase: Case = {
      ...selectedCaseProfile,
      files: [...(selectedCaseProfile.files || []), ...newAdded]
    };

    onUpdateCase(updatedCase);
    setSelectedCaseProfile(updatedCase);
    alert(`تم بنجاح إرفاق عدد (${newAdded.length}) مستندات/أوراق إلكترونية بملف القضية المؤرشفة.`);
  };

  // Filter archived entities
  const archivedCases = cases.filter(c => c.isArchived);
  const archivedCompanies = companies.filter(co => co.isArchived);

  // Filter logic
  const filteredCases = archivedCases.filter(c => {
    const clientsMatch = c.clientName.includes(searchQuery) || 
      (c.clientsList && c.clientsList.some(cl => cl.name.includes(searchQuery)));
    const opponentsMatch = c.opponent.name.includes(searchQuery) || 
      (c.opponentsList && c.opponentsList.some(op => op.name.includes(searchQuery)));
    return (
      clientsMatch ||
      opponentsMatch ||
      c.caseNumberFirstInstance.includes(searchQuery) ||
      c.court.includes(searchQuery) ||
      (c.archiveReason && c.archiveReason.includes(searchQuery))
    );
  });

  const filteredCompanies = archivedCompanies.filter(co => {
    return (
      co.name.includes(searchQuery) ||
      co.commercialRegister.includes(searchQuery) ||
      co.activityType.includes(searchQuery) ||
      (co.archiveReason && co.archiveReason.includes(searchQuery))
    );
  });

  // Direct print of a single case
  const handlePrintCaseSheet = (c: Case) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ملف قضية مؤرشفة رقم ${c.caseNumberFirstInstance}</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 15px; line-height: 1.6; }
              .header { text-align: center; border-bottom: 3px double #059669; padding-bottom: 15px; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 22px; color: #059669; }
              .archive-stamp { border: 2px solid #dc2626; color: #dc2626; text-transform: uppercase; font-weight: bold; padding: 4px 10px; display: inline-block; font-size: 14px; margin-top: 10px; border-radius: 4px; }
              .section-title { font-size: 16px; font-weight: bold; background-color: #f3f4f6; padding: 6px 12px; margin-top: 20px; border-right: 4px solid #059669; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              td, th { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; text-align: right; }
              th { background-color: #f8fafc; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>مؤسسة رميح لأعمال المحاماة والاستشارات القانونية</h1>
              <p>الملف القضائي الكامل والأرشيف القضائي المغلق</p>
              <div class="archive-stamp">ملف مؤرشف مغلق</div>
            </div>

            <div class="section-title">بيانات الأرشفة والقرار</div>
            <table>
              <tr>
                <th style="width: 25%">تاريخ الأرشفة</th>
                <td>${c.archiveDate || 'غير مدون'}</td>
                <th style="width: 25%">سبب الترحيل للأرشيف</th>
                <td><strong>${c.archiveReason || 'حكم نهائي'}</strong></td>
              </tr>
              <tr>
                <th>ملاحظات ختامية</th>
                <td colspan="3">${c.archiveNotes || 'تمت التسوية والحفظ القانوني'}</td>
              </tr>
            </table>
            
            <div class="section-title">بيانات الدعوى العامة</div>
            <table>
              <tr>
                <th>رقم أول درجة</th>
                <td>${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}</td>
                <th>رقم ثاني درجة</th>
                <td>${c.caseNumberSecondInstance || 'لا يوجد'} ${c.caseYearSecondInstance ? 'لسنة ' + c.caseYearSecondInstance : ''}</td>
              </tr>
              <tr>
                <th>درجة التقاضي</th>
                <td>${c.degree}</td>
                <th>نوع القضية</th>
                <td>${c.type}</td>
              </tr>
              <tr>
                <th>المحكمة</th>
                <td>${c.court}</td>
                <th>الدائرة</th>
                <td>${c.circuit}</td>
              </tr>
            </table>

            <div class="section-title">بيانات الأطراف والموكلين</div>
            <table>
              <tr>
                <th style="width: 5%">م</th>
                <th>اسم الموكل</th>
                <th>الصفة</th>
                <th>رقم الهاتف</th>
                <th>البريد الإلكتروني</th>
              </tr>
              ${(c.clientsList && c.clientsList.length > 0 ? c.clientsList : [{ name: c.clientName, role: 'موكل' }]).map((cl, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${cl.name}</strong></td>
                  <td>${cl.role || 'غير محدد'}</td>
                  <td>${cl.phone || 'غير مدون'}</td>
                  <td>${cl.email || 'غير مدون'}</td>
                </tr>
              `).join('')}
            </table>

            <div class="section-title">بيانات الخصوم ودفاعهم</div>
            <table>
              <tr>
                <th style="width: 5%">م</th>
                <th>اسم الخصم</th>
                <th>الصفة</th>
                <th>العنوان</th>
                <th>الهاتف</th>
                <th>محامي الخصم</th>
                <th>هاتف محامي الخصم</th>
              </tr>
              ${(c.opponentsList && c.opponentsList.length > 0 ? c.opponentsList : [c.opponent]).map((op, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${op.name}</strong></td>
                  <td>${op.role || 'خصم'}</td>
                  <td>${op.address || 'غير مدون'}</td>
                  <td>${op.phone || 'غير مدون'}</td>
                  <td>${op.lawyer || 'غير مدون'}</td>
                  <td>${op.lawyerPhone || 'غير مدون'}</td>
                </tr>
              `).join('')}
            </table>

            <div class="section-title">الأتعاب والمالية النهائية</div>
            <table>
              <tr>
                <th>إجمالي عقد الأتعاب</th>
                <td>${c.totalFees.toLocaleString()} ج.م</td>
                <th>المبلغ المسدد بالكامل</th>
                <td>${c.paidFees.toLocaleString()} ج.م</td>
                <th>المتبقي الذمم الكلية</th>
                <td><strong>${c.remainingFees.toLocaleString()} ج.م</strong></td>
              </tr>
            </table>

            <div class="section-title">مستندات ووثائق الملف المرفوعة</div>
            <table>
              <tr>
                <th>اسم الوثيقة</th>
                <th>نوع الملف</th>
                <th>تاريخ الإرفاق</th>
              </tr>
              ${c.files.map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td>${f.type.toUpperCase()}</td>
                  <td>${f.uploadDate}</td>
                </tr>
              `).join('')}
            </table>

            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Direct print of a company
  const handlePrintCompany = (co: Company) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ملف شركة مؤرشفة - ${co.name}</title>
            <style>
              @page {
                size: A4;
                margin: 15mm;
              }
              body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 20px; line-height: 1.8; }
              .header { text-align: center; border-bottom: 3px double #059669; padding-bottom: 15px; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 22px; color: #059669; }
              .archive-stamp { border: 2px solid #dc2626; color: #dc2626; font-weight: bold; padding: 4px 10px; display: inline-block; font-size: 14px; margin-top: 10px; border-radius: 4px; }
              .section-title { font-size: 16px; font-weight: bold; background-color: #f1f5f9; padding: 6px 12px; margin-top: 25px; border-right: 4px solid #059669; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              td, th { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; text-align: right; }
              th { background-color: #f8fafc; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>مؤسسة رميح لأعمال المحاماة والاستشارات القانونية</h1>
              <p>سجل الشراكات والملف القانوني مؤرشف ومغلق</p>
              <div class="archive-stamp">ملف شركة مؤرشف مغلق</div>
            </div>

            <div class="section-title">بيانات أرشفة الشركة</div>
            <table>
              <tr>
                <th style="width: 25%">تاريخ الأرشفة للشركة</th>
                <td>${co.archiveDate || 'غير مدون'}</td>
                <th style="width: 25%">سبب الأرشفة والحل</th>
                <td><strong>${co.archiveReason || 'تصفية الشركة'}</strong></td>
              </tr>
              <tr>
                <th>ملاحظات وقرارات التصفية</th>
                <td colspan="3">${co.archiveNotes || 'تم فض الشراكة وتسوية الالتزامات والضرائب'}</td>
              </tr>
            </table>

            <div class="section-title">بيانات القيد والتأسيس للشركة</div>
            <table>
              <tr>
                <th>اسم الشركة الكلي</th>
                <td><strong>${co.name}</strong></td>
                <th>السجل التجاري</th>
                <td>${co.commercialRegister}</td>
              </tr>
              <tr>
                <th>البطاقة الضريبية</th>
                <td>${co.taxCard}</td>
                <th>طبيعة النشاط</th>
                <td>${co.activityType}</td>
              </tr>
              <tr>
                <th>رقم ملف الشركة بالمكتب</th>
                <td><strong>${co.officeFileNumber || 'غير مسجل'}</strong></td>
                <th>الهاتف والعنوان</th>
                <td>${co.phone || 'بدون هاتف'} - ${co.address || 'غير مدون'}</td>
              </tr>
            </table>

            <div class="section-title">الشركاء وحصصهم التأسيسية</div>
            <table>
              <thead>
                <tr>
                  <th>اسم الشريك</th>
                  <th>نسبة الشراكة</th>
                  <th>قيمة الحصة الرأسمالية</th>
                  <th>الرقم القومي للشريك</th>
                </tr>
              </thead>
              <tbody>
                ${co.partners.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.participationPercentage}%</td>
                    <td>${p.shareValue.toLocaleString()} ج.م</td>
                    <td>${p.nationalId}</td>
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
      
      {/* Tab Switcher */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-xl border border-slate-200 self-start inline-flex">
        <button
          onClick={() => {
            setActiveTab('cases');
            setSearchQuery('');
          }}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'cases' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Gavel className="w-4 h-4" />
          أرشيف القضايا والدعاوى والمرافعات ({archivedCases.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('companies');
            setSearchQuery('');
          }}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'companies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <Building2 className="w-4 h-4" />
          أرشيف الشركات والتصفيات ({archivedCompanies.length})
        </button>
      </div>

      {/* Control Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:max-w-xl">
          <span className="text-slate-400"><Search className="w-5 h-5" /></span>
          <input
            type="text"
            placeholder={activeTab === 'cases' ? "البحث بالأرشيف: اسم الموكل، رقم القضية، المحكمة، سبب الأرشفة..." : "البحث بأرشيف الشركات: الاسم، السجل التجاري، سبب التصفية..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
          />
        </div>

        {activeTab === 'cases' && currentUser.permissions.addCase && (
          <button
            onClick={() => setShowAddArchiveModal(true)}
            className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700/60 flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            تسجيل قضية مؤرشفة ومستنداتها مباشرة +
          </button>
        )}

        {activeTab === 'companies' && currentUser.permissions.addCompany && (
          <button
            onClick={() => setShowAddCompanyArchiveModal(true)}
            className="w-full md:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-emerald-600 flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            تسجيل شركة مؤرشفة/تصفية مباشرة +
          </button>
        )}
      </div>

      {/* VIEW: ARCHIVED CASES */}
      {activeTab === 'cases' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCases.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-400 text-xs bg-white border rounded-xl space-y-3">
              <Archive className="w-12 h-12 text-slate-200 mx-auto" />
              <p>لا توجد قضايا مؤرشفة متطابقة مع عمليات البحث حالياً.</p>
            </div>
          ) : (
            filteredCases.map((c) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col justify-between space-y-4">
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-emerald-50 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                        مغلق: {c.archiveReason}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">تاريخ الأرشفة: {c.archiveDate}</span>
                    </div>
                    {(currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.permissions.deleteCase) && onDeleteCase && (
                      <button
                        onClick={() => {
                          setDeleteCaseTarget(c);
                          setDeleteCasePassword('');
                          setDeleteCaseError('');
                        }}
                        className="text-[10px] text-red-600 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer shadow-3xs"
                        title="حذف القضية نهائياً من الأرشيف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">
                        قضية {c.caseNumberFirstInstance} / {c.caseYearFirstInstance} ({c.type})
                      </h4>
                      {c.officeFileNo && (
                        <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap">
                          ملف: {c.officeFileNo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{c.court}</p>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-lg">
                    <p><strong>الموكل:</strong> {c.clientName}</p>
                    <p><strong>الخصم:</strong> {c.opponent.name}</p>
                  </div>

                  {c.archiveNotes && (
                    <div className="text-[11px] text-slate-500 bg-slate-100/70 p-2 rounded-lg leading-relaxed border border-slate-200/50">
                      ℹ️ <strong>ملاحظات الحفظ:</strong> {c.archiveNotes}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSelectedCaseProfile(c)}
                      className="text-xs text-slate-700 hover:text-amber-600 font-bold"
                    >
                      اطلاع وتفاصيل
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentUser.permissions.restoreCase && (
                      <button
                        onClick={() => {
                          onRestoreCase(c.id);
                          alert(`تم بنجاح استعادة قضية الموكل [${c.clientName}] إلى القضايا المتداولة والنشطة في جدول الرول القضائي.`);
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-bold flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        استعادة للنشطة
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* VIEW: ARCHIVED COMPANIES */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCompanies.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-400 text-xs bg-white border rounded-xl space-y-3">
              <Building2 className="w-12 h-12 text-slate-200 mx-auto" />
              <p>لا توجد شركات مؤرشفة في دفاتر المكتب حالياً.</p>
            </div>
          ) : (
            filteredCompanies.map((co) => (
              <div key={co.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col justify-between space-y-4 relative group text-right" dir="rtl">
                {onDeleteCompany && (
                  <button
                    onClick={() => {
                      setDeleteCompanyTarget(co);
                      setDeleteCompanyPassword('');
                      setDeleteCompanyError('');
                    }}
                    className="absolute top-4 left-4 w-8 h-8 p-0 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-3xs cursor-pointer z-10 flex items-center justify-center"
                    title="حذف الشركة نهائياً من الأرشيف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 flex-wrap ${onDeleteCompany ? 'ml-10' : ''}`}>
                      <span className="bg-slate-100 text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200">
                        التصفية: {co.archiveReason}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">تاريخ التصفية: {co.archiveDate}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{co.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">نوع الشركة: <span className="font-semibold text-emerald-700">{co.companyType || 'غير محدد'}</span> | النشاط التجاري: {co.activityType}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-2.5 rounded-lg text-slate-600">
                    {co.officeFileNumber && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <strong>رقم ملف المكتب:</strong>{' '}
                        <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                          <FolderOpen className="w-3.5 h-3.5 text-amber-500 inline" />
                          {co.officeFileNumber}
                        </span>
                      </div>
                    )}
                    <div><strong>سجل تجاري:</strong> <span className="font-mono">{co.commercialRegister}</span></div>
                    <div><strong>ملف ضريبي:</strong> <span className="font-mono">{co.taxCard}</span></div>
                  </div>

                  {co.archiveNotes && (
                    <div className="text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-lg leading-relaxed">
                      💡 <strong>تفاصيل الحل:</strong> {co.archiveNotes}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {currentUser.permissions.printCompany && (
                      <button
                        onClick={() => handlePrintCompany(co)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                        title="طباعة كامل كراسة شروط وتصفية الشركة"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedCompanyProfile(co)}
                      className="text-xs text-slate-700 hover:text-amber-600 font-bold"
                    >
                      شركاء ومستندات
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentUser.permissions.restoreCompany && (
                      <button
                        onClick={() => {
                          onRestoreCompany(co.id);
                          alert(`تم استعادة ملف شركة [${co.name}] بنجاح إلى الشركات الفعالة والنشطة بالمؤسسة.`);
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-bold flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        استعادة للنشطة
                      </button>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* POPUP: DETAILED ARCHIVED CASE PROFILE */}
      {selectedCaseProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b pb-3 mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-emerald-600" />
                تفاصيل القضية المؤرشفة والمستندات (رقم {selectedCaseProfile.caseNumberFirstInstance})
              </h3>
              <div className="flex items-center gap-2">
                {/* Delete button placed at the top */}
                {(currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.permissions.deleteCase) && onDeleteCase && (
                  <button
                    onClick={() => {
                      setDeleteCaseTarget(selectedCaseProfile);
                      setDeleteCasePassword('');
                      setDeleteCaseError('');
                    }}
                    className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-1.5 rounded-lg border border-red-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-3xs"
                    title="حذف القضية نهائياً من الأرشيف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف القضية</span>
                  </button>
                )}
                {/* Edit details button at the top */}
                {onUpdateCase && !isEditingCase && (
                  <button
                    onClick={() => {
                      setEditCaseForm({ ...selectedCaseProfile });
                      setIsEditingCase(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-3xs"
                  >
                    <span>تعديل التفاصيل</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    setSelectedCaseProfile(null);
                    setIsEditingCase(false);
                    setEditCaseForm(null);
                  }} 
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isEditingCase && editCaseForm ? (
              <div className="space-y-4 text-xs">
                <p className="font-bold text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-right">
                  ⚠️ أنت الآن في وضع تعديل بيانات القضية المؤرشفة. يرجى تعديل الحقول المطلوبة ثم الضغط على "حفظ التعديلات".
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-right">
                  <div>
                    <label className="text-slate-500 block mb-1">رقم القضية:</label>
                    <input
                      type="text"
                      value={editCaseForm.caseNumberFirstInstance}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, caseNumberFirstInstance: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">سنة القضية:</label>
                    <input
                      type="text"
                      value={editCaseForm.caseYearFirstInstance}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, caseYearFirstInstance: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">نوع الدعوى:</label>
                    <input
                      type="text"
                      value={editCaseForm.type}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, type: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">المحكمة:</label>
                    <CourtSelect
                      value={editCaseForm.court}
                      onChange={(val) => setEditCaseForm(prev => prev ? { ...prev, court: val } : null)}
                      placeholder="مثال: محكمة أسرة التجمع الخامس"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none text-right font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">الدائرة القضائية:</label>
                    <input
                      type="text"
                      value={editCaseForm.circuit}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, circuit: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">درجة التقاضي:</label>
                    <select
                      value={editCaseForm.degree}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, degree: e.target.value as any } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    >
                      <option value="أول درجة">أول درجة</option>
                      <option value="استئناف">استئناف</option>
                      <option value="نقض">نقض</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3 text-right">
                  <div>
                    <label className="text-slate-500 block mb-1 font-bold">اسم الموكل:</label>
                    <input
                      type="text"
                      value={editCaseForm.clientName}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, clientName: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">اسم الخصم:</label>
                    <input
                      type="text"
                      value={editCaseForm.opponent?.name || ''}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, opponent: { ...prev.opponent, name: e.target.value } } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">محامي الخصم:</label>
                    <input
                      type="text"
                      value={editCaseForm.opponent?.lawyer || ''}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, opponent: { ...prev.opponent, lawyer: e.target.value } } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t pt-3 text-right">
                  <div>
                    <label className="text-slate-500 block mb-1">تاريخ الحفظ/الأرشفة:</label>
                    <input
                      type="date"
                      value={editCaseForm.archiveDate}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, archiveDate: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">سبب الأرشفة الرئيسي:</label>
                    <input
                      type="text"
                      value={editCaseForm.archiveReason}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, archiveReason: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">رقم ملف المكتب:</label>
                    <input
                      type="text"
                      value={editCaseForm.officeFileNo || ''}
                      onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, officeFileNo: e.target.value } : null)}
                      placeholder="مثال: رف 4 ب - صندوق رقم 12"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <label className="text-slate-500 block mb-1">تقرير الحفظ الفني والختامي للملف:</label>
                  <textarea
                    rows={3}
                    value={editCaseForm.archiveNotes || ''}
                    onChange={(e) => setEditCaseForm(prev => prev ? { ...prev, archiveNotes: e.target.value } : null)}
                    placeholder="تقرير وتفاصيل الحفظ الفني..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingCase(false);
                      setEditCaseForm(null);
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-4 py-2 rounded-xl font-bold transition-all"
                  >
                    إلغاء التعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editCaseForm.caseNumberFirstInstance.trim()) {
                        alert('يرجى إدخال رقم القضية');
                        return;
                      }
                      if (!editCaseForm.clientName.trim()) {
                        alert('يرجى إدخال اسم الموكل');
                        return;
                      }
                      if (onUpdateCase) {
                        onUpdateCase(editCaseForm);
                      }
                      setSelectedCaseProfile(editCaseForm);
                      setIsEditingCase(false);
                      setEditCaseForm(null);
                      alert('تم حفظ وتحديث بيانات القضية المؤرشفة بنجاح.');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    حفظ التعديلات ✓
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                
                <div className="grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-right">
                  <div>
                    <p className="text-slate-500">تاريخ الحفظ والترحيل:</p>
                    <strong className="text-slate-800 text-sm font-mono">{selectedCaseProfile.archiveDate}</strong>
                  </div>
                  <div>
                    <p className="text-slate-500">سبب الأرشفة الرئيسي:</p>
                    <strong className="text-emerald-700 text-sm">{selectedCaseProfile.archiveReason}</strong>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500">تقرير الحفظ الفني والختامي للملف:</p>
                    <p className="text-slate-700 mt-1 leading-relaxed">{selectedCaseProfile.archiveNotes || 'لا توجد ملاحظات إضافية. تم الغلق بالكامل.'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t pt-3 text-right">
                  <div>
                    <span className="text-slate-400 block mb-0.5">المحكمة والدائرة:</span>
                    <strong className="text-slate-800">{selectedCaseProfile.court} - {selectedCaseProfile.circuit}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">نوع الدعوى:</span>
                    <strong className="text-slate-800">{selectedCaseProfile.type} ({selectedCaseProfile.degree})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">رقم ملف المكتب:</span>
                    <strong className="text-slate-800">{selectedCaseProfile.officeFileNo || 'غير مدون'}</strong>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-4 text-right">
                  <div>
                    <span className="text-slate-400 block mb-1.5 font-bold">الموكلين ({selectedCaseProfile.clientsList?.length || 1}):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(selectedCaseProfile.clientsList && selectedCaseProfile.clientsList.length > 0
                        ? selectedCaseProfile.clientsList
                        : [{ name: selectedCaseProfile.clientName, role: 'موكل' }]
                      ).map((cl, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                          <p className="font-black text-slate-800 text-[11px] mb-1">
                            {idx + 1}. {cl.name} {cl.role && <span className="text-amber-600">({cl.role})</span>}
                          </p>
                          {cl.phone && <p className="text-[10px] text-slate-500">📞 {cl.phone}</p>}
                          {cl.email && <p className="text-[10px] text-slate-500">✉️ {cl.email}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1.5 font-bold">الخصوم والمحامين ({selectedCaseProfile.opponentsList?.length || 1}):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(selectedCaseProfile.opponentsList && selectedCaseProfile.opponentsList.length > 0
                        ? selectedCaseProfile.opponentsList
                        : [selectedCaseProfile.opponent]
                      ).map((op, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                          <p className="font-black text-slate-800 text-[11px] mb-1">
                            {idx + 1}. {op.name} {op.role && <span className="text-emerald-700">({op.role})</span>}
                          </p>
                          {op.phone && <p className="text-[10px] text-slate-500">📞 {op.phone}</p>}
                          {op.address && <p className="text-[10px] text-slate-500">📍 {op.address}</p>}
                          {op.lawyer && (
                            <p className="text-[10px] text-slate-600 mt-1 pt-1 border-t border-slate-200/60">
                              💼 محامي الخصم: {op.lawyer} {op.lawyerPhone && `(${op.lawyerPhone})`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div className="flex justify-between items-center text-right">
                    <span className="text-slate-400 block text-xs">أرشيف المستندات والملفات المرفقة ({selectedCaseProfile.files?.length || 0}):</span>
                    {onUpdateCase && (
                      <button
                        onClick={() => setIsAddingDoc(!isAddingDoc)}
                        className="text-[11px] bg-amber-500 hover:bg-amber-600 text-slate-950 px-2 py-1 rounded font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        {isAddingDoc ? 'إلغاء الإضافة' : 'إضافة مستند/ورقة جديدة'}
                      </button>
                    )}
                  </div>

                  {isAddingDoc && (
                    <div className="bg-slate-50 border border-amber-200/60 rounded-xl p-3.5 space-y-3 text-right">
                      <p className="font-bold text-slate-800 text-[11px] text-amber-700">إضافة مستند أو ورقة جديدة للأرشيف المغلق:</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">اسم المستند/الورقة:</label>
                          <input
                            type="text"
                            placeholder="مثلاً: حكم الاستئناف النهائي"
                            value={newDocName}
                            onChange={(e) => setNewDocName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 animate-fadeIn"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">تصنيف المستند:</label>
                          <select
                            value={newDocCategory}
                            onChange={(e) => setNewDocCategory(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                          >
                            <option value="أحكام">أحكام</option>
                            <option value="مذكرات">مذكرات</option>
                            <option value="صحف الدعاوى">صحف الدعاوى</option>
                            <option value="مستندات رسمية">مستندات رسمية</option>
                            <option value="أخرى">أخرى</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">نوع الملف المتوقع:</label>
                          <select
                            value={newDocType}
                            onChange={(e) => setNewDocType(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-none"
                          >
                            <option value="pdf">PDF</option>
                            <option value="word">Word (docx)</option>
                            <option value="image">صورة (JPG/PNG)</option>
                            <option value="doc">مستند نصي</option>
                          </select>
                        </div>
                      </div>

                      <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-white text-center hover:bg-slate-50/50 transition-all relative">
                        <input
                          type="file"
                          multiple
                          onChange={handleExistingCaseLocalFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="تحميل ملفات الكترونية"
                        />
                        <div className="space-y-1">
                          <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                          <p className="text-[10px] text-slate-600 font-bold">أو اسحب وأفلت مستنداً إلكترونياً هنا للتحميل المباشر</p>
                          <p className="text-[9px] text-slate-400">سيتم قراءة الاسم والحجم ونوع الملف تلقائياً</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setIsAddingDoc(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-[10px]"
                        >
                          إلغاء
                        </button>
                        <button
                          onClick={handleDirectAddDocToExistingCase}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-1.5 rounded-lg font-bold text-[10px]"
                        >
                          حفظ المستند
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {!selectedCaseProfile.files || selectedCaseProfile.files.length === 0 ? (
                      <p className="text-center py-4 text-slate-400 text-[11px] text-right">لا توجد مستندات مرفوعة حالياً في هذا الملف مؤرشفاً.</p>
                    ) : (
                      selectedCaseProfile.files.map(f => (
                        <div key={f.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center transition-all hover:bg-slate-100 text-right">
                          <span className="flex items-center gap-2">
                            <span className="text-xs">📁</span>
                            <span className="font-semibold text-slate-800">{f.name}</span>
                            <span className="text-[9px] text-slate-400">({f.category} - {f.size} - {f.uploadDate})</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => alert(`محاكاة الاطلاع: [${f.name}] مفتوح من الأرشيف المغلق للقراءة فقط.`)}
                              className="text-amber-600 hover:underline font-bold text-[11px]"
                            >
                              الاطلاع على المستند
                            </button>
                            {onUpdateCase && (
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من رغبتك في حذف هذا المستند نهائياً من الأرشيف؟')) {
                                    const updatedCase = {
                                      ...selectedCaseProfile,
                                      files: selectedCaseProfile.files.filter(file => file.id !== f.id)
                                    };
                                    onUpdateCase(updatedCase);
                                    setSelectedCaseProfile(updatedCase);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="حذف المستند من الأرشيف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    onClick={() => {
                      setSelectedCaseProfile(null);
                      setIsEditingCase(false);
                      setEditCaseForm(null);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold cursor-pointer"
                  >
                    إغلاق الاطلاع
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* POPUP: DETAILED ARCHIVED COMPANY PROFILE */}
      {selectedCompanyProfile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-5 h-5 text-emerald-600" />
                الملف الأرشيفي للشركة والشركاء: {selectedCompanyProfile.name}
              </h3>
              <button onClick={() => setSelectedCompanyProfile(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <div>
                  <p className="text-slate-500">تاريخ الحل والتصفية:</p>
                  <strong className="text-slate-800 text-sm font-mono">{selectedCompanyProfile.archiveDate}</strong>
                </div>
                <div>
                  <p className="text-slate-500">سبب الحل القانوني:</p>
                  <strong className="text-emerald-700 text-sm">{selectedCompanyProfile.archiveReason}</strong>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500">ملاحظات فض الشراكة وتصفية الأصول والضرائب:</p>
                  <p className="text-slate-700 mt-1 leading-relaxed">{selectedCompanyProfile.archiveNotes || 'تم غلق الملف الضريبي وإنهاء السجل التجاري كلياً.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">نوع الشركة:</span>
                  <strong className="text-slate-800">{selectedCompanyProfile.companyType || 'غير محدد'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">طبيعة النشاط:</span>
                  <strong className="text-slate-800">{selectedCompanyProfile.activityType}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <span className="text-slate-400 block mb-0.5">السجل التجاري والجهة:</span>
                  <strong className="text-slate-800 font-mono">{selectedCompanyProfile.commercialRegister}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">البطاقة الضريبية:</span>
                  <strong className="text-slate-800 font-mono">{selectedCompanyProfile.taxCard}</strong>
                </div>
              </div>

              {selectedCompanyProfile.officeFileNumber && (
                <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-amber-950 flex items-center gap-2 mt-3 text-xs font-bold">
                  <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>رقم ملف الشركة بالمكتب للأرشيف المغلق:</span>
                  <span className="text-amber-800 font-mono bg-white px-2 py-0.5 rounded border border-amber-200">{selectedCompanyProfile.officeFileNumber}</span>
                </div>
              )}

              <div className="border-t pt-3">
                <span className="text-slate-400 block mb-2">الشركاء وحصص رأس المال المغلقة:</span>
                <div className="space-y-2">
                  {selectedCompanyProfile.partners?.map((p, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                      <span>👤 الشريك: <strong>{p.name}</strong></span>
                      <span className="font-mono text-slate-600 font-bold">{p.participationPercentage}% | {p.shareValue.toLocaleString()} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setSelectedCompanyProfile(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
                >
                  إغلاق الاطلاع
                </button>
                {currentUser.permissions.printCompany && (
                  <button
                    onClick={() => handlePrintCompany(selectedCompanyProfile)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة ملف التصفية الكامل
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL: ADD NEW ARCHIVED CASE DIRECTLY */}
      {showAddArchiveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3 text-right">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Archive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    أرشفة وتقييد قضية مباشرة بالملفات والأرشيف
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    تسجيل ملف قضية مؤرشفة وتعيين أطراف الخصومة والقرارات الفنية وصحف الدعاوى والأحكام في الأرشيف الموحد
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowAddArchiveModal(false);
                  setNewCaseFiles([]);
                }}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Navigation */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none text-right">
              {[
                { id: 'judicial', label: 'البيانات القضائية', desc: 'المحكمة والدائرة', icon: Gavel },
                { id: 'litigants', label: 'أطراف الدعوى', desc: 'الموكلين والخصوم', icon: UserCheck },
                { id: 'financials', label: 'الأتعاب والتعليمات', desc: 'العقد والدفاع', icon: Coins },
                { id: 'attachments', label: 'المستندات والأوراق', desc: 'صحف الدعاوى والأحكام', icon: Paperclip },
                { id: 'archiving', label: 'بيانات الأرشفة', desc: 'سبب وتاريخ الغلق', icon: FolderOpen }
              ].map((step, idx) => {
                const Icon = step.icon;
                const isActive = activeFormTab === step.id;
                const isCompleted = ['judicial', 'litigants', 'financials', 'attachments', 'archiving'].indexOf(activeFormTab) > idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      setActiveFormTab(step.id as any);
                    }}
                    className={`flex items-center gap-2.5 text-right transition-all duration-200 outline-none ${
                      isActive ? 'opacity-100 scale-[1.02]' : 'opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-350 ${
                      isActive ? 'bg-slate-950 text-amber-400 shadow-sm ring-4 ring-slate-100' :
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

            {/* Modal Body */}
            <form onSubmit={handleSubmitArchivedCase} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-right">
              
              {/* Judicial Section */}
              {activeFormTab === 'judicial' && (
                <div>
                  <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4 flex items-center gap-1.5 justify-end">
                    <span>البيانات القضائية والقيد بالجدول</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </h4>
                  
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">درجة التقاضي الحالية</label>
                      <select
                        value={degree}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setDegree(val);
                          if (val === 'استئناف') {
                            setShowAppealSection(true);
                          } else if (val === 'نقض') {
                            setShowAppealSection(true);
                            setShowCassationSection(true);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="أول درجة">أول درجة</option>
                        <option value="استئناف">استئناف</option>
                        <option value="نقض">نقض</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">نوع القضية</label>
                      <select
                        value={caseType}
                        onChange={(e) => setCaseType(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans"
                      >
                        <option value="جنائي">جنائي</option>
                        <option value="جنح">جنح</option>
                        <option value="ادارى">ادارى</option>
                        <option value="مخالفات">مخالفات</option>
                        <option value="مدني">مدني</option>
                        <option value="إيجارات">إيجارات</option>
                        <option value="تجارى">تجارى</option>
                        <option value="عمال">عمال</option>
                        <option value="أحوال شخصية">أحوال شخصية</option>
                        <option value="صحة توقيع">صحة توقيع</option>
                        <option value="مجلس الدولة">مجلس الدولة</option>
                        <option value="تنفيذ">تنفيذ</option>
                        <option value="إشكالات">إشكالات</option>
                        <option value="منازعات تنفيذ">منازعات تنفيذ</option>
                        <option value="أخرى">أخرى (أدخل بالأسفل)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 text-amber-700">رقم ملف الأرشيف / المكتب 📂</label>
                      <input
                        type="text"
                        placeholder="مثال: رف 4 ب - صندوق رقم 12"
                        value={archiveFileNumber}
                        onChange={(e) => setArchiveFileNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-right font-bold focus:border-amber-500 focus:ring-1 focus:ring-amber-500/10 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 justify-end bg-slate-50 border border-slate-150 p-3 rounded-xl mb-4">
                    <span className="text-[11px] font-bold text-slate-500">خيارات مراحل التقاضي:</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showAppealSection}
                        onChange={(e) => {
                          setShowAppealSection(e.target.checked);
                          if (!e.target.checked && degree === 'استئناف') {
                            setDegree('أول درجة');
                          }
                        }}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">تفعيل مرحلة الاستئناف</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showCassationSection}
                        onChange={(e) => {
                          setShowCassationSection(e.target.checked);
                          if (!e.target.checked && degree === 'نقض') {
                            setDegree(showAppealSection ? 'استئناف' : 'أول درجة');
                          }
                        }}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-700">تفعيل مرحلة الطعن بالنقض</span>
                    </label>
                  </div>

                  {caseType === 'أخرى' && (
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">اكتب نوع القضية المخصص</label>
                      <input
                        type="text"
                        placeholder="مثال: تحكيم هندسي، استثمار"
                        value={customCaseType}
                        onChange={(e) => setCustomCaseType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  {/* First Instance Card */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                    <h5 className="text-xs font-bold text-slate-800 border-b border-slate-150 pb-2 mb-3 flex items-center gap-1.5 justify-end">
                      <span>أولاً: مرحلة أول درجة</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">المحكمة</label>
                        <CourtSelect
                          value={court1st}
                          onChange={setCourt1st}
                          placeholder="مثال: محكمة أسرة التجمع الخامس"
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-right font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">مقر الانعقاد</label>
                        <input
                          type="text"
                          placeholder="مثال: القاهرة الجديدة"
                          value={venue1st}
                          onChange={(e) => setVenue1st(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">الدائرة</label>
                        <input
                          type="text"
                          placeholder="مثال: الدائرة 3 إيجارات"
                          value={circuit1st}
                          onChange={(e) => setCircuit1st(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">رقم القضية (مطلوب)</label>
                        <input
                          type="text"
                          placeholder="رقم الدعوى"
                          value={caseNo1st}
                          onChange={(e) => setCaseNo1st(e.target.value)}
                          required={degree === 'أول درجة'}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left font-mono"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">سنة القضية (مطلوب)</label>
                        <input
                          type="text"
                          placeholder="2026"
                          value={caseYear1st}
                          onChange={(e) => setCaseYear1st(e.target.value)}
                          required={degree === 'أول درجة'}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Appeal Card */}
                  {showAppealSection && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-3">
                        {degree !== 'استئناف' && degree !== 'نقض' && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAppealSection(false);
                              setCaseNo2nd('');
                              setCaseYear2nd('');
                              setCourt2nd('');
                              setVenue2nd('');
                              setCircuit2nd('');
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                          >
                            إخفاء وحذف البيانات
                          </button>
                        )}
                        <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                          <span>ثانياً: مرحلة الاستئناف</span>
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        </h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">المحكمة</label>
                          <CourtSelect
                            value={court2nd}
                            onChange={setCourt2nd}
                            placeholder="مثال: استئناف عالي شمال القاهرة"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-right font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">مقر الانعقاد</label>
                          <input
                            type="text"
                            placeholder="مثال: العباسية"
                            value={venue2nd}
                            onChange={(e) => setVenue2nd(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">الدائرة</label>
                          <input
                            type="text"
                            placeholder="مثال: الدائرة 5 مستأنف"
                            value={circuit2nd}
                            onChange={(e) => setCircuit2nd(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">رقم الاستئناف (مطلوب)</label>
                          <input
                            type="text"
                            placeholder="رقم الاستئناف"
                            value={caseNo2nd}
                            onChange={(e) => setCaseNo2nd(e.target.value)}
                            required={degree === 'استئناف'}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left font-mono"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">سنة الاستئناف (مطلوب)</label>
                          <input
                            type="text"
                            placeholder="سنة الاستئناف"
                            value={caseYear2nd}
                            onChange={(e) => setCaseYear2nd(e.target.value)}
                            required={degree === 'استئناف'}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left font-mono"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cassation Card */}
                  {showCassationSection && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-3">
                        {degree !== 'نقض' && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowCassationSection(false);
                              setCassationNumber('');
                              setCassationYear('');
                              setCourtCass('');
                              setVenueCass('');
                              setCircuitCass('');
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                          >
                            إخفاء وحذف البيانات
                          </button>
                        )}
                        <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                          <span>ثالثاً: مرحلة الطعن بالنقض</span>
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        </h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">محكمة النقض (أو المختصة)</label>
                          <CourtSelect
                            value={courtCass}
                            onChange={setCourtCass}
                            placeholder="مثال: محكمة النقض العليا"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-right font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">مقر الانعقاد</label>
                          <input
                            type="text"
                            placeholder="مثال: دار القضاء العالي"
                            value={venueCass}
                            onChange={(e) => setVenueCass(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">الدائرة</label>
                          <input
                            type="text"
                            placeholder="مثال: الدائرة الجنائية"
                            value={circuitCass}
                            onChange={(e) => setCircuitCass(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">رقم الطعن (مطلوب)</label>
                          <input
                            type="text"
                            placeholder="رقم الطعن"
                            value={cassationNumber}
                            onChange={(e) => setCassationNumber(e.target.value)}
                            required={degree === 'نقض'}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left font-mono"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">سنة الطعن (مطلوب)</label>
                          <input
                            type="text"
                            placeholder="سنة الطعن"
                            value={cassationYear}
                            onChange={(e) => setCassationYear(e.target.value)}
                            required={degree === 'نقض'}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left font-mono"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Legal metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-right">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">اسم السيد عضو النيابة المسؤول</label>
                      <input
                        type="text"
                        placeholder="مثال: رئيس النيابة الكلية"
                        value={prosecutor}
                        onChange={(e) => setProsecutor(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الحصر والقيد التنفيذي (إن وجد)</label>
                      <input
                        type="text"
                        placeholder="مثال: 453 لسنة 2024 حصر"
                        value={enforcementNo}
                        onChange={(e) => setEnforcementNo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">حالة رول الجلسة والدعوى</label>
                      <select
                        value={caseStatus}
                        onChange={(e) => setCaseStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                      >
                        <option value="مؤرشفة مغلقة">مؤرشفة مغلقة</option>
                        <option value="متداولة بجلسات المحكمة">متداولة بجلسات المحكمة</option>
                        <option value="حكم تمهيدي خبير">حكم تمهيدي خبير</option>
                        <option value="محجوزة للحكم">محجوزة للحكم</option>
                        <option value="منتهية ومحفوظة بالملفات">منتهية ومحفوظة بالملفات</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 text-right">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">موضوع الدعوى</label>
                      <textarea
                        placeholder="اكتب موضوع القضية أو عريضة الدعوى بشكل واضح هنا..."
                        value={caseSubject}
                        onChange={(e) => setCaseSubject(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات ودفوع جوهرية بالملف</label>
                      <textarea
                        placeholder="اكتب أية دفوع أو ثغرات أو تعليمات للمرافعة هنا..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Litigants Tab */}
              {activeFormTab === 'litigants' && (
                <div className="space-y-4">
                  
                  {/* Clients List */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-3">
                      <button
                        type="button"
                        onClick={handleAddNewClient}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        إضافة موكل آخر
                      </button>
                      <h4 className="text-xs font-bold text-amber-600 flex items-center gap-1.5 justify-end">
                        <span>أولاً: الموكلين وأصحاب الشأن (الطرف الأول)</span>
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {newCaseClients.map((client, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative space-y-3 text-right">
                          <div className="flex justify-between items-center border-b pb-1.5">
                            {newCaseClients.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveClient(idx)}
                                className="text-red-500 hover:text-red-700 text-[10px] font-bold flex items-center gap-0.5 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف
                              </button>
                            )}
                            <span className="font-bold text-slate-800 text-[11px]">
                              {idx === 0 ? 'الموكل الأول والأساسي' : `الموكل رقم ${idx + 1}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-right font-sans">
                            <div className="col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">الاسم الكامل (مطلوب)</label>
                              <input
                                type="text"
                                required={idx === 0}
                                placeholder="أدخل اسم الموكل بالكامل"
                                value={client.name}
                                onChange={(e) => handleUpdateClient(idx, { name: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">الصفة بالدعوى</label>
                              <input
                                type="text"
                                placeholder="مثال: مدعي، مستأنف"
                                value={client.role}
                                onChange={(e) => handleUpdateClient(idx, { role: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">رقم الهاتف (اختياري)</label>
                              <input
                                type="text"
                                placeholder="رقم الموكل للتواصل"
                                value={client.phone}
                                onChange={(e) => handleUpdateClient(idx, { phone: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">البريد الإلكتروني (اختياري)</label>
                              <input
                                type="email"
                                placeholder="البريد الإلكتروني"
                                value={client.email}
                                onChange={(e) => handleUpdateClient(idx, { email: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                                dir="ltr"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Opponents List */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-3">
                      <button
                        type="button"
                        onClick={handleAddNewOpponent}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        إضافة خصم آخر
                      </button>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                        <span>ثانياً: الخصوم والمدعى عليهم (الطرف الثاني)</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {newCaseOpponents.map((opponent, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs relative space-y-3 text-right">
                          <div className="flex justify-between items-center border-b pb-1.5">
                            {newCaseOpponents.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOpponent(idx)}
                                className="text-red-500 hover:text-red-700 text-[10px] font-bold flex items-center gap-0.5 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف
                              </button>
                            )}
                            <span className="font-bold text-slate-800 text-[11px]">
                              {idx === 0 ? 'الخصم الأول والأساسي' : `الخصم رقم ${idx + 1}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-right font-sans">
                            <div className="col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">اسم الخصم (مطلوب)</label>
                              <input
                                type="text"
                                required={idx === 0}
                                placeholder="أدخل اسم الخصم بالكامل"
                                value={opponent.name}
                                onChange={(e) => handleUpdateOpponent(idx, { name: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">الصفة بالدعوى</label>
                              <input
                                type="text"
                                placeholder="مثال: مدعى عليه"
                                value={opponent.role}
                                onChange={(e) => handleUpdateOpponent(idx, { role: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">هاتف الخصم (اختياري)</label>
                              <input
                                type="text"
                                placeholder="هاتف للتواصل"
                                value={opponent.phone}
                                onChange={(e) => handleUpdateOpponent(idx, { phone: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">محل الإقامة والعنوان (اختياري)</label>
                              <input
                                type="text"
                                placeholder="أدخل العنوان الكامل للخصم"
                                value={opponent.address}
                                onChange={(e) => handleUpdateOpponent(idx, { address: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">محامي الخصم (إن وجد)</label>
                              <input
                                type="text"
                                placeholder="اسم وكيل الخصم"
                                value={opponent.lawyer}
                                onChange={(e) => handleUpdateOpponent(idx, { lawyer: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">هاتف محامي الخصم (اختياري)</label>
                              <input
                                type="text"
                                placeholder="رقم هاتف محامي الخصم"
                                value={opponent.lawyerPhone}
                                onChange={(e) => handleUpdateOpponent(idx, { lawyerPhone: e.target.value })}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* Financials Tab */}
              {activeFormTab === 'financials' && (
                <div>
                  <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4 flex items-center gap-1.5 justify-end">
                    <span>عقد الأتعاب وتكليف الدفاع</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">إجمالي مبلغ الأتعاب بالعقد (ج.م)</label>
                      <input
                        type="number"
                        value={totalFees || ''}
                        placeholder="0"
                        onChange={(e) => setTotalFees(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">المسدد والمدفوع فعلاً (ج.م)</label>
                      <input
                        type="number"
                        value={paidFees || ''}
                        placeholder="0"
                        onChange={(e) => setPaidFees(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">المحامي المسؤول والمكلف بالملف</label>
                      <select
                        value={assignedLawyer}
                        onChange={(e) => setAssignedLawyer(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                      >
                        <option value="">-- اختر محامياً لتكليفه بالدعوى --</option>
                        {users.filter(u => u.role === 'lawyer' || u.role === 'admin').map(u => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.role === 'admin' ? 'مدير النظام' : 'محامٍ شريك'})
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>


                </div>
              )}

              {/* Attachments Tab */}
              {activeFormTab === 'attachments' && (
                <div>
                  <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4 flex items-center gap-1.5 justify-end">
                    <span>إرفاق صحف الدعاوى والأحكام والمستندات الرسمية</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </h4>
                  
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5 text-right">
                    
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fadeIn">
                        
                        {/* File selector input */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold text-[10px] py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 border border-slate-800 transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95"
                            >
                              <Upload className="w-3.5 h-3.5 text-amber-400" />
                              تحميل من الجهاز 💻
                            </button>
                            <input
                              ref={fileInputRef}
                              id="device-file-input"
                              type="file"
                              className="hidden"
                              onChange={handleDeviceUpload}
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                            />
                            {stagedDeviceFile ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1" title={stagedDeviceFile.originalName}>
                                <CheckCircle className="w-3.5 h-3.5" />
                                ملف جاهز ({stagedDeviceFile.size})
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">لم يتم اختيار ملف بعد</span>
                            )}
                          </div>
                          <div>
                            <h5 className="text-[11px] font-black text-slate-900">اختيار الملف المطلوب إرفاقه</h5>
                            <p className="text-[9px] text-slate-400 font-bold">يمكنك رفع ملف (PDF, Word, Image) مباشرة من جهازك</p>
                          </div>
                        </div>

                        {/* File description fields */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
                          
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">رافع الملف ومقيد السند</label>
                            <input
                              type="text"
                              value={newFileUploader}
                              onChange={(e) => setNewFileUploader(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-right"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">نوع المستند</label>
                            <select
                              value={newFileType}
                              onChange={(e) => setNewFileType(e.target.value as any)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-right font-sans"
                            >
                              <option value="pdf">PDF</option>
                              <option value="word">Word</option>
                              <option value="image">صورة</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">تصنيف الورقة بالملف</label>
                            <select
                              value={newFileCategory}
                              onChange={(e) => setNewFileCategory(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-right"
                            >
                              <option value="صحيفة دعوى">صحيفة دعوى</option>
                              <option value="مذكرة دفاع">مذكرة دفاع</option>
                              <option value="حافظة مستندات">حافظة مستندات</option>
                              <option value="حكم">حكم</option>
                              <option value="محضر جلسة">محضر جلسة</option>
                              <option value="توكيل">توكيل</option>
                              <option value="أخرى">أخرى</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم المستند المرفق بالدفتر</label>
                            <input
                              type="text"
                              placeholder="أدخل اسماً واضحاً للورقة"
                              value={newFileName}
                              onChange={(e) => setNewFileName(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-right font-bold focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                        </div>

                        {/* Add file button */}
                        <div className="flex justify-end pt-2 border-t border-slate-50">
                          <button
                            type="button"
                            onClick={handleUploadStagedFile}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] py-1.5 px-5 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                          >
                            <Plus className="w-4 h-4 text-slate-950" />
                            إرفاق الورقة المحددة بمجلد القضية
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Attached files summary */}
                    {newCaseFiles.length > 0 && (
                      <div className="space-y-2 mt-4 text-right">
                        <p className="text-[10px] font-bold text-slate-600">المستندات المرفقة حتى الآن بمجلد القضية ({newCaseFiles.length}):</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {newCaseFiles.map((f) => (
                            <div key={f.id} className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-[11px] shadow-xs">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTempFile(f.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewingFile({ id: f.id, name: f.name, type: f.type, category: f.category, size: f.size })}
                                  className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] py-1 px-2.5 rounded-lg border border-slate-200"
                                >
                                  معاينة
                                </button>
                              </div>
                              <div className="text-right">
                                <strong className="text-slate-800 font-bold block">{f.name}</strong>
                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{f.category} | {f.size} | {f.type.toUpperCase()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Archiving Details Tab */}
              {activeFormTab === 'archiving' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4 flex items-center gap-1.5 justify-end">
                    <span>بيانات الأرشفة وحفظ الملف بالكامل</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </h4>
                  
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">تاريخ غلق وأرشفة الملف</label>
                      <input
                        type="date"
                        value={archiveDate}
                        onChange={(e) => setArchiveDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">سبب الأرشفة والترحيل للدفاتر</label>
                      <select
                        value={archiveReason}
                        onChange={(e) => setArchiveReason(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-right font-sans"
                      >
                        <option value="صدر حكم نهائي">صدر حكم نهائي في الموضوع</option>
                        <option value="تم التنفيذ">تم التنفيذ بالكامل واسترداد الحقوق</option>
                        <option value="الصلح">الصلح الودي والتصالح</option>
                        <option value="التنازل">التنازل عن الدعوى رسمياً</option>
                        <option value="حفظ الأوراق">حفظ الأوراق إدارياً</option>
                        <option value="بناءً على طلب المدير">بناءً على طلب المدير والمالك</option>
                        <option value="انتهاء العمل المطلوب">انتهاء العمل المطلوب</option>
                        <option value="إيقاف العمل مؤقتاً">إيقاف العمل مؤقتاً</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">حالة القضية عند الأرشفة</label>
                      <select
                        value={archiveStatus}
                        onChange={(e) => setArchiveStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-sans text-right"
                      >
                        <option value="منتهية">منتهية</option>
                        <option value="حكم نهائي">حكم نهائي</option>
                        <option value="تنفيذ">تنفيذ</option>
                        <option value="صلح">صلح</option>
                        <option value="تنازل">تنازل</option>
                        <option value="حفظ">حفظ</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 gap-4 text-right">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">رقم ملف الأرشيف والموقع الجغرافي (اختياري)</label>
                      <input
                        type="text"
                        placeholder="مثال: رف 4 ب - صندوق رقم 12"
                        value={archiveFileNumber}
                        onChange={(e) => setArchiveFileNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات وقرارات الأرشفة الختامية</label>
                      <textarea
                        placeholder="اكتب أية ملاحظات تفصيلية لعملية الأرشفة والحل النهائي هنا..."
                        value={archiveNotes}
                        onChange={(e) => setArchiveNotes(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none text-right"
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* Navigation buttons */}
              <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl shrink-0">
                
                {/* Right side: Back / Cancel button */}
                <div>
                  {activeFormTab === 'judicial' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddArchiveModal(false);
                        setNewCaseFiles([]);
                      }}
                      className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs rounded-xl font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      إلغاء وإغلاق
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>السابق</span>
                    </button>
                  )}
                </div>

                {/* Left side: Next, Quick Save, or Submit */}
                <div className="flex items-center gap-2.5">
                  {activeFormTab !== 'archiving' && (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-amber-400 text-xs rounded-xl font-black transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      <span>التالي</span>
                    </button>
                  )}

                  {activeFormTab !== 'archiving' && (
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <CheckCircle className="w-4 h-4" />
                      حفظ وأرشفة الآن
                    </button>
                  )}

                  {activeFormTab === 'archiving' && (
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-400 text-xs rounded-xl font-black transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      <CheckCircle className="w-5 h-5" />
                      تأكيد وأرشفة القضية بالدفاتر رسمياً
                    </button>
                  )}
                </div>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* Permanent Delete Case Modal */}
      {deleteCaseTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">تأكيد حذف القضية المؤرشفة نهائياً</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              يرجى العلم أن حذف القضية المؤرشفة رقم <strong className="text-slate-800">"{deleteCaseTarget.caseNumberFirstInstance}"</strong> لسنة <strong className="text-slate-800">{deleteCaseTarget.caseYearFirstInstance}</strong> نهائياً سيقوم بإزالتها بالكامل من سجلات الأرشيف ولا يمكن التراجع عن هذه الخطوة.
            </p>

            {deleteCaseError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {deleteCaseError}
              </div>
            )}

            <div className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة مرور الدخول الخاصة بك للتأكيد</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={deleteCasePassword}
                  onChange={(e) => setDeleteCasePassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteCaseTarget(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء وتراجع
              </button>
              <button
                onClick={handleDeleteCaseSubmit}
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">تأكيد حذف الشركة المؤرشفة نهائياً</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              يرجى العلم أن حذف سجلات وملف شركة <strong className="text-slate-800">"{deleteCompanyTarget.name}"</strong> نهائياً سيقوم بإزالتها بالكامل من سجلات الأرشيف ولا يمكن التراجع عن هذه الخطوة.
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

      {/* ADD ARCHIVED COMPANY MODAL */}
      <BaseModal
        isOpen={showAddCompanyArchiveModal}
        onClose={() => {
          setShowAddCompanyArchiveModal(false);
          setActiveCompanyFormTab('basic');
          setNewCompanyPartners([]);
          setNewCompanyDocs([]);
        }}
        title="تسجيل وأرشفة شركة أو تصفية جديدة مباشرة للأرشيف المغلق"
        description="تسجيل الكيان القانوني للمنشأة وتوثيق السجل والبطاقة الضريبية وحصص الشركاء والمستندات بملفات الأرشيف المغلق كلياً"
        icon={Building2}
        size="4xl"
      >
        {showAddCompanyArchiveModal && (
          <>
            {/* Stepper Navigation */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none mb-6">
          {[
            { id: 'basic', label: 'البيانات والتأسيس', desc: 'القيد التجاري والنشاط', icon: Building2 },
            { id: 'partners', label: 'سجل الشركاء', desc: 'الحصص والتوزيع', icon: Users },
            { id: 'archiving', label: 'قرار الأرشفة', desc: 'سبب وتاريخ الأرشفة', icon: FolderOpen },
            { id: 'docs', label: 'مستندات التصفية', desc: 'العقود والقرارات', icon: Paperclip }
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeCompanyFormTab === step.id;
            const isCompleted = ['basic', 'partners', 'archiving', 'docs'].indexOf(activeCompanyFormTab) > idx;
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
                  isActive ? 'bg-slate-900 text-emerald-400 shadow-sm ring-4 ring-slate-100' :
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

        <form onSubmit={handleSubmitArchivedCompany} className="space-y-6">
          {/* Step 1: Basic Info */}
          {activeCompanyFormTab === 'basic' && (
            <div className="space-y-6 animate-fadeIn">
              <FormCard title="بيانات الهوية والقيد التجاري للشركة" icon={Building2} accentClass="bg-emerald-600">
                <FormGrid cols={3}>
                  <FormField label="اسم الشركة التجاري بالكامل *" required>
                    <input
                      type="text"
                      required
                      placeholder="مثلاً: شركة الفتح للمقاولات والتوريدات ذ.م.م"
                      value={newCompanyForm.name}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-semibold text-slate-900"
                    />
                  </FormField>
                  <FormField label="نوع المنشأة القانوني" required>
                    <select
                      value={newCompanyForm.companyType}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, companyType: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-bold text-slate-800"
                    >
                      <option value="شركة مساهمة">شركة مساهمة</option>
                      <option value="شركة ذات مسئولية محدودة">شركة ذات مسئولية محدودة</option>
                      <option value="شركة شخص واحد">شركة شخص واحد</option>
                      <option value="شركة توصية بسيطة">شركة توصية بسيطة</option>
                      <option value="شركة تضامن">شركة تضامن</option>
                      <option value="منشأة فردية">منشأة فردية</option>
                    </select>
                  </FormField>
                  <FormField label="طبيعة النشاط أو مجال العمل">
                    <input
                      type="text"
                      placeholder="مثلاً: مقاولات عمومية، استيراد وتصدير"
                      value={newCompanyForm.activityType}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, activityType: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-medium text-slate-800"
                    />
                  </FormField>
                </FormGrid>

                <FormGrid cols={3}>
                  <FormField label="رقم السجل التجاري والجهة *" required>
                    <input
                      type="text"
                      required
                      placeholder="مثلاً: 12345/القاهرة"
                      value={newCompanyForm.commercialRegister}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, commercialRegister: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-semibold"
                    />
                  </FormField>
                  <FormField label="رقم الملف الضريبي والبطاقة">
                    <input
                      type="text"
                      placeholder="مثلاً: 987-654-321"
                      value={newCompanyForm.taxCard}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, taxCard: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-850"
                    />
                  </FormField>
                  <FormField label="رقم شهادة الضريبة المضافة (إن وجد)">
                    <input
                      type="text"
                      placeholder="مثلاً: 554-321"
                      value={newCompanyForm.vatCertificate}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, vatCertificate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-850"
                    />
                  </FormField>
                </FormGrid>

                <FormGrid cols={3}>
                  <FormField label="هاتف التواصل للشركة">
                    <input
                      type="text"
                      placeholder="مثلاً: 0221234567"
                      value={newCompanyForm.phone}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-medium text-slate-850"
                    />
                  </FormField>
                  <FormField label="رقم ملف الشركة بالمكتب (للأرشيف المغلق)">
                    <input
                      type="text"
                      placeholder="مثلاً: م/2026/12"
                      value={newCompanyForm.officeFileNumber}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, officeFileNumber: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-bold text-emerald-800"
                    />
                  </FormField>
                  <FormField label="العنوان الرئيسي ومحل الإقامة المختار">
                    <input
                      type="text"
                      placeholder="مثلاً: قصر النيل، القاهرة"
                      value={newCompanyForm.address}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-medium text-slate-850"
                    />
                  </FormField>
                </FormGrid>
              </FormCard>
            </div>
          )}

          {/* Step 2: Archiving & Liquidation */}
          {activeCompanyFormTab === 'archiving' && (
            <div className="space-y-6 animate-fadeIn">
              <FormCard title="قرار الأرشفة وإغلاق الملف القانوني" icon={FolderOpen} accentClass="bg-amber-500">
                <FormGrid cols={2}>
                  <FormField label="سبب أرشفة وإغلاق الملف القانوني" required>
                    <select
                      value={newCompanyForm.archiveReason}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, archiveReason: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-bold text-emerald-800"
                    >
                      <option value="تصفية الشركة">تصفية الشركة بالكامل وفض الشراكة</option>
                      <option value="إيقاف النشاط">إيقاف النشاط مؤقتاً/نهائياً</option>
                      <option value="انتهاء التعاقد مع المكتب">انتهاء عقد الاستشارات مع المكتب</option>
                      <option value="دمج الشركة">دمج الشركة مع كيان آخر</option>
                      <option value="حل بقرار قضائي">حل الشركة بقرار قضائي/تحكيمي</option>
                      <option value="انتهاء العمل المطلوب">انتهاء العمل المطلوب</option>
                      <option value="إيقاف العمل مؤقتاً">إيقاف العمل مؤقتاً</option>
                    </select>
                  </FormField>
                  <FormField label="تاريخ الأرشفة بالدفاتر" required>
                    <input
                      type="date"
                      required
                      value={newCompanyForm.archiveDate}
                      onChange={(e) => setNewCompanyForm(prev => ({ ...prev, archiveDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-900"
                    />
                  </FormField>
                </FormGrid>

                <FormField label="تقرير وملاحظات الأرشفة والحل النهائي">
                  <textarea
                    rows={4}
                    placeholder="مثلاً: تم توزيع الأصول وسداد التأمينات والضرائب بالكامل وإنهاء كافة الإجراءات مع مصلحة الضرائب والسجل التجاري..."
                    value={newCompanyForm.archiveNotes}
                    onChange={(e) => setNewCompanyForm(prev => ({ ...prev, archiveNotes: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-medium text-slate-800"
                  />
                </FormField>
              </FormCard>
            </div>
          )}

          {/* Step 3: Partners List */}
          {activeCompanyFormTab === 'partners' && (
            <div className="space-y-6 animate-fadeIn">
              <FormCard title="إدخل بيانات الشركاء وتوزيع الحصص التأسيسية" icon={Users} accentClass="bg-emerald-600">
                <div className="bg-slate-50/75 p-5 rounded-2xl border border-slate-150 space-y-4 text-right">
                  <p className="font-bold text-slate-700 text-[10px] mb-2">إدخال شريك جديد في الشركة ومطابقة حصته ورقم هويته:</p>
                  
                  <FormGrid cols={3}>
                    <FormField label="اسم الشريك بالكامل">
                      <input
                        type="text"
                        placeholder="اسم الشريك بالكامل"
                        value={coPartName}
                        onChange={(e) => setCoPartName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-semibold text-slate-850"
                      />
                    </FormField>
                    <FormField label="نسبة الشراكة (%)">
                      <input
                        type="number"
                        placeholder="مثلاً: 25"
                        value={coPartPercentage || ''}
                        onChange={(e) => setCoPartPercentage(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-850"
                      />
                    </FormField>
                    <FormField label="قيمة الحصة الرأسمالية (ج.م)">
                      <input
                        type="number"
                        placeholder="مثلاً: 100000"
                        value={coPartShare || ''}
                        onChange={(e) => setCoPartShare(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-850"
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid cols={3}>
                    <FormField label="الرقم القومي للشريك">
                      <input
                        type="text"
                        placeholder="14 رقم"
                        value={coPartId}
                        onChange={(e) => setCoPartId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-850"
                      />
                    </FormField>
                    <FormField label="هاتف التواصل للشريك">
                      <input
                        type="text"
                        placeholder="هاتف الشريك"
                        value={coPartPhone}
                        onChange={(e) => setCoPartPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-mono font-medium text-slate-850"
                      />
                    </FormField>
                    <FormField label="عنوان الشريك المختار">
                      <input
                        type="text"
                        placeholder="محل إقامة الشريك"
                        value={coPartAddress}
                        onChange={(e) => setCoPartAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all font-sans font-medium text-slate-850"
                      />
                    </FormField>
                  </FormGrid>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleAddCoPartner}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-5 h-5" />
                      إضافة الشريك للسجلات +
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] font-black text-slate-850 flex items-center gap-1.5">
                      <Users className="w-5 h-5 text-emerald-600" />
                      شركاء شركة التصفية المضافين حالياً ({newCompanyPartners.length})
                    </span>
                  </div>

                  {newCompanyPartners.length === 0 ? (
                    <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-xs">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-[11px] text-slate-400 italic">لا يوجد شركاء مضافين حالياً لهذه المنشأة المصفاة.</p>
                      <p className="text-[9px] text-slate-400 mt-1">يرجى كتابة بيانات الشريك وضمه من النموذج بالأعلى.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto pr-1">
                      {newCompanyPartners.map((p, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
                          <div className="absolute top-0 bottom-0 right-0 w-1 bg-emerald-500" />
                          <div className="space-y-2 pr-2 text-right">
                            <div className="flex items-center justify-between">
                              <strong className="text-[11px] font-black text-slate-900">{p.name}</strong>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100/50 px-2 py-0.5 rounded text-[9px] font-black leading-none">
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
                              onClick={() => handleRemoveCoPartner(idx)}
                              className="text-[10px] text-red-650 hover:bg-red-50 hover:text-red-755 px-2.5 py-1.5 rounded-lg font-bold transition-all"
                            >
                              إزالة من السجل 🗑️
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

          {/* Step 4: Documents and Contracts */}
          {activeCompanyFormTab === 'docs' && (
            <div className="space-y-6 animate-fadeIn">
              <FormCard title="مستندات وعقود التصفية والحل الملحقة" icon={Paperclip} accentClass="bg-emerald-600">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-5">
                  
                  {/* Top Action Row: File Picker */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h5 className="text-[11px] font-black text-slate-900">اختيار الملف المطلوب إرفاقه لتصفية المنشأة</h5>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">يمكنك رفع ملف (PDF, Word, Image) مباشرة من جهازك ليكون جزءاً من ملف الأرشفة</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => companyFileInputRef.current?.click()}
                        className="bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold text-[10px] py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 border border-slate-800 transition-all shadow-xs cursor-pointer hover:scale-[1.02] active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        تحميل من الجهاز 💻
                      </button>
                      <input
                        ref={companyFileInputRef}
                        id="company-archive-device-file-input"
                        type="file"
                        className="hidden"
                        onChange={handleCompanyDeviceUpload}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                      />
                      {stagedCompanyFile ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1" title={stagedCompanyFile.originalName}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          ملف جاهز ({stagedCompanyFile.size})
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">لم يتم اختيار ملف بعد</span>
                      )}
                    </div>
                  </div>

                  {/* Drag & Drop area next to input fields */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    {/* Drag & Drop Area */}
                    <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-white text-center hover:bg-slate-50 transition-all relative flex flex-col justify-center items-center min-h-[140px] md:col-span-1">
                      <input
                        type="file"
                        multiple
                        onChange={handleLocalCoFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="تحميل وثائق التصفية"
                      />
                      <div className="space-y-1.5">
                        <Upload className="w-6 h-6 text-emerald-600 mx-auto animate-pulse" />
                        <p className="text-[10px] text-slate-700 font-bold">اسحب وأفلت الوثائق هنا</p>
                        <p className="text-[8px] text-slate-400">تحميل متعدد ومباشر للسحابة</p>
                      </div>
                    </div>

                    {/* Organized Input Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2">
                      <FormField label="اسم المستند القانوني ✏️">
                        <input
                          type="text"
                          placeholder="مثال: قرار الجمعية غير العادية بالحل..."
                          value={coDocName}
                          onChange={(e) => setCoDocName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                        />
                      </FormField>

                      <FormField label="صيغة الملف المستلم 📄">
                        <select
                          value={coDocType}
                          onChange={(e) => setCoDocType(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none transition-all cursor-pointer"
                        >
                          <option value="pdf">ملف PDF مستند رسمي</option>
                          <option value="word">ملف Word (docx)</option>
                          <option value="image">صورة ضوئية ملونة (JPG/PNG)</option>
                        </select>
                      </FormField>

                      <FormField label="تاريخ الرفع والإثبات 📅" isMono>
                        <input
                          type="text"
                          readOnly
                          value={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-500 cursor-not-allowed outline-none"
                        />
                      </FormField>

                      <FormField label="الجهة المودع لديها 🏛️">
                        <input
                          type="text"
                          readOnly
                          value="سجلات الأرشفة والتصفية"
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-500 cursor-not-allowed outline-none"
                        />
                      </FormField>
                    </div>
                  </div>

                  {/* Attach Button */}
                  <div className="flex justify-end gap-3 pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      disabled={isCompanyDocUploading}
                      onClick={handleAddCoDoc}
                      className={`w-full md:w-auto font-black px-8 py-2.5 rounded-xl text-xs shadow-md transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                        isCompanyDocUploading
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02] active:scale-95'
                      }`}
                    >
                      {isCompanyDocUploading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          جاري الرفع والاتصال بالسحابة... ☁️
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          إرفاق المستند بالملف ➕
                        </>
                      )}
                    </button>
                  </div>

                  {/* Instant Preview Banner */}
                  {stagedCompanyFile && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">معاينة فورية</span>
                        <span className="text-slate-600 font-bold">اسم الملف الأصلي المرفوع: <strong className="font-black text-slate-850">{stagedCompanyFile.originalName}</strong></span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (stagedCompanyFile.fileUrl && stagedCompanyFile.fileUrl !== '#') {
                              setPreviewingFile({
                                id: 'staged',
                                name: coDocName || stagedCompanyFile.originalName,
                                type: stagedCompanyFile.type,
                                category: 'وثيقة تصفية وأرشفة',
                                size: stagedCompanyFile.size
                              });
                            } else {
                              alert('رابط المعاينة غير صالح أو مفقود.');
                            }
                          }}
                          className="text-[10px] bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                        >
                          👁️ معاينة المستند
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStagedCompanyFile(null);
                            setCoDocName('');
                          }}
                          className="text-[10px] text-red-650 hover:text-red-755 font-bold py-1 px-2 cursor-pointer"
                        >
                          إلغاء الملف
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Stored Document Cards Grid */}
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-black text-slate-850 flex items-center gap-1.5">
                        <Paperclip className="w-5 h-5 text-emerald-600" />
                        المستندات وعقود التصفية المرفقة بالشركة حالياً ({newCompanyDocs.length})
                      </span>
                    </div>

                    {newCompanyDocs.length === 0 ? (
                      <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-xs">
                        <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[11px] text-slate-400 italic">لا توجد أوراق أو مستندات مرفقة بهذه الشركة مؤرشفة حالياً.</p>
                        <p className="text-[9px] text-slate-400 mt-1">يرجى رفع المستند وإضافة بياناته بالأعلى.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                        {newCompanyDocs.map((d) => {
                          const formatConfig = 
                            d.type === 'pdf' ? { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200/60' } :
                            d.type === 'word' ? { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200/60' } :
                            { label: 'IMAGE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };

                          return (
                            <div 
                              key={d.id} 
                              className="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group text-right"
                            >
                              {/* Status accent strip */}
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

                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] border-t border-slate-150 pt-2.5 text-slate-600">
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">طبيعة المستند:</span>
                                    <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded text-[9px] inline-block mt-0.5">
                                      💼 وثيقة تصفية وأرشفة
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">حجم الملف:</span>
                                    <span className="font-mono font-bold text-slate-700 inline-block mt-1">
                                      💾 {d.storagePath ? 'سحابي معتمد' : '1.24 MB'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">تاريخ الرفع:</span>
                                    <span className="font-mono font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                                      📅 {d.uploadDate}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">الأمان:</span>
                                    <span className="font-bold text-emerald-600 block mt-0.5">
                                      🔒 مشفر تماماً
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 mt-3 pr-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewingFile({ id: d.id, name: d.name, type: d.type, category: 'وثيقة تصفية', size: 'من مسودة التصفية' })}
                                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-400 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer w-full text-center justify-center shadow-xs active:scale-95"
                                >
                                  👁️ عرض ومعاينة المستند
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCoDoc(d.id)}
                                  className="px-2.5 py-1.5 text-red-650 hover:bg-red-50 hover:text-red-755 text-[10px] font-bold rounded-lg transition-all border border-transparent hover:border-red-100 cursor-pointer shrink-0"
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
                    const tabs: ('basic' | 'partners' | 'archiving' | 'docs')[] = ['basic', 'partners', 'archiving', 'docs'];
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
                  onClick={() => {
                    setShowAddCompanyArchiveModal(false);
                    setNewCompanyPartners([]);
                    setNewCompanyDocs([]);
                    setActiveCompanyFormTab('basic');
                  }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs rounded-xl font-bold transition-all active:scale-95 cursor-pointer"
                >
                  إلغاء وتراجع
                </button>
              )}
            </div>

            {/* Left Side: Next, or Submit */}
            <div className="flex items-center gap-2.5">
              {activeCompanyFormTab !== 'docs' && (
                <button
                  type="button"
                  onClick={() => {
                    // Validation before proceeding
                    if (activeCompanyFormTab === 'basic') {
                      if (!newCompanyForm.name.trim()) {
                        alert('يرجى كتابة اسم الشركة التجاري بالكامل للمتابعة.');
                        return;
                      }
                      if (!newCompanyForm.commercialRegister.trim()) {
                        alert('يرجى كتابة رقم السجل التجاري والجهة للمتابعة.');
                        return;
                      }
                    }

                    const tabs: ('basic' | 'partners' | 'archiving' | 'docs')[] = ['basic', 'partners', 'archiving', 'docs'];
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

              {activeCompanyFormTab === 'docs' && (
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-xl font-black transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  حفظ وأرشفة تصفية الشركة رسمياً بالدفاتر
                </button>
              )}
            </div>
          </div>
        </form>
          </>
        )}
      </BaseModal>

      {/* نافذة الاطلاع ومعاينة المستند المرفق الفورية */}
      {previewingFile && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Header of Viewer */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="bg-amber-500 text-slate-950 rounded-lg p-1.5 font-bold">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs text-slate-100">معاين ومستعرض الأوراق المؤرشفة الفوري</h4>
                  <p className="text-[10px] text-amber-400 font-mono">نظام الفحص والأمان الرقمي للوثائق القانونية</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewingFile(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                title="إغلاق نافذة المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Body Area (Classic Egyptian Legal style layout) */}
            <div className="p-6 bg-slate-100 overflow-y-auto flex-1 flex flex-col items-center">
              <div className="bg-white w-full max-w-lg min-h-[500px] shadow-lg border-2 border-slate-300 rounded-lg p-8 relative flex flex-col justify-between font-sans text-right text-slate-800 leading-relaxed select-none">
                
                {/* Official watermarked background overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none rounded-lg" />
                
                {/* Large luxury diagonal stamp in middle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-dashed border-emerald-600/10 text-emerald-600/10 text-3xl font-black p-4 rounded-xl select-none pointer-events-none text-center">
                  مكتب الأستاذ عربي رميح<br/>
                  للأرشيف الإلكتروني المؤمّن
                </div>

                {/* Top Header of official legal paper */}
                <div className="border-b-2 border-double border-slate-400 pb-4 flex justify-between items-start">
                  <div className="text-right space-y-1">
                    <p className="text-[10.5px] font-extrabold text-slate-900">مؤسسة الأستاذ عربي رميح للمحاماة</p>
                    <p className="text-[9px] text-slate-500">نظام الإدارة الرقمية وسجلات التقاضي والأرشيف</p>
                    <p className="text-[8.5px] text-slate-400">محافظة الشرقية - جمهورية مصر العربية</p>
                  </div>
                  <div className="text-left space-y-1 font-mono text-[9px] text-slate-500">
                    <p>التاريخ: {toAr(new Date().toLocaleDateString('ar-EG'))}</p>
                    <p>حالة التدقيق: معتمد 🟢</p>
                  </div>
                </div>

                {/* Middle Content */}
                <div className="my-8 space-y-5 flex-1">
                  <div className="text-center space-y-1.5">
                    <span className="bg-amber-500/10 text-amber-700 text-[10px] px-3 py-1 rounded-full border border-amber-500/20 font-bold inline-block font-sans">
                      {previewingFile.category || 'مرفق الأرشيف الفني'}
                    </span>
                    <h3 className="text-sm font-black text-slate-900">مستند: {previewingFile.name}</h3>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3 text-[11px] text-slate-700">
                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="font-bold text-slate-950">اسم الملف الرقمي:</span>
                      <span className="font-mono text-slate-600">{previewingFile.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="font-bold text-slate-950">امتداد وتنسيق الملف:</span>
                      <span className="font-mono text-amber-700 font-extrabold">{previewingFile.type.toUpperCase()} File</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="font-bold text-slate-950">حجم الملف المستنتج:</span>
                      <span className="font-mono text-slate-600">{previewingFile.size || '380 KB'}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                      <span className="font-bold text-slate-950">مستوى السرية والخصوصية:</span>
                      <span className="text-emerald-700 font-bold">عالي السرية (مشفر بالكامل) 🔒</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed pt-1.5 text-center">
                      تم سحب هذا الملف ومعاينته بشكل فوري ومباشر من مسودة المعاملة قبل تصديره النهائي لخوادم الحفظ السحابي المحصنة.
                    </p>
                  </div>

                  {/* Simulated legal text visual block */}
                  <div className="space-y-2.5 pt-2">
                    <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
                    <div className="h-2 w-11/12 bg-slate-200 rounded animate-pulse" />
                    <div className="h-2 w-4/5 bg-slate-200 rounded animate-pulse" />
                    <div className="h-2 w-3/4 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>

                {/* Bottom Stamps and Signatures section */}
                <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-[10px]">
                  <div className="text-right space-y-1">
                    <p className="font-bold text-slate-700">توقيع المسؤول القانوني الفاحص:</p>
                    <p className="text-slate-500 font-serif italic text-xs pl-4">{currentUser.fullName}</p>
                    <p className="text-[8px] text-slate-400">({currentUser.title})</p>
                  </div>
                  {/* Visual Gold Approved Stamp */}
                  <div className="border-4 border-amber-600/40 text-amber-600 font-black px-3 py-1.5 rounded-full rotate-12 text-[9px] flex items-center gap-1 bg-amber-500/5 select-none font-sans">
                    <span>موافق ومؤرشف</span>
                    <span>✓</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Actions of Viewer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewingFile(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs py-2 px-5 rounded-xl font-bold transition-all cursor-pointer"
              >
                إغلاق نافذة المعاينة
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => alert('محاكاة: جاري تهيئة المستند للطباعة على طابعة الشبكة المحلية...')}
                  className="bg-slate-900 hover:bg-slate-850 text-white text-xs py-2 px-4 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer font-sans"
                >
                  <Printer className="w-4 h-4 text-amber-500" />
                  <span>طباعة فورية</span>
                </button>
                <button
                  type="button"
                  onClick={() => alert('محاكاة: تم تنزيل نسخة رقمية معتمدة من المستند بنجاح على جهازك.')}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs py-2 px-4 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer font-sans"
                >
                  <FileText className="w-4 h-4" />
                  <span>تنزيل الملف</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
